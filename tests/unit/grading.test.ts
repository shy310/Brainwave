import { describe, expect, it } from 'vitest';
import { sanitizeQuestion } from '../../shared/math/validate';
import { verdictFor } from '../../server/ai/ops/grader';
import type { Question } from '../../shared/learn';

const base: Question = { kind: 'open', prompt: 'Why is the derivative the slope of the tangent?', options: ['x'], correctIndex: 2, answer: 'Because it is the limit of secant slopes.', accepted: ['a'], check: '1+1', hint: ' Think of secants. ', moreHints: [' Let h shrink. ', 'undefined', ''], explanation: 'Secants approach the tangent.' };

describe('written-answer questions', () => {
  it('keep a model answer and drop choice fields', () => {
    expect(sanitizeQuestion(base)).toMatchObject({ kind: 'open', options: [], correctIndex: -1, accepted: [], check: '', hint: 'Think of secants.', moreHints: ['Let h shrink.'] });
  });
  it('are dropped without a model answer', () => {
    expect(sanitizeQuestion({ ...base, answer: '' })).toBeNull();
  });
  it('the verdict always follows the score', () => {
    expect([verdictFor(95), verdictFor(70), verdictFor(69), verdictFor(40), verdictFor(39)]).toEqual(['correct', 'correct', 'partial', 'partial', 'incorrect']);
  });
});

describe('grader history', async () => {
  const { addAttempt, taskId } = await import('../../src/features/grader/history');
  const g = (score: number) => ({ score, verdict: 'partial' as const, criteria: [], strengths: [], improvements: [], feedback: 'f', improved: '' });
  it('groups attempts by question (ignoring case and spacing) and keeps the newest task first', () => {
    let tasks = addAttempt([], 'Explain  photosynthesis', '', { at: 1, answer: 'a', grade: g(40) });
    tasks = addAttempt(tasks, 'Why is the sky blue?', '', { at: 2, answer: 'b', grade: g(50) });
    tasks = addAttempt(tasks, 'explain photosynthesis', '', { at: 3, answer: 'c', grade: g(70) });
    expect(tasks.map((t) => t.attempts.length)).toEqual([2, 1]);
    expect(tasks[0].id).toBe(taskId('EXPLAIN PHOTOSYNTHESIS'));
  });
  it('keeps at most 10 attempts and 20 questions', () => {
    let tasks: ReturnType<typeof addAttempt> = [];
    for (let i = 0; i < 12; i++) tasks = addAttempt(tasks, 'Q one', '', { at: i, answer: '', grade: g(i) });
    expect(tasks[0].attempts).toHaveLength(10);
    expect(tasks[0].attempts[0].grade.score).toBe(2);
    for (let i = 0; i < 25; i++) tasks = addAttempt(tasks, `Question ${i}`, '', { at: i, answer: '', grade: g(1) });
    expect(tasks).toHaveLength(20);
  });
});
