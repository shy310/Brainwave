import { describe, expect, it } from 'vitest';
import { addMark, markSegment, markedSegments, transcriptWithMarks } from '../../shared/marks';

const segs = [{ start: 0, text: 'Intro.' }, { start: 60, text: 'Derivatives are slopes.' }, { start: 120, text: 'This is on the exam!' }, { start: 300, text: 'Homework.' }];

describe('marking important moments', () => {
  it('adds marks in order and ignores a second tap right after the first', () => {
    let m = addMark([], 130);
    m = addMark(m, 132);
    m = addMark(m, 20);
    expect(m).toEqual([20, 130]);
  });

  it('marks the part said just before the tap (and a little after)', () => {
    expect(markedSegments(segs, [150])).toEqual([false, false, true, false]);
    // A tap early in a segment also catches the end of the one before it.
    expect(markedSegments(segs, [125])).toEqual([false, true, true, false]);
    expect(markedSegments(segs, [])).toEqual([false, false, false, false]);
  });

  it('puts a star before the marked parts for the AI', () => {
    expect(transcriptWithMarks(segs, [150])).toBe('Intro.\n\nDerivatives are slopes.\n\n⭐ This is on the exam!\n\nHomework.');
    expect(markSegment(segs, 130)).toBe(2);
    expect(markSegment(segs, 0)).toBe(0);
  });
});
