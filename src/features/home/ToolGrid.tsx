import { Link } from 'react-router';
import { Mic, Upload } from '@/ui/icons';
import { useT } from '@/i18n';
import { KeyTile } from '@/ui/KeyTile';
import { TOOL_META, type Tool } from '@/ui/tools';

/**
 * Home's launcher: a grid of keycaps for starting anything in one tap,
 * recording first. Each label says exactly where it goes.
 */
export const ToolGrid = () => {
  const t = useT();
  const tq = t.home.quick;
  const meta = (tool: Tool) => ({ icon: TOOL_META[tool].icon, tint: TOOL_META[tool].tile });
  const items = [
    { to: '/lectures/new', label: t.home.record, icon: Mic, tint: 'from-brand-400 to-brand-700' },
    { to: '/lectures/new?tab=upload', label: tq.upload, icon: Upload, tint: 'from-violet-400 to-violet-700' },
    { to: '/tutor', label: tq.tutor, ...meta('tutor') },
    { to: '/videos', label: t.shell.make.video.title, ...meta('videos') },
    { to: '/podcasts', label: t.shell.make.podcast.title, ...meta('podcasts') },
    { to: '/lectures/review', label: tq.review, ...meta('review') },
    { to: '/exams', label: tq.exams, ...meta('exams') },
    { to: '/play', label: tq.games, ...meta('games') },
    { to: '/groups', label: tq.groups, ...meta('groups') },
    { to: '/grader', label: tq.grade, ...meta('grader') },
  ];
  return (
    <nav aria-labelledby="quick-title" className="space-y-3">
      <h2 id="quick-title" className="font-display text-2xl font-bold">{tq.title}</h2>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-5">
        {items.map((it) => (
          <li key={it.to} className="min-w-0">
            <Link to={it.to} className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-2 text-center text-[13px] font-semibold leading-tight transition-colors hover:bg-surface sm:text-sm">
              <KeyTile icon={it.icon} tint={it.tint} size="lg" className="sm:size-16 sm:rounded-[20px] sm:[&>svg]:size-8" />
              <span className="line-clamp-2">{it.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
};
