// Browser-side audio handling. Everything is converted to 16 kHz mono and cut
// into pieces of about a minute, which are small enough to send for transcription.

import { CHUNK_SECONDS, MAX_CHUNK_SECONDS, MIN_CHUNK_SECONDS } from '@shared/lectures';

export const SAMPLE_RATE = 16_000;

/** Where a piece may end, in seconds. Tests use much shorter pieces. */
export interface PieceLimits { min: number; target: number; max: number }
export const DEFAULT_LIMITS: PieceLimits = { min: MIN_CHUNK_SECONDS, target: CHUNK_SECONDS, max: MAX_CHUNK_SECONDS };

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

/**
 * Where to end a piece: the middle of the quietest short window between
 * `limits.min` and `limits.max` seconds, so a cut lands in a pause rather than
 * mid-word. Among equally quiet windows, the one nearest `limits.target` wins.
 * Returns a sample index. Audio shorter than `limits.max` is not cut.
 */
export const quietCut = (samples: Float32Array, rate = SAMPLE_RATE, limits: PieceLimits = DEFAULT_LIMITS, windowSec = 0.3): number => {
  const max = Math.floor(limits.max * rate);
  if (samples.length <= max) return samples.length;
  const min = Math.floor(limits.min * rate);
  const target = limits.target * rate;
  const win = Math.max(1, Math.floor(windowSec * rate));
  const hop = Math.max(1, Math.floor(win / 6));
  // Running sum of squares over [min - win/2, max + win/2].
  const from = Math.max(0, min - (win >> 1));
  const to = Math.min(samples.length, max + (win >> 1));
  const prefix = new Float64Array(to - from + 1);
  for (let i = from; i < to; i++) prefix[i - from + 1] = prefix[i - from] + samples[i] * samples[i];
  const centres: number[] = [];
  const energies: number[] = [];
  let quietest = Infinity;
  for (let centre = min; centre <= max; centre += hop) {
    const a = Math.max(from, centre - (win >> 1));
    const b = Math.min(to, a + win);
    const energy = (prefix[b - from] - prefix[a - from]) / Math.max(1, b - a);
    centres.push(centre);
    energies.push(energy);
    if (energy < quietest) quietest = energy;
  }
  // Windows within 1% of the quietest count as equally quiet (e.g. a long pause, or a steady tone).
  const limit = quietest * 1.01 + 1e-10;
  let best = -1;
  for (let i = 0; i < centres.length; i++) {
    if (energies[i] <= limit && (best < 0 || Math.abs(centres[i] - target) < Math.abs(best - target))) best = centres[i];
  }
  if (best < 0) best = max;
  return best;
};

/** Cut a whole recording into pieces that end at quiet moments. */
export const splitAtQuietPoints = (samples: Float32Array, rate = SAMPLE_RATE, limits: PieceLimits = DEFAULT_LIMITS) => {
  const pieces: { start: number; samples: Float32Array }[] = [];
  let offset = 0;
  while (offset < samples.length) {
    const rest = samples.subarray(offset);
    const cut = quietCut(rest, rate, limits);
    pieces.push({ start: offset / rate, samples: rest.subarray(0, cut) });
    offset += cut;
  }
  return pieces;
};

/** Fixed-length pieces (kept for callers that want hard cuts). */
export const splitIntoChunks = (samples: Float32Array, rate = SAMPLE_RATE, seconds = CHUNK_SECONDS): Float32Array[] => {
  const size = rate * seconds;
  const chunks: Float32Array[] = [];
  for (let i = 0; i < samples.length; i += size) chunks.push(samples.subarray(i, Math.min(samples.length, i + size)));
  return chunks;
};

