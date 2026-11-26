import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ToolArt } from './ToolArt';
import { TOOL_META, type Tool } from './tools';

/** Back to the page this one belongs to: a quiet pill whose arrow nudges on hover. */
export const BackLink = ({ to, label, className }: { to: string; label: string; className?: string }) => (
  <Link to={to} className={cn('group -ms-2.5 inline-flex h-9 max-w-full items-center gap-1 rounded-full px-2.5 text-sm font-semibold text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-fg', className)}>
    <ChevronLeft className="size-4 shrink-0 transition-transform duration-200 ease-[var(--ease-out)] group-hover:-translate-x-0.5 rtl:rotate-180 rtl:group-hover:translate-x-0.5" aria-hidden="true" />
    <span className="truncate" dir="auto">{label}</span>
  </Link>
);

/**
 * Buttons and links that sit on a tool's field: the main action is a raised
 * white key (navy on sunshine fields), others are quiet translucent pills.
 */
export const heroAction = (tool: Tool, kind: 'primary' | 'secondary' = 'primary') => {
  const onSun = TOOL_META[tool].onField !== 'text-white';
  return cn(
    'relative inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] px-4 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-[var(--dur-press)] ease-out',
    kind === 'primary'
      ? (onSun ? 'btn-lip bg-brand-950 text-white [--lip:#0b1022] hover:bg-brand-900' : 'btn-lip bg-white text-brand-900 [--lip:rgb(11_16_34/0.28)] hover:bg-brand-50')
      : (onSun ? 'bg-brand-950/10 text-brand-950 hover:bg-brand-950/15 active:scale-[0.97]' : 'bg-white/15 text-white ring-1 ring-inset ring-white/35 hover:bg-white/25 active:scale-[0.97]'),
  );
};

/** The brainwave draws itself only the first time a tool's page is opened in a visit; after that the page just appears. */
const useFirstVisit = (key: string) => useState(() => {
  try {
    const k = `bw.seen.${key}`;
    if (sessionStorage.getItem(k)) return false;
    sessionStorage.setItem(k, '1');
    return true;
  } catch { return false; }
})[0];

/**
 * The header of a tool's main page (Lectures, Videos, Exams…): the tool's
 * colour field with its scene, the page title and a line about it, and the
 * page's actions. Actions on the field use `onColor` buttons, or a white one
 * for the main action.
 */
export const ToolHero = ({ tool, title, subtitle, actions, back, children, className }: {
  tool: Tool; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  back?: { to: string; label: string }; children?: ReactNode; className?: string;
}) => {
  const meta = TOOL_META[tool];
  const first = useFirstVisit(tool);
  return (
    <div className="space-y-3">
      {back && <BackLink to={back.to} label={back.label} />}
      <header className={cn('relative isolate overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-lift)]', meta.field, meta.onField, className)}>
        <div className="relative z-10 flex min-h-36 flex-col justify-end gap-4 p-5 sm:min-h-44 sm:p-7">
          {/* The words keep clear of the scene on the end side; the actions may run under it. */}
          <div className="space-y-1.5 pe-[36%] sm:pe-[36%] lg:pe-[32%]">
            <h1 className="text-3xl font-bold leading-[1.05] sm:text-4xl" dir="auto">{title}</h1>
            {subtitle && <p className={cn('max-w-prose text-[15px] font-medium leading-snug', meta.onField === 'text-white' ? 'text-white' : 'text-brand-950')}>{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          {children}
        </div>
        <ToolArt tool={tool} draw={first} className="pointer-events-none absolute -end-2 top-2 h-28 w-[36%] max-w-64 sm:-end-3 sm:top-3 sm:h-40 sm:w-[38%] sm:max-w-72" />
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
          <span className={cn('icon-tile relative mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white', meta.tile)} aria-hidden="true">
            <meta.icon className="relative size-5" fill="currentColor" fillOpacity={0.2} />
          </span>
        )}
        <div className="min-w-0 flex-1 basis-60 space-y-1">
          <h1 className={cn('text-3xl font-bold leading-tight sm:text-4xl', titleClassName)} dir="auto">{title}</h1>
          {subtitle && <div className="text-muted">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
};
