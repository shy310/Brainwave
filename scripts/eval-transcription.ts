/**
 * Compare transcription models on a small set of checked lecture clips.
 *
 *   OPENROUTER_API_KEY=… npx tsx scripts/eval-transcription.ts \
 *     [--dir eval/transcription] [--models openai/whisper-large-v3-turbo,…] [--llm google/gemini-2.5-flash] [--repeat 1]
 *
 * For every clip × model it records word error rate against the reference,
 * the cost the provider reported (usage.cost — not an estimate) and latency,
 * then writes results/<date>.json and results/<date>.md.
 *
 * Clips are listed in <dir>/clips.json:
 *   [{ "id": "he-01", "file": "he-01.wav", "language": "he", "topic": "Linear algebra", "math": true }]
 * Audio goes in <dir>/audio/ (not committed: it's real lecture audio), and each
 * reference transcript in <dir>/refs/<id>.txt — the words as spoken, checked by a person.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { transcribeSpeech } from '../server/ai/stt.js';
import { transcribeLlm } from '../server/ai/ops/lectures.js';
import { normalizeForWer, wordErrors } from '../shared/wer.js';

/** Speech-to-text models on OpenRouter (GET /api/v1/models?output_modalities=transcription, 2026-11-20). */
export const DEFAULT_MODELS = [
  'openai/whisper-large-v3-turbo',
  'openai/whisper-large-v3',
  'openai/gpt-4o-mini-transcribe',
  'openai/gpt-4o-transcribe',
  'openai/gpt-transcribe',
  'google/gemini-3.5-transcribe',
  'google/chirp-3',
  'elevenlabs/scribe-v2',
  'mistralai/voxtral-mini-transcribe',
  'deepgram/nova-3',
  'assemblyai/universal-3-6-pro',
];

interface Clip { id: string; file: string; language: 'he' | 'en'; topic?: string; math?: boolean }
interface Row {
  clip: string; model: string; language: string; math: boolean; seconds: number;
  wer: number | null; errors: number | null; words: number; cost: number | null; latencyMs: number; error?: string; text?: string;
}

const { values: args } = parseArgs({
  options: {
    dir: { type: 'string', default: 'eval/transcription' },
    models: { type: 'string' },
    llm: { type: 'string' },
    repeat: { type: 'string', default: '1' },
  },
});

const key = process.env.OPENROUTER_API_KEY ?? '';
if (!key) { console.error('Set OPENROUTER_API_KEY.'); process.exit(1); }
const dir = args.dir!;
const models = args.models ? args.models.split(',').map((m) => m.trim()).filter(Boolean) : DEFAULT_MODELS;
const llmModels = args.llm ? args.llm.split(',').map((m) => m.trim()).filter(Boolean) : [];
const repeat = Math.max(1, Number(args.repeat) || 1);

/** Seconds of audio in a 16-bit PCM WAV; null for other formats. */
const wavSeconds = (buf: Buffer) => {
  if (buf.toString('ascii', 0, 4) !== 'RIFF') return null;
  const byteRate = buf.readUInt32LE(28);
  let off = 12;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4), size = buf.readUInt32LE(off + 4);
    if (id === 'data') return size / byteRate;
    off += 8 + size + (size % 2);
  }
  return null;
};

