import { describe, expect, it } from 'vitest';
import { normalizeForWer, wer, wordErrors } from '../../shared/wer';
import { parseStt } from '../../server/ai/stt';

describe('word error rate', () => {
  it('is 0 for the same words, ignoring case and punctuation', () => {
    expect(wer('The derivative, at a point.', 'the derivative at a point')).toBe(0);
  });

  it('counts substitutions, deletions and insertions', () => {
    expect(wordErrors(['a', 'b', 'c', 'd'], ['a', 'x', 'c', 'd', 'e'])).toMatchObject({ substitutions: 1, insertions: 1, deletions: 0, errors: 2 });
    expect(wordErrors(['a', 'b', 'c'], ['a', 'c'])).toMatchObject({ deletions: 1, errors: 1 });
    expect(wer('one two three four', 'one three four')).toBeCloseTo(0.25);
  });

  it('normalises Hebrew: niqqud, geresh and punctuation', () => {
    expect(normalizeForWer('שָׁלוֹם, עוֹלָם!')).toEqual(['שלום', 'עולם']);
    expect(wer('הנגזרת של x בריבוע היא 2x.', 'הנגזרת של x בריבוע היא 2x')).toBe(0);
    expect(wer('צ׳ופר', 'צופר')).toBe(0);
  });

  it('handles empty input', () => {
    expect(wer('', '')).toBe(0);
    expect(wer('', 'noise')).toBe(1);
    expect(wer('words here', '')).toBe(1);
  });
});

describe('speech-to-text replies', () => {
  it('reads text, cost, seconds and segments', () => {
    expect(parseStt({ text: ' hi ', usage: { cost: 0.0012, seconds: 60 }, segments: [{ start: 0, end: 2.5, text: ' hi ' }] }))
      .toEqual({ text: 'hi', cost: 0.0012, seconds: 60, segments: [{ start: 0, end: 2.5, text: 'hi' }] });
  });

  it('tolerates missing usage and segments', () => {
    expect(parseStt({ text: 'x' })).toEqual({ text: 'x', cost: null, seconds: null, segments: [] });
  });
});

describe('paragraph times from speech-to-text', async () => {
  const { groupSegments } = await import('../../shared/lectures');
  const s = (start: number, text: string) => ({ start, end: start + 3, text });
  it('joins sentences into paragraphs of at least 15 s, ending at a sentence', () => {
    const parts = [s(0, 'Today we start.'), s(4, 'Derivatives are rates'), s(9, 'of change.'), s(16, 'Next, the definition'), s(21, 'uses a limit.'), s(33, 'Example:'), s(36, 'x squared.')];
    expect(groupSegments(parts)).toEqual([
      { start: 0, text: 'Today we start. Derivatives are rates of change.' },
      { start: 16, text: 'Next, the definition uses a limit.' },
      { start: 33, text: 'Example: x squared.' },
    ]);
  });
  it('breaks a long run without punctuation at 40 s, and skips empty parts', () => {
    const parts = [s(0, 'and so'), s(20, 'we keep'), s(41, 'going'), s(45, ' ')];
    expect(groupSegments(parts).map((p) => p.start)).toEqual([0, 41]);
  });
});
