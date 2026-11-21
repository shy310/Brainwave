import { describe, expect, it } from 'vitest';
import { highlights, normalize, passages, search, terms } from '../../shared/search';

const notes = (summary: string, points: string[], keyTerms: { term: string; definition: string }[] = []) =>
  ({ title: 't', summary, sections: [{ heading: 'Main', points }], keyTerms, reminders: [] }) as never;

const lectures = [
  { id: 'calc', title: 'Calculus', created_at: '', segments: [{ start: 0, text: 'Today: limits.' }, { start: 95, text: 'The derivative is the slope of the tangent line.' }],
    notes: notes('Limits and derivatives.', ['A derivative measures a rate of change'], [{ term: 'Chain rule', definition: 'How to differentiate a composition' }]) },
  { id: 'bio', title: 'Biology', created_at: '', segments: [{ start: 30, text: 'Mitosis has four stages.' }], notes: null },
  { id: 'he', title: 'מבוא', created_at: '', segments: [{ start: 12, text: 'פונקציה לינארית היא קו ישר.' }, { start: 70, text: 'השיפוע הוא קצב השינוי.' }], notes: null },
];

describe('searching all lectures', () => {
  it('keeps the words that matter', () => {
    expect(terms('What is the derivative?')).toEqual(['derivative']);
    expect(terms('מה זה השיפוע')).toEqual(['השיפוע']);
    expect(normalize('Café ÉCOLE')).toBe('cafe ecole');
    expect(normalize('שָׁלוֹם')).toBe('שלום');
  });

  it('finds the transcript moment with its time, and the notes', () => {
    const hits = search(lectures, 'derivative');
    expect(hits[0]).toMatchObject({ lectureId: 'calc' });
    expect(hits.some((h) => h.kind === 'transcript' && h.start === 95)).toBe(true);
    expect(hits.some((h) => h.kind === 'notes')).toBe(true);
    expect(hits.every((h) => h.lectureId === 'calc')).toBe(true);
  });

  it('ranks the exact phrase and all-words matches first', () => {
    const hits = search(lectures, 'tangent line slope');
    expect(hits[0].text).toBe('The derivative is the slope of the tangent line.');
  });

  it('works in Hebrew, including words with a prefix', () => {
    expect(search(lectures, 'שיפוע')[0]).toMatchObject({ lectureId: 'he', start: 70 });
    expect(search(lectures, 'לינארית')[0]).toMatchObject({ lectureId: 'he', start: 12 });
  });

  it('finds nothing for unrelated words or an empty query', () => {
    expect(search(lectures, 'photosynthesis')).toEqual([]);
    expect(search(lectures, '   ')).toEqual([]);
    expect(passages(lectures[1])).toHaveLength(1);
  });

  it('marks where the words are', () => {
    const text = 'The derivative is the slope.';
    expect(highlights(text, 'slope derivative').map(([a, b]) => text.slice(a, b))).toEqual(['derivative', 'slope']);
  });
});
