import { NavLink, Outlet, Link } from 'react-router';
import { useT } from '@/i18n';
import { Logo } from '@/ui/Logo';
import { cn } from '@/lib/cn';
import { NAV } from './nav';
import { AccountMenu } from './AccountMenu';
import { LanguageToggle } from './LanguageToggle';

export const AppShell = () => {
  const t = useT();
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link to="/" aria-label={t.nav.home}><Logo /></Link>
          <nav aria-label="Main" className="ms-4 hidden items-center gap-1 md:flex">
            {NAV.map(item => (
              <NavLink key={item.to} to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn(
                  'rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}>
                {item.label(t)}
              </NavLink>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            <LanguageToggle />
            <AccountMenu />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Outlet />
      </main>

      {/* Mobile bottom tabs */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        <ul className="grid grid-cols-5">
          {NAV.map(item => (
            <li key={item.to}>
              <NavLink to={item.to} end={item.to === '/'}
                className={({ isActive }) => cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  isActive ? 'text-brand-600 dark:text-brand-300' : 'text-muted',
                )}>
                <item.icon className="size-5" aria-hidden="true" />
                <span className="truncate px-1">{item.label(t)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
};
