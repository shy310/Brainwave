import { useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router';
import { LayoutGrid, Plus } from '@/ui/icons';
import { useT } from '@/i18n';
import { Logo, LogoMark } from '@/ui/Logo';
import { TOOL_META } from '@/ui/tools';
import { cn } from '@/lib/cn';
import { ALL_NAV, NAV, activeItem } from './nav';
import { Sidebar, StreakSticker } from './Sidebar';
import { CreateSheet, StudySheet } from './CreateSheet';
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
 * The app's frame. Desktop: a sidebar (an icon rail on tablets) with every page
 * and a Create key; a slim top bar over the page with your streak, Focus,
 * language and account. Phones: a top bar with the logo and a Study grid, and a
 * floating tab pill with a separate round "+" beside it.
 */
export const AppShell = () => {
  const t = useT();
  useStudyTimer();
  // While focusing, the navigation is hidden so the page has nothing else to offer.
  const focusing = useFocus()?.phase === 'focus';
  const noTabs = useTabBarHidden();
  useEnsurePush();
  const { pathname } = useLocation();
  const active = activeItem(ALL_NAV, pathname);
  const tab = activeItem(NAV, pathname);
  const tabIndex = tab ? NAV.indexOf(tab) : -1;
  const [sheet, setSheet] = useState<'create' | 'study' | null>(null);

  return (
    <div className={cn('min-h-dvh md:pb-0', !focusing && 'md:ps-[76px] lg:ps-64', focusing || noTabs ? 'pb-[env(safe-area-inset-bottom)]' : 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]', 'print:ps-0')}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      {!focusing && <Sidebar active={active} onCreate={() => setSheet('create')} />}

      <header className="sticky top-0 z-30 border-b border-line/70 bg-bg/80 backdrop-blur-xl print:hidden md:border-transparent md:bg-bg/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:px-6">
          <Link to="/" aria-label={t.nav.home} className={cn(!focusing && 'md:hidden')}>
            <span className="max-[379px]:hidden"><Logo /></span><LogoMark className="size-9 min-[380px]:hidden" />
          </Link>
          <div className="ms-auto flex items-center gap-1 sm:gap-2">
            <span className="max-[379px]:hidden"><StreakSticker /></span>
            {!focusing && (
              <button type="button" onClick={() => setSheet('study')} aria-label={t.shell.studyTitle} title={t.shell.studyTitle}
                className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg md:hidden">
                <LayoutGrid className="size-5" aria-hidden="true" />
              </button>
            )}
            <FocusButton />
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>
      <FocusBar />

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        <ClassReminders />
        <RecoveryBanner />
        {/* Each page eases in when you move between them. */}
        <div key={pathname} className="animate-rise">
          <Outlet />
        </div>
      </main>

      {/* Phones: a floating tab pill (the highlight slides to the open tab) and the round "+" beside it. */}
      <nav aria-label="Main" className={cn('fixed inset-x-3 bottom-[calc(0.625rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-2 md:hidden print:hidden', (focusing || noTabs) && 'hidden')}>
        <ul className="relative grid min-w-0 flex-1 grid-cols-5 rounded-[1.75rem] border border-line/80 bg-surface/90 p-1.5 shadow-[var(--shadow-lift)] backdrop-blur-xl">
          {tabIndex >= 0 && (
            <li aria-hidden="true" style={{ '--i': tabIndex } as React.CSSProperties}
              className="pointer-events-none absolute inset-y-1.5 start-1.5 w-[calc((100%-0.75rem)/5)] translate-x-[calc(var(--i)*100%)] rounded-[1.375rem] bg-brand-500/12 transition-transform duration-300 ease-[var(--ease-out)] rtl:-translate-x-[calc(var(--i)*100%)] dark:bg-brand-400/15" />
          )}
          {NAV.map((item, i) => {
            const Icon = TOOL_META[item.tool].icon;
            const on = i === tabIndex;
            return (
              <li key={item.to} className="relative min-w-0">
                <NavLink to={item.to} end={item.to === '/'} aria-current={on ? 'page' : undefined}
                  className={cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-[1.375rem] text-[11px] font-semibold transition-colors duration-200',
                    on ? 'text-brand-700 dark:text-brand-300' : 'text-muted active:text-fg')}>
                  <Icon className="size-[22px]"
                    weight={on ? 'fill' : 'bold'} aria-hidden="true" />
                  <span className="line-clamp-2 px-0.5 text-center leading-tight max-[379px]:sr-only">{item.label(t)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
        <button type="button" onClick={() => setSheet('create')} aria-label={t.shell.create} title={t.shell.create}
          className="key-tile relative flex size-[62px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 text-white active:translate-y-0.5">
          <Plus className="relative size-7" aria-hidden="true" />
        </button>
      </nav>

      <CreateSheet open={sheet === 'create'} onClose={() => setSheet(null)} />
      <StudySheet open={sheet === 'study'} onClose={() => setSheet(null)} />
    </div>
  );
};
