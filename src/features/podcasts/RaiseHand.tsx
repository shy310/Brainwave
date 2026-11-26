import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUp, Hand, Mic, Square, X } from 'lucide-react';
import { useT } from '@/i18n';
import { callAi } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { Shimmer } from '@/ui/Feedback';
import type { Locale } from '@shared/locales';
import type { PodcastAnswer, PodcastScript } from '@shared/media';
import { usePlayback, type Unit } from '@/features/media/usePlayback';
import { primeAudio } from '@/features/media/cloudVoice';
import { useDictation } from '@/features/media/useDictation';

export interface AskedQuestion { question: string; lines: PodcastAnswer['lines'] }

const scriptText = (p: PodcastScript) => p.lines.map((l) => `${p.hosts[l.speaker]?.name}: ${l.text}`).join('\n');

/**
 * The listener raised their hand: the episode is paused, they ask by voice
 * or text, and the hosts answer on air in their own voices. When the answer
 * ends the episode carries on from where it stopped.
 */
export const RaiseHand = ({ script, title, locale, at, listener, rate, unit, earlier, onAnswered, onResume, onClose }: {
  script: PodcastScript; title: string; locale: Locale;
  /** The line the episode paused on. */
  at: number;
  listener?: string; rate: number;
  /** How a host's line is spoken (their voice). */
  unit: (line: { speaker: number; text: string }) => Unit;
  earlier: AskedQuestion[];
  onAnswered: (q: AskedQuestion) => void;
  onResume: () => void;
  onClose: () => void;
}) => {
  const t = useT();
  const th = t.podcasts.hand;
  const toMessage = useAiError();
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<AskedQuestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const mic = useDictation(locale);
  const [round, setRound] = useState(0);
  const hosts = script.hosts.map((h) => h.name);

  const ask = async (text: string) => {
    const question = text.trim().slice(0, 600);
    if (!question || thinking) return;
    primeAudio();
    setThinking(true);
    setError('');
    try {
      const out = await callAi<PodcastAnswer>('podcastAnswer', {
        title: title.slice(0, 200), hosts: script.hosts, locale,
        script: scriptText(script).slice(0, 80_000),
        focus: script.lines.slice(Math.max(0, at - 2), at + 1).map((l) => `${hosts[l.speaker]}: ${l.text}`).join('\n'),
        question, listener: listener?.slice(0, 40) || undefined,
        earlier: earlier.slice(-5).map((e) => ({ question: e.question, answer: e.lines.map((l) => l.text).join(' ').slice(0, 3000) })),
      });
      const q = { question, lines: out.lines };
      setRound((n) => n + 1);
      setAsked(q);
      onAnswered(q);
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setDraft(question);
    } finally { setThinking(false); }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); void ask(draft); setDraft(''); };

  return (
    <section aria-label={th.title} className="relative space-y-4 overflow-hidden rounded-[var(--radius-card)] border border-amber-300 bg-amber-50/70 p-5 animate-pop-in dark:border-amber-700/60 dark:bg-amber-950/30">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-sm">
          <Hand className="size-6 animate-wave" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{asked ? th.answering(hosts[0], hosts[1]) : th.title}</h2>
          <p className="text-sm text-muted">{asked ? asked.question : th.body}</p>
        </div>
        <Button variant="ghost" size="sm" className="size-9 shrink-0 px-0" aria-label={th.lower} title={th.lower} onClick={onClose}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      {thinking ? (
        <p className="py-2 text-sm text-muted" aria-live="polite"><Shimmer text={th.thinking(hosts[0], hosts[1])} /></p>
      ) : asked ? (
        <Answer key={round} lines={asked.lines} hosts={hosts} unit={unit} rate={rate} onResume={onResume} onAgain={() => setAsked(null)} />
      ) : (
        <div className="space-y-3">
          {mic.supported && (
            <div className="flex flex-col items-center gap-2 py-1">
              <button type="button" onClick={() => (mic.listening ? mic.stop() : mic.start((words) => void ask(words)))}
                aria-pressed={mic.listening} aria-label={mic.listening ? th.stop : th.speak}
                className={cn('relative flex size-16 items-center justify-center rounded-full text-white shadow-[var(--shadow-lift)] transition-transform active:scale-95',
                  mic.listening ? 'bg-rose-500' : 'bg-brand-600 hover:bg-brand-700')}>
                {mic.listening && <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50 motion-reduce:hidden" aria-hidden="true" />}
                {mic.listening ? <Square className="relative size-6" fill="currentColor" aria-hidden="true" /> : <Mic className="size-7" aria-hidden="true" />}
              </button>
              <p className="min-h-5 text-center text-sm text-muted" aria-live="polite" dir="auto">
                {mic.listening ? (mic.text || th.listening) : mic.denied ? th.micDenied : th.speak}
              </p>
            </div>
          )}
          <form onSubmit={submit} className="flex gap-2">
            <Input aria-label={th.type} placeholder={th.type} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={600} dir="auto"
              autoFocus={!mic.supported} className="h-11 bg-surface" />
            <Button type="submit" className="size-11 shrink-0 px-0" aria-label={t.tutor.send} disabled={!draft.trim()}>
              <ArrowUp className="size-5" aria-hidden="true" />
            </Button>
          </form>
        </div>
      )}
    </section>
  );
};

/** The hosts' answer, spoken line by line; when it ends the episode carries on. */
const Answer = ({ lines, hosts, unit, rate, onResume, onAgain }: {
  lines: PodcastAnswer['lines']; hosts: string[]; unit: (l: { speaker: number; text: string }) => Unit; rate: number;
  onResume: () => void; onAgain: () => void;
}) => {
  const t = useT();
  const th = t.podcasts.hand;
  const answer = usePlayback(lines.map(unit), rate);
  const { play, ended } = answer;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { play(); }, []);
  useEffect(() => { if (ended) onResume(); }, [ended, onResume]);
  return (
    <>
      <ol className="space-y-2" aria-live="polite">
        {lines.map((l, i) => (
          <li key={i} className={cn('flex gap-2.5 rounded-xl p-2 transition-[background-color,opacity] duration-300',
            i === answer.index && answer.playing ? 'bg-white/80 shadow-sm dark:bg-white/10' : i > answer.index && !ended ? 'opacity-45' : '')}>
            <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
              l.speaker === 0 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-200')} aria-hidden="true">
              {hosts[l.speaker]?.charAt(0)}
            </span>
            <p className="min-w-0 flex-1 text-sm" dir="auto"><span className="font-medium">{hosts[l.speaker]}: </span>{l.text}</p>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onResume}>{th.back}</Button>
        <Button size="sm" variant="secondary" icon={<Hand className="size-4" />} onClick={() => { answer.pause(); onAgain(); }}>{th.again}</Button>
      </div>
    </>
  );
};
