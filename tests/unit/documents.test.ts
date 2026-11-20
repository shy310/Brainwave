import { describe, expect, it } from 'vitest';
import { formatPageRange, joinTextItems, mapLimit, parsePageRange } from '../../src/features/lectures/documents';

const item = (str: string, y: number, hasEOL = false) => ({ str, transform: [1, 0, 0, 1, 0, y], hasEOL });

describe('PDF text', () => {
  it('rebuilds lines from positions and joins words on a line', () => {
    expect(joinTextItems([item('Derivatives', 700), item('The', 680), item('slope', 680), item('of a line.', 680, true), item('Next', 660)]))
      .toBe('Derivatives\nThe slope of a line.\nNext');
  });
  it('keeps Hebrew and collapses extra spaces', () => {
    expect(joinTextItems([item('נגזרת  של', 700), item('פונקציה', 700)])).toBe('נגזרת של פונקציה');
  });
});

describe('page ranges', () => {
  it('reads ranges, single pages and reversed ranges, within the PDF', () => {
    expect(parsePageRange('1-3, 7, 10-8', 20)).toEqual([1, 2, 3, 7, 8, 9, 10]);
    expect(parsePageRange('5-50', 8)).toEqual([5, 6, 7, 8]);
    expect(parsePageRange('0, 2–3, x, 4', 10)).toEqual([2, 3, 4]);
    expect(parsePageRange('', 10)).toEqual([]);
  });
  it('writes ranges back compactly', () => {
    expect(formatPageRange([1, 2, 3, 7, 9, 10])).toBe('1-3, 7, 9-10');
    expect(formatPageRange([])).toBe('');
  });
});

describe('mapLimit', () => {
  it('keeps order and never runs more than the limit at once', async () => {
    let running = 0, peak = 0;
    const out = await mapLimit([30, 10, 20, 5], 2, async (ms, i) => {
      running++; peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, ms));
      running--;
      return i * 10;
    });
    expect(out).toEqual([0, 10, 20, 30]);
    expect(peak).toBe(2);
  });
});

describe('share links', async () => {
  const { newShareToken } = await import('../../src/features/lectures/repo');
  it('makes long, URL-safe, random tokens that the database accepts', () => {
    const tokens = new Set(Array.from({ length: 200 }, () => newShareToken()));
    expect(tokens.size).toBe(200);
    for (const tk of tokens) expect(tk).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});
