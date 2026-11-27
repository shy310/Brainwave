import { Link } from 'react-router';
import { Clapperboard, FileText, Headphones, MessageCircle, Mic, MonitorPlay, Upload, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n';
import { Sheet } from '@/ui/Sheet';
import { KeyTile } from '@/ui/KeyTile';
import { TOOL_META } from '@/ui/tools';
import { HELP_NAV, STUDY_NAV } from './nav';

type MakeId = 'record' | 'upload' | 'youtube' | 'document' | 'video' | 'podcast' | 'tutor';

/** Everything you can start from the "+" button, and where it goes. All existing pages. */
const MAKE: { id: MakeId; to: string; icon: LucideIcon; tint: string }[] = [
  { id: 'record', to: '/lectures/new', icon: Mic, tint: 'from-brand-400 to-brand-700' },
  { id: 'upload', to: '/lectures/new?tab=upload', icon: Upload, tint: 'from-violet-400 to-violet-700' },
  { id: 'youtube', to: '/lectures/new?tab=youtube', icon: MonitorPlay, tint: 'from-coral-400 to-coral-600' },
  { id: 'document', to: '/lectures/new?tab=pdf', icon: FileText, tint: 'from-emerald-400 to-emerald-600' },
  { id: 'video', to: '/videos', icon: Clapperboard, tint: TOOL_META.videos.tile },
  { id: 'podcast', to: '/podcasts', icon: Headphones, tint: TOOL_META.podcasts.tile },
  { id: 'tutor', to: '/tutor', icon: MessageCircle, tint: TOOL_META.tutor.tile },
];

/**
 * "+": one sheet with every way to make something new. Recording comes first
 * and spans the row; the rest are keycap tiles that settle in one after another.
 */
export const CreateSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useT();
  const tm = t.shell.make;
  return (
    <Sheet open={open} onClose={onClose} title={t.shell.createTitle} className="sm:max-w-lg">
      <ul className="create-grid grid grid-cols-2 gap-2.5 pt-1">
        {MAKE.map((m) => (
          <li key={m.id} className={m.id === 'record' ? 'col-span-2' : undefined}>
            <Link to={m.to} onClick={onClose}
              className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 transition-colors hover:border-brand-200 hover:bg-surface-2 dark:hover:border-brand-800">
              <KeyTile icon={m.icon} tint={m.tint} size={m.id === 'record' ? 'lg' : 'md'} />
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">{tm[m.id].title}</span>
                <span className="mt-0.5 block text-xs text-muted">{tm[m.id].body}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  );
};

/** On phones: the study and help tools, as a grid of keycaps. */
export const StudySheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t.shell.studyTitle}>
      {[[t.shell.sections.study, STUDY_NAV], [t.shell.sections.help, HELP_NAV]].map(([heading, items]) => (
        <section key={heading as string} className="pb-4">
          <h3 className="mb-2 text-sm font-semibold text-muted">{heading as string}</h3>
          <ul className="create-grid grid grid-cols-3 gap-2">
            {(items as typeof STUDY_NAV).map((it) => {
              const meta = TOOL_META[it.tool];
              return (
                <li key={it.to}>
                  <Link to={it.to} onClick={onClose}
                    className="group flex h-full flex-col items-center gap-2 rounded-2xl p-2.5 text-center text-xs font-semibold leading-tight transition-colors hover:bg-surface-2">
                    <KeyTile icon={meta.icon} tint={meta.tile} size="lg" />
                    {it.label(t)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </Sheet>
  );
};
