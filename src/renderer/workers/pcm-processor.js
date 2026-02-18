/**
 * PCM Processor – AudioWorklet
 *
 * Runs in the dedicated audio rendering thread.
 * Converts float32 samples to 16-bit PCM integers and posts them to the main
 * thread in 512-sample chunks (32 ms at 16 kHz), matching what the Python
 * WebSocket server expects.
 *
 * Messages sent to the main thread:
 *   { type: 'chunk', buffer: ArrayBuffer }   – 512 * 2 bytes of 16-bit PCM
 */

const CHUNK_SAMPLES = 512;

class PcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buf = new Float32Array(CHUNK_SAMPLES);
    this._filled = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    const channel = input[0]; // mono

    let i = 0;
    while (i < channel.length) {
      const space = CHUNK_SAMPLES - this._filled;
      const take = Math.min(space, channel.length - i);
      this._buf.set(channel.subarray(i, i + take), this._filled);
      this._filled += take;
      i += take;

      if (this._filled === CHUNK_SAMPLES) {
        // Convert Float32 → Int16
        const out = new Int16Array(CHUNK_SAMPLES);
        for (let j = 0; j < CHUNK_SAMPLES; j++) {
          const s = Math.max(-1, Math.min(1, this._buf[j]));
          out[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        // Transfer ownership for zero-copy
        this.port.postMessage({ type: 'chunk', buffer: out.buffer }, [out.buffer]);
        this._filled = 0;
      }
    }

    return true; // keep processor alive
  }
}

registerProcessor('pcm-processor', PcmProcessor);
