import { describe, expect, it } from 'vitest';
import { dailyIndex, medal, rankBoard, utcDay, weekStart } from '../../shared/challenge';

describe('group challenges', () => {
  it('weeks start on Monday (UTC)', () => {
    expect(weekStart(new Date('2026-11-21T12:00:00Z'))).toBe('2026-11-16'); // Saturday
    expect(weekStart(new Date('2026-11-16T00:30:00Z'))).toBe('2026-11-16'); // Monday
    expect(weekStart(new Date('2026-11-22T23:59:00Z'))).toBe('2026-11-16'); // Sunday
    expect(weekStart(new Date('2026-12-02T10:00:00Z'))).toBe('2026-11-30');
    expect(utcDay(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-21');
  });

  it('every member gets the same question of the day, and it changes from day to day', () => {
    const a = dailyIndex('group-1', '2026-11-21', 40);
    expect(a).toBe(dailyIndex('group-1', '2026-11-21', 40));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(40);
    const week = ['15', '16', '17', '18', '19', '20', '21'].map((d) => dailyIndex('group-1', `2026-11-${d}`, 40));
    expect(new Set(week).size).toBeGreaterThan(3);
    expect(dailyIndex('g', '2026-11-21', 0)).toBe(-1);
  });

  it('ranks the board, sharing places on ties, and marks you', () => {
    const board = rankBoard([
      { userId: 'a', name: 'Ann', best: 300 }, { userId: 'b', name: 'Ben', best: 500 },
      { userId: 'c', name: 'Cy', best: 300 }, { userId: 'd', name: 'Dee', best: 100 },
    ], 'c');
    expect(board.map((r) => [r.name, r.rank, r.you])).toEqual([['Ben', 1, false], ['Ann', 2, false], ['Cy', 2, true], ['Dee', 4, false]]);
    expect([medal(1), medal(2), medal(3), medal(4)]).toEqual(['🥇', '🥈', '🥉', '']);
  });
});
