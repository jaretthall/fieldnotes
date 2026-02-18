/**
 * TranscriptionService
 *
 * Owns the WebSocket connection to the Python faster-whisper server,
 * feeds it PCM chunks from AudioCaptureService, and fires typed callbacks
 * for partial and final transcription segments.
 *
 * Lifecycle:
 *   connect(wsUrl, model) → start streaming → stop() → disconnect()
 */

import { audioCaptureService } from './audio-capture';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PartialSegment {
  type: 'partial';
  id: number;
  text: string;
}

export interface FinalSegment {
  type: 'final';
  id: number;
  text: string;
}

export type TranscriptionSegment = PartialSegment | FinalSegment;

export interface TranscriptionCallbacks {
  onPartial?: (segment: PartialSegment) => void;
  onFinal?: (segment: FinalSegment) => void;
  onReady?: (model: string) => void;
  onError?: (message: string) => void;
  onDisconnected?: () => void;
}

export type ServiceStatus =
  | 'disconnected'
  | 'connecting'
  | 'ready'
  | 'streaming'
  | 'stopping'
  | 'error';

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let _ws: WebSocket | null = null;
let _status: ServiceStatus = 'disconnected';
let _callbacks: TranscriptionCallbacks = {};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(s: ServiceStatus): void {
  _status = s;
}

function sendJson(payload: unknown): void {
  if (_ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(JSON.stringify(payload));
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const transcriptionService = {
  get status(): ServiceStatus {
    return _status;
  },

  /**
   * Connect to the Python WebSocket server and tell it which model to use.
   * Does nothing if already connected.
   */
  connect(wsUrl: string, model = 'tiny.en', callbacks: TranscriptionCallbacks = {}): void {
    if (_ws && _ws.readyState === WebSocket.OPEN) return;

    _callbacks = callbacks;
    setStatus('connecting');

    _ws = new WebSocket(wsUrl);

    _ws.onopen = () => {
      sendJson({ type: 'start', model });
    };

    _ws.onmessage = (evt) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(evt.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      const msgType = msg['type'];

      if (msgType === 'status') {
        if (msg['ready']) {
          setStatus('ready');
          _callbacks.onReady?.(msg['model'] as string);
        } else {
          setStatus('disconnected');
          _callbacks.onDisconnected?.();
        }
      } else if (msgType === 'partial') {
        const seg: PartialSegment = {
          type: 'partial',
          id: msg['id'] as number,
          text: msg['text'] as string,
        };
        _callbacks.onPartial?.(seg);
      } else if (msgType === 'final') {
        const seg: FinalSegment = {
          type: 'final',
          id: msg['id'] as number,
          text: msg['text'] as string,
        };
        _callbacks.onFinal?.(seg);
      } else if (msgType === 'error') {
        _callbacks.onError?.(msg['message'] as string);
      }
    };

    _ws.onerror = () => {
      setStatus('error');
      _callbacks.onError?.('WebSocket connection error');
    };

    _ws.onclose = () => {
      if (_status !== 'stopping') {
        setStatus('error');
        _callbacks.onError?.('WebSocket connection lost');
      } else {
        setStatus('disconnected');
        _callbacks.onDisconnected?.();
      }
      _ws = null;
    };
  },

  /** Begin streaming microphone audio to the server. */
  async startStreaming(): Promise<void> {
    if (_status !== 'ready') {
      throw new Error(`Cannot start streaming in status "${_status}"`);
    }

    setStatus('streaming');

    await audioCaptureService.start((chunk: Int16Array) => {
      if (_ws && _ws.readyState === WebSocket.OPEN) {
        // Convert Int16Array → base64 string
        const bytes = new Uint8Array(chunk.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const b64 = btoa(binary);
        sendJson({ type: 'audio', data: b64 });
      }
    });
  },

  /** Stop streaming audio but keep the WebSocket open. */
  stopStreaming(): void {
    audioCaptureService.stop();
    sendJson({ type: 'stop' });
    if (_status === 'streaming') setStatus('ready');
  },

  /** Disconnect entirely and clean up. */
  disconnect(): void {
    audioCaptureService.stop();
    setStatus('stopping');
    if (_ws) {
      sendJson({ type: 'stop' });
      _ws.close();
      _ws = null;
    }
    setStatus('disconnected');
    _callbacks = {};
  },
};
