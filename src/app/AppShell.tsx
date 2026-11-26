import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import { useT } from '@/i18n';
import { Logo } from '@/ui/Logo';
import { cn } from '@/lib/cn';
import { NAV } from './nav';
import { AccountMenu } from './AccountMenu';
import { LanguageToggle } from './LanguageToggle';
import { RecoveryBanner } from '@/features/lectures/RecoveryBanner';
import { useStudyTimer } from '@/features/stats/activity';
import { ClassReminders } from '@/features/schedule/UpNext';
import { FocusBar, FocusButton } from '@/features/focus/FocusBar';
import { useFocus } from '@/features/focus/focus';
import { useTabBarHidden } from './chrome';
import { useEnsurePush } from '@/features/schedule/useEnsurePush';

/**
 * The header's page links: each with its icon, and a soft pill that slides to
 * the open page (measured, so it fits every language's label widths).
 */
const DesktopNav = ({ active, hidden }: { active: number; hidden: boolean }) => {
  const t = useT();
  const list = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ start: number; end: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = list.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? (active >= 0 ? list.current?.children[active + 1] as HTMLElement | undefined : undefined);
      const box = list.current;
      setPill(el && box ? { start: el.offsetLeft, end: box.offsetWidth - el.offsetLeft - el.offsetWidth } : null);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (list.current) ro?.observe(list.current);
    void document.fonts?.ready.then(measure);
    return () => ro?.disconnect();
  }, [active, t]);
  return (
    <nav aria-label="Main" className={cn('ms-4 hidden', !hidden && 'md:block')}>
      <div ref={list} className="relative flex items-center gap-0.5">
        {/* The highlight is one full-width layer clipped to the open link: clip-path moves on the GPU. */}
        <span aria-hidden="true" className={cn('pointer-events-none absolute inset-0 bg-brand-100 transition-[clip-path,opacity] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none dark:bg-brand-900/50', !pill && 'opacity-0')}
          style={{ clipPath: pill ? `inset(0 ${pill.end}px 0 ${pill.start}px round 9999px)` : undefined }} />
        {NAV.map((item, i) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} aria-current={i === active ? 'page' : undefined}
            className={cn(
              'relative inline-flex h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors duration-200',
              i === active ? 'text-brand-700 dark:text-brand-200' : 'text-muted hover:text-fg',
            )}>
            <item.icon className="size-4 shrink-0 max-lg:hidden" fill={i === active ? 'currentColor' : 'none'} fillOpacity={0.2} strokeWidth={i === active ? 2.25 : 2} aria-hidden="true" />
            {item.label(t)}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export const AppShell = () => {
  const t = useT();
  useStudyTimer();
  // While focusing, the navigation is hidden so the page has nothing else to offer.
  const focusing = useFocus()?.phase === 'focus';
  const noTabs = useTabBarHidden();
  useEnsurePush();
  const { pathname } = useLocation();
  /** The tab the page belongs to (deepest match), for the sliding highlight. */
  const active = NAV.reduce((best, item, i) => {
    const match = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`);
    return match && (best < 0 || item.to.length > NAV[best].to.length) ? i : best;
  }, -1);
  return (
    <div className={cn('min-h-dvh md:pb-0', focusing || noTabs ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[calc(6rem+env(safe-area-inset-bottom))]')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4 sm:px-6">
          <Link to="/" aria-label={t.nav.home}><Logo /></Link>
          <DesktopNav active={active} hidden={focusing} />
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <FocusButton />
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <FocusBar />

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10 print:max-w-none print:p-0">
        <ClassReminders />
        <RecoveryBanner />
        {/* Each page eases in when you move between them. */}
        <div key={pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>

      {/* Mobile tabs: a floating bar; the highlight slides to the open tab. */}
      <nav aria-label="Main" className={cn('fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-40 md:hidden print:hidden', (focusing || noTabs) && 'hidden')}>
        <ul className="relative grid grid-cols-5 rounded-[1.75rem] border border-line/80 bg-surface/90 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl">
          {active >= 0 && (
            <li aria-hidden="true" style={{ '--i': active } as CSSProperties}
              className="pointer-events-none absolute inset-y-1.5 start-1.5 w-[calc((100%-0.75rem)/5)] translate-x-[calc(var(--i)*100%)] rounded-[1.375rem] bg-brand-500/12 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] rtl:-translate-x-[calc(var(--i)*100%)] dark:bg-brand-400/15" />
          )}
          {NAV.map(item => (
            <li key={item.to} className="relative">
              <NavLink to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] text-[11px] font-medium transition-colors duration-200',
                  isActive ? 'text-brand-700 dark:text-brand-300' : 'text-muted active:text-fg',
                )}>
                {({ isActive }) => (
                  <>
                    <item.icon className={cn('size-[22px] transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]', isActive && '-translate-y-px scale-110')}
                      fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.2 : 0} strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                    <span className="line-clamp-2 px-1 text-center leading-tight">{item.label(t)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
