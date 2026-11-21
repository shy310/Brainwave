import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Menu, type MenuItem } from '@/ui/Menu';

export interface DockAction {
  key: string;
  label: string;
  /** A fuller name for screen readers and tooltips, when the label is short. */
  name?: string;
  icon: ReactNode;
  /** Colour of the round icon, e.g. "bg-accent-500". */
  tone: string;
  onSelect?: (el: HTMLElement) => void;
  /** A short menu instead of a single action. */
  items?: MenuItem[];
  disabled?: boolean;
}

const COLLAPSED = 'bw.dockCollapsed';

const Round = ({ a, ...props }: { a: DockAction } & React.ButtonHTMLAttributes<HTMLButtonElement> & { ref?: React.Ref<HTMLButtonElement> }) => (
  <button type="button" disabled={a.disabled} aria-label={a.name ?? a.label} title={a.name} {...props}
    className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl py-1 text-[11px] font-medium text-muted transition-colors hover:text-fg disabled:opacity-40">
    <span className={cn('flex size-11 items-center justify-center rounded-full text-white shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:-translate-y-0.5 group-active:scale-90 [&>svg]:size-5', a.tone)} aria-hidden="true">
      {a.icon}
    </span>
    <span className="max-w-full truncate" aria-hidden="true">{a.label}</span>
  </button>
);

/**
 * The bar at the bottom of a lecture: round actions (share, ask, copy…) and,
 * when the recording was kept, its player. The actions fold away to leave just
 * the player.
 */
export const LectureDock = ({ actions, player }: { actions: DockAction[]; player?: ReactNode }) => {
  const t = useT();
  const [collapsed, setCollapsed] = useState(() => storage.get(COLLAPSED) === '1');
  const fold = () => setCollapsed((c) => { storage.set(COLLAPSED, c ? '0' : '1'); return !c; });

  return (
    // The page fades out behind the dock so its text never shows through the controls.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg from-40% via-bg/80 to-transparent px-3 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-8 print:hidden">
      <div className="pointer-events-auto mx-auto max-w-lg space-y-2 animate-rise">
        {!(collapsed && player) && (
          <div role="toolbar" aria-label={t.lectures.actions.toolbar}
            className="flex items-start gap-1 rounded-[1.75rem] border border-line/80 bg-surface/95 px-2 py-2.5 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            {actions.map((a) => a.items
              ? (
                <Menu key={a.key} label={a.name ?? a.label} items={a.items} above align={a.key === actions.at(-1)?.key ? 'end' : 'start'}
                  trigger={({ ref, props }) => <Round a={a} ref={ref} {...props} />} />
              )
              : <Round key={a.key} a={a} onClick={(e) => a.onSelect?.(e.currentTarget)} />)}
          </div>
        )}
        {player && (
          <div className="relative rounded-[1.75rem] border border-line/80 bg-surface/95 px-4 pb-2 pt-3 shadow-[var(--shadow-lift)] backdrop-blur-xl">
            <button type="button" onClick={fold} aria-label={collapsed ? t.lectures.actions.showActions : t.lectures.actions.hideActions} aria-expanded={!collapsed}
              className="absolute start-1/2 top-0 flex h-5 w-10 -translate-x-1/2 items-center justify-center rounded-full text-muted hover:text-fg rtl:translate-x-1/2">
              {collapsed ? <ChevronUp className="size-4" aria-hidden="true" /> : <ChevronDown className="size-4" aria-hidden="true" />}
            </button>
            {player}
          </div>
        )}
      </div>
    </div>
  );
};
