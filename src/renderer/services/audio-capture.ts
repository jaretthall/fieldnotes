/**
 * AudioCaptureService
 *
 * Captures microphone audio at 16 kHz (mono) using an AudioWorklet and
 * emits 16-bit PCM Int16Array chunks to a caller-supplied callback.
 *
 * Why AudioWorklet?
 *   - Runs in a dedicated audio-rendering thread; no main-thread jitter.
 *   - Consistent 512-sample chunks that the Python VAD/Whisper expects.
 *   - Survives React re-renders and state changes without data loss.
 */

// Vite resolves this import at build time; the ?url suffix returns the
// URL to the bundled worker file so AudioContext.addModule() can load it.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – Vite ?url import
import pcmProcessorUrl from '../workers/pcm-processor.js?url';

export type PcmChunkHandler = (chunk: Int16Array) => void;

export interface AudioCaptureService {
  /** Start capturing. Resolves when the first chunk is ready to stream. */
  start(onChunk: PcmChunkHandler): Promise<void>;
  /** Stop capturing and release all resources. */
  stop(): void;
  /** True while the microphone stream is open. */
  readonly isRunning: boolean;
}

interface InternalState {
  context: AudioContext;
  source: MediaStreamAudioSourceNode;
  worklet: AudioWorkletNode;
  stream: MediaStream;
}

let _state: InternalState | null = null;

export const audioCaptureService: AudioCaptureService = {
  get isRunning() {
    return _state !== null;
  },

  async start(onChunk: PcmChunkHandler): Promise<void> {
    if (_state) this.stop(); // clean up any stale session

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16_000,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Create an AudioContext at 16 kHz so the worklet already receives 16 kHz
    // samples and we avoid any resampling.
    const context = new AudioContext({ sampleRate: 16_000 });

    await context.audioWorklet.addModule(pcmProcessorUrl);

    const source = context.createMediaStreamSource(stream);
    const worklet = new AudioWorkletNode(context, 'pcm-processor');

    worklet.port.onmessage = (event: MessageEvent<{ type: string; buffer: ArrayBuffer }>) => {
      if (event.data.type === 'chunk') {
        onChunk(new Int16Array(event.data.buffer));
      }
    };

    source.connect(worklet);
    // Do NOT connect worklet to context.destination – we don't want mic playback

    _state = { context, source, worklet, stream };
  },

  stop(): void {
    if (!_state) return;
    const { context, worklet, source, stream } = _state;
    worklet.port.close();
    source.disconnect();
    worklet.disconnect();
    stream.getTracks().forEach((t) => t.stop());
    void context.close();
    _state = null;
  },
};
