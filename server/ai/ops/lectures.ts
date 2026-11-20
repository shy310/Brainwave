import { defineOp, type AiOp, type OpContext } from '../ops.js';
import { runStructured } from '../run.js';
import { transcribeSpeech } from '../stt.js';
import { env } from '../../env.js';
import { audience, OPEN_QUESTION_RULES, QUESTION_RULES } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import { QuizSchema } from '../../../shared/learn.js';
import { sanitizeQuestions } from '../../../shared/math/validate.js';
import { candidateTopics, cleanTopicIds } from '../../../shared/topicMatch.js';
import { findTopic } from '../../../shared/curriculum.js';
import { z } from 'zod';
import { groupSegments } from '../../../shared/lectures.js';
import {
  FlashcardsInputSchema, FlashcardsSchema, ImageTextInputSchema, LectureQuizInputSchema, NotesInputSchema, NotesSchema,
  SlidesInputSchema, SlidesTextSchema, TranscribeInputSchema, TranscriptPieceSchema, type LectureLanguage, type SummaryMode,
} from '../../../shared/lectures.js';

const LANGUAGE_HINT: Record<LectureLanguage, string> = {
  auto: 'The lecture may be in English, Hebrew or a mix. Write each part in the language it was spoken in.',
  en: 'The lecture is in English.',
  he: 'The lecture is in Hebrew (it may include English technical terms — keep those in English). Write Hebrew in Hebrew script, without niqqud.',
};

const CLEANUP_RULES = `- Clean it up: remove filler words (um, uh, אה, אמ), false starts and repeated words; add punctuation; start a new paragraph when the topic shifts.
- When the speaker reads out math, write it in LaTeX inside $...$ (e.g. "x squared plus one" → $x^2 + 1$).`;

export const transcribeLlm: AiOp<z.infer<typeof TranscribeInputSchema>, z.infer<typeof TranscriptPieceSchema>> = {
  name: 'transcribe',
  input: TranscribeInputSchema,
  output: TranscriptPieceSchema,
  cost: 1,
  maxTokens: 6000,
  temperature: 0,
  build: ({ audio, language, topic }) => [
    {
      role: 'system',
      content: `You transcribe one-minute pieces of recorded university and school lectures into clean text for students.
- Write what was said. Do NOT translate and do NOT summarise.
${CLEANUP_RULES}
- Mark words you cannot make out as [inaudible]. If there is no speech at all, return an empty "text".
- The piece may start or end mid-sentence; transcribe it as it is.
${LANGUAGE_HINT[language]}${topic ? `\nThe lecture is about: ${topic}` : ''}`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Transcribe this audio.' },
        { type: 'input_audio', input_audio: { data: audio, format: 'wav' } },
      ],
    },
  ],
};

const CleanupInputSchema = z.object({ text: z.string().max(40_000), language: TranscribeInputSchema.shape.language, topic: z.string().optional() });

/** Optional second pass for speech-to-text output: tidy the TEXT, never the audio. Not a public operation. */
const cleanupOp: AiOp<z.infer<typeof CleanupInputSchema>, z.infer<typeof TranscriptPieceSchema>> = {
  name: 'transcriptCleanup',
  input: CleanupInputSchema,
  output: TranscriptPieceSchema,
  cost: 0,
  maxTokens: 6000,
  temperature: 0,
  build: ({ text, language, topic }) => [
    {
      role: 'system',
      content: `You tidy a raw speech-to-text transcript of one piece of a lecture for students.
- Keep every sentence and the speaker's wording. Do NOT summarise, translate, reorder or add anything.
${CLEANUP_RULES}
- Fix obvious mis-hearings of technical terms only when the context makes the right word certain.
${LANGUAGE_HINT[language]}${topic ? `\nThe lecture is about: ${topic}` : ''}`,
    },
    { role: 'user', content: `Raw transcript:\n"""\n${text}\n"""` },
  ],
};

/** Upstream answers that mean the whole account is blocked; another model won't help. */
const accountProblem = (err: unknown) => err instanceof AiError && [401, 402, 403].includes(err.upstreamStatus ?? 0);

