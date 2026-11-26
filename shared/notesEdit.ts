// Editing lecture notes with AI: select part of the notes, pick what to do
// (expand, simplify, add an example, or your own instruction), where the new
// text goes and how much of it. The AI writes the text; putting it into the
// notes is done here (pure, tested).
import { z } from 'zod';
import type { Notes } from './lectures.js';

export const EDIT_ACTIONS = ['expand', 'simplify', 'example', 'custom'] as const;
export type EditAction = (typeof EDIT_ACTIONS)[number];
/** Right after the selected point, at the end of its section, or instead of the selected words. */
export const EDIT_PLACES = ['after', 'end', 'replace'] as const;
export type EditPlace = (typeof EDIT_PLACES)[number];
export const EDIT_DEPTHS = ['brief', 'detailed', 'deep'] as const;
export type EditDepth = (typeof EDIT_DEPTHS)[number];

export const MAX_INSTRUCTION = 300;

export const NotesEditInputSchema = z.object({
  action: z.enum(EDIT_ACTIONS),
  instruction: z.string().max(MAX_INSTRUCTION).optional(),
  place: z.enum(EDIT_PLACES),
  depth: z.enum(EDIT_DEPTHS),
  /** The selected words, and the whole point or paragraph they are in. */
  quote: z.string().min(1).max(1500),
  block: z.string().min(1).max(3000),
  /** The section it is in, for context. */
  heading: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
  /** The rest of the notes as plain text, so new text fits and doesn't repeat. */
  notes: z.string().max(20_000).optional(),
}).refine((i) => i.action !== 'custom' || !!i.instruction?.trim(), { message: 'Say what to change', path: ['instruction'] });
export type NotesEditInput = z.infer<typeof NotesEditInputSchema>;

export const NotesEditOutputSchema = z.object({
  /** New bullet points; when replacing, the replacement text is the first. */
  points: z.array(z.string().min(1).max(1500)).min(1).max(8),
});
export type NotesEditOutput = z.infer<typeof NotesEditOutputSchema>;

/** How many points each depth may add. */
export const DEPTH_POINTS: Record<EditDepth, number> = { brief: 1, detailed: 3, deep: 6 };

/** Which part of the notes a data-block id names. */
export type BlockRef = { kind: 'summary' } | { kind: 'point'; section: number; point: number } | { kind: 'term'; term: number };

export const parseBlock = (id: string): BlockRef | null => {
  if (id === 'summary') return { kind: 'summary' };
  const p = /^s(\d+)\.(\d+)$/.exec(id);
  if (p) return { kind: 'point', section: Number(p[1]), point: Number(p[2]) };
  const k = /^k(\d+)$/.exec(id);
  return k ? { kind: 'term', term: Number(k[1]) } : null;
};

/** The text of a block (as stored, with its formatting), or null if it doesn't exist. */
export const blockText = (notes: Notes, id: string): string | null => {
  const ref = parseBlock(id);
  if (!ref) return null;
  if (ref.kind === 'summary') return notes.summary;
  if (ref.kind === 'point') return notes.sections[ref.section]?.points[ref.point] ?? null;
  return notes.keyTerms[ref.term]?.definition ?? null;
};

export const blockHeading = (notes: Notes, id: string): string | undefined => {
  const ref = parseBlock(id);
  return ref?.kind === 'point' ? notes.sections[ref.section]?.heading : undefined;
};

/** Formatting marks in stored notes that the page draws instead of showing. */
const MARKS = '*_`$';

/**
 * Find the selected words in the stored text. The selection comes from the
 * page, where formatting (**bold**, `code`, $maths$) is already drawn, so
 * matching ignores those marks. Returns [start, end) in the stored text.
 */
