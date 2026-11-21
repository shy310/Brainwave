import { describe, expect, it } from 'vitest';
import { isWeakCard, mistakeKey, openMistakes, recordAnswer, weakSession, type Mistake } from '../../shared/mistakes';

const q = (prompt: string) => ({ kind: 'choice', prompt, options: ['a', 'b'], correctIndex: 0, answer: 'a', accepted: [], check: '', hint: '', explanation: 'x' }) as never;

describe('weak spots', () => {
  it('a miss adds a question; a right answer to a new question leaves nothing', () => {
    expect(recordAnswer(undefined, q('Q1'), 'l1', true, 1)).toBeUndefined();
    const m = recordAnswer(undefined, q('Q1'), 'l1', false, 5)!;
    expect(m).toMatchObject({ lectureId: 'l1', wrong: 1, streak: 0, lastWrong: 5, resolved: false, key: mistakeKey('l1', 'Q1') });
  });

  it('two right answers in a row clear it; a miss in between starts over', () => {
    let m = recordAnswer(undefined, q('Q'), null, false, 1)!;
    m = recordAnswer(m, q('Q'), null, true, 2)!;
    expect(m.resolved).toBe(false);
    m = recordAnswer(m, q('Q'), null, false, 3)!;
    expect(m).toMatchObject({ wrong: 2, streak: 0, resolved: false });
    m = recordAnswer(m, q('Q'), null, true, 4)!;
    m = recordAnswer(m, q('Q'), null, true, 5)!;
    expect(m.resolved).toBe(true);
    expect(recordAnswer(m, q('Q'), null, false, 6)!.resolved).toBe(false); // missed again: back on the list
  });

  it('keys are stable and ignore case and spaces at the ends', () => {
    expect(mistakeKey('l', ' What is X? ')).toBe(mistakeKey('l', 'what is x?'));
    expect(mistakeKey('l', 'A')).not.toBe(mistakeKey('m', 'A'));
  });

  it('weak flashcards are forgotten ones not yet known well', () => {
    const s = (box: number, lapses: number) => ({ key: 'k', lectureId: 'l', box, due: 0, reviews: 3, lapses, last: 0, first: 0 });
    expect(isWeakCard(s(0, 1))).toBe(true);
    expect(isWeakCard(s(1, 2))).toBe(true);
    expect(isWeakCard(s(3, 2))).toBe(false);
    expect(isWeakCard(s(0, 0))).toBe(false);
    expect(isWeakCard(undefined)).toBe(false);
  });

  it('orders open mistakes by how often and how recently they were missed, and mixes a round', () => {
    const mk = (key: string, wrong: number, lastWrong: number, resolved = false) => ({ key, wrong, lastWrong, resolved }) as Mistake;
    expect(openMistakes([mk('a', 1, 9), mk('b', 3, 1), mk('c', 1, 20), mk('d', 5, 5, true)]).map((m) => m.key)).toEqual(['b', 'c', 'a']);
    expect(weakSession(['m1', 'm2', 'm3'], ['c1'], 10)).toEqual(['m1', 'c1', 'm2', 'm3']);
    expect(weakSession(['m1', 'm2'], ['c1', 'c2', 'c3'], 4)).toEqual(['m1', 'c1', 'm2', 'c2']);
  });
});
