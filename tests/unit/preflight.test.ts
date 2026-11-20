import { describe, expect, it } from 'vitest';
import { inBrowserMaxMinutes, planUpload } from '../../src/features/lectures/preflight';
import { splitAtQuietPoints } from '../../src/features/lectures/audio';

describe('upload preflight', () => {
  it('estimates AI units as the number of pieces the file will be cut into', () => {
    for (const sec of [30, 60, 70, 71, 130, 600, 3599]) {
      const actual = splitAtQuietPoints(new Float32Array(Math.round(sec * 16000)).fill(0.2)).length;
      expect(planUpload(sec, 1, 120).units).toBe(actual);
    }
  });

  it('shows length, size and time, and flags long files', () => {
    expect(planUpload(45 * 60, 80 * 1024 * 1024, 120)).toMatchObject({ minutes: 45, mb: 80, units: 45, etaMinutes: 3, allowed: true, long: true });
    expect(planUpload(5 * 60, 1, 120)).toMatchObject({ long: false });
  });

  it('refuses files longer than this device can decode', () => {
    expect(planUpload(31 * 60, 1, 30).allowed).toBe(false);
    expect(planUpload(30 * 60 + 20, 1, 30).allowed).toBe(true); // small margin
  });

  it('lets an unknown length through to be checked after decoding', () => {
    expect(planUpload(null, 5 * 1024 * 1024, 30)).toMatchObject({ minutes: null, units: null, allowed: true });
  });

  it('allows more on devices with more memory', () => {
    expect(inBrowserMaxMinutes(2)).toBe(20);
    expect(inBrowserMaxMinutes(4)).toBe(45);
    expect(inBrowserMaxMinutes(8)).toBe(120);
    expect(inBrowserMaxMinutes(undefined)).toBe(30);
  });
});