/** The production LLM transcriber (same prompt), asking OpenRouter to report the cost. */
const llmTranscribe = async (model: string, audio: string, clip: Clip) => {
  const messages = transcribeLlm.build({ audio, language: clip.language, topic: clip.topic }, { userId: 'eval', demo: true, locale: 'en', grade: '12' });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'BrainWave eval' },
    body: JSON.stringify({
      model, messages, temperature: 0, max_tokens: 6000, usage: { include: true },
      response_format: { type: 'json_object' },
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { cost?: number } };
  const content = data.choices?.[0]?.message?.content ?? '';
  let text = content;
  try { text = (JSON.parse(content.replace(/^```(?:json)?|```$/g, '')) as { text: string }).text; } catch { /* plain text */ }
  return { text, cost: data.usage?.cost ?? null };
};

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const main = async () => {
  const clips = JSON.parse(await readFile(path.join(dir, 'clips.json'), 'utf8')) as Clip[];
  const rows: Row[] = [];
  const candidates: { id: string; model: string; llm: boolean }[] = [
    ...models.map((m) => ({ id: m, model: m, llm: false })),
    ...llmModels.map((m) => ({ id: `${m} (LLM prompt)`, model: m, llm: true })),
  ];

  for (const clip of clips) {
    const buf = await readFile(path.join(dir, 'audio', clip.file));
    const reference = await readFile(path.join(dir, 'refs', `${clip.id}.txt`), 'utf8');
    const audio = buf.toString('base64');
    const format = path.extname(clip.file).slice(1).toLowerCase() as 'wav';
    const seconds = wavSeconds(buf) ?? 60;
    const ref = normalizeForWer(reference);
    for (const c of candidates) {
      for (let r = 0; r < repeat; r++) {
        const t0 = performance.now();
        try {
          const out = c.llm
            ? await llmTranscribe(c.model, audio, clip)
            : await transcribeSpeech({ model: c.model, audio, format, language: clip.language, prompt: clip.topic ? `Lecture: ${clip.topic}` : undefined }, key);
          const e = wordErrors(ref, normalizeForWer(out.text));
          rows.push({ clip: clip.id, model: c.id, language: clip.language, math: !!clip.math, seconds, wer: ref.length ? e.errors / ref.length : null, errors: e.errors, words: ref.length, cost: out.cost, latencyMs: Math.round(performance.now() - t0), text: out.text });
          process.stdout.write('.');
        } catch (err) {
          rows.push({ clip: clip.id, model: c.id, language: clip.language, math: !!clip.math, seconds, wer: null, errors: null, words: ref.length, cost: null, latencyMs: Math.round(performance.now() - t0), error: (err as Error).message.slice(0, 200) });
          process.stdout.write('x');
        }
      }
    }
  }
  console.log();

  // Pooled WER (total errors / total reference words) is fairer than averaging per clip.
  const pooled = (rs: Row[]) => {
    const ok = rs.filter((r) => r.errors != null);
    const words = ok.reduce((s, r) => s + r.words, 0);
    return words ? ok.reduce((s, r) => s + r.errors!, 0) / words : NaN;
  };
  const pct = (x: number) => (Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');
  const lines = [
    `# Transcription evaluation — ${new Date().toISOString().slice(0, 10)}`, '',
    `${clips.length} clips (${clips.filter((c) => c.language === 'he').length} Hebrew, ${clips.filter((c) => c.language === 'en').length} English, ${clips.filter((c) => c.math).length} with spoken math), ${repeat} run(s) each.`,
    'WER is pooled over all words (lower is better). Cost is what OpenRouter reported in `usage.cost`.', '',
    '| Model | WER all | WER Hebrew | WER English | WER math | $ / audio minute | Median latency | Failures |',
    '|---|---|---|---|---|---|---|---|',
  ];
  const summary = candidates.map((c) => {
    const rs = rows.filter((r) => r.model === c.id);
    const costed = rs.filter((r) => r.cost != null);
    const perMin = costed.length ? costed.reduce((s, r) => s + r.cost!, 0) / (costed.reduce((s, r) => s + r.seconds, 0) / 60) : NaN;
    const s = {
      model: c.id, wer: pooled(rs), he: pooled(rs.filter((r) => r.language === 'he')), en: pooled(rs.filter((r) => r.language === 'en')),
      math: pooled(rs.filter((r) => r.math)), perMinute: perMin, latency: median(rs.filter((r) => !r.error).map((r) => r.latencyMs)) / 1000,
      failures: rs.filter((r) => r.error).length, runs: rs.length,
    };
    lines.push(`| ${s.model} | ${pct(s.wer)} | ${pct(s.he)} | ${pct(s.en)} | ${pct(s.math)} | ${Number.isFinite(perMin) ? `$${perMin.toFixed(4)}` : '—'} | ${Number.isFinite(s.latency) ? `${s.latency.toFixed(1)} s` : '—'} | ${s.failures}/${s.runs} |`);
    return s;
  });
  const failures = rows.filter((r) => r.error);
  if (failures.length) lines.push('', '## Failures', '', ...failures.map((f) => `- ${f.model} on ${f.clip}: ${f.error}`));

  const outDir = path.join(dir, 'results');
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await writeFile(path.join(outDir, `${stamp}.json`), JSON.stringify({ clips, summary, rows }, null, 2));
  await writeFile(path.join(outDir, `${stamp}.md`), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
};

void main();
