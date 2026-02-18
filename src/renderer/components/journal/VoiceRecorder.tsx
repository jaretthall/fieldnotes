import { useState, useEffect } from 'react';
import { useRecorderStore } from '../../stores/recorder.store';
import type { VoiceResult } from '../../../../shared/types';

interface VoiceRecorderProps {
  onTranscription?: (text: string) => void;
  onVoiceResult?: (result: VoiceResult) => void;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const FALLBACK_PLACEHOLDER = '[Voice entry — transcription unavailable. Audio saved.]';

export default function VoiceRecorder({ onTranscription, onVoiceResult, compact = false }: VoiceRecorderProps) {
  const [whisperStatus, setWhisperStatus] = useState<{ ready: boolean; remediation: string } | null>(null);
  const status = useRecorderStore((s) => s.status);

  useEffect(() => {
    if (compact) return;
    window.api.invoke('audio:checkWhisperStatus').then((s: { ready: boolean; remediation: string }) => {
      setWhisperStatus({ ready: s.ready, remediation: s.remediation });
    }).catch(() => setWhisperStatus({ ready: false, remediation: 'Could not check Whisper status.' }));
  }, [compact]);
  const duration = useRecorderStore((s) => s.duration);
  const error = useRecorderStore((s) => s.error);
  const waveformData = useRecorderStore((s) => s.waveformData);
  const startRecording = useRecorderStore((s) => s.startRecording);
  const stopRecording = useRecorderStore((s) => s.stopRecording);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'transcribing';

  const handleToggle = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        if (onVoiceResult) {
          onVoiceResult(result);
        } else if (onTranscription) {
          const text = 'transcription' in result ? result.transcription : FALLBACK_PLACEHOLDER;
          onTranscription(text);
        }
      }
    } else if (status === 'idle' || status === 'error') {
      await startRecording();
    }
  };

  if (compact) {
    return (
      <button
        onClick={handleToggle}
        disabled={isProcessing}
        className={`
          w-8 h-8 rounded-full flex items-center justify-center
          transition-all duration-200
          ${isRecording
            ? 'bg-red-500 text-white animate-recorder-pulse hover:bg-red-600'
            : isProcessing
              ? 'bg-graphite-400 text-white cursor-wait'
              : 'bg-forest-600 text-white hover:bg-forest-500 hover:scale-105 shadow-sm shadow-forest-600/25'
          }
        `}
        title={isRecording ? 'Stop recording' : isProcessing ? 'Processing...' : 'Record voice entry'}
      >
        {isRecording ? (
          <StopIcon className="w-3.5 h-3.5" />
        ) : isProcessing ? (
          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <MicIcon className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main record button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isProcessing}
        className={`
          w-16 h-16 rounded-full flex items-center justify-center
          transition-all duration-200 shadow-lg cursor-pointer
          focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500 focus-visible:ring-offset-2
          border-0
          ${isRecording
            ? 'bg-red-500 text-white animate-recorder-pulse shadow-red-500/25'
            : isProcessing
              ? 'bg-graphite-400 text-white cursor-wait shadow-graphite-400/25'
              : 'bg-forest-600 text-white hover:bg-forest-500 hover:scale-105 shadow-forest-600/25'
          }
        `}
        style={{ boxShadow: isRecording ? undefined : '0 4px 14px rgba(43, 95, 63, 0.25)' }}
      >
        {isRecording ? (
          <StopIcon className="w-6 h-6" />
        ) : isProcessing ? (
          <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <MicIcon className="w-7 h-7" />
        )}
      </button>

      {/* Duration & status */}
      {(isRecording || isProcessing) && (
        <div className="text-center">
          {isRecording && (
            <>
              <p className="text-lg font-mono text-ink-900 font-medium">
                {formatDuration(duration)}
              </p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-graphite-500">Recording</span>
              </div>
            </>
          )}
          {status === 'processing' && (
            <p className="text-sm text-graphite-500">Saving audio...</p>
          )}
          {status === 'transcribing' && (
            <p className="text-sm text-graphite-500">Transcribing...</p>
          )}
        </div>
      )}

      {/* Waveform visualization */}
      {isRecording && (
        <div className="flex items-end gap-0.5 h-12 px-4">
          {waveformData.slice(0, 32).map((value, i) => (
            <div
              key={i}
              className="w-1 bg-forest-600 rounded-full transition-all duration-75"
              style={{
                height: `${Math.max(4, value * 48)}px`,
                opacity: 0.5 + value * 0.5,
              }}
            />
          ))}
        </div>
      )}

      {/* Duration warning */}
      {isRecording && duration >= 600 && (
        <p className="text-xs text-gold-600 bg-gold-500/10 px-3 py-1 rounded-full">
          Still recording. Take your time.
        </p>
      )}

      {/* Whisper status (non-compact only) */}
      {!compact && whisperStatus && !whisperStatus.ready && (
        <p className="text-xs text-amber-600 max-w-sm text-center" title={whisperStatus.remediation}>
          Whisper not configured. Open Settings to install. Audio will still save.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg max-w-sm text-center">
          {error}
        </p>
      )}
    </div>
  );
}

// Icons
function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}
