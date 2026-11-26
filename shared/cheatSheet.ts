// Cheat sheets: a lecture squeezed onto one or two printed pages for the
// exam — dense bullets, two columns, or tables. The AI writes the content;
// tidying it is done here (pure, tested).
import { z } from 'zod';

export const CHEAT_FORMATS = ['bullets', 'columns', 'tables'] as const;
export type CheatFormat = (typeof CHEAT_FORMATS)[number];

export const CheatSheetInputSchema = z.object({
  title: z.string().max(200).optional(),
  /** The notes (or transcript) as plain text. */
  text: z.string().min(20).max(30_000),
  format: z.enum(CHEAT_FORMATS),
});
export type CheatSheetInput = z.infer<typeof CheatSheetInputSchema>;

const TableSchema = z.object({
  head: z.array(z.string().max(80)).min(2).max(4),
  rows: z.array(z.array(z.string().max(300)).max(4)).max(16),
});

export const CheatSheetSchema = z.object({
  blocks: z.array(z.object({
    heading: z.string().max(120),
    items: z.array(z.string().max(400)).max(14).default([]),
    table: TableSchema.nullable().optional(),
  })).min(1).max(16),
  /** Formulas and definitions worth memorising, written in LaTeX where it helps. */
  formulas: z.array(z.string().max(300)).max(14).default([]),
  /** Set by the server, not the model. */
  format: z.enum(CHEAT_FORMATS).optional(),
});
export type CheatSheet = z.infer<typeof CheatSheetSchema>;

/**
 * Tidy what the AI wrote: trim, drop empty items and blocks, make every table
 * row as wide as its header, and drop tables with no rows.
 */
export const cleanSheet = (s: CheatSheet, format: CheatFormat): CheatSheet => {
  const blocks = s.blocks.map((b) => {
    const items = b.items.map((i) => i.trim().replace(/^[-•*]\s+/, '')).filter(Boolean);
    let table = b.table ?? null;
    if (table) {
      const width = table.head.length;
      const rows = table.rows.filter((r) => r.some((c) => c.trim())).map((r) => Array.from({ length: width }, (_, k) => (r[k] ?? '').trim()));
      table = rows.length ? { head: table.head.map((h) => h.trim()), rows } : null;
    }
    return { heading: b.heading.trim(), items, table };
  }).filter((b) => b.items.length || b.table);
  return { blocks, formulas: s.formulas.map((f) => f.trim()).filter(Boolean), format };
};
