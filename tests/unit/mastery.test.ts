import { describe, expect, it } from 'vitest';
import { masteryCounts, masteryLevel, review } from '../../shared/srs';

describe('flashcard mastery', () => {
  it('moves from new to mastered as a card is known again and again', () => {
    expect(masteryLevel(undefined)).toBe('new');
    let s = review(undefined, 'good', 0, 'k', 'l');
    expect(masteryLevel(s)).toBe('learning'); // seen once: back tomorrow
    s = review(s, 'good', 0, 'k', 'l');
    expect(masteryLevel(s)).toBe('almost');
    s = review(review(s, 'good', 0, 'k', 'l'), 'good', 0, 'k', 'l');
    expect(masteryLevel(s)).toBe('mastered'); // two weeks or more apart
    expect(masteryLevel(review(s, 'again', 0, 'k', 'l'))).toBe('learning'); // a miss starts it over
  });

  it('counts a deck by level', () => {
    const known = review(undefined, 'easy', 0, 'k', 'l');
    expect(masteryCounts([undefined, undefined, known])).toEqual({ new: 2, learning: 0, almost: 1, mastered: 0 });
  });
});