export const transcribeOp = defineOp({
  ...transcribeLlm,
  // TRANSCRIBE_MODE=stt uses a dedicated speech-to-text model; the LLM path is the fallback.
  run: async (input, ctx: OpContext) => {
    if (env.transcribeMode === 'stt') {
      try {
        const result = await transcribeSpeech({
          model: env.transcribeModel,
          audio: input.audio,
          language: input.language === 'auto' ? undefined : input.language,
          prompt: input.topic ? `Lecture: ${input.topic}` : undefined,
        });
        // Paragraph times only when the text is the model's own (cleanup rewrites it).
        if (!env.transcribeCleanup || !result.text) {
          const segments = groupSegments(result.segments);
          return segments.length > 1 ? { text: result.text, segments } : { text: result.text };
        }
        return await runStructured(cleanupOp, { text: result.text, language: input.language, topic: input.topic }, ctx);
      } catch (err) {
        if (accountProblem(err)) throw err;
        console.warn('Speech-to-text failed; falling back to the LLM transcriber', err instanceof Error ? err.message : err);
      }
    }
    return runStructured(transcribeLlm, input, ctx);
  },
});

const lectureBlock = (transcript: string, slides?: string, title?: string) => [
  title ? `Lecture title: ${title}` : '',
  `Lecture transcript:\n"""\n${transcript}\n"""`,
  slides ? `Text from the lecture slides:\n"""\n${slides}\n"""` : '',
].filter(Boolean).join('\n\n');

const notesLanguage = (ctx: OpContext) =>
  `Write in ${LOCALE_NAME[ctx.locale]}${ctx.locale === 'he' ? ' (keep technical terms in their original language where students would expect them)' : ''}.`;

/** Learn topics the lecture may cover, for the model to choose from (empty when nothing matches). */
const topicChoices = (transcript: string, slides?: string, title?: string) => {
  const ids = candidateTopics([title, transcript, slides].filter(Boolean).join('\n'), 30);
  if (!ids.length) return '\n- "topics": [].';
  const list = ids.map((id) => `${id} — ${findTopic(id)!.topic.title.en}`).join('\n');
  return `\n- "topics": the ids (up to 4) of the course topics below that this lecture actually teaches, best first. [] if none really fit.\n${list}`;
};

const NOTES_STYLE: Record<SummaryMode, string> = {
  short: `Write SHORT notes for a quick review:
- "title": a short, specific title for this lecture.
- "summary": 2–3 sentences with the main takeaway.
- "sections": 2–5 sections in lecture order, each with 2–4 short "points" — only the ideas a student must remember.
- "keyTerms": at most 8 of the most important terms, one short sentence each.
- "reminders": homework, deadlines, readings or exam hints the lecturer mentioned. Empty if none.`,
  detailed: `Write study notes:
- "title": a short, specific title for this lecture.
- "summary": 3–5 sentences — what the lecture covered and the main takeaway.
- "sections": follow the order of the lecture. Each has a "heading" and 2–8 "points": complete, self-contained statements a student can revise from (definitions, formulas in LaTeX, examples, reasoning steps). Don't pad.
- "keyTerms": important terms with one-sentence definitions.
- "reminders": homework, deadlines, readings or "this will be on the exam" hints the lecturer mentioned. Empty if none.`,
  exam: `Write EXAM-PREP notes — what a student needs to answer exam questions on this lecture:
- "title": a short, specific title for this lecture.
- "summary": 2–4 sentences on what is most likely to be examined and why.
- "sections": organise by what is examinable, not lecture order. Use headings such as the key definitions, formulas and when to use them (LaTeX), methods step by step, common mistakes to avoid, and a final section of 3–6 likely exam questions (each point is one question; no answers). Points are precise and exam-ready.
- "keyTerms": every term a student could be asked to define, with a precise definition.
- "reminders": exam hints, homework, deadlines and readings the lecturer mentioned. Empty if none.`,
};

