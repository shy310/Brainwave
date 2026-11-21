import { describe, expect, it } from 'vitest';
import { MAX_TASKS, mergeTasks, taskId, type Task } from '../../src/features/grader/history';

const grade = { score: 50, verdict: 'partial', feedback: 'f', criteria: [], strengths: [], improvements: [], improved: 'i' } as unknown as Task['attempts'][number]['grade'];
const task = (q: string, ats: number[]): Task => ({ id: taskId(q), question: q, rubric: '', attempts: ats.map((at) => ({ at, answer: `a${at}`, grade })) });

describe('grader history on several devices', () => {
  it('merges the same question from two devices without duplicate attempts, oldest attempt first', () => {
    const phone = [task('Why is the sky blue?', [1, 3])];
    const laptop = [task('why is the sky  blue?', [1, 2])];
    const [t] = mergeTasks(phone, laptop);
    expect(t.attempts.map((a) => a.at)).toEqual([1, 2, 3]);
  });

  it('puts the most recently practised question first and keeps the limit', () => {
    const many = Array.from({ length: MAX_TASKS + 5 }, (_, i) => task(`Question ${i}`, [i]));
    const merged = mergeTasks(many.slice(0, 10), many.slice(10));
    expect(merged).toHaveLength(MAX_TASKS);
    expect(merged[0].question).toBe(`Question ${MAX_TASKS + 4}`);
  });

  it('keeps at most 10 attempts per question', () => {
    const [t] = mergeTasks([task('Q', [1, 2, 3, 4, 5, 6])], [task('Q', [7, 8, 9, 10, 11, 12])]);
    expect(t.attempts.map((a) => a.at)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});
