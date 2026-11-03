import { z } from 'zod';
import { compilePlot } from './math/plot.js';

// ── Video lessons ──────────────────────────────────────────────────────────
// A video is a list of animated scenes. Every scene has narration (spoken and
// shown as captions) plus one visual. One flat shape keeps the AI's output simple.

export const SCENE_KINDS = ['title', 'bullets', 'equation', 'steps', 'graph', 'flow', 'summary'] as const;
export type SceneKind = (typeof SCENE_KINDS)[number];

export const SceneSchema = z.object({
  kind: z.enum(SCENE_KINDS),
  heading: z.string().max(160),
  /** bullets / steps / flow / summary items; title: optional subtitle in items[0]. */
  items: z.array(z.string().max(300)).max(8),
  /** equation: display LaTeX. */
  latex: z.string().max(600),
  /** graph: y as a function of x in plain math, e.g. "x^2 - 2*x". */
  fn: z.string().max(200),
  xMin: z.number().min(-1000).max(1000),
  xMax: z.number().min(-1000).max(1000),
  narration: z.string().min(1).max(900),
});
export type Scene = z.infer<typeof SceneSchema>;

export const VideoScriptSchema = z.object({
  title: z.string().min(1).max(160),
  scenes: z.array(SceneSchema).min(3).max(14),
});
export type VideoScript = z.infer<typeof VideoScriptSchema>;

export const LENGTHS = ['short', 'long'] as const;
export type MediaLength = (typeof LENGTHS)[number];

/** What a video or podcast is about: a curriculum topic, a lecture, or a free request. */
export const MediaSourceSchema = z.object({
  topicId: z.string().max(60).optional(),
  lecture: z.object({ title: z.string().max(200), text: z.string().min(20).max(80_000) }).optional(),
  prompt: z.string().min(3).max(500).optional(),
}).refine((s) => [s.topicId, s.lecture, s.prompt].filter(Boolean).length === 1, 'Give exactly one of topicId, lecture or prompt');
export type MediaSource = z.infer<typeof MediaSourceSchema>;

export const VideoInputSchema = z.object({ source: MediaSourceSchema, length: z.enum(LENGTHS).default('short') });

/** Make every scene drawable: fall back to a simpler visual when data is missing or unsafe. */
export const sanitizeScene = (s: Scene): Scene => {
  const scene = { ...s, items: s.items.map((i) => i.trim()).filter(Boolean) };
  if (scene.kind === 'graph') {
    const ok = compilePlot(scene.fn) && scene.xMax > scene.xMin;
    if (!ok) scene.kind = scene.latex ? 'equation' : scene.items.length ? 'bullets' : 'title';
  }
  if (scene.kind === 'equation' && !scene.latex.trim()) scene.kind = scene.items.length ? 'bullets' : 'title';
  if (['bullets', 'steps', 'flow', 'summary'].includes(scene.kind) && scene.items.length === 0) scene.kind = 'title';
  if (scene.kind === 'flow') scene.items = scene.items.slice(0, 5);
  return scene;
};

// ── Saved media (videos now, podcasts next) ────────────────────────────────

export const MEDIA_KINDS = ['video', 'podcast'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Where a saved video/podcast came from, for display and links. */
export interface MediaOrigin { type: 'topic' | 'lecture' | 'prompt'; ref?: string; label: string }
