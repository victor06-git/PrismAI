/**
 * audio-capture-worklet.js
 *
 * Runs on the audio rendering thread (AudioWorkletGlobalScope), not the
 * main thread. Its only job is continuously handing mono Float32 PCM
 * samples back to useLiveAudioStream.ts via the message port — all the
 * actual buffering / VAD / segment-cutting / WAV-encoding logic lives on
 * the main thread. This file stays tiny and dumb on purpose: anything slow
 * here risks audible glitches.
 *
 * Render quanta arrive 128 samples at a time (a few ms). Posting a message
 * per quantum would mean hundreds of postMessage calls per second, so they're
 * batched into ~2048-sample (~40-45ms) chunks before being posted — still
 * far finer-grained than anything VAD needs, but with much less main-thread
 * message-passing overhead. The buffer is transferred (not copied) on post.
 */
const FLUSH_SIZE = 2048;

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._parts = [];
    this._bufferedLength = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      this._parts.push(channel.slice());
      this._bufferedLength += channel.length;

      if (this._bufferedLength >= FLUSH_SIZE) {
        const merged = new Float32Array(this._bufferedLength);
        let offset = 0;
        for (const part of this._parts) {
          merged.set(part, offset);
          offset += part.length;
        }
        this.port.postMessage(merged, [merged.buffer]);
        this._parts = [];
        this._bufferedLength = 0;
      }
    }
    return true; // keep the processor alive for the life of the node
  }
}

registerProcessor("capture-processor", CaptureProcessor);
