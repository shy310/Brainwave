import { defineOp } from '../ops';
import { audience } from '../prompts';
import type { ChatMessage, ContentPart } from '../openrouter';
import { findTopic } from '../../../shared/curriculum';
import { TutorInputSchema, type TutorMode } from '../../../shared/learn';

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
      mode,
      topic ? `The student is studying: ${topic.topic.title.en} (${topic.unit.title.en}) — ${topic.topic.description.en}` : '',
      weak.length ? `They have recently struggled with: ${weak.join(', ')}. Watch for related gaps, but don't mention this list unless it helps.` : '',
      'If a file or image is attached, read it carefully and refer to what it actually shows. If it is unreadable, say so.',
      'Stay on learning topics. If asked for something harmful or unrelated to studying, decline kindly and steer back.',
    ].filter(Boolean).join('\n\n');

    const history = input.messages.slice(-20);
    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    history.forEach((turn, i) => {
      const last = i === history.length - 1;
      if (last && turn.role === 'user' && input.attachment) {
        const a = input.attachment;
        const part: ContentPart = a.kind === 'image'
          ? { type: 'image_url', image_url: { url: a.dataUrl } }
          : { type: 'file', file: { filename: a.name || 'document.pdf', file_data: a.dataUrl } };
        messages.push({ role: 'user', content: [{ type: 'text', text: turn.content || 'Please help me with this.' }, part] });
      } else {
        messages.push({ role: turn.role, content: turn.content });
      }
    });
    return messages;
  },
});
