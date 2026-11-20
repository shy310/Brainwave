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
