import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Hand, Headphones, MessageCircleQuestion, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import type { Locale } from '@shared/locales';
import type { PodcastScript } from '@shared/media';
import { estimateMs, useVoices, type Voice } from '@/features/media/speech';
import { primeAudio, useCloudVoices } from '@/features/media/cloudVoice';
import { VOICE_PAIRS } from '@shared/tts';
import { usePlayback } from '@/features/media/usePlayback';
import { RaiseHand, type AskedQuestion } from './RaiseHand';

const RATES = [0.75, 1, 1.25, 1.5, 2];
const HOST_STYLE = [
  'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200',
];

interface Props {
  script: PodcastScript;
  locale: Locale;
  title: string;
  onAsk?: (lineIndex: number) => void;
  /** The listener's first name, for the hosts to greet them when they raise their hand. */
  listener?: string;
}

export const PodcastPlayer = ({ script, locale, title, onAsk, listener }: Props) => {
  const t = useT();
  const voices = useVoices(locale);
  const cloud = useCloudVoices();
  const [rate, setRate] = useState(1);
  const [voicesChecked, setVoicesChecked] = useState(false);
  const lineRefs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => { const id = setTimeout(() => setVoicesChecked(true), 1500); return () => clearTimeout(id); }, []);

  // Two different voices when the device has them; otherwise one voice at two pitches.
  const v0: Voice = cloud ? { cloud: VOICE_PAIRS[locale][0] } : voices[0] ?? null;
  const v1: Voice = cloud ? { cloud: VOICE_PAIRS[locale][1] } : voices.find((v) => v !== v0) ?? v0;
  const samePitch = !cloud && v0 === v1;
  const unit = useCallback((l: { speaker: number; text: string }) => ({
    text: l.text,
    voice: l.speaker === 1 ? v1 : v0,
    pitch: samePitch ? (l.speaker === 1 ? 0.85 : 1.15) : 1,
    pauseAfter: 250,
  }), [v0, v1, samePitch]);
  const units = useMemo(() => script.lines.map(unit), [script, unit]);
  const { index, playing, ended, play, pause, seek, toggle } = usePlayback(units, rate);

  // Raise your hand: pause, ask, the hosts answer, then the episode carries on.
  const [hand, setHand] = useState(false);
  const [questions, setQuestions] = useState<AskedQuestion[]>([]);
  const raise = () => { primeAudio(); pause(); setHand(true); };
  const resume = useCallback(() => { setHand(false); if (!ended) play(); }, [ended, play]);

  const chapters = useMemo(() => script.lines.map((l, i) => (l.chapter ? i : -1)).filter((i) => i >= 0), [script]);
  const currentChapter = chapters.filter((c) => c <= index).pop() ?? 0;
  const minutesLeft = Math.max(1, Math.round(script.lines.slice(index).reduce((ms, l) => ms + estimateMs(l.text, rate) + 250, 0) / 60000));

  const jump = (i: number) => { seek(i); };
  const playFrom = (i: number) => { primeAudio(); seek(i); play(); };

  useEffect(() => {
    if (playing) lineRefs.current[index]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [index, playing]);

  // Headphone buttons and lock-screen controls where supported.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: script.hosts.map((h) => h.name).join(' & '), album: 'BrainWave' });
    const handlers: [MediaSessionAction, () => void][] = [
      ['play', play], ['pause', pause],
      ['previoustrack', () => seek(index - 1)], ['nexttrack', () => seek(index + 1)],
    ];
    handlers.forEach(([a, h]) => { try { navigator.mediaSession.setActionHandler(a, h); } catch { /* unsupported */ } });
    return () => handlers.forEach(([a]) => { try { navigator.mediaSession.setActionHandler(a, null); } catch { /* unsupported */ } });
  }, [title, script, play, pause, seek, index]);

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-center gap-4">
          <span className="icon-tile relative flex size-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white">
            <Headphones className="relative size-8" fill="currentColor" fillOpacity={0.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm text-muted">{script.hosts.map((h) => h.name).join(' · ')}</p>
            <p className="truncate font-semibold" dir="auto">{script.lines[currentChapter]?.chapter}</p>
            <p className="text-xs text-muted">{ended ? t.podcasts.finished : t.podcasts.left(minutesLeft)}</p>
          </div>
        </div>

        <input type="range" min={0} max={script.lines.length - 1} value={index} onChange={(e) => jump(Number(e.target.value))}
          aria-label={t.podcasts.transcript} className="mt-5 w-full accent-brand-600" />

        <div className="mt-3 flex items-center justify-center gap-1 sm:gap-2">
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.podcasts.prevChapter}
            onClick={() => jump(chapters.filter((c) => c < currentChapter).pop() ?? 0)}>
            <ChevronsLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.podcasts.back} onClick={() => jump(index - 1)}>
            <SkipBack className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button className="size-14 rounded-full px-0" aria-label={ended ? t.podcasts.replay : playing ? t.podcasts.pause : t.podcasts.play} onClick={() => { primeAudio(); toggle(); }}>
            {ended ? <RotateCcw className="size-6" aria-hidden="true" /> : playing ? <Pause className="size-6" aria-hidden="true" /> : <Play className="size-6" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.podcasts.forward} onClick={() => jump(index + 1)}>
            <SkipForward className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="sm" className="size-10 px-0" aria-label={t.podcasts.nextChapter}
            onClick={() => { const next = chapters.find((c) => c > index); if (next !== undefined) jump(next); }}>
            <ChevronsRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </Button>
          <label className="sr-only" htmlFor="podcast-rate">{t.podcasts.speed}</label>
          <select id="podcast-rate" value={rate} onChange={(e) => setRate(Number(e.target.value))} title={t.podcasts.speed}
            className="ms-2 h-9 rounded-lg border border-line bg-surface px-2 text-sm">
            {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
        <div className="mt-4 flex justify-center">
          <Button variant={hand ? 'primary' : 'secondary'} icon={<Hand className={cn('size-4', hand && 'animate-wave')} />} aria-pressed={hand}
            onClick={() => (hand ? setHand(false) : raise())}
            className={cn(!hand && 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200')}>
            {hand ? t.podcasts.hand.lower : t.podcasts.hand.raise}
          </Button>
        </div>
        {voicesChecked && !cloud && voices.length === 0 && <p className="mt-3 text-center text-sm text-muted">{t.podcasts.noVoice}</p>}
        {voicesChecked && voices.length > 0 && samePitch && <p className="mt-3 text-center text-xs text-muted">{t.podcasts.oneVoice}</p>}
      </div>

      {hand && (
        <RaiseHand script={script} title={title} locale={locale} at={index} listener={listener} rate={rate} unit={unit}
          earlier={questions} onAnswered={(q) => setQuestions((all) => [...all, q])} onResume={resume} onClose={() => setHand(false)} />
      )}

      {questions.length > 0 && !hand && (
        <details className="rounded-xl border border-line bg-surface px-4 py-2.5">
          <summary className="cursor-pointer text-sm font-medium">{t.podcasts.hand.yours(questions.length)}</summary>
          <ul className="mt-2 space-y-3 pb-1">
            {questions.map((q, i) => (
              <li key={i} className="space-y-1 text-sm">
                <p className="font-medium" dir="auto">{q.question}</p>
                {q.lines.map((l, j) => <p key={j} className="text-muted" dir="auto">{script.hosts[l.speaker]?.name}: {l.text}</p>)}
              </li>
            ))}
          </ul>
        </details>
      )}

      {chapters.length > 1 && (
        <nav aria-label={t.podcasts.chapters} className="flex flex-wrap gap-2">
          {chapters.map((c, n) => (
            <button key={c} type="button" onClick={() => playFrom(c)} aria-current={c === currentChapter} dir="auto"
              className={cn('rounded-full border px-3 py-1 text-sm transition-colors',
                c === currentChapter ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'border-line hover:bg-surface-2')}>
              <span className="tabular-nums text-muted">{n + 1}.</span> {script.lines[c].chapter}
            </button>
          ))}
        </nav>
      )}

      <section aria-label={t.podcasts.transcript}>
        <ol className="space-y-1">
          {script.lines.map((l, i) => (
            <li key={i} ref={(el) => { lineRefs.current[i] = el; }}
              className={cn('group flex gap-3 rounded-xl p-2.5 transition-colors', i === index ? 'bg-brand-50 dark:bg-brand-900/30' : 'hover:bg-surface-2')}>
              <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', HOST_STYLE[l.speaker])} aria-hidden="true">
                {script.hosts[l.speaker]?.name.charAt(0)}
              </span>
              <button type="button" onClick={() => playFrom(i)} className="min-w-0 flex-1 text-start" aria-label={`${t.podcasts.playFrom}: ${l.text}`}>
                {l.chapter && i > 0 && <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted" dir="auto">{l.chapter}</span>}
                <span className="block text-sm font-medium text-muted">{script.hosts[l.speaker]?.name}</span>
                <span className={cn('block', i === index && 'font-medium')} dir="auto">{l.text}</span>
              </button>
              {onAsk && (
                <Button variant="ghost" size="sm" className="size-8 shrink-0 px-0 opacity-70 group-hover:opacity-100" aria-label={t.podcasts.askLine} title={t.podcasts.askLine}
                  onClick={() => { pause(); onAsk(i); }}>
                  <MessageCircleQuestion className="size-4" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
