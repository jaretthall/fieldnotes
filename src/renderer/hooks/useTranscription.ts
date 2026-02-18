/**
 * useTranscription
 *
 * React hook that owns the full real-time transcription lifecycle:
 *   1. Asks Electron for the WebSocket URL (starts Python server if needed).
 *   2. Connects the TranscriptionService.
 *   3. Exposes start/stop controls and live text for the UI.
 *
 * Returned `liveText`  – the running partial transcript (updates ~every 500 ms).
 * Returned `committed` – array of finalized sentence-level segments.
 *
 * On `stop()`, the last partial is also converted to a final segment and the
 * hook calls the optional `onFinished(fullText)` callback with the complete
 * joined transcript so the composer can append it.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { transcriptionService } from '../services/transcription-service';
import type { FinalSegment } from '../services/transcription-service';

export type TranscriptionPhase =
  | 'idle'
  | 'starting_server'
  | 'connecting'
  | 'ready'
  | 'streaming'
  | 'finalizing'
  | 'error';

export interface UseTranscriptionOptions {
  model?: string;
  onFinished?: (text: string) => void;
}

export interface UseTranscriptionReturn {
  phase: TranscriptionPhase;
  liveText: string;
  committed: FinalSegment[];
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Dictation post-processor
// ---------------------------------------------------------------------------

/**
 * Normalises raw Whisper output from a dictation session.
 *   - Trims leading/trailing whitespace.
 *   - Capitalises the first letter of each final segment.
 *   - Applies basic spoken punctuation commands:
 *       "period" / "full stop" → .
 *       "comma"                → ,
 *       "question mark"        → ?
 *       "exclamation mark"     → !
 *       "new line" / "newline" → \n
 *       "new paragraph"        → \n\n
 */
function applyDictationCommands(text: string): string {
  return text
    .replace(/\bperiod\b/gi, '.')
    .replace(/\bfull stop\b/gi, '.')
    .replace(/\bcomma\b/gi, ',')
    .replace(/\bquestion mark\b/gi, '?')
    .replace(/\bexclamation mark\b/gi, '!')
    .replace(/\bnew paragraph\b/gi, '\n\n')
    .replace(/\bnew line\b/gi, '\n')
    .replace(/\bnewline\b/gi, '\n')
    .trim();
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function buildFullText(segments: FinalSegment[], partial: string): string {
  const parts = segments.map((s) => s.text);
  if (partial) parts.push(partial);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTranscription(options: UseTranscriptionOptions = {}): UseTranscriptionReturn {
  const { model = 'tiny.en', onFinished } = options;

  const [phase, setPhase] = useState<TranscriptionPhase>('idle');
  const [liveText, setLiveText] = useState('');
  const [committed, setCommitted] = useState<FinalSegment[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Refs so callbacks don't capture stale state
  const committedRef = useRef<FinalSegment[]>([]);
  const liveRef = useRef('');
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  // Clean up on unmount
  useEffect(() => {
    return () => {
      transcriptionService.disconnect();
    };
  }, []);

  const reset = useCallback(() => {
    transcriptionService.disconnect();
    setPhase('idle');
    setLiveText('');
    setCommitted([]);
    committedRef.current = [];
    liveRef.current = '';
    setError(null);
  }, []);

  const start = useCallback(async () => {
    reset();

    try {
      // Step 1: ask Electron to start the Python server and get the WS URL
      setPhase('starting_server');
      const state = await window.api.invoke('realtime:start') as { wsUrl: string | null; error: string | null; status: string };

      if (!state.wsUrl) {
        throw new Error(state.error ?? 'Python server did not start');
      }

      // Step 2: connect the WebSocket
      setPhase('connecting');

      await new Promise<void>((resolve, reject) => {
        transcriptionService.connect(state.wsUrl!, model, {
          onReady: () => {
            setPhase('ready');
            resolve();
          },
          onPartial: (seg) => {
            const cleaned = applyDictationCommands(seg.text);
            liveRef.current = cleaned;
            setLiveText(cleaned);
          },
          onFinal: (seg) => {
            const cleaned = capitalize(applyDictationCommands(seg.text));
            const withId: FinalSegment = { ...seg, text: cleaned };
            committedRef.current = [...committedRef.current, withId];
            setCommitted([...committedRef.current]);
            liveRef.current = '';
            setLiveText('');
          },
          onError: (msg) => {
            setError(msg);
            setPhase('error');
            reject(new Error(msg));
          },
          onDisconnected: () => {
            if (phase !== 'finalizing') setPhase('idle');
          },
        });

        // Bail out after 10 s if we never get 'ready'
        setTimeout(() => reject(new Error('Timed out waiting for transcription server')), 10_000);
      });

      // Step 3: start streaming mic audio
      setPhase('streaming');
      await transcriptionService.startStreaming();

    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }, [model, reset, phase]);

  const stop = useCallback(() => {
    setPhase('finalizing');
    transcriptionService.stopStreaming();

    // Give the server ~1 s to emit its final segment, then close
    setTimeout(() => {
      transcriptionService.disconnect();
      const fullText = buildFullText(committedRef.current, liveRef.current);
      onFinishedRef.current?.(fullText);
      setLiveText('');
      setPhase('idle');
    }, 1_200);
  }, []);

  return { phase, liveText, committed, error, start, stop, reset };
}
