import { describe, expect, it } from 'vitest';
import type { Notes } from '../../shared/lectures';
import { switchNotes, withNewNotes } from '../../src/features/lectures/notesVersions';

const note = (mode: Notes['mode'], summary = `${mode} notes`): Notes =>
  ({ title: 'T', summary, sections: [{ heading: 'H', points: ['p'] }], keyTerms: [], reminders: [], mode });

describe('notes saved per style', () => {
  it('keeps the old style when a new one is written, and switches back without the AI', () => {
    const detailed = withNewNotes(null, note('detailed'));
    expect(detailed).toEqual(note('detailed'));
    expect(switchNotes(detailed, 'exam')).toBeNull(); // not written yet: the AI is needed

    const exam = withNewNotes(detailed, note('exam'));
    expect(exam.summary).toBe('exam notes');
    expect(exam.other).toEqual({ detailed: note('detailed') });

    const back = switchNotes(exam, 'detailed')!;
    expect(back.summary).toBe('detailed notes');
    expect(back.other).toEqual({ exam: note('exam') });
    expect(switchNotes(back, 'exam')!.summary).toBe('exam notes');
  });

  it('"Write again" replaces only the style on screen', () => {
    const both = withNewNotes(withNewNotes(null, note('short')), note('exam'));
    const again = withNewNotes(both, note('exam', 'exam notes, take 2'));
    expect(again.summary).toBe('exam notes, take 2');
    expect(again.other).toEqual({ short: note('short') });
  });

  it('drops the other styles when the transcript changed', () => {
    const both = withNewNotes(withNewNotes(null, note('short')), note('exam'));
    const fresh = withNewNotes(both, note('exam', 'from the edited transcript'), false);
    expect(fresh).toEqual(note('exam', 'from the edited transcript'));
    expect(switchNotes(fresh, 'short')).toBeNull();
  });

  it('treats old notes without a style as detailed', () => {
    const { mode: _, ...old } = note('detailed');
    const exam = withNewNotes(old, note('exam'));
    expect(switchNotes(exam, 'detailed')!.summary).toBe('detailed notes');
  });
});