export const lectureNotesOp = defineOp({
  name: 'lectureNotes',
  input: NotesInputSchema,
  output: NotesSchema,
  cost: 2,
  maxTokens: 10000,
  temperature: 0.3,
  build: ({ transcript, slides, title, mode }, ctx) => [
    {
      role: 'system',
      content: `You turn lecture transcripts into excellent study notes, like the best student in the class would write.\n\n${audience(ctx)}\n${notesLanguage(ctx)}`,
    },
    {
      role: 'user',
      content: `${lectureBlock(transcript, slides, title)}

${NOTES_STYLE[mode]}
Use only what is in the lecture (and slides). Fix obvious transcription errors silently. Do not include a "mode" field.${topicChoices(transcript, slides, title)}`,
    },
  ],
  post: (notes, input) => ({ ...notes, mode: input.mode, topics: cleanTopicIds(notes.topics) }),
});

export const lectureQuizOp = defineOp({
  name: 'lectureQuiz',
  input: LectureQuizInputSchema,
  output: QuizSchema,
  cost: 2,
  maxTokens: 8000,
  temperature: 0.6,
  build: ({ transcript, slides, title, count }, ctx) => [
    { role: 'system', content: `You write fair, accurate quiz questions that check understanding of a specific lecture.\n\n${audience(ctx)}` },
    {
      role: 'user',
      content: `${lectureBlock(transcript, slides, title)}

Write ${count + 2} questions that test the most important ideas of THIS lecture (not general trivia). Mix "choice" and "input" questions, and include 1–2 "open" questions near the end. Order them from easier to harder. In each explanation, say briefly where in the lecture the idea came from.

${QUESTION_RULES}
${OPEN_QUESTION_RULES}`,
    },
  ],
  post: (quiz, { count }) => {
    const questions = sanitizeQuestions(quiz.questions).slice(0, count);
    if (questions.length < 3) throw new AiError('Could not build a good quiz this time. Please try again.', 502);
    return { questions };
  },
});

export const flashcardsOp = defineOp({
  name: 'flashcards',
  input: FlashcardsInputSchema,
  output: FlashcardsSchema,
  cost: 2,
  maxTokens: 6000,
  temperature: 0.4,
  build: ({ transcript, slides, title, count }, ctx) => [
    { role: 'system', content: `You make flashcards for spaced-repetition revision.\n\n${audience(ctx)}\n${notesLanguage(ctx)}` },
    {
      role: 'user',
      content: `${lectureBlock(transcript, slides, title)}

Make up to ${count} flashcards covering the key facts, definitions, formulas and ideas of this lecture.
- "front": a short question or prompt (one idea per card).
- "back": the answer in 1–3 sentences; math in LaTeX.
Skip trivia and anything not in the lecture.`,
    },
  ],
});

export const slidesTextOp = defineOp({
  name: 'slidesText',
  input: SlidesInputSchema,
  output: SlidesTextSchema,
  cost: 1,
  maxTokens: 12000,
  temperature: 0,
  build: ({ name, dataUrl }) => [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Extract the text of these lecture slides, slide by slide ("Slide 1: …"). Keep headings, bullet points, formulas (as LaTeX) and short descriptions of important diagrams. Return it in "text".',
        },
        { type: 'file', file: { filename: name || 'slides.pdf', file_data: dataUrl } },
      ],
    },
  ],
});

export const imageTextOp = defineOp({
  name: 'imageText',
  input: ImageTextInputSchema,
  output: TranscriptPieceSchema,
  cost: 1,
  maxTokens: 6000,
  temperature: 0,
  build: ({ image, kind, language }) => [
    {
      role: 'system',
      content: `You read ${kind === 'page' ? 'a scanned page of a document' : 'a photo a student took of a whiteboard, handwritten notes, slides or a textbook page'} and write out its content as clean text for study notes.
- Write everything that is written, in reading order (right-to-left for Hebrew). Do NOT translate and do NOT summarise.
- Write math in LaTeX inside $...$ (display equations in $$...$$).
- Keep headings, lists and line breaks where they help. For a table, write it as a simple Markdown table.
- For a diagram or graph, add one short line in [brackets] saying what it shows.
- Mark words you cannot read as [?]. Ignore things that are not content (fingers, desk, glare).
- If there is no readable content, return an empty "text".
${LANGUAGE_HINT[language]}`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Write out the content of this image.' },
        { type: 'image_url', image_url: { url: image } },
      ],
    },
  ],
});

export const lectureOps = { imageTextOp, transcribeOp, lectureNotesOp, lectureQuizOp, flashcardsOp, slidesTextOp };
