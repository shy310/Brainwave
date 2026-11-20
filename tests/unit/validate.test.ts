import { describe, expect, it } from 'vitest';
import type { Question } from '../../shared/learn';
import { sanitizeQuestion, sanitizeQuestions } from '../../shared/math/validate';

const choice = (over: Partial<Question> = {}): Question => ({
  kind: 'choice', prompt: 'What is 3 × 4?', options: ['7', '12', '34', '1'], correctIndex: 1,
  answer: '12', accepted: [], check: '3*4', hint: 'Count 3 groups of 4.', explanation: '3 groups of 4 make 12.', ...over,
});
const input = (over: Partial<Question> = {}): Question => ({
  kind: 'input', prompt: 'Half of 18?', options: [], correctIndex: -1, answer: '9', accepted: [],
  check: '18/2', hint: '', explanation: '18 ÷ 2 = 9.', ...over,
});

describe('question validator', () => {
  it('keeps a good choice question', () => {
    expect(sanitizeQuestion(choice())).toMatchObject({ correctIndex: 1, answer: '12' });
  });

  it('fixes a wrongly marked option using the check expression', () => {
    expect(sanitizeQuestion(choice({ correctIndex: 0 }))).toMatchObject({ correctIndex: 1, answer: '12' });
  });

  it('drops choice questions with no correct option or duplicate options', () => {
    expect(sanitizeQuestion(choice({ options: ['7', '13', '34', '1'] }))).toBeNull();
    expect(sanitizeQuestion(choice({ options: ['12', '24/2', '7', '1'] }))).toBeNull();
    expect(sanitizeQuestion(choice({ options: ['12'] }))).toBeNull();
    expect(sanitizeQuestion(choice({ correctIndex: 9, check: '' }))).toBeNull();
  });

  it('keeps worded choice questions without a check', () => {
    const q = choice({ prompt: 'Which organelle makes energy?', options: ['Nucleus', 'Mitochondria', 'Ribosome'], correctIndex: 1, check: '' });
    expect(sanitizeQuestion(q)).toMatchObject({ answer: 'Mitochondria' });
  });

  it('replaces a wrong typed answer with the verified one', () => {
    expect(sanitizeQuestion(input({ answer: '8', accepted: ['8', 'nine'] }))).toMatchObject({ answer: '9', accepted: ['nine'] });
    expect(sanitizeQuestion(input({ answer: '' }))).toMatchObject({ answer: '9' });
    expect(sanitizeQuestion(input({ answer: '', check: '' }))).toBeNull();
  });

  it('drops broken text and duplicates', () => {
    expect(sanitizeQuestion(input({ prompt: 'What is undefined + 2?' }))).toBeNull();
    expect(sanitizeQuestions([input(), input({ prompt: '  half of 18? ' }), choice()])).toHaveLength(2);
  });
});
