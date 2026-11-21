import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { BookOpen, CarFront, ChevronRight, Folder as FolderIcon, Library, ListChecks, Send } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { storage } from '@/lib/storage';
import { Alert } from '@/ui/Alert';
import { Spinner } from '@/ui/Spinner';
import { ListSection } from '@/ui/List';
import { DrawCheck } from '@/ui/Feedback';
import { BackLink } from '@/features/learn/CoursePage';
import { lectureTitle } from '@/features/lectures/LecturesPage';
import { lectureRepo, type StudyLecture } from '@/features/lectures/repo';
import { folderRepo, type Folder } from '@/features/lectures/folders';
import { buildGame } from './game';
import { GAMES, bestKey, type GameId } from './PlayPage';

const LOOK: Record<GameId, { icon: typeof Send; tile: string }> = {
  glide: { icon: Send, tile: 'from-sky-400 to-brand-600' },
  rush: { icon: CarFront, tile: 'from-rose-400 to-rose-600' },
};

const Row = ({ checked, onClick, icon: Icon, label, hint, role = 'radio' }: {
  checked: boolean; onClick: () => void; icon: typeof Send; label: string; hint: string; role?: 'radio' | 'checkbox';
}) => (
  <button type="button" role={role} aria-checked={checked} onClick={onClick}
    className="pressable flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-start hover:bg-surface-2 focus-visible:-outline-offset-2">
    <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-brand-500/10 text-brand-700 dark:text-brand-300">
      <Icon className="size-[18px]" aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium" dir="auto">{label}</span>
      <span className="block text-sm text-muted">{hint}</span>
    </span>
    <span className={cn('flex size-6 shrink-0 items-center justify-center border-2 transition-colors',
      role === 'radio' ? 'rounded-full' : 'rounded-md',
      checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line')} aria-hidden="true">
      {checked && <DrawCheck className="size-3.5" />}
    </span>
  </button>
);

/**
 * The arcade. First choose what the questions are about (all lectures, a
 * folder, or hand-picked lectures), then pick a game.
 */
export default function GamesPage() {
  const { t, locale } = useI18n();
  const tg = t.game;
  const [params, setParams] = useSearchParams();
  const [pool, setPool] = useState<StudyLecture[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  useEffect(() => {
    Promise.all([lectureRepo.studyMaterial('all'), folderRepo.list().catch(() => [])])
      .then(([p, f]) => { setPool(p); setFolders(f); })
      .catch(() => setPool([]));
  }, []);

  const title = useCallback((l: StudyLecture) => lectureTitle(l, t.lectures.untitled, locale), [t, locale]);
  const count = useCallback((ls: StudyLecture[]) => buildGame(ls, title, Math.random, 500).length, [title]);

  const folder = params.get('folder');
  const picked = useMemo(() => new Set((params.get('lectures') ?? '').split(',').filter(Boolean)), [params]);
  const picking = params.has('lectures');
  const chosen = folder !== null || (picking && picked.size > 0);

  const options = useMemo(() => {
    if (!pool) return null;
    return {
      all: count(pool),
      folders: folders.map((f) => ({ f, n: count(pool.filter((l) => l.folder_id === f.id)) })).filter((x) => x.n > 0),
      lectures: pool.map((l) => ({ l, n: count([l]) })).filter((x) => x.n > 0),
    };
  }, [pool, folders, count]);
  const selectedCount = useMemo(() => {
    if (!pool) return 0;
    if (folder) return folder === 'all' ? count(pool) : count(pool.filter((l) => l.folder_id === folder));
    return count(pool.filter((l) => picked.has(l.id)));
  }, [pool, folder, picked, count]);

  const set = (next: Record<string, string>) => setParams(next, { replace: true });
  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id); else s.add(id);
    set({ lectures: [...s].join(',') });
  };
  const query = params.toString();

  return (
    <div className="stagger mx-auto max-w-2xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{tg.title}</h1>
        <p className="text-muted">{tg.subtitle}</p>
      </header>

      {!options && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>}
      {options && options.all === 0 && <Alert>{tg.notEnough}</Alert>}

      {options && options.all > 0 && (
        <>
          <ListSection title={tg.source}>
            <div role="radiogroup" aria-label={tg.source} className="divide-y divide-line">
              <Row checked={folder === 'all'} onClick={() => set({ folder: 'all' })} icon={Library} label={tg.allLectures} hint={tg.questions(options.all)} />
              {options.folders.map(({ f, n }) => (
                <Row key={f.id} checked={folder === f.id} onClick={() => set({ folder: f.id })} icon={FolderIcon} label={f.name} hint={tg.questions(n)} />
              ))}
              {options.lectures.length > 1 && (
                <Row checked={picking} onClick={() => set({ lectures: [...picked].join(',') })} icon={ListChecks} label={tg.pickLectures}
                  hint={picking && picked.size ? tg.questions(selectedCount) : tg.pickOne} />
              )}
            </div>
            {picking && (
              <div role="group" aria-label={tg.pickLectures} className="divide-y divide-line border-t border-line bg-surface-2/40 ps-4">
                {options.lectures.map(({ l, n }) => (
                  <Row key={l.id} role="checkbox" checked={picked.has(l.id)} onClick={() => toggle(l.id)} icon={BookOpen} label={title(l)} hint={tg.questions(n)} />
                ))}
              </div>
            )}
          </ListSection>

          <section aria-label={tg.play} className="space-y-2">
            {!chosen && <p className="px-1 text-sm font-medium text-muted" role="status">{tg.chooseFirst}</p>}
            {chosen && selectedCount === 0 && <Alert>{tg.notEnough}</Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
              {GAMES.map((g) => {
                const { icon: Icon, tile } = LOOK[g];
                const best = Number(storage.get(bestKey(g))) || 0;
                const ready = chosen && selectedCount > 0;
                const body = (
                  <>
                    <span className={`icon-tile flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white ${tile}`}>
                      <Icon className="size-7" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-semibold">{tg[g].name}</span>
                      <span className="block text-sm text-muted">{tg[g].body}</span>
                      {best > 0 && <span className="mt-1 block text-xs font-medium text-accent-600 dark:text-accent-300">{tg.best(best)}</span>}
                    </span>
                    <ChevronRight className="size-5 shrink-0 text-muted rtl:rotate-180" aria-hidden="true" />
                  </>
                );
                const cls = 'flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]';
                return ready
                  ? <Link key={g} to={`/play/${g}?${query}`} className={cn(cls, 'pressable transition-shadow hover:shadow-[var(--shadow-lift)]')}>{body}</Link>
                  : <div key={g} className={cn(cls, 'opacity-50')}>{body}</div>;
              })}
            </div>
          </section>

          <ol className="space-y-2 rounded-[var(--radius-card)] border border-line bg-surface p-4 text-sm shadow-[var(--shadow-soft)]">
            {tg.how.map((h, i) => (
              <li key={i} className="flex gap-2"><span className="font-semibold text-brand-600 dark:text-brand-300">{i + 1}.</span>{h}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
