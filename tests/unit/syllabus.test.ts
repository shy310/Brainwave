import { describe, expect, it } from 'vitest';
import { cleanSyllabus, isDay, itemsOn, monthGrid, shiftMonth, weekStart, weekdayOf } from '../../shared/syllabus';

describe('syllabus import', () => {
  it('keeps valid, recent, de-duplicated dates and sensible class times', () => {
    const s = cleanSyllabus({
      course: ' Calculus I ',
      meetings: [
        { weekday: 1, starts: '10:00', ends: '11:30', label: 'Lecture' },
        { weekday: 1, starts: '10:00', ends: '11:30', label: 'dup' },
        { weekday: 3, starts: '9:15', ends: '', label: 'Lab' },
        { weekday: 7, starts: '10:00', ends: '11:00', label: 'bad day' },
        { weekday: 2, starts: '25:00', ends: '26:00', label: 'bad time' },
      ],
      exams: [{ title: 'Final', date: '2027-01-20' }, { title: 'Midterm', date: '2026-12-08' }, { title: 'midterm', date: '2026-12-08' }, { title: 'Old', date: '2025-01-01' }, { title: 'Nonsense', date: '2026-02-30' }],
      deadlines: [{ title: 'PS 1', date: '2026-11-30', kind: 'assignment' }, { title: '', date: '2026-12-01', kind: 'quiz' }],
    }, '2026-11-26');
    expect(s.course).toBe('Calculus I');
    expect(s.meetings).toEqual([{ weekday: 1, starts: '10:00', ends: '11:30', label: 'Lecture' }, { weekday: 3, starts: '09:15', ends: '10:30', label: 'Lab' }]);
    expect(s.exams).toEqual([{ title: 'Midterm', date: '2026-12-08' }, { title: 'Final', date: '2027-01-20' }]);
    expect(s.deadlines).toEqual([{ title: 'PS 1', date: '2026-11-30', kind: 'assignment' }]);
    expect(isDay('2026-02-29')).toBe(false);
    expect(isDay('2028-02-29')).toBe(true);
  });
});

describe('the calendar', () => {
  it('lays out six weeks from the right first day of the week', () => {
    const sun = monthGrid('2026-11', weekStart('he'));
    expect(sun).toHaveLength(42);
    expect(sun[0]).toBe('2026-11-01'); // 1 Nov 2026 is a Sunday
    const mon = monthGrid('2026-11', weekStart('ru'));
    expect(mon[0]).toBe('2026-10-26');
    expect(weekdayOf(mon[0])).toBe(1);
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('finds what happens on a day', () => {
    const items = itemsOn('2026-12-07', {
      classes: [{ weekday: 1, name: 'Calc' }, { weekday: 2, name: 'Bio' }],
      exams: [{ date: '2026-12-07', title: 'Mid' }],
      deadlines: [{ date: '2026-12-08', title: 'PS' }],
      plan: [{ date: '2026-12-07', task: 'review' }],
    });
    expect(items.classes.map((c) => c.name)).toEqual(['Calc']);
    expect(items.exams).toHaveLength(1);
    expect(items.deadlines).toHaveLength(0);
    expect(items.plan).toHaveLength(1);
  });
});
