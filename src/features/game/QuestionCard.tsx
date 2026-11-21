import { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Siren } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { RichInline } from '@/ui/Rich';
import { DrawCheck } from '@/ui/Feedback';
import { SECONDS, type Ask, type GameQuestion } from './game';

const FEEDBACK_MS = 1000;

/**
 * A question over the paused game: tap an answer or press 1–4 before the bar
 * runs out. Shows right/wrong for a moment, then reports back.
 */
export const QuestionCard = ({ q, ask, onDone }: { q: GameQuestion; ask: Ask; onDone: (right: boolean) => void }) => {
  const { t } = useI18n();
  const tg = t.game;
  const [left, setLeft] = useState(SECONDS);
  const [picked, setPicked] = useState<number | null | undefined>(undefined);
  const done = useRef(onDone);
  done.current = onDone;
  const answered = picked !== undefined;

  const choose = (choice: number | null) => {
    if (answered) return;
    setPicked(choice);
    setTimeout(() => done.current(choice === q.correct), FEEDBACK_MS);
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  // Time left comes from the clock, so it stays right when the browser delays ticks.
  useEffect(() => {
    if (answered) return;
    const shownAt = Date.now();
    const id = setInterval(() => {
      const l = Math.max(0, SECONDS - (Date.now() - shownAt) / 1000);
      setLeft(l);
      if (l <= 0) chooseRef.current(null);
    }, 100);
    return () => clearInterval(id);
  }, [answered]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= q.options.length) { e.preventDefault(); chooseRef.current(n - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q]);

  const right = answered && picked === q.correct;
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="game-q" className="max-h-full w-full overflow-y-auto rounded-3xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)] animate-pop-in">
      <p className={cn('mb-2 flex items-center gap-1.5 text-sm font-semibold', ask === 'rescue' ? 'text-rose-600 dark:text-rose-400' : 'text-brand-700 dark:text-brand-300')}>
        {ask === 'rescue' ? <Siren className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
        {ask === 'rescue' ? tg.rescue : tg.checkpoint}
        <span className="font-normal text-muted">· {ask === 'rescue' ? tg.rescueHint : tg.checkpointHint}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-label={tg.timeUp} aria-valuemin={0} aria-valuemax={SECONDS} aria-valuenow={Math.ceil(left)}>
        <div className={cn('h-full rounded-full transition-[width] duration-100 ease-linear motion-reduce:transition-none', left < 4 ? 'bg-rose-500' : 'bg-brand-500')}
          style={{ width: `${(left / SECONDS) * 100}%` }} />
      </div>
      <h2 id="game-q" className="mt-3 text-lg font-semibold leading-snug" dir="auto"><RichInline text={q.prompt} /></h2>
      <p className="mt-0.5 text-xs text-muted" dir="auto">{tg.from(q.from)}</p>
      <div className="mt-3 grid gap-2">
        {q.options.map((o, i) => {
          const isRight = answered && i === q.correct;
          const isWrongPick = answered && !right && i === picked;
          return (
            <button key={i} type="button" disabled={answered} onClick={() => choose(i)} autoFocus={i === 0}
              className={cn('pressable flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2 text-start text-sm transition-colors',
                !answered && 'border-line hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30',
                isRight && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40',
                isWrongPick && 'animate-shake border-rose-400 bg-rose-50 dark:bg-rose-950/40',
                answered && !isRight && !isWrongPick && 'border-line opacity-50')}>
              <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold', isRight ? 'bg-emerald-500 text-white' : 'bg-surface-2')}>
                {isRight ? <DrawCheck className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1" dir="auto"><RichInline text={o} /></span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 min-h-5 text-sm font-semibold" aria-live="assertive">
        {answered && (right ? <span className="text-emerald-600 dark:text-emerald-400">{tg.correct}</span>
          : <span className="text-rose-600 dark:text-rose-400">{picked === null ? tg.timeUp : tg.wrong}</span>)}
      </p>
      <p className="hidden text-xs text-muted sm:block">{tg.keys}</p>
    </div>
  );
};
