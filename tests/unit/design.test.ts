import { describe, expect, it } from 'vitest';
import { leadingEmoji, withEmoji } from '../../shared/lectures';
import { dailyGoals } from '../../shared/activity';

describe('emoji in lecture titles', () => {
  it('finds the emoji a title starts with, including joined and variant emoji', () => {
    expect(leadingEmoji('🧬 Cell division')).toBe('🧬');
    expect(leadingEmoji('🏛️ The Roman Republic')).toBe('🏛️');
    expect(leadingEmoji('👩‍🔬 Lab safety')).toBe('👩‍🔬');
    expect(leadingEmoji('Cell division')).toBeNull();
    expect(leadingEmoji('3 laws of motion')).toBeNull();
  });
  it('adds the notes\' emoji to a title that has none, and leaves the rest alone', () => {
    expect(withEmoji('Calculus — 20 Nov', '🧮 Limits and derivatives')).toBe('🧮 Calculus — 20 Nov');
    expect(withEmoji('📐 Geometry', '🧮 Limits')).toBe('📐 Geometry');
    expect(withEmoji('Calculus', 'Limits')).toBe('Calculus');
    expect(withEmoji('', '🧮 Limits')).toBe('');
  });
});

describe('daily goals', () => {
  const day = { day: '2026-11-21', minutes: 0, cards: 0, quizzes: 0, lectures: 0 };
  it('starts with nothing done when cards are due', () => {
    expect(dailyGoals(day, 3)).toMatchObject({ done: 0 });
  });
  it('counts reviewing, ten minutes and a lecture', () => {
    const r = dailyGoals({ ...day, cards: 4, minutes: 12, lectures: 1 }, 0);
    expect(r.done).toBe(3);
    expect(r.goals.map((g) => g.id)).toEqual(['review', 'minutes', 'lecture']);
  });
  it('treats "nothing due" as reviewed, and 9 minutes as not yet', () => {
    expect(dailyGoals({ ...day, minutes: 9 }, 0).goals.map((g) => g.done)).toEqual([true, false, false]);
    expect(dailyGoals(undefined, 0).done).toBe(1);
  });
});
