/**
 * LiveTranscriptionPanel
 *
 * Self-contained widget that lets the user dictate text in real time.
 * Shows a pulsing mic button, an inline transcript preview, and calls
 * `onCommit(text)` when the user stops recording so the caller can
 * append the text to their draft.
 *
 * Usage:
 *   <LiveTranscriptionPanel onCommit={(text) => setText(prev => prev + text)} />
 */

import { useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { useTranscription } from '../../hooks/useTranscription';

interface LiveTranscriptionPanelProps {
  /** Called once when the user stops recording; receives the full transcript. */
  onCommit: (text: string) => void;
  model?: string;
  className?: string;
}

export default function LiveTranscriptionPanel({
  onCommit,
  model = 'tiny.en',
  className = '',
}: LiveTranscriptionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { phase, liveText, committed, error, start, stop } = useTranscription({
    model,
    onFinished: onCommit,
  });

  const isStreaming = phase === 'streaming';
  const isBusy = phase === 'starting_server' || phase === 'connecting' || phase === 'finalizing';
  const hasContent = committed.length > 0 || liveText.length > 0;

  // Auto-scroll transcript window
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [committed, liveText]);

  const handleButtonClick = () => {
    if (isStreaming) {
      stop();
    } else if (!isBusy && phase !== 'error') {
      start();
    }
  };

  const statusLabel = (): string => {
    switch (phase) {
      case 'starting_server': return 'Starting transcription engine…';
      case 'connecting':      return 'Connecting…';
      case 'ready':           return 'Ready — click to speak';
      case 'streaming':       return 'Listening…';
      case 'finalizing':      return 'Finishing up…';
      case 'error':           return error ?? 'An error occurred';
      default:                return 'Click mic to start dictating';
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {/* Mic button + status */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleButtonClick}
          disabled={isBusy}
          aria-label={isStreaming ? 'Stop dictation' : 'Start dictation'}
          className={`
            relative flex items-center justify-center w-10 h-10 rounded-full
            transition-all duration-200 focus:outline-none focus-visible:ring-2
            focus-visible:ring-forest-500 focus-visible:ring-offset-2 disabled:cursor-wait
            ${isStreaming
              ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-200'
              : phase === 'error'
              ? 'bg-amber-100 text-amber-600 border border-amber-300'
              : 'bg-forest-600 hover:bg-forest-500 text-white disabled:opacity-50'}
          `}
        >
          {isBusy ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isStreaming ? (
            <>
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
              <MicOff size={18} />
            </>
          ) : phase === 'error' ? (
            <AlertCircle size={18} />
          ) : (
            <Mic size={18} />
          )}
        </button>

        <span className={`text-xs font-medium ${phase === 'error' ? 'text-amber-600' : 'text-graphite-500'}`}>
          {statusLabel()}
        </span>
      </div>

      {/* Live transcript preview */}
      {hasContent && (
        <div
          ref={scrollRef}
          className="max-h-32 overflow-y-auto rounded-lg bg-parchment-50 border border-mist-200 px-3 py-2 text-sm text-ink-900 leading-relaxed"
        >
          {committed.map((seg) => (
            <span key={seg.id} className="text-ink-800">
              {seg.text}{' '}
            </span>
          ))}
          {liveText && (
            <span className="text-graphite-400 italic">{liveText}</span>
          )}
        </div>
      )}

      {/* Dictation command hint */}
      {isStreaming && (
        <p className="text-[10px] text-graphite-400 leading-snug">
          Tip: say <span className="font-medium">"period"</span>,{' '}
          <span className="font-medium">"comma"</span>,{' '}
          <span className="font-medium">"new line"</span>, or{' '}
          <span className="font-medium">"new paragraph"</span> while speaking.
        </p>
      )}
    </div>
  );
}
