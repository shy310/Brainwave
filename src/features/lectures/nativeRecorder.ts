// In the Android app, lectures are recorded by a native foreground service
// (android/…/recorder/RecorderService.java), so recording continues with the
// screen off. The service writes finished pieces to app storage; this module
// moves each one into the same local queue as the web recorder (IndexedDB),
// and deletes the native file only after it is saved there.

import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { isNativeApp } from '@/lib/platform';
import { fromPcm16, type PieceLimits } from './audio';

export interface NativeItem { name: string; start: number; duration: number; tail: boolean }

interface LectureRecorderPlugin {
  start(o: { sessionId: string; title?: string; limits?: PieceLimits }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  status(): Promise<{ recording: boolean; paused: boolean; sessionId: string | null; elapsed: number; level: number }>;
  list(o: { sessionId: string }): Promise<{ items: NativeItem[] }>;
  read(o: { sessionId: string; name: string }): Promise<{ data: string }>;
  remove(o: { sessionId: string; name: string }): Promise<void>;
  addListener(event: 'segment', fn: (e: { sessionId: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'stopped', fn: (e: { sessionId: string; error?: string }) => void): Promise<PluginListenerHandle>;
}

const plugin = registerPlugin<LectureRecorderPlugin>('LectureRecorder');

export const nativeRecorderAvailable = () => isNativeApp();

const base64ToPcm16 = (b64: string): Int16Array => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.length >> 1);
};

type OnPiece = (samples: Float32Array, start: number) => Promise<void> | void;

/**
 * Move every saved native piece of a session into the web queue, oldest
 * first. A file is deleted only after `onPiece` resolved (it is saved).
 */
export const drainNative = async (sessionId: string, onPiece: OnPiece) => {
  const { items } = await plugin.list({ sessionId });
  for (const item of items) {
    const { data } = await plugin.read({ sessionId, name: item.name });
    await onPiece(fromPcm16(base64ToPcm16(data)), item.start);
    await plugin.remove({ sessionId, name: item.name });
  }
};

/**
 * After the app was closed or crashed: stop a recording of this session that
 * may still be running, then move everything it saved into the queue.
 */
export const recoverNative = async (sessionId: string, onPiece: OnPiece) => {
  if (!isNativeApp()) return;
  const s = await plugin.status();
  if (s.recording && s.sessionId === sessionId) await plugin.stop();
  await drainNative(sessionId, onPiece);
};

interface Events {
  onChunk: OnPiece;
  onLevel?: (level: number) => void;
  onEnded?: () => void;
  limits?: PieceLimits;
}

/** Same surface as LiveRecorder, backed by the native service. */
export class NativeRecorder {
  private handles: PluginListenerHandle[] = [];
  private poll: ReturnType<typeof setInterval> | null = null;
  private draining: Promise<void> = Promise.resolve();
  private seconds = 0;
  private paused = false;
  private stopping = false;
  lastFrameAt = 0;

  constructor(private sessionId: string, private title: string, private events: Events) {}

  get elapsed() { return this.seconds; }
  get state(): AudioContextState | 'closed' { return this.paused ? 'suspended' : 'running'; }
  get micLive() { return true; }

  private drain() {
    this.draining = this.draining.then(() => drainNative(this.sessionId, this.events.onChunk)).catch((err) => {
      console.error('Could not move recorded audio into the queue', err);
    });
    return this.draining;
  }

  async start() {
    this.handles.push(await plugin.addListener('segment', (e) => { if (e.sessionId === this.sessionId) void this.drain(); }));
    this.handles.push(await plugin.addListener('stopped', (e) => {
      if (e.sessionId === this.sessionId && !this.stopping) this.events.onEnded?.();
    }));
    try {
      await plugin.start({ sessionId: this.sessionId, title: this.title, limits: this.events.limits });
    } catch (err) {
      await this.release();
      const code = (err as { code?: string }).code;
      throw new DOMException((err as Error).message, code === 'NotAllowedError' ? 'NotAllowedError' : 'AbortError');
    }
    this.lastFrameAt = performance.now();
    this.poll = setInterval(() => {
      void plugin.status().then((s) => {
        if (!s.recording) return;
        this.seconds = s.elapsed;
        this.lastFrameAt = performance.now();
        this.events.onLevel?.(s.paused ? 0 : s.level);
      });
    }, 500);
    // Pieces written while the app was in the background are picked up when it's back.
    document.addEventListener('visibilitychange', this.onVisible);
  }

  private onVisible = () => { if (document.visibilityState === 'visible') void this.drain(); };

  async pause() { this.paused = true; await plugin.pause(); }
  async resume() { this.paused = false; await plugin.resume(); }

  /** Stop, then move the last pieces into the queue. */
  async stop() {
    this.stopping = true;
    await plugin.stop();
    await this.drain();
    await this.release();
  }

  private async release() {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    document.removeEventListener('visibilitychange', this.onVisible);
    await Promise.all(this.handles.splice(0).map((h) => h.remove()));
  }
}
