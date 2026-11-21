import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import { AiError } from '../openrouter.js';
import { LOCALE_NAME } from '../../../shared/locales.js';
import { YoutubeTranscriptInputSchema, YoutubeTranscriptSchema, tidyTranscript, youtubeUrl } from '../../../shared/youtube.js';

/**
 * A lecture from a YouTube video: the model (Gemini) watches the public video
 * and writes what was said, in paragraphs with their start times.
 */
export const youtubeTranscriptOp = defineOp({
  name: 'youtubeTranscript',
  input: YoutubeTranscriptInputSchema,
  output: YoutubeTranscriptSchema,
  cost: 6,
  maxTokens: 16000,
  temperature: 0.1,
  build: ({ videoId, language }, ctx) => [
    {
      role: 'system',
      content: `You transcribe lecture videos for students.

${audience(ctx)}

Write what is SAID in the video, in the language it is spoken${language !== 'auto' ? ` (${LOCALE_NAME[language]})` : ''} — do not translate or summarise.
- Split it into paragraphs of about 20–60 seconds of speech, at natural pauses or topic changes.
- "start": when each paragraph begins, in seconds from the start of the video. Times increase and never go past the end of the video.
- "length": how long the video is, in seconds.
- Keep paragraphs short — a 15-minute video should give roughly 20–40 of them. Transcribe the WHOLE video.
- Clean it up like a good transcript: punctuation, no filler words ("um", "uh"), fix obvious mis-hearings of technical terms; write maths as LaTeX in $...$.
- If something important is only shown on screen (a formula, a definition on a slide), add it in [brackets] where it appears.
- "speech": false if nobody talks in the video (music, silence); then "segments" is empty.`,
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Transcribe this video.' },
        { type: 'video_url', video_url: { url: youtubeUrl(videoId) } },
      ],
    },
  ],
  post: (out) => {
    const clean = tidyTranscript(out);
    if (out.speech && !clean.segments.length) throw new AiError('Could not read this video. Please try again.', 502);
    return { ...clean, length: out.length };
  },
});
