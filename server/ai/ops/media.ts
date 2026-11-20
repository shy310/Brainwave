import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { findTopic } from '../../../shared/curriculum.js';
import { VideoInputSchema, VideoScriptSchema, sanitizeScene, type MediaSource } from '../../../shared/media.js';

/** Describe what the video/podcast should teach, for the prompt. */
export const describeSource = (source: MediaSource): string => {
  if (source.topicId) {
    const ref = findTopic(source.topicId);
    if (!ref) throw new AiError('Unknown topic.', 400);
    return `Teach this curriculum topic. Subject: ${ref.course.subject}. Unit: ${ref.unit.title.en}. Topic: ${ref.topic.title.en} — ${ref.topic.description.en}`;
  }
  if (source.lecture) {
    return `Teach the main ideas of this lecture the student attended, "${source.lecture.title}". Stay faithful to what the lecture said.\n"""\n${source.lecture.text}\n"""`;
  }
  return `Teach what the student asked for: """${source.prompt}"""\nIf the request is not a learning topic, or is harmful, teach a closely related safe learning topic instead.`;
};

export const videoScriptOp = defineOp({
  name: 'videoScript',
  input: VideoInputSchema,
  output: VideoScriptSchema,
  cost: 2,
  maxTokens: 9000,
  temperature: 0.6,
  build: ({ source, length }, ctx) => [
    {
      role: 'system',
      content: `You are BrainWave, an expert teacher who scripts short animated explainer videos (like the best educational YouTube channels): one clear idea at a time, concrete examples, a friendly spoken voice.\n\n${audience(ctx)}`,
    },
    {
      role: 'user',
      content: `${describeSource(source)}

Write a ${length === 'long' ? '4–6 minute video with 8–12 scenes' : '2–3 minute video with 5–7 scenes'}.
Each scene has ONE visual ("kind") and "narration" — 1–4 short spoken sentences (what the narrator says while the visual is on screen). Narration is read aloud by a text-to-speech voice: write it the way people speak, with no Markdown, no LaTeX and no symbols — say "x squared", not "x^2".
Visual kinds and the fields they use (leave unused fields empty: "", [], and xMin -5 / xMax 5):
- "title": "heading" (+ optional subtitle in items[0]). Use for the opening scene.
- "bullets": "heading" + 2–5 short "items" (they appear one by one as the narrator speaks).
- "equation": "heading" + "latex" (one display formula, LaTeX without $).
- "steps": "heading" + 2–6 "items", each one step of a worked example (LaTeX allowed inside $...$).
- "graph": "heading" + "fn" (y in terms of x in plain math like "x^2 - 2*x" or "sin(x)") + sensible "xMin"/"xMax". Only for math/science where a graph genuinely helps.
- "flow": "heading" + 2–5 "items" that form a process or cause-and-effect chain.
- "summary": "heading" + 3–5 key takeaways. Use for the last scene.
Vary the visuals. Start with a hook, build intuition before formulas, include at least one concrete worked example, and end with the summary.
On-screen text (heading, items) must be short — a few words to one line.`,
    },
  ],
  post: (script) => ({ ...script, scenes: script.scenes.map(sanitizeScene) }),
});
