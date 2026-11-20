// A lecture keeps the notes it has written in each style, so switching back
// to a style shows the saved notes instead of asking the AI again.

import type { Notes, SummaryMode } from '@shared/lectures';

/** The notes on screen, plus the other styles already written for this lecture. */
export type SavedNotes = Notes & { other?: Partial<Record<SummaryMode, Notes>> };

export const notesMode = (n: Notes): SummaryMode => n.mode ?? 'detailed';

const bare = ({ other: _, ...n }: SavedNotes): Notes => n;

/** Show the saved notes in `mode` (keeping the current ones), or null if that style hasn't been written yet. */
export const switchNotes = (current: SavedNotes, mode: SummaryMode): SavedNotes | null => {
  const saved = current.other?.[mode];
  if (!saved) return null;
  const { [mode]: _, ...rest } = current.other!;
  return { ...saved, other: { ...rest, [notesMode(current)]: bare(current) } };
};

/**
 * New notes from the AI. The other styles are kept unless the transcript
 * changed (`keepOthers` false), when they are out of date.
 */
export const withNewNotes = (current: SavedNotes | null, fresh: Notes, keepOthers = true): SavedNotes => {
  const mode = notesMode(fresh);
  if (!current || !keepOthers) return fresh;
  const { [mode]: _, ...rest } = current.other ?? {};
  const other = notesMode(current) === mode ? rest : { ...rest, [notesMode(current)]: bare(current) };
  return Object.keys(other).length ? { ...fresh, other } : fresh;
};
