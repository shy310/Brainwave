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
