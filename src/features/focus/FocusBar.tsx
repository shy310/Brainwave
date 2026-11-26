import { useEffect, useRef, useState } from 'react';
import { Coffee, Pause, Play, Square, Timer } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { track } from '@/features/stats/activity';
import { FOCUS_CHOICES, focusLogic, focusStore, useFocus } from './focus';

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** A short, soft two-note chime (no audio file needed). */
const chime = () => {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.6);
      o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + i * 0.18); o.stop(ctx.currentTime + i * 0.18 + 0.65);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch { /* no audio */ }
};

/** Count new focus minutes as study time (the server takes at most 5 minutes per call). */
const credit = (minutes: number) => {
  for (let left = minutes; left > 0; left -= 5) track({ minutes: Math.min(5, left) });
};

/** The countdown bar under the header while focusing, and the break prompts. */
export const FocusBar = () => {
  const t = useT();
  const tf = t.focus;
  const s = useFocus();
  const [now, setNow] = useState(Date.now);
  const announced = useRef<string>('');

  useEffect(() => {
    if (!s) return;
    const step = () => {
      const at = Date.now();
      setNow(at);
      const cur = focusStore.get();
      if (!cur) return;
      const minutes = focusLogic.newMinutes(cur, at);
      let next = minutes > 0 ? { ...cur, credited: cur.credited + minutes * 60_000 } : cur;
      if (minutes > 0) credit(minutes);
      const ticked = focusLogic.tick(next, at);
      if (ticked.phase !== next.phase) {
        // Time is up: count what's left of the focus time, then chime (and notify when the tab is hidden).
        const rest = focusLogic.newMinutes(ticked, at);
        if (rest > 0) { credit(rest); next = { ...ticked, credited: ticked.credited + rest * 60_000 }; } else next = ticked;
        chime();
        const title = next.phase === 'focusDone' ? tf.doneTitle : tf.breakOver;
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          try { new Notification(title, { icon: '/favicon.svg' }); } catch { /* ignore */ }
        }
      }
      if (next !== cur) focusStore.set(next);
    };
    step();
    const id = setInterval(step, 1000);
    return () => clearInterval(id);
  }, [s?.phase, s?.pausedLeft === null, tf.doneTitle, tf.breakOver]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;
  const running = s.phase === 'focus' || s.phase === 'break';
  const left = focusLogic.left(s, now);
  const total = s.phase === 'break' ? 5 * 60_000 : s.focusMs;
  const message = s.phase === 'focusDone' ? tf.doneTitle : s.phase === 'breakDone' ? tf.breakOver : '';
  if (message && announced.current !== message) announced.current = message;

  return (
    <div className="sticky top-16 z-30 border-b border-line bg-surface/95 backdrop-blur-xl" role="region" aria-label={tf.title}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        {running ? (
          <>
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', s.phase === 'focus' ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/60 dark:text-brand-200' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300')}>
              {s.phase === 'focus' ? <Timer className="size-4" aria-hidden="true" /> : <Coffee className="size-4" aria-hidden="true" />}
            </span>
            <span className="text-sm font-medium">{s.pausedLeft !== null ? tf.paused : s.phase === 'focus' ? tf.focusing : tf.onBreak}</span>
            <span className="text-lg font-semibold tabular-nums" role="timer" aria-label={tf.left(clock(left))}>{clock(left)}</span>
            <div className="order-last h-1 w-full overflow-hidden rounded-full bg-surface-2 sm:order-none sm:w-auto sm:flex-1" aria-hidden="true">
              <div className={cn('h-full rounded-full', s.phase === 'focus' ? 'bg-brand-500' : 'bg-emerald-500')} style={{ width: `${Math.min(100, ((total - left) / total) * 100)}%` }} />
            </div>
            <div className="ms-auto flex gap-1.5">
              {s.pausedLeft !== null
                ? <Button size="sm" variant="secondary" icon={<Play className="size-4" />} onClick={() => focusStore.set(focusLogic.resume(s, Date.now()))}>{tf.resume}</Button>
                : <Button size="sm" variant="secondary" icon={<Pause className="size-4" />} onClick={() => focusStore.set(focusLogic.pause(s, Date.now()))}>{tf.pause}</Button>}
              <Button size="sm" variant="ghost" icon={<Square className="size-3.5" />} onClick={() => focusStore.set(null)}>{tf.end}</Button>
            </div>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm font-medium" role="status">{message}</p>
            <div className="flex gap-1.5">
              {s.phase === 'focusDone'
                ? <Button size="sm" icon={<Coffee className="size-4" />} onClick={() => focusStore.set(focusLogic.startBreak(s, Date.now()))}>{tf.startBreak}</Button>
                : <Button size="sm" icon={<Timer className="size-4" />} onClick={() => focusStore.set(focusLogic.start(s.focusMs / 60_000, Date.now()))}>{tf.again}</Button>}
              <Button size="sm" variant="ghost" onClick={() => focusStore.set(null)}>{tf.finish}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/** The header button: pick a length and start. */
export const FocusButton = () => {
  const t = useT();
  const tf = t.focus;
  const s = useFocus();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onDown); };
  }, [open]);

  if (s) return null;
  return (
    <div className="relative">
      <button ref={button} type="button" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen((v) => !v)}
        className="flex h-10 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg">
        <Timer className="size-5" aria-hidden="true" /><span className="hidden sm:max-md:inline lg:inline">{tf.button}</span><span className="sr-only sm:max-md:hidden lg:hidden">{tf.title}</span>
      </button>
      {open && (
        <div ref={panel} role="dialog" aria-label={tf.title}
          className="fixed inset-x-4 top-[4.5rem] z-50 space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-lift)] sm:absolute sm:inset-x-auto sm:end-0 sm:top-12 sm:w-72">
          <div>
            <h2 className="font-semibold">{tf.title}</h2>
            <p className="mt-1 text-sm text-muted">{tf.body}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {FOCUS_CHOICES.map((m) => (
              <Button key={m} variant={m === 25 ? 'primary' : 'secondary'} onClick={() => { focusStore.set(focusLogic.start(m, Date.now())); setOpen(false); }}>
                {tf.minutes(m)}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
