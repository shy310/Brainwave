/**
 * Phase 1D check, run before building the large-upload path: which
 * speech-to-text models accept audio by URL (input_audio.url), and how long a
 * long lecture takes in ONE synchronous call. Vercel functions stop after 300 s.
 *
 *   OPENROUTER_API_KEY=… npx tsx scripts/check-url-transcription.ts --url https://…/lecture.mp3 [--models a,b] [--language he]
 *
 * Use a 60–90 minute recording you're allowed to share with the providers, at a
 * public or signed URL. Writes eval/transcription/results/url-check-<date>.md.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { transcribeSpeech } from '../server/ai/stt.js';
import { DEFAULT_MODELS } from './sttModels.js';

const VERCEL_LIMIT_S = 300;

const main = async () => {
  const { values: args } = parseArgs({
    options: { url: { type: 'string' }, models: { type: 'string' }, language: { type: 'string' }, timeout: { type: 'string', default: '600' } },
  });
  const key = process.env.OPENROUTER_API_KEY ?? '';
  if (!key || !args.url) { console.error('Set OPENROUTER_API_KEY and pass --url.'); process.exit(1); }
  const models = args.models ? args.models.split(',') : DEFAULT_MODELS;
  const format = (new URL(args.url).pathname.split('.').pop() ?? 'mp3').toLowerCase() as 'mp3';

  const rows: string[] = [];
  for (const model of models) {
    const t0 = performance.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Number(args.timeout) * 1000);
    try {
      const r = await transcribeSpeech({ model, url: args.url, format, language: args.language }, key, ctl.signal);
      const s = (performance.now() - t0) / 1000;
      rows.push(`| ${model} | yes | ${s.toFixed(0)} s | ${s <= VERCEL_LIMIT_S ? 'yes' : '**no**'} | ${r.seconds ?? '—'} | ${r.cost != null ? `$${r.cost.toFixed(4)}` : '—'} | ${r.text.length} chars, ${r.segments.length} segments |`);
    } catch (err) {
      const s = (performance.now() - t0) / 1000;
      rows.push(`| ${model} | no | ${s.toFixed(0)} s | — | — | — | ${(err as Error).message.replace(/\|/g, '/').slice(0, 120)} |`);
    } finally {
      clearTimeout(timer);
    }
    console.log(rows.at(-1));
  }

  const md = [
    `# URL transcription check — ${new Date().toISOString().slice(0, 10)}`, '',
    `Audio: ${new URL(args.url).pathname.split('/').pop()}`, '',
    '| Model | Accepts URL | Time | Within 300 s | Audio seconds | Cost | Result |',
    '|---|---|---|---|---|---|---|',
    ...rows, '',
  ].join('\n');
  await mkdir('eval/transcription/results', { recursive: true });
  await writeFile(`eval/transcription/results/url-check-${new Date().toISOString().slice(0, 10)}.md`, md);
  console.log(md);
};

void main();
