import { defineOp, type OpContext } from '../ops.js';
import { audience, QUESTION_RULES } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import { QuizSchema } from '../../../shared/learn.js';
import { sanitizeQuestions } from '../../../shared/math/validate.js';
import {
  FlashcardsInputSchema, FlashcardsSchema, LectureQuizInputSchema, LectureTextInputSchema, NotesSchema,
  SlidesInputSchema, SlidesTextSchema, TranscribeInputSchema, TranscriptPieceSchema, type LectureLanguage,
} from '../../../shared/lectures.js';

const LANGUAGE_HINT: Record<LectureLanguage, string> = {
  auto: 'The lecture may be in English, Hebrew or a mix. Write each part in the language it was spoken in.',
  en: 'The lecture is in English.',
  he: 'The lecture is in Hebrew (it may include English technical terms — keep those in English). Write Hebrew in Hebrew script, without niqqud.',
};

export const transcribeOp = defineOp({
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
- Clean it up: remove filler words (um, uh, אה, אמ), false starts and repeated words; add punctuation; start a new paragraph when the topic shifts.
- When the speaker reads out math, write it in LaTeX inside $...$ (e.g. "x squared plus one" → $x^2 + 1$).
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
});

const lectureBlock = (transcript: string, slides?: string, title?: string) => [
  title ? `Lecture title: ${title}` : '',
  `Lecture transcript:\n"""\n${transcript}\n"""`,
  slides ? `Text from the lecture slides:\n"""\n${slides}\n"""` : '',
].filter(Boolean).join('\n\n');

const notesLanguage = (ctx: OpContext) =>
  `Write in ${LOCALE_NAME[ctx.locale]}${ctx.locale === 'he' ? ' (keep technical terms in their original language where students would expect them)' : ''}.`;

export const lectureNotesOp = defineOp({
  name: 'lectureNotes',
  input: LectureTextInputSchema,
  output: NotesSchema,
  cost: 2,
  maxTokens: 10000,
  temperature: 0.3,
  build: ({ transcript, slides, title }, ctx) => [
    {
      role: 'system',
      content: `You turn lecture transcripts into excellent study notes, like the best student in the class would write.\n\n${audience(ctx)}\n${notesLanguage(ctx)}`,
    },
    {
      role: 'user',
      content: `${lectureBlock(transcript, slides, title)}

Write study notes:
- "title": a short, specific title for this lecture.
- "summary": 3–5 sentences — what the lecture covered and the main takeaway.
- "sections": follow the order of the lecture. Each has a "heading" and 2–8 "points": complete, self-contained statements a student can revise from (definitions, formulas in LaTeX, examples, reasoning steps). Don't pad.
- "keyTerms": important terms with one-sentence definitions.
- "reminders": homework, deadlines, readings or "this will be on the exam" hints the lecturer mentioned. Empty if none.
Use only what is in the lecture (and slides). Fix obvious transcription errors silently.`,
    },
  ],
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

Write ${count + 2} questions that test the most important ideas of THIS lecture (not general trivia). Mix "choice" and "input" questions and order them from easier to harder. In each explanation, say briefly where in the lecture the idea came from.

${QUESTION_RULES}`,
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

export const lectureOps = { transcribeOp, lectureNotesOp, lectureQuizOp, flashcardsOp, slidesTextOp };
