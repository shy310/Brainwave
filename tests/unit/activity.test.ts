import { describe, expect, it } from 'vitest';
import { bumpDay, lastWeek, localDay, streaks, type DayActivity } from '../../shared/activity';

const d = (day: string, minutes = 10, cards = 0): DayActivity => ({ day, minutes, cards, quizzes: 0, lectures: 0 });

describe('study streaks', () => {
  it('counts days in a row ending today', () => {
    expect(streaks([d('2026-11-18'), d('2026-11-19'), d('2026-11-20')], '2026-11-20')).toMatchObject({ current: 3, studiedToday: true });
  });
  it('keeps yesterday’s streak alive until today is over', () => {
    expect(streaks([d('2026-11-18'), d('2026-11-19')], '2026-11-20')).toMatchObject({ current: 2, studiedToday: false });
    expect(streaks([d('2026-11-17')], '2026-11-20').current).toBe(0);
  });
  it('needs a little real study: 5 minutes, or a card, quiz or lecture', () => {
    expect(streaks([d('2026-11-20', 2)], '2026-11-20').current).toBe(0);
    expect(streaks([d('2026-11-20', 0, 1)], '2026-11-20').current).toBe(1);
  });
  it('remembers the best streak, across months and years', () => {
    const days = [d('2025-12-30'), d('2025-12-31'), d('2026-01-01'), d('2026-01-02'), d('2026-11-20')];
    expect(streaks(days, '2026-11-20')).toMatchObject({ current: 1, best: 4 });
  });
});

describe('weekly summary', () => {
  it('fills the last 7 days, oldest first, with totals', () => {
    const { week, total, activeDays } = lastWeek([d('2026-11-20', 30, 5), d('2026-11-15', 20), d('2026-11-01', 99)], '2026-11-20');
    expect(week.map((x) => x.day)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20']);
    expect(total).toEqual({ minutes: 50, cards: 5, quizzes: 0, lectures: 0 });
    expect(activeDays).toBe(2);
  });
  it('adds to a day', () => {
    let days = bumpDay([], '2026-11-20', { minutes: 1 });
    days = bumpDay(days, '2026-11-20', { minutes: 1, cards: 2 });
    expect(days).toEqual([{ day: '2026-11-20', minutes: 2, cards: 2, quizzes: 0, lectures: 0 }]);
  });
  it('uses the local calendar day', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
