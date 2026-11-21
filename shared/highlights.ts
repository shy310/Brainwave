// Highlights and comments in lecture notes. A highlight is the exact text the
// student selected inside one block of the notes (the summary, a point or a
// key term), with where it started, a colour and an optional comment.

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];
export const MAX_HIGHLIGHTS = 300;
export const MAX_QUOTE = 1000;
export const MAX_COMMENT = 1000;

export interface NoteHighlight {
  id: string;
  /** Which part of the notes: "summary", "s{section}.{point}" or "k{term}". */
  block: string;
  quote: string;
  /** Where the quote started in the block's text when it was made. */
  offset: number;
  color: HighlightColor;
  comment?: string;
  createdAt: number;
}

/**
 * Where the quote is in the block's text now: at its old place if it's still
 * there, else the occurrence nearest to it, else -1 (the notes changed).
 */
export const locate = (text: string, quote: string, offset: number): number => {
  if (!quote) return -1;
  if (text.startsWith(quote, offset)) return offset;
  let best = -1;
  for (let i = text.indexOf(quote); i !== -1; i = text.indexOf(quote, i + 1)) {
    if (best === -1 || Math.abs(i - offset) < Math.abs(best - offset)) best = i;
  }
  return best;
};

/** Add a highlight, unless the same text in the same place is already highlighted (then recolour it). */
export const addHighlight = (all: NoteHighlight[], h: NoteHighlight): NoteHighlight[] => {
  const same = all.find((x) => x.block === h.block && x.offset === h.offset && x.quote === h.quote);
  if (same) return all.map((x) => (x === same ? { ...x, color: h.color } : x));
  if (all.length >= MAX_HIGHLIGHTS) return all;
  return [...all, { ...h, quote: h.quote.slice(0, MAX_QUOTE) }];
};

/** The order they appear in the notes: summary, then sections and points, then key terms. */
export const blockOrder = (block: string): number[] => {
  if (block === 'summary') return [0, 0, 0];
  const s = /^s(\d+)\.(\d+)$/.exec(block);
  if (s) return [1, Number(s[1]), Number(s[2])];
  const k = /^k(\d+)$/.exec(block);
  return k ? [2, Number(k[1]), 0] : [3, 0, 0];
};

export const sortHighlights = (all: NoteHighlight[]): NoteHighlight[] => [...all].sort((a, b) => {
  const x = blockOrder(a.block), y = blockOrder(b.block);
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2] || a.offset - b.offset;
});
