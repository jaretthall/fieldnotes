import { create } from 'zustand';
import type { VoiceResult } from '../../../shared/types';

function audioLog(msg: string, meta?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    const prefix = '[Audio:renderer]';
    console.log(prefix, msg, meta ?? '');
  }
}

type RecorderStatus = 'idle' | 'recording' | 'processing' | 'transcribing' | 'error';

/**
 * Convert any browser-recorded audio Blob to a WAV ArrayBuffer.
 * Uses the built-in Web Audio API to decode and re-encode as 16-bit PCM WAV.
 * This guarantees Whisper CLI compatibility regardless of the browser's
 * MediaRecorder output format (typically WebM/Opus in Chromium).
 */
async function blobToWavArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new OfflineAudioContext(1, 1, 16000);
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = decoded;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();

  const pcm = rendered.getChannelData(0);
  const wavBuffer = encodeWav(pcm, sampleRate);
  return wavBuffer;
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

interface RecorderState {
  status: RecorderStatus;
  duration: number;
  error: string | null;
  audioPath: string | null;
  transcription: string | null;
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  intervalId: ReturnType<typeof setInterval> | null;
  _recordingId: string | null; // for IPC correlation, cleared on stop

  waveformData: number[];
  analyser: AnalyserNode | null;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<VoiceResult | null>;
  reset: () => void;
  setTranscription: (text: string) => void;
}

export const useRecorderStore = create<RecorderState>((set, get) => ({
  status: 'idle',
  duration: 0,
  error: null,
  audioPath: null,
  transcription: null,
  mediaRecorder: null,
  audioChunks: [],
  intervalId: null,
  _recordingId: null,
  waveformData: new Array(64).fill(0),
  analyser: null,

  startRecording: async () => {
    try {
      const { recordingId } = await window.api.invoke('audio:startRecording', 'wav') as { tempPath: string; recordingId: string };
      audioLog('start_requested', { recordingId, format: 'wav' });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioLog('mic_granted', { recordingId });

      // Set up audio analysis for waveform
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream);

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
        }
      };

      mediaRecorder.start(250); // Collect data every 250ms

      // Duration counter
      const intervalId = setInterval(() => {
        set((state) => ({ duration: state.duration + 1 }));

        // Update waveform data
        const currentAnalyser = get().analyser;
        if (currentAnalyser) {
          const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);
          currentAnalyser.getByteFrequencyData(dataArray);
          const normalized = Array.from(dataArray).map(v => v / 255);
          set({ waveformData: normalized });
        }
      }, 1000);

      // Also update waveform more frequently
      const animateWaveform = () => {
        const currentAnalyser = get().analyser;
        const currentStatus = get().status;
        if (currentAnalyser && currentStatus === 'recording') {
          const dataArray = new Uint8Array(currentAnalyser.frequencyBinCount);
          currentAnalyser.getByteFrequencyData(dataArray);
          const normalized = Array.from(dataArray).map(v => v / 255);
          set({ waveformData: normalized });
          requestAnimationFrame(animateWaveform);
        }
      };

      set({
        status: 'recording',
        duration: 0,
        error: null,
        mediaRecorder,
        audioChunks,
        intervalId,
        analyser,
        audioPath: null,
        transcription: null,
        _recordingId: recordingId, // internal, for stopRecording
      });

      requestAnimationFrame(animateWaveform);
    } catch (err) {
      audioLog('mic_permission', { error: (err as Error).message, remediation: 'Grant microphone access in browser/system settings.' });
      set({
        status: 'idle',
        error: `Microphone access denied: ${(err as Error).message}`,
      });
    }
  },

  stopRecording: async () => {
    const { mediaRecorder, intervalId, _recordingId } = get();

    if (intervalId) clearInterval(intervalId);

    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      set({ status: 'idle', _recordingId: null });
      return null;
    }

    const recordingId = _recordingId ?? 'unknown';
    set({ status: 'processing' });

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        const { audioChunks } = get();
        const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'application/octet-stream' });

        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        audioLog('converting_to_wav', { recordingId, originalType: audioBlob.type, originalSize: audioBlob.size });
        const arrayBuffer = await blobToWavArrayBuffer(audioBlob);
        audioLog('bytes_captured', { recordingId, sizeBytes: arrayBuffer.byteLength, format: 'wav' });

        try {
          const result = await window.api.invoke('audio:stopRecording', arrayBuffer, recordingId) as {
            audioPath: string;
            duration: number;
          };

          set({
            status: 'transcribing',
            audioPath: result.audioPath,
          });

          try {
            const transcription = await window.api.invoke('audio:transcribe', result.audioPath, recordingId) as {
              text: string;
            };

            set({
              status: 'idle',
              transcription: transcription.text,
              _recordingId: null,
            });

            resolve({ transcription: transcription.text });
          } catch (transcribeErr) {
            set({
              status: 'idle',
              error: `Transcription failed: ${(transcribeErr as Error).message}. Audio saved.`,
              _recordingId: null,
            });
            resolve({
              transcriptionUnavailable: true as const,
              audioPath: result.audioPath,
              duration: result.duration,
            });
          }
        } catch (err) {
          set({
            status: 'idle',
            error: `Failed to save audio: ${(err as Error).message}`,
            _recordingId: null,
          });
          resolve(null);
        }
      };

      mediaRecorder.stop();
    });
  },

  reset: () => {
    const { intervalId, mediaRecorder } = get();
    if (intervalId) clearInterval(intervalId);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      mediaRecorder.stop();
    }
    set({
      status: 'idle',
      duration: 0,
      error: null,
      audioPath: null,
      transcription: null,
      mediaRecorder: null,
      audioChunks: [],
      intervalId: null,
      _recordingId: null,
      waveformData: new Array(64).fill(0),
      analyser: null,
    });
  },

  setTranscription: (text: string) => {
    set({ transcription: text });
  },
}));
