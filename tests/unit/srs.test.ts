import { describe, expect, it } from 'vitest';
import { RELEARN_MS, buildQueue, cardKey, preview, review, type CardState } from '../../shared/srs';

const DAY = 86_400_000;
const NOW = new Date('2026-11-20T12:00:00').getTime();

describe('spaced repetition', () => {
  it('spaces cards out more each time you know them', () => {
    let s = review(undefined, 'good', NOW, 'k', 'l');
    expect([s.box, (s.due - NOW) / DAY]).toEqual([1, 1]);
    s = review(s, 'good', s.due, 'k', 'l');
    expect([s.box, (s.due - s.last) / DAY]).toEqual([2, 3]);
    s = review(s, 'easy', s.due, 'k', 'l');
    expect([s.box, (s.due - s.last) / DAY]).toEqual([4, 14]);
    for (let i = 0; i < 10; i++) s = review(s, 'easy', s.due, 'k', 'l');
    expect([s.box, (s.due - s.last) / DAY]).toEqual([7, 120]);
    expect(s.reviews).toBe(13);
  });

  it('brings a forgotten card back in 10 minutes and starts it over', () => {
    const known = review(review(undefined, 'good', NOW, 'k', 'l'), 'good', NOW + DAY, 'k', 'l');
    const lapsed = review(known, 'again', NOW + 4 * DAY, 'k', 'l');
    expect(lapsed).toMatchObject({ box: 0, lapses: 1, due: NOW + 4 * DAY + RELEARN_MS });
    expect(review(lapsed, 'good', lapsed.due, 'k', 'l').box).toBe(1);
  });

  it('shows what each button will do', () => {
    expect(preview(undefined, 'again')).toEqual({ minutes: 10 });
    expect(preview(undefined, 'good')).toEqual({ days: 1 });
    expect(preview(undefined, 'easy')).toEqual({ days: 3 });
  });

  it('keeps a card’s schedule when the same card comes back, whatever its spacing or case', () => {
    expect(cardKey('lec', 'What is a  Derivative?')).toBe(cardKey('lec', ' what is a derivative? '));
    expect(cardKey('lec', 'מהי נגזרת?')).not.toBe(cardKey('lec', 'מהו אינטגרל?'));
    expect(cardKey('a', 'x')).not.toBe(cardKey('b', 'x'));
  });

  it('queues due cards first (most overdue first), then a limited number of new ones', () => {
    const cards = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({ key }));
    const st = (key: string, due: number, first = NOW - 9 * DAY): CardState => ({ key, lectureId: 'l', box: 2, due, reviews: 2, lapses: 0, last: NOW - 5 * DAY, first });
    const states = new Map([['a', st('a', NOW + DAY)], ['b', st('b', NOW - DAY)], ['c', st('c', NOW - 3 * DAY)]]);
    expect(buildQueue(cards, states, NOW, 2).map((c) => c.key)).toEqual(['c', 'b', 'd', 'e']);
    // A new card already started today (even if reviewed twice) counts against the daily limit.
    states.set('d', st('d', NOW + DAY, NOW - 1000));
    expect(buildQueue(cards, states, NOW, 2).map((c) => c.key)).toEqual(['c', 'b', 'e']);
  });
});
