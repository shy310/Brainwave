import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ChevronRight, type IconType } from '@/ui/icons';
import { cn } from '@/lib/cn';

/** A group of rows on one rounded card, with an optional small header and a footer note. */
export const ListSection = ({ title, footer, children, className }: { title?: string; footer?: ReactNode; children: ReactNode; className?: string }) => {
  const id = useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cn('space-y-2', className)}>
      {title && <h2 id={id} className="px-1 font-display text-lg font-bold">{title}</h2>}
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-soft)]">
        {children}
      </div>
      {footer && <div className="px-4 text-sm text-muted">{footer}</div>}
    </section>
  );
};

interface RowBase {
  icon?: IconType;
  label: ReactNode;
  /** The current value, shown at the end of the row. */
  value?: ReactNode;
  /** Red text for destructive rows. */
  danger?: boolean;
  /** Extra line under the label. */
  hint?: ReactNode;
}

const RowInner = ({ icon: Icon, label, value, danger, hint, trailing }: RowBase & { trailing?: ReactNode }) => (
  <>
    {Icon && (
      // A small keycap: blue for settings and options, rose for destructive rows.
      <span className={cn('key-tile relative flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-gradient-to-br text-white',
        danger ? 'from-rose-400 to-rose-600' : 'from-brand-400 to-brand-700')} aria-hidden="true">
        <Icon className="relative size-[18px]" weight="fill" />
      </span>
    )}
    <span className="min-w-0 flex-1">
      <span className={cn('block font-medium', danger && 'text-rose-600 dark:text-rose-400')}>{label}</span>
      {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
    </span>
    {value != null && <span className="max-w-[45%] shrink-0 truncate text-end text-sm text-muted">{value}</span>}
    {trailing}
  </>
);

const rowClass = 'pressable flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2 focus-visible:-outline-offset-2';

/** A row that opens something (a link or an action), with a chevron. */
export const ListRow = (props: RowBase & ({ to: string; onClick?: never } | { onClick: () => void; to?: never }) & { chevron?: boolean }) => {
  const { to, onClick, chevron = true, ...base } = props;
  const trailing = chevron ? <ChevronRight className="size-4 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" /> : null;
  return to
    ? <Link to={to} className={rowClass}><RowInner {...base} trailing={trailing} /></Link>
    : <button type="button" onClick={onClick} className={rowClass}><RowInner {...base} trailing={trailing} /></button>;
};

/** A row with no action: a label and whatever control or value sits at its end. */
export const ListItem = ({ children, ...base }: RowBase & { children?: ReactNode }) => (
  <div className="flex min-h-14 items-center gap-3 px-4 py-2.5"><RowInner {...base} trailing={children} /></div>
);

/** A row that opens in place to show its editor ("the list is the editor"). */
export const ExpandRow = ({ children, defaultOpen = false, ...base }: RowBase & { children: ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={rowClass}>
        <RowInner {...base} trailing={<ChevronDown className={cn('size-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />} />
      </button>
      {/* Grid-rows trick: the panel's height animates from 0 to its content. */}
      <div id={id} className={cn('grid transition-[grid-template-rows] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden" inert={!open}>
          <div className="px-4 pb-4 pt-1 ps-[3.75rem] max-sm:ps-4">{children}</div>
        </div>
      </div>
    </div>
  );
};
