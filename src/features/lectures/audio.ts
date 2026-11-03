// Browser-side audio handling. Everything is converted to 16 kHz mono and cut
// into one-minute pieces, which are small enough to send for transcription.

import { CHUNK_SECONDS } from '@shared/lectures';

export const SAMPLE_RATE = 16_000;

/** Average-based downsampling — good enough for speech. */
export const downsample = (input: Float32Array, fromRate: number, toRate = SAMPLE_RATE): Float32Array => {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
};

export const rms = (samples: Float32Array): number => {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / Math.max(1, samples.length));
};

/** Pieces that are basically silence are skipped instead of sent to the AI. */
export const isSilent = (samples: Float32Array) => rms(samples) < 0.002;

export const splitIntoChunks = (samples: Float32Array, rate = SAMPLE_RATE, seconds = CHUNK_SECONDS): Float32Array[] => {
  const size = rate * seconds;
  const chunks: Float32Array[] = [];
  for (let i = 0; i < samples.length; i += size) chunks.push(samples.subarray(i, Math.min(samples.length, i + size)));
  return chunks;
};

/** 16-bit PCM WAV. */
export const encodeWav = (samples: Float32Array, rate = SAMPLE_RATE): Uint8Array => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buffer);
};

export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};

export const formatTime = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** Decode an audio or video file to 16 kHz mono. The browser does the resampling. */
export const decodeFile = async (file: Blob): Promise<Float32Array> => {
  const data = await file.arrayBuffer();
  const Offline = window.OfflineAudioContext
    ?? (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  const ctx = new Offline(1, SAMPLE_RATE, SAMPLE_RATE);
  const audio = await ctx.decodeAudioData(data);
  if (audio.numberOfChannels === 1) return audio.getChannelData(0);
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / audio.numberOfChannels;
  }
  return out;
};

// Collects microphone samples off the main thread and posts them in batches.
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(4096); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('bw-capture', Capture);
`;

export interface RecorderEvents {
  /** A finished one-minute piece (16 kHz mono) and when it started, in seconds. */
  onChunk: (samples: Float32Array, startSec: number) => void;
  onLevel?: (level: number) => void;
}

/** Live microphone recorder that emits one-minute pieces while recording continues. */
export class LiveRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private buffers: Float32Array[] = [];
  private buffered = 0;
  private emittedSec = 0;
  private rate = 48_000;

  constructor(private events: RecorderEvents) {}

  get elapsed(): number { return this.emittedSec + this.buffered / this.rate; }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.ctx = new AudioContext();
    this.rate = this.ctx.sampleRate;
    const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
    await this.ctx.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);
    this.node = new AudioWorkletNode(this.ctx, 'bw-capture');
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => this.push(e.data);
    const source = this.ctx.createMediaStreamSource(this.stream);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    source.connect(this.node).connect(mute).connect(this.ctx.destination);
  }

  private push(frame: Float32Array) {
    this.buffers.push(frame);
    this.buffered += frame.length;
    this.events.onLevel?.(Math.min(1, rms(frame) * 8));
    if (this.buffered >= this.rate * CHUNK_SECONDS) this.flush();
  }

  private flush() {
    if (!this.buffered) return;
    const raw = new Float32Array(this.buffered);
    let offset = 0;
    for (const b of this.buffers) { raw.set(b, offset); offset += b.length; }
    const start = this.emittedSec;
    this.emittedSec += this.buffered / this.rate;
    this.buffers = [];
    this.buffered = 0;
    this.events.onChunk(downsample(raw, this.rate), start);
  }

  async pause() { await this.ctx?.suspend(); }
  async resume() { await this.ctx?.resume(); }

  /** Stop and emit whatever is left. */
  async stop() {
    this.flush();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
