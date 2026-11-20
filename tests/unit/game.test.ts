import { describe, expect, it } from 'vitest';
import { LIVES, MAX_COMBO, answer, buildGame, points, reachedSummit, start } from '../../src/features/game/game';

/** Repeatable "random" numbers. */
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const card = (front: string, back: string) => ({ front, back });
const lecture = (id: string, cards: { front: string; back: string }[], quiz: unknown[] = []) => ({
  id, title: id, created_at: '', status: 'ready' as const, folder_id: null,
  flashcards: { cards }, quiz: quiz.length ? { questions: quiz } : null,
}) as never;

describe('Summit game', () => {
  it('turns flashcards into 4-option questions with distinct wrong answers from other cards', () => {
    const qs = buildGame([lecture('a', [card('1+1', '2'), card('2+2', '4'), card('3+3', '6'), card('4+4', '8'), card('5+5', '10')])], (l) => (l as { id: string }).id, seeded());
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(Number(q.options[q.correct])).toBe(Number(q.prompt[0]) * 2);
      expect(q.card?.lectureId).toBe('a');
    }
  });

  it('needs 4 different answers before using flashcards; uses quiz choice questions as they are', () => {
    const quiz = [{ kind: 'choice', prompt: 'Q?', options: ['x', 'y', 'z'], correctIndex: 2 }, { kind: 'input', prompt: 'Typed?', options: [], correctIndex: -1 }];
    const qs = buildGame([lecture('a', [card('a', '1'), card('b', '2')], quiz)], () => 'A', seeded());
    expect(qs).toEqual([{ prompt: 'Q?', options: ['x', 'y', 'z'], correct: 2, from: 'A' }]);
  });

  it('rewards speed and combos, and ends after three misses', () => {
    expect(points(1, 12)).toBe(200);
    expect(points(3, 0)).toBe(300);
    const q = { prompt: 'p', options: ['a', 'b'], correct: 0, from: '' };
    let s = start();
    for (let i = 0; i < 6; i++) s = answer(s, q, 0, 6, 10);
    expect([s.combo, s.height]).toEqual([MAX_COMBO, 6]);
    s = answer(s, q, 1, 6, 10);
    expect([s.combo, s.lives, s.missed]).toEqual([1, LIVES - 1, [6]]);
    s = answer(s, q, null, 0, 10);
    s = answer(s, q, null, 0, 10);
    expect(s.over).toBe(true);
  });

  it('ends when the questions run out', () => {
    const q = { prompt: 'p', options: ['a', 'b'], correct: 0, from: '' };
    expect(answer(start(), q, 0, 5, 1).over).toBe(true);
  });
  it('only says "summit" when the climb ended with lives left and at least one right answer', () => {
    const q = { prompt: 'Q', options: ['a', 'b'], correct: 0 } as unknown as Parameters<typeof answer>[1];
    expect(reachedSummit(answer(start(), q, 1, 5, 1))).toBe(false); // a one-question round, missed
    expect(reachedSummit(answer(start(), q, 0, 5, 1))).toBe(true);
    let s = start();
    for (let i = 0; i < LIVES; i++) s = answer(s, q, 1, 5, 20);
    expect(s.over && !reachedSummit(s)).toBe(true); // out of lives
    expect(reachedSummit(answer(start(), q, 0, 5, 20))).toBe(false); // not over yet
  });
});
