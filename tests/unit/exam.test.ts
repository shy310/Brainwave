import { describe, expect, it } from 'vitest';
import { addDays, daysUntil, examPlan, nextExam, readiness } from '../../shared/exam';

describe('exam plan', () => {
  it('counts whole days to the exam', () => {
    expect(daysUntil('2026-11-28', '2026-11-21')).toBe(7);
    expect(daysUntil('2026-11-21', '2026-11-21')).toBe(0);
    expect(daysUntil('2026-11-20', '2026-11-21')).toBe(-1);
    expect(addDays('2026-11-30', 2)).toBe('2026-12-02');
  });

  it('spreads the lectures over the first days, reviews from day two, and practises at the end', () => {
    const plan = examPlan(['a', 'b', 'c', 'd', 'e'], '2026-11-21', '2026-11-28');
    expect(plan).toHaveLength(7);
    expect(plan[0].date).toBe('2026-11-21');
    expect(plan.at(-1)!.date).toBe('2026-11-27'); // the day before the exam
    const learned = plan.flatMap((d) => d.tasks.flatMap((t) => (t.kind === 'learn' ? t.lectureIds : [])));
    expect(learned).toEqual(['a', 'b', 'c', 'd', 'e']); // each lecture once, in order
    expect(plan.slice(0, 5).every((d) => !d.tasks.some((t) => t.kind === 'practice'))).toBe(true);
    expect(plan.slice(5).every((d) => d.tasks.some((t) => t.kind === 'practice'))).toBe(true);
    expect(plan[0].tasks.some((t) => t.kind === 'review')).toBe(false);
    expect(plan.slice(1).every((d) => d.tasks.some((t) => t.kind === 'review'))).toBe(true);
  });

  it('works with little time: one day left means learn everything and practise', () => {
    expect(examPlan(['a', 'b'], '2026-11-21', '2026-11-22')).toEqual([
      { date: '2026-11-21', tasks: [{ kind: 'learn', lectureIds: ['a', 'b'] }, { kind: 'practice' }] },
    ]);
    const two = examPlan(['a'], '2026-11-21', '2026-11-23');
    expect(two[1].tasks).toEqual([{ kind: 'review' }, { kind: 'practice' }]);
    expect(examPlan(['a'], '2026-11-21', '2026-11-21')).toEqual([]);
  });

  it('more days than lectures: some days just review', () => {
    const plan = examPlan(['a'], '2026-11-21', '2026-12-01');
    expect(plan.filter((d) => d.tasks.some((t) => t.kind === 'learn'))).toHaveLength(1);
    expect(plan.every((d) => d.tasks.length > 0)).toBe(true);
  });
});

describe('readiness', () => {
  it('mixes known flashcards and the best practice score, capped at 60 without practice', () => {
    expect(readiness(10, 10, null)).toBe(60);
    expect(readiness(10, 5, 80)).toBe(62);
    expect(readiness(10, 10, 100)).toBe(100);
    expect(readiness(0, 0, 70)).toBe(70);
    expect(readiness(0, 0, null)).toBe(0);
    expect(readiness(4, 9, null)).toBe(60);
  });

  it('picks the nearest exam still to come', () => {
    const exams = [{ date: '2026-12-10' }, { date: '2026-11-20' }, { date: '2026-11-25' }];
    expect(nextExam(exams, '2026-11-21')).toEqual({ date: '2026-11-25' });
    expect(nextExam(exams, '2026-12-11')).toBeUndefined();
  });
});
