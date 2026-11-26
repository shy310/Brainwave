import { describe, expect, it } from 'vitest';
import { applyEdit, blockText, findQuote, parseBlock, shiftBlocks, NotesEditInputSchema } from '../../shared/notesEdit';
import type { Notes } from '../../shared/lectures';

const notes: Notes = {
  title: 'Calculus', summary: 'Derivatives measure **how fast** things change.', mode: 'detailed',
  sections: [
    { heading: 'Rules', points: ['The **chain rule** handles compositions', 'The product rule handles products'] },
    { heading: 'Uses', points: ['Speed is the derivative of position'] },
  ],
  keyTerms: [{ term: 'Limit', definition: 'The value a function approaches.' }],
  reminders: [],
};

describe('editing notes with AI', () => {
  it('reads block ids', () => {
    expect(parseBlock('summary')).toEqual({ kind: 'summary' });
    expect(parseBlock('s1.0')).toEqual({ kind: 'point', section: 1, point: 0 });
    expect(parseBlock('k0')).toEqual({ kind: 'term', term: 0 });
    expect(parseBlock('x')).toBeNull();
    expect(blockText(notes, 's0.1')).toBe('The product rule handles products');
    expect(blockText(notes, 's9.0')).toBeNull();
  });

  it('finds the selected words even where the notes have formatting', () => {
    const s = notes.sections[0].points[0];
    expect(findQuote(s, 'handles')).toEqual([s.indexOf('handles'), s.indexOf('handles') + 7]);
    const [a, b] = findQuote(s, 'chain rule handles')!;
    expect(s.slice(a, b)).toBe('**chain rule** handles');
    expect(findQuote(s, 'chain  rule')).not.toBeNull();
    expect(findQuote(s, 'nowhere')).toBeNull();
  });

  it('adds new points right after the selected one, or at the end of the section', () => {
    const after = applyEdit(notes, 's0.0', 'chain rule', 'after', ['- Example: sin(x²)', 'Another']);
    expect(after!.notes.sections[0].points).toEqual(['The **chain rule** handles compositions', 'Example: sin(x²)', 'Another', 'The product rule handles products']);
    expect(after!.changed).toEqual(['s0.1', 's0.2']);
    const end = applyEdit(notes, 's0.0', 'chain rule', 'end', ['At the end']);
    expect(end!.notes.sections[0].points.at(-1)).toBe('At the end');
    expect(end!.changed).toEqual(['s0.2']);
    expect(end!.notes.sections[1]).toBe(notes.sections[1]);
  });

  it('replaces the selected words, keeping formatting balanced', () => {
    const r = applyEdit(notes, 's0.0', 'chain rule handles', 'replace', ['**chain rule** deals with']);
    expect(r!.notes.sections[0].points[0]).toBe('The **chain rule** deals with compositions');
    expect(r!.changed).toEqual(['s0.0']);
  });

  it('grows the summary and key terms in place', () => {
    const s = applyEdit(notes, 'summary', 'how fast', 'after', ['Like a speedometer.']);
    expect(s!.notes.summary).toBe('Derivatives measure **how fast** things change.\n\nLike a speedometer.');
    const k = applyEdit(notes, 'k0', 'approaches', 'end', ['As x gets close.']);
    expect(k!.notes.keyTerms[0].definition).toBe('The value a function approaches. As x gets close.');
  });

  it('gives up when the part is gone or the AI wrote nothing', () => {
    expect(applyEdit(notes, 's5.0', 'x', 'after', ['y'])).toBeNull();
    expect(applyEdit(notes, 's0.0', 'x', 'after', ['  '])).toBeNull();
  });

  it('moves highlights below inserted points down', () => {
    const hs = [{ block: 's0.0' }, { block: 's0.1' }, { block: 's1.0' }, { block: 'summary' }];
    expect(shiftBlocks(hs, 's0.0', 'after', 2, 2).map((h) => h.block)).toEqual(['s0.0', 's0.3', 's1.0', 'summary']);
    expect(shiftBlocks(hs, 's0.0', 'end', 2, 2)).toEqual(hs);
    expect(shiftBlocks(hs, 's0.0', 'replace', 1, 2)).toEqual(hs);
  });

  it('needs an instruction for a custom edit', () => {
    const base = { place: 'after', depth: 'brief', quote: 'a', block: 'a' } as const;
    expect(NotesEditInputSchema.safeParse({ ...base, action: 'custom' }).success).toBe(false);
    expect(NotesEditInputSchema.safeParse({ ...base, action: 'custom', instruction: 'make it rhyme' }).success).toBe(true);
    expect(NotesEditInputSchema.safeParse({ ...base, action: 'expand' }).success).toBe(true);
  });
});
