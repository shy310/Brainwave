import { defineOp } from '../ops.js';
import { audience } from '../prompts.js';
import type { ChatMessage, ContentPart } from '../openrouter.js';
import { findTopic } from '../../../shared/curriculum.js';
import { TutorInputSchema, type TutorMode } from '../../../shared/learn.js';

const MODES: Record<TutorMode, string> = {
  tutor: `MODE — "Tutor me" (Socratic):
- Do NOT give the final answer or a full solution until the student has genuinely attempted the current step.
- Reply with ONE guiding question or ONE small hint at a time.
- After an attempt: say what they got right, point to the FIRST thing that is off, and nudge them to fix it themselves.
- Give a bigger hint only if they ask ("hint", "I'm stuck") or have missed the same step twice.
- If they clearly give up after trying, walk through the solution one step at a time.
- Keep every reply short and end with a question that hands the thinking back.`,
  explain: `MODE — "Explain":
- Give a complete, clear, step-by-step explanation now.
- Number the steps and name the rule or idea used in each. Show the work.
- Finish with a one-line recap and one quick check-in question.`,
  custom: `MODE — "Custom": the student asked to be taught like this: """{instruction}"""
- Follow it as faithfully as you can (tone, format, style).
- Only push back if it would hurt their learning (e.g. "just give me answers"), and then say why in one line.`,
};

const SPOKEN = `MODE — spoken conversation. Your reply is read aloud by a voice, and the student answers by talking, like a tutor face to face.
- Reply in 2–4 short, natural spoken sentences. Go longer only if they ask for more detail, and then still in plain talk.
- Never use lists, numbering, headings, Markdown, LaTeX, emoji or symbols. Say maths in words ("x to the power of n", "n times x to the n minus one").
- One idea at a time. Often end with a short question back to keep the conversation going.`;

export const tutorOp = defineOp({
  name: 'tutor',
  input: TutorInputSchema,
  cost: 1,
  maxTokens: 2500,
  temperature: 0.6,
  stream: true,
  build: (input, ctx) => {
    const topic = input.topicId ? findTopic(input.topicId) : undefined;
    const weak = (input.weakTopicIds ?? []).map((id) => findTopic(id)?.topic.title.en).filter(Boolean);
    const mode = MODES[input.mode].replace('{instruction}', (input.custom || 'Explain clearly and simply.').slice(0, 500));

    const systemPrompt = [
      'You are BrainWave, a warm, patient and honest AI tutor. You help students understand — you do not do their homework for them.',
      audience(ctx),
      // Talk mode: the reply is read aloud, so spoken style replaces the mode's formatting.
      input.spoken ? SPOKEN : mode,
      topic ? `The student is studying: ${topic.topic.title.en} (${topic.unit.title.en}) — ${topic.topic.description.en}` : '',
      weak.length ? `They have recently struggled with: ${weak.join(', ')}. Watch for related gaps, but don't mention this list unless it helps.` : '',
      input.lecture ? `The student is asking about a lecture they attended, "${input.lecture.title}". Answer from the lecture first; quote or point to the part you are using. If the lecture doesn't cover something, say so, then explain it anyway.\n\nLecture:\n"""\n${input.lecture.text}\n"""` : '',
      input.material
        ? `The student is ${input.material.kind === 'video' ? 'watching a video lesson' : 'listening to a podcast'} called "${input.material.title}" and paused to ask about this moment:\n"""\n${input.material.focus}\n"""\nAnswer about that moment first, in a few sentences, then offer to go deeper.\n\nFull script for context:\n"""\n${input.material.text}\n"""`
        : '',
      'If a file or image is attached, read it carefully and refer to what it actually shows. If it is unreadable, say so.',
      'Stay on learning topics. If asked for something harmful or unrelated to studying, decline kindly and steer back.',

    ].filter(Boolean).join('\n\n');

    const history = input.messages.slice(-20);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    history.forEach((turn, i) => {
      const last = i === history.length - 1;
      if (last && turn.role === 'user' && input.attachment) {
        const a = input.attachment;
        const parts: ContentPart[] = a.kind === 'image'
          ? [{ type: 'image_url', image_url: { url: a.dataUrl } }]
          : a.kind === 'pdf'
            ? [{ type: 'file', file: { filename: a.name || 'document.pdf', file_data: a.dataUrl } }]
            : [
              // A big PDF: its text, read on the student's device, plus pictures of the first pages if it is a scan.
              { type: 'text', text: `Attached PDF "${a.name}"${a.text ? ` — its text:\n\"\"\"\n${a.text}\n\"\"\"` : ' (a scan; pictures of its first pages follow)'}` },
              ...a.pages.map((url): ContentPart => ({ type: 'image_url', image_url: { url } })),
            ];
        messages.push({ role: 'user', content: [{ type: 'text', text: turn.content || 'Please help me with this.' }, ...parts] });
      } else {
        messages.push({ role: turn.role, content: turn.content });
      }
    });
    return messages;
  },
});