/** Audio is stored as 16-bit PCM: half the size of floats, and exactly what goes into the WAV. */
export const toPcm16 = (samples: Float32Array): Int16Array => {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

export const fromPcm16 = (pcm: Int16Array): Float32Array => {
  const out = new Float32Array(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = pcm[i] / (pcm[i] < 0 ? 0x8000 : 0x7fff);
  return out;
};

/** 16-bit PCM WAV. */
export const encodeWav = (samples: Float32Array | Int16Array, rate = SAMPLE_RATE): Uint8Array => {
  const pcm = samples instanceof Int16Array ? samples : toPcm16(samples);
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const text = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  text(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
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
  view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) view.setInt16(44 + i * 2, pcm[i], true);
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
  /** A finished piece (16 kHz mono) and when it started, in seconds of recorded audio. */
  onChunk: (samples: Float32Array, startSec: number) => void;
  /**
   * The audio recorded since the last piece, sent every few seconds so it can be
   * saved. If the tab is closed, at most these few seconds are lost.
   */
  onCheckpoint?: (samples: Float32Array, startSec: number) => void;
  onLevel?: (level: number) => void;
  /** The microphone stopped (unplugged, taken by another app, or stopped by the browser). */
  onEnded?: () => void;
  limits?: PieceLimits;
  /** Seconds of audio between checkpoints. */
  checkpointEvery?: number;
}

/** Live microphone recorder that emits pieces of about a minute while recording continues. */
export class LiveRecorder {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  private buffers: Float32Array[] = [];
  private buffered = 0;
  private sinceCheckpoint = 0;
  private emittedSec = 0;
  private rate = 48_000;
  private limits: PieceLimits;
  /** When the last batch of samples arrived (ms, performance.now()). */
  lastFrameAt = 0;

  constructor(private events: RecorderEvents) {
    this.limits = events.limits ?? DEFAULT_LIMITS;
  }

  get elapsed(): number { return this.emittedSec + this.buffered / this.rate; }
  get state(): AudioContextState | 'closed' { return this.ctx?.state ?? 'closed'; }
  get micLive(): boolean { return this.stream?.getAudioTracks().some((t) => t.readyState === 'live') ?? false; }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    this.stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => this.events.onEnded?.()));
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
    this.lastFrameAt = performance.now();
  }

  private push(frame: Float32Array) {
    this.lastFrameAt = performance.now();
    this.buffers.push(frame);
    this.buffered += frame.length;
    this.sinceCheckpoint += frame.length;
    this.events.onLevel?.(Math.min(1, rms(frame) * 8));
    if (this.buffered >= this.rate * this.limits.max) this.cut();
    else if (this.events.onCheckpoint && this.sinceCheckpoint >= this.rate * (this.events.checkpointEvery ?? 5)) this.checkpoint();
  }

  private joined(): Float32Array {
    if (this.buffers.length === 1) return this.buffers[0];
    const raw = new Float32Array(this.buffered);
    let offset = 0;
    for (const b of this.buffers) { raw.set(b, offset); offset += b.length; }
    this.buffers = [raw];
    return raw;
  }

  private checkpoint() {
    this.sinceCheckpoint = 0;
    if (this.buffered) this.events.onCheckpoint?.(downsample(this.joined(), this.rate), this.emittedSec);
  }

  /** Emit everything up to the quietest moment between min and max; keep the rest. */
  private cut() {
    const raw = this.joined();
    const at = quietCut(raw, this.rate, this.limits);
    this.emit(raw.subarray(0, at));
    const rest = raw.slice(at);
    this.buffers = rest.length ? [rest] : [];
    this.buffered = rest.length;
    this.checkpoint();
  }

  private emit(raw: Float32Array) {
    if (!raw.length) return;
    const start = this.emittedSec;
    this.emittedSec += raw.length / this.rate;
    this.events.onChunk(downsample(raw, this.rate), start);
  }

  async pause() { await this.ctx?.suspend(); }
  async resume() { await this.ctx?.resume(); }

  /** Stop and emit whatever is left. */
  async stop() {
    if (this.buffered) this.emit(this.joined());
    this.buffers = [];
    this.buffered = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.node?.disconnect();
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
