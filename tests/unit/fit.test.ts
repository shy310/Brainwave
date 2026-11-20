import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { fitToSchema } from '../../server/ai/fit';
import { NotesSchema } from '../../shared/lectures';

const json = (s: z.ZodType) => z.toJSONSchema(s, { target: 'draft-7', unrepresentable: 'any' });

describe('trimming AI answers to the limits', () => {
  it('rescues over-long notes instead of rejecting them', () => {
    const notes = {
      title: 'T'.repeat(250), summary: 'S'.repeat(3500), mode: 'exam',
      sections: Array.from({ length: 25 }, (_, i) => ({ heading: `H${i}`, points: Array.from({ length: 18 }, () => 'p') })),
      keyTerms: Array.from({ length: 40 }, (_, i) => ({ term: `t${i}`, definition: 'd' })),
      reminders: [],
    };
    expect(NotesSchema.safeParse(notes).success).toBe(false);
    const fitted = NotesSchema.parse(fitToSchema(notes, json(NotesSchema)));
    expect(fitted.title).toHaveLength(200);
    expect(fitted.summary).toHaveLength(3000);
    expect(fitted.sections).toHaveLength(20);
    expect(fitted.sections[0].points).toHaveLength(15);
    expect(fitted.keyTerms).toHaveLength(30);
    expect(fitted.keyTerms[0].term).toBe('t0'); // keeps the first ones, in order
  });

  it('rounds and clamps numbers (scores)', () => {
    const GradeSchema = z.object({ score: z.number().int().min(0).max(100), criteria: z.array(z.object({ score: z.number().int().min(0).max(10) })) });
    const g = { score: 104.6, criteria: [{ score: 7.4 }] };
    const fitted = GradeSchema.parse(fitToSchema(g, json(GradeSchema)));
    expect(fitted.score).toBe(100);
    expect(fitted.criteria[0].score).toBe(7);
  });

  it('handles optional and nullable fields, and leaves real problems for validation', () => {
    const s = z.object({ a: z.string().max(3).nullable(), b: z.array(z.string()).max(1).optional(), c: z.string().min(2) });
    expect(fitToSchema({ a: null, b: ['x', 'y'], c: '1' }, json(s))).toEqual({ a: null, b: ['x'], c: '1' });
    expect(s.safeParse(fitToSchema({ a: 'abcdef', c: '1' }, json(s))).success).toBe(false); // too short stays an error
  });
});
