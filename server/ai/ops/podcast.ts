import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import { PodcastInputSchema, PodcastScriptSchema, sanitizePodcast } from '../../../shared/media.js';
import { describeSource } from './media.js';

export const podcastScriptOp = defineOp({
  name: 'podcastScript',
  input: PodcastInputSchema,
  output: PodcastScriptSchema,
  cost: 2,
  maxTokens: 12000,
  temperature: 0.8,
  build: ({ source, length }, ctx) => [
    {
      role: 'system',
      content: `You write scripts for a warm, smart two-host educational podcast for students. It should sound like a real conversation between two friends who love the subject — not a lecture read aloud.\n\n${audience(ctx)}`,
    },
    {
      role: 'user',
      content: `${describeSource(source)}

Write a ${length === 'long' ? 'deep-dive episode of about 8–10 minutes (50–80 lines) in 3–5 chapters' : 'short episode of about 3–4 minutes (18–30 lines) in 2–3 chapters'}.
- "hosts": two hosts with first names that fit ${LOCALE_NAME[ctx.locale]} speakers, and a short "role" each — host 0 is the curious host who asks what students would ask; host 1 is the expert who explains.
- "lines": alternate naturally between speaker 0 and 1 (short back-and-forth turns, occasionally two lines in a row). Each line is 1–3 spoken sentences.
- Open with a hook, use vivid everyday analogies and at least one concrete worked example, have host 0 voice a common misconception that host 1 gently corrects, and end with a quick recap of the key takeaways.
- "chapter": a short chapter title on the first line of each chapter, "" on every other line.
- Everything is read aloud by a text-to-speech voice: write numbers and math in words ("x squared", "two thirds"), no Markdown, no LaTeX, no emoji, no stage directions.
- Write all lines in ${LOCALE_NAME[ctx.locale]}.`,
    },
  ],
  post: (script) => {
    const clean = sanitizePodcast(script);
    if (clean.lines.length < 8) throw new AiError('The episode came back too short. Please try again.', 502);
    return clean;
  },
});
