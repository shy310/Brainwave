import { beforeEach, describe, expect, it, vi } from 'vitest';

// A fake native plugin: a folder of saved pieces.
const files = new Map<string, Int16Array>();
const removed: string[] = [];
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  registerPlugin: () => ({
    list: async () => ({ items: [...files.keys()].sort().map((name, i) => ({ name, start: i * 60, duration: 60, tail: false })) }),
    read: async ({ name }: { name: string }) => {
      const pcm = files.get(name)!;
      return { data: Buffer.from(pcm.buffer).toString('base64') };
    },
    remove: async ({ name }: { name: string }) => { files.delete(name); removed.push(name); },
    status: async () => ({ recording: false, paused: false, sessionId: null, elapsed: 0, level: 0 }),
  }),
}));

const { drainNative } = await import('../../src/features/lectures/nativeRecorder');

beforeEach(() => {
  files.clear();
  removed.length = 0;
  files.set('seg-0.pcm', new Int16Array([0, 16384, -16384]));
  files.set('seg-960000.pcm', new Int16Array([1000, 2000]));
});

describe('moving native pieces into the queue', () => {
  it('passes each piece in order as audio, then deletes it', async () => {
    const got: { start: number; samples: number[] }[] = [];
    await drainNative('s1', (samples, start) => { got.push({ start, samples: [...samples].map((v) => +v.toFixed(3)) }); });
    expect(got).toEqual([{ start: 0, samples: [0, 0.5, -0.5] }, { start: 60, samples: [0.031, 0.061] }]);
    expect(removed).toEqual(['seg-0.pcm', 'seg-960000.pcm']);
  });

  it('keeps the file when saving it failed', async () => {
    await expect(drainNative('s1', () => Promise.reject(new DOMException('full', 'QuotaExceededError')))).rejects.toThrow('full');
    expect(removed).toEqual([]);
    expect(files.size).toBe(2);
  });
});
