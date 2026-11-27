import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { Flame, Plus } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Logo, LogoMark } from '@/ui/Logo';
import { Sticker } from '@/ui/Sticker';
import { TOOL_META } from '@/ui/tools';
import { activityRepo } from '@/features/stats/activity';
import { localDay, streaks } from '@shared/activity';
import { HELP_NAV, NAV, STUDY_NAV, type NavItem } from './nav';

/**
 * The desktop sidebar (from lg) and icon rail (md–lg): the logo, a Create key,
 * then every page in three groups, each with its tool's keycap. A soft pill
 * slides to the open page (one layer clipped to the link, so it moves on the GPU).
 */
export const Sidebar = ({ active, onCreate }: { active: NavItem | null; onCreate: () => void }) => {
  const t = useT();
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ top: number; bottom: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const box = list.current;
      const el = box?.querySelector<HTMLElement>('[aria-current="page"]');
      setPill(el && box ? { top: el.offsetTop, bottom: box.offsetHeight - el.offsetTop - el.offsetHeight } : null);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (list.current) ro?.observe(list.current);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [active, t]);

  const groups: [string, NavItem[]][] = [
    [t.shell.sections.learn, NAV], [t.shell.sections.study, STUDY_NAV], [t.shell.sections.help, HELP_NAV],
  ];
  return (
    <nav aria-label="Main" className="fixed inset-y-0 start-0 z-40 hidden w-[76px] flex-col border-e border-line bg-surface/85 backdrop-blur-xl md:flex lg:w-64 print:hidden">
      <Link to="/" aria-label={t.nav.home} className="flex h-16 shrink-0 items-center justify-center px-4 lg:justify-start lg:px-5">
        <span className="lg:hidden"><LogoMark className="size-9" /></span>
        <span className="max-lg:hidden"><Logo /></span>
      </Link>
      <div className="px-3 pb-3 lg:px-4">
        <button type="button" onClick={onCreate} title={t.shell.create}
          className="btn-lip relative flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-brand-600 font-semibold text-white [--lip:var(--color-brand-800)] hover:bg-brand-700">
          <Plus className="size-5" strokeWidth={2.6} aria-hidden="true" /><span className="max-lg:sr-only">{t.shell.create}</span>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-6 lg:px-4">
        <div ref={list} className="relative">
          <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 rounded-2xl bg-brand-50 transition-[clip-path,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none dark:bg-brand-900/40', !pill && 'opacity-0')}
            style={{ clipPath: pill ? `inset(${pill.top}px 0 ${pill.bottom}px 0 round 16px)` : undefined }} />
          {groups.map(([heading, items], g) => (
            <div key={heading} className={cn(g > 0 && 'mt-3 border-t border-line pt-3 lg:border-0 lg:pt-0')}>
              <p className="mb-1 px-2.5 text-xs font-semibold text-muted max-lg:sr-only">{heading}</p>
              <ul className="space-y-0.5">
                {items.map((it) => {
                  const meta = TOOL_META[it.tool];
                  const on = active?.to === it.to;
                  return (
                    <li key={it.to}>
                      <NavLink to={it.to} end={it.to === '/'} aria-current={on ? 'page' : undefined} title={it.label(t)}
                        className={cn('group relative flex h-11 items-center gap-3 rounded-2xl px-1.5 text-[15px] font-semibold transition-colors duration-200 max-lg:justify-center',
                          on ? 'text-brand-800 dark:text-brand-100' : 'text-fg/80 hover:bg-surface-2 hover:text-fg')}>
                        <span className={cn('key-tile relative flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-gradient-to-br text-white', meta.tile)} aria-hidden="true">
                          <meta.icon className="relative size-[18px]" fill="currentColor" fillOpacity={0.22} strokeWidth={2.2} />
                        </span>
                        <span className="truncate max-lg:sr-only">{it.label(t)}</span>
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
};

/** Your streak as a sticker in the top bar: real days only; nothing shows before the first one. */
export const StreakSticker = () => {
  const t = useT();
  const [days, setDays] = useState<number | null>(null);
  useEffect(() => {
    activityRepo.list(60).then((d) => setDays(streaks(d, localDay()).current)).catch(() => setDays(null));
  }, []);
  if (!days) return null;
  return <Sticker icon={Flame} tone="sun" label={t.week.streak(days)}>{days}</Sticker>;
};