export const findQuote = (stored: string, quote: string): [number, number] | null => {
  const q = quote.trim();
  if (!q) return null;
  const exact = stored.indexOf(q);
  if (exact >= 0) return [exact, exact + q.length];
  // Map every visible character back to its place in the stored text (runs of spaces count once).
  const map: number[] = [];
  let plain = '';
  for (let i = 0; i < stored.length; i++) {
    if (MARKS.includes(stored[i])) continue;
    const space = /\s/.test(stored[i]);
    if (space && plain.endsWith(' ')) continue;
    map.push(i);
    plain += space ? ' ' : stored[i];
  }
  const want = q.replace(/\s+/g, ' ');
  const start = plain.indexOf(want);
  if (start < 0) return null;
  const end = start + want.length - 1;
  let to = map[end] + 1;
  // Keep closing marks with the replaced text (so "**word**" doesn't leave a stray "**").
  while (to < stored.length && MARKS.includes(stored[to])) to++;
  let from = map[start];
  while (from > 0 && MARKS.includes(stored[from - 1])) from--;
  return [from, to];
};

const clean = (points: string[]) => points.map((p) => p.trim().replace(/^[-•*]\s+/, '')).filter(Boolean);

/**
 * Put the AI's text into the notes. Returns the new notes and the blocks that
 * are new or changed (so the page can show them being written), or null if
 * the selected part isn't in the notes any more.
 */
export const applyEdit = (notes: Notes, block: string, quote: string, place: EditPlace, points: string[]): { notes: Notes; changed: string[] } | null => {
  const ref = parseBlock(block);
  const add = clean(points);
  if (!ref || !add.length) return null;
  const text = blockText(notes, block);
  if (text === null) return null;

  if (place === 'replace') {
    const at = findQuote(text, quote);
    const next = at ? text.slice(0, at[0]) + add.join(' ') + text.slice(at[1]) : add.join(' ');
    return { notes: setBlock(notes, ref, next), changed: [block] };
  }

  // The summary and key terms are paragraphs, not lists: the new text joins them.
  if (ref.kind !== 'point') {
    const joined = `${text.trimEnd()}${ref.kind === 'summary' ? '\n\n' : ' '}${add.join(ref.kind === 'summary' ? '\n\n' : ' ')}`;
    return { notes: setBlock(notes, ref, joined), changed: [block] };
  }

  const sections = notes.sections.map((s, i) => {
    if (i !== ref.section) return s;
    const at = place === 'after' ? ref.point + 1 : s.points.length;
    return { ...s, points: [...s.points.slice(0, at), ...add, ...s.points.slice(at)] };
  });
  const first = place === 'after' ? ref.point + 1 : notes.sections[ref.section].points.length;
  return { notes: { ...notes, sections }, changed: add.map((_, k) => `s${ref.section}.${first + k}`) };
};

const setBlock = (notes: Notes, ref: BlockRef, text: string): Notes => {
  if (ref.kind === 'summary') return { ...notes, summary: text };
  if (ref.kind === 'term') return { ...notes, keyTerms: notes.keyTerms.map((k, i) => (i === ref.term ? { ...k, definition: text } : k)) };
  return { ...notes, sections: notes.sections.map((s, i) => (i === ref.section ? { ...s, points: s.points.map((p, j) => (j === ref.point ? text : p)) } : s)) };
};

/**
 * Highlights point at blocks by id (s1.2). Inserting points moves the ones
 * after them down, so their ids are renumbered to stay on the same text.
 */
export const shiftBlocks = <H extends { block: string }>(items: H[], block: string, place: EditPlace, added: number, sectionLength: number): H[] => {
  const ref = parseBlock(block);
  if (!ref || ref.kind !== 'point' || place === 'replace' || added <= 0) return items;
  const from = place === 'after' ? ref.point + 1 : sectionLength;
  return items.map((h) => {
    const r = parseBlock(h.block);
    return r?.kind === 'point' && r.section === ref.section && r.point >= from ? { ...h, block: `s${r.section}.${r.point + added}` } : h;
  });
};
