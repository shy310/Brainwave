import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsLeft, ChevronsRight, Hand, MessageCircleQuestion, Pause, Play, RotateCcw, SkipBack, SkipForward } from 'lucide-react';
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
/** A control on the purple player: white icon, a soft white wash on hover. */
const PLAYER_BTN = 'flex size-10 items-center justify-center rounded-full text-white transition-[background-color,transform] duration-150 hover:bg-white/15 active:scale-95';

const HOST_STYLE = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/60 dark:text-violet-200',
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
      {/* The player on the podcast's purple field, the way a listening app shows "now playing". */}
      <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[linear-gradient(150deg,#7c45db,#3f2470)] p-5 text-white shadow-[var(--shadow-lift)] sm:p-6">
        <div className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-white/8" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          {/* The two hosts, side by side. */}
          <span className="flex shrink-0 -space-x-3 rtl:space-x-reverse" aria-hidden="true">
            {script.hosts.slice(0, 2).map((h, n) => (
              <span key={n} className={cn('flex size-12 items-center justify-center rounded-full font-display text-lg font-bold ring-[3px] ring-[#5b2aa8]', n ? 'bg-emerald-300 text-emerald-950' : 'bg-white text-violet-700')}>
                {h.name.charAt(0)}
              </span>
            ))}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">{script.hosts.map((h) => h.name).join(' · ')}</p>
            <p className="truncate font-display text-lg font-bold" dir="auto">{script.lines[currentChapter]?.chapter}</p>
            <p className="flex items-center gap-2 text-xs font-medium text-white">
              {playing && (
                <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
                  {[0, 1, 2, 3].map((b) => <span key={b} className="podcast-eq w-0.5 rounded-full bg-accent-400" style={{ animationDelay: `${b * 120}ms` }} />)}
                </span>
              )}
              {ended ? t.podcasts.finished : t.podcasts.left(minutesLeft)}
            </p>
          </div>
        </div>

        <input type="range" min={0} max={script.lines.length - 1} value={index} onChange={(e) => jump(Number(e.target.value))}
          aria-label={t.podcasts.transcript} className="relative mt-5 w-full accent-accent-400" />

        <div className="relative mt-3 flex items-center justify-center gap-1 sm:gap-2">
          <button type="button" className={PLAYER_BTN} aria-label={t.podcasts.prevChapter}
            onClick={() => jump(chapters.filter((c) => c < currentChapter).pop() ?? 0)}>
            <ChevronsLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button type="button" className={PLAYER_BTN} aria-label={t.podcasts.back} onClick={() => jump(index - 1)}>
            <SkipBack className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button type="button" aria-label={ended ? t.podcasts.replay : playing ? t.podcasts.pause : t.podcasts.play} onClick={() => { primeAudio(); toggle(); }}
            className="mx-1 flex size-16 items-center justify-center rounded-full bg-white text-violet-700 shadow-[0_10px_24px_-10px_rgb(11_16_34/0.6)] transition-transform duration-150 ease-out active:scale-95">
            {ended ? <RotateCcw className="size-7" aria-hidden="true" /> : playing ? <Pause className="size-7" fill="currentColor" aria-hidden="true" /> : <Play className="ms-1 size-7" fill="currentColor" aria-hidden="true" />}
          </button>
          <button type="button" className={PLAYER_BTN} aria-label={t.podcasts.forward} onClick={() => jump(index + 1)}>
            <SkipForward className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button type="button" className={PLAYER_BTN} aria-label={t.podcasts.nextChapter}
            onClick={() => { const next = chapters.find((c) => c > index); if (next !== undefined) jump(next); }}>
            <ChevronsRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <label className="sr-only" htmlFor="podcast-rate">{t.podcasts.speed}</label>
          <select id="podcast-rate" value={rate} onChange={(e) => setRate(Number(e.target.value))} title={t.podcasts.speed}
            className="ms-1 h-9 rounded-full bg-white/15 px-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 [&>option]:bg-surface [&>option]:text-fg">
            {RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
        <div className="relative mt-4 flex justify-center">
          <button type="button" aria-pressed={hand} onClick={() => (hand ? setHand(false) : raise())}
            className={cn('inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold transition-[background-color,transform] duration-150 active:scale-[0.97]',
              hand ? 'bg-accent-400 text-brand-950' : 'bg-white/15 text-white ring-1 ring-inset ring-white/35 hover:bg-white/25')}>
            <Hand className={cn('size-4', hand && 'animate-wave')} aria-hidden="true" />
            {hand ? t.podcasts.hand.lower : t.podcasts.hand.raise}
          </button>
        </div>
        {voicesChecked && !cloud && voices.length === 0 && <p className="relative mt-3 text-center text-sm text-white">{t.podcasts.noVoice}</p>}
        {voicesChecked && voices.length > 0 && samePitch && <p className="relative mt-3 text-center text-xs text-white">{t.podcasts.oneVoice}</p>}
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
              className={cn('min-h-9 rounded-full border px-3.5 py-1 text-sm transition-colors',
                c === currentChapter ? 'border-violet-500 bg-violet-50 font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-100' : 'border-line bg-surface hover:bg-surface-2')}>
              <span className="tabular-nums text-muted">{n + 1}.</span> {script.lines[c].chapter}
            </button>
          ))}
        </nav>
      )}

      <section aria-label={t.podcasts.transcript}>
        <ol className="space-y-1">
          {script.lines.map((l, i) => (
            <li key={i} ref={(el) => { lineRefs.current[i] = el; }}
              className={cn('group flex gap-3 rounded-xl p-2.5 transition-colors', i === index ? 'bg-violet-50 ring-1 ring-inset ring-violet-200 dark:bg-violet-900/30 dark:ring-violet-800' : 'hover:bg-surface-2')}>
              <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold', HOST_STYLE[l.speaker])} aria-hidden="true">
                {script.hosts[l.speaker]?.name.charAt(0)}
              </span>
              <button type="button" onClick={() => playFrom(i)} className="min-w-0 flex-1 text-start" aria-label={`${t.podcasts.playFrom}: ${l.text}`}>
                {l.chapter && i > 0 && <span className="mb-1.5 inline-flex rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:bg-violet-900/40 dark:text-violet-200" dir="auto">{l.chapter}</span>}
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
