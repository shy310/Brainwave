import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from '@/ui/icons';
import { cn } from '@/lib/cn';
import { KeyTile } from './KeyTile';
import { TOOL_META, type Tool } from './tools';

/** Back to the page this one belongs to: a quiet pill whose arrow nudges on hover. */
export const BackLink = ({ to, label, className }: { to: string; label: string; className?: string }) => (
  <Link to={to} className={cn('group -ms-2.5 inline-flex h-9 max-w-full items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg', className)}>
    <ChevronLeft className="size-4 shrink-0 transition-transform duration-200 ease-[var(--ease-out)] group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" aria-hidden="true" />
    <span className="truncate" dir="auto">{label}</span>
  </Link>
);

/**
 * The actions in a tool's masthead: the main one is the raised blue key,
 * others are white keys with a line lip.
 */
export const heroAction = (_tool: Tool, kind: 'primary' | 'secondary' = 'primary') => cn(
  'btn-lip relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-[var(--dur-press)] ease-out',
  kind === 'primary'
    ? 'bg-brand-600 text-white [--lip:var(--color-brand-800)] hover:bg-brand-700'
    : 'border border-line bg-surface text-fg [--lip:var(--line)] hover:bg-surface-2',
);

/** The tile settles in only the first time a tool's page is opened in a visit; after that the page just appears. */
const useFirstVisit = (key: string) => useState(() => {
  try {
    const k = `bw.seen.${key}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  } catch { return false; }
})[0];

/**
 * A tool's masthead (Lectures, Videos, Exams…): the tool's big keycap, tilted,
 * on a soft halo of its colour with a spark; then the title in the display
 * face, a line about the tool, the page's actions and any stat stickers.
 * Compact, so the page's own content starts high.
 */
export const ToolHero = ({ tool, title, subtitle, actions, stats, back, children, className }: {
  tool: Tool; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  /** Stickers with real numbers (e.g. cards due, exams coming). */
  stats?: ReactNode;
  back?: { to: string; label: string }; children?: ReactNode; className?: string;
}) => {
  const meta = TOOL_META[tool];
  const first = useFirstVisit(tool);
  return (
    <div className="space-y-3">
      {back && <BackLink to={back.to} label={back.label} />}
      <header className={cn('flex items-start gap-5 sm:items-center sm:gap-7', className)}>
        <span className={cn('masthead-tile relative mt-1 shrink-0 sm:mt-0', first && 'masthead-first')} aria-hidden="true">
          <span className={cn('absolute -inset-3 rounded-[34px] sm:-inset-4 sm:rounded-[40px]', meta.soft)} />
          <KeyTile icon={meta.icon} tint={meta.tile} size="xl" className="-rotate-6 sm:size-24 sm:rounded-[28px] sm:[&>svg]:size-12" />
          <svg viewBox="0 0 20 20" className="masthead-spark absolute -end-3 -top-3 size-5 sm:-end-4 sm:-top-4 sm:size-6">
            <path d="M10 0 q1.6 8.4 10 10 q-8.4 1.6 -10 10 q-1.6 -8.4 -10 -10 q8.4 -1.6 10 -10 z" fill={meta.spark} />
          </svg>
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1.5">
            <h1 className="text-[2.1rem] font-extrabold leading-[1.02] sm:text-5xl" dir="auto">{title}</h1>
            {subtitle && <p className="max-w-[60ch] text-base text-muted sm:text-lg">{subtitle}</p>}
          </div>
          {(actions || stats) && (
            <div className="flex flex-wrap items-center gap-2">
              {actions}
              {stats && <span className="flex flex-wrap items-center gap-2 sm:ms-2">{stats}</span>}
            </div>
          )}
          {children}
        </div>
      </header>
    </div>
  );
};

/**
 * The header of an item's page (a lecture, an episode, an exam): back to its
 * tool, the title in the display face, a line of detail, and actions.
 */
export const PageHeader = ({ title, subtitle, back, actions, tool, className, titleClassName }: {
  title: ReactNode; subtitle?: ReactNode; back?: { to: string; label: string }; actions?: ReactNode;
  /** A small badge of the tool the item belongs to, before the title. */
  tool?: Tool; className?: string; titleClassName?: string;
}) => {
  const meta = tool ? TOOL_META[tool] : null;
  return (
    <header className={cn('space-y-3', className)}>
      {back && <BackLink to={back.to} label={back.label} />}
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
        {meta && (
          <KeyTile icon={meta.icon} tint={meta.tile} size="md" className="mt-0.5" />
        )}
        <div className="min-w-0 flex-1 basis-60 space-y-1">
          <h1 className={cn('text-3xl font-extrabold leading-tight sm:text-4xl', titleClassName)} dir="auto">{title}</h1>
          {subtitle && <div className="text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
