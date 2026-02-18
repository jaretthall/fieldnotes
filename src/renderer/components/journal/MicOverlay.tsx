import { useState, useEffect } from 'react';
import { Mic, Loader2, AlertCircle } from 'lucide-react';
import { useRecorderStore } from '../../stores/recorder.store';
import type { VoiceResult } from '../../../../shared/types';

interface MicOverlayProps {
  onVoiceResult?: (result: VoiceResult) => void;
  /** @deprecated Use onVoiceResult */
  onTranscription?: (text: string) => void;
}

export default function MicOverlay({ onVoiceResult, onTranscription }: MicOverlayProps) {
  const [whisperStatus, setWhisperStatus] = useState<{ ready: boolean; remediation: string } | null>(null);
  const status = useRecorderStore((s) => s.status);

  useEffect(() => {
    window.api.invoke('audio:checkWhisperStatus').then((s: { ready: boolean; remediation: string }) => {
      setWhisperStatus({ ready: s.ready, remediation: s.remediation });
    }).catch(() => setWhisperStatus({ ready: false, remediation: 'Could not check Whisper status.' }));
  }, []);
  const waveformData = useRecorderStore((s) => s.waveformData);
  const startRecording = useRecorderStore((s) => s.startRecording);
  const stopRecording = useRecorderStore((s) => s.stopRecording);

  const isRecording = status === 'recording';
  const isProcessing = status === 'processing' || status === 'transcribing';

  const handleClick = async () => {
    if (isRecording) {
      const result = await stopRecording();
      if (result) {
        if (onVoiceResult) {
          onVoiceResult(result);
        } else if (onTranscription && 'transcription' in result) {
          onTranscription(result.transcription);
        } else if (onTranscription && 'transcriptionUnavailable' in result) {
          onTranscription('[Voice entry — transcription unavailable. Audio saved.]');
        }
      }
    } else if (status === 'idle' || status === 'error') {
      await startRecording();
    }
  };

  return (
    <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50">
      {isRecording && (
        <div className="bg-[#1A1A2E] text-white px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl">
          <div className="flex gap-1 h-3 items-end">
            {waveformData.slice(0, 8).map((value, i) => (
              <div
                key={i}
                className="w-1 bg-[#D4A853] rounded-full animate-bounce"
                style={{
                  height: `${20 + (value || 0) * 80}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-sm font-mono font-medium">Recording...</span>
          <button
            type="button"
            onClick={handleClick}
            className="bg-white text-black px-4 py-1.5 rounded-full text-xs font-bold hover:bg-[#D4A853] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4A853] focus-visible:ring-offset-2"
          >
            STOP
          </button>
        </div>
      )}

      {!isRecording && (
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={handleClick}
            disabled={isProcessing}
            className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#2B5F3F] focus-visible:ring-offset-2 ${
              isProcessing ? 'bg-[#E8E5DD] cursor-not-allowed opacity-50' : 'bg-[#2B5F3F]'
            }`}
          >
            {isProcessing ? (
              <Loader2 className="text-white animate-spin" size={28} />
            ) : (
              <Mic className="text-white" size={28} />
            )}
          </button>
          {whisperStatus && !whisperStatus.ready && (
            <div className="flex items-center gap-1 text-[10px] text-amber-600 max-w-[200px] text-center" title={whisperStatus.remediation}>
              <AlertCircle size={10} />
              <span>Whisper not configured. Open Settings to install. Audio will still save.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
