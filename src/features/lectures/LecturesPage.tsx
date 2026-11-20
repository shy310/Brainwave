import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, ArrowRight, BookOpen, BookOpenCheck, Camera, FileText, Layers, Mountain, Folder as FolderIcon, FolderPlus, Mic, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Input, Select } from '@/ui/Field';
import { Spinner } from '@/ui/Spinner';
import { linkButton } from '@/features/learn/TopicPage';
import { storage } from '@/lib/storage';
import { lectureRepo, type LectureSummary } from './repo';
import { arrangeLectures, folderRepo, type Folder, type SortKey } from './folders';
import { reviewCards, reviewRepo } from './reviews';
import { dueCount } from '@shared/srs';

const SOURCE_ICON = { record: Mic, upload: Upload, text: FileText, pdf: BookOpen, image: Camera } as const;
const VIEW_KEY = 'bw.lectures.view';

export const lectureTitle = (l: Pick<LectureSummary, 'title' | 'created_at'>, untitled: string, locale: string) =>
  l.title || `${untitled} · ${new Date(l.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}`;

const chip = (active: boolean) => cn(
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors',
  active ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-surface-2',
);

export default function LecturesPage() {
  const { t, locale } = useI18n();
  const tl = t.lectures.library;
  const [items, setItems] = useState<LectureSummary[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState('');
  const saved = (() => { try { return JSON.parse(storage.get(VIEW_KEY) ?? '{}') as { sort?: SortKey; folder?: string }; } catch { return {}; } })();
  const [sort, setSort] = useState<SortKey>(saved.sort ?? 'newest');
  const [folder, setFolder] = useState<string>(saved.folder ?? 'all');
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    Promise.all([lectureRepo.list(), folderRepo.list()])
      .then(([l, f]) => { setItems(l); setFolders(f); })
      .catch((err) => { console.error(err); setError(true); });
  }, []);

  const [due, setDue] = useState(0);
  useEffect(() => {
    Promise.all([lectureRepo.studyMaterial('all'), reviewRepo.list()])
      .then(([lectures, states]) => setDue(dueCount(reviewCards(lectures, (l) => l.title), states, Date.now())))
      .catch(() => setDue(0));
  }, []);

  useEffect(() => { storage.set(VIEW_KEY, JSON.stringify({ sort, folder })); }, [sort, folder]);
  // A remembered folder that no longer exists falls back to All.
  const current = folders.find((f) => f.id === folder);
  const activeFolder = folder === 'all' || folder === 'none' || current ? folder : 'all';

  const untitled = (l: LectureSummary) => lectureTitle(l, t.lectures.untitled, locale);
  const shown = useMemo(() => (items ? arrangeLectures(items, { query, folder: activeFolder, sort, untitled, locale }) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, query, activeFolder, sort, locale]);
  const count = (id: string | 'none') => items?.filter((l) => (id === 'none' ? !l.folder_id : l.folder_id === id)).length ?? 0;

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const f = await folderRepo.create(name, folders.length);
      setFolders((all) => [...all, f]);
      setFolder(f.id);
      setCreating(false);
      setName('');
    } catch (err) { console.error(err); setError(true); }
  };

  const renameFolder = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !name.trim()) return;
    await folderRepo.rename(current.id, name).catch(() => setError(true));
    setFolders((all) => all.map((f) => (f.id === current.id ? { ...f, name: name.trim() } : f)));
    setRenaming(false);
  };

  const move = async (delta: -1 | 1) => {
    if (!current) return;
    const i = folders.indexOf(current), j = i + delta;
    if (j < 0 || j >= folders.length) return;
    const next = [...folders];
    [next[i], next[j]] = [next[j], next[i]];
    setFolders(next.map((f, position) => ({ ...f, position })));
    await folderRepo.reorder(next.map((f) => f.id)).catch(() => setError(true));
  };

  const removeFolder = async () => {
    if (!current || !window.confirm(tl.confirmRemove(current.name))) return;
    await folderRepo.remove(current.id).catch(() => setError(true));
    setFolders((all) => all.filter((f) => f.id !== current.id));
    setItems((all) => all?.map((l) => (l.folder_id === current.id ? { ...l, folder_id: null } : l)) ?? null);
    setFolder('all');
  };

  const hasAny = Boolean(items?.length);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t.lectures.title}</h1>
          <p className="text-muted">{t.lectures.subtitle}</p>
        </div>
        <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
          <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
        </Link>
      </header>

      {error && <Alert tone="error">{t.auth.errors.generic}</Alert>}
      {!items && !error && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>}

      {items?.length === 0 && (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-accent-600 text-white">
            <Mic className="size-7" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">{t.lectures.empty}</h2>
            <p className="mt-1 max-w-md text-muted">{t.lectures.emptyBody}</p>
          </div>
          <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
            <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
          </Link>
        </Card>
      )}

      {due > 0 && (
        <Link to="/lectures/review" className="flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-4 hover:bg-brand-100 dark:border-brand-800 dark:bg-brand-900/30">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white"><Layers className="size-5" aria-hidden="true" /></span>
          <span className="min-w-0 flex-1 font-medium">{t.lectures.review.due(due)}</span>
          <span className="text-sm font-medium text-brand-700 dark:text-brand-200">{t.lectures.review.start}</span>
        </Link>
      )}

      {hasAny && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input type="search" aria-label={tl.search} placeholder={tl.search} value={query} onChange={(e) => setQuery(e.target.value)} className="ps-9" dir="auto" />
            </div>
            <Select aria-label={tl.sort} value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="sm:w-48">
              {(['newest', 'oldest', 'title'] as const).map((s) => <option key={s} value={s}>{tl.sorts[s]}</option>)}
            </Select>
          </div>

          <nav aria-label={tl.folders} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            <button type="button" className={chip(activeFolder === 'all')} aria-pressed={activeFolder === 'all'} onClick={() => setFolder('all')}>
              {tl.all} <span className="opacity-70">{items!.length}</span>
            </button>
            {folders.map((f) => (
              <button key={f.id} type="button" className={chip(activeFolder === f.id)} aria-pressed={activeFolder === f.id} onClick={() => { setFolder(f.id); setRenaming(false); }}>
                <FolderIcon className="size-4" aria-hidden="true" /><span dir="auto">{f.name}</span> <span className="opacity-70">{count(f.id)}</span>
              </button>
            ))}
            {folders.length > 0 && count('none') > 0 && (
              <button type="button" className={chip(activeFolder === 'none')} aria-pressed={activeFolder === 'none'} onClick={() => setFolder('none')}>
                {tl.unfiled} <span className="opacity-70">{count('none')}</span>
              </button>
            )}
            {!creating && (
              <button type="button" className={cn(chip(false), 'border-dashed')} onClick={() => { setCreating(true); setName(''); }}>
                <FolderPlus className="size-4" aria-hidden="true" />{tl.newFolder}
              </button>
            )}
          </nav>

          {creating && (
            <form onSubmit={createFolder} className="flex gap-2">
              <Input aria-label={tl.folderName} placeholder={tl.folderName} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus dir="auto" />
              <Button type="submit">{tl.create}</Button>
              <Button variant="secondary" onClick={() => setCreating(false)}>{t.common.cancel}</Button>
            </form>
          )}

          {current && !creating && (
            renaming ? (
              <form onSubmit={renameFolder} className="flex gap-2">
                <Input aria-label={tl.folderName} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoFocus dir="auto" />
                <Button type="submit">{t.common.save}</Button>
                <Button variant="secondary" onClick={() => setRenaming(false)}>{t.common.cancel}</Button>
              </form>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={<Pencil className="size-4" />} onClick={() => { setName(current.name); setRenaming(true); }}>{tl.rename}</Button>
                <Button variant="ghost" size="sm" aria-label={tl.moveEarlier} disabled={folders.indexOf(current) === 0} onClick={() => void move(-1)}>
                  <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" aria-label={tl.moveLater} disabled={folders.indexOf(current) === folders.length - 1} onClick={() => void move(1)}>
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => void removeFolder()}>{tl.remove}</Button>
              </div>
            )
          )}

          {activeFolder !== 'none' && (activeFolder === 'all' ? items!.length : count(activeFolder)) > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/lectures/study?folder=${activeFolder}`} className={cn(linkButton, 'flex-1 border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 sm:flex-none dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100')}>
                <BookOpenCheck className="size-4" aria-hidden="true" />{activeFolder === 'all' ? t.lectures.study.studyAll : t.lectures.study.studyFolder}
              </Link>
              <Link to={`/play?folder=${activeFolder}`} className={cn(linkButton, 'flex-1 border border-line bg-surface hover:bg-surface-2 sm:flex-none')}>
                <Mountain className="size-4" aria-hidden="true" />{t.game.play}
              </Link>
            </div>
          )}

          {shown.length === 0 && (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-muted">
              {query.trim() ? tl.noResults(query.trim()) : tl.emptyFolder}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((l) => {
              const Icon = SOURCE_ICON[l.source];
              const inFolder = folders.find((f) => f.id === l.folder_id);
              return (
                <Link key={l.id} to={`/lectures/${l.id}`} className="rounded-[var(--radius-card)]">
                  <Card className="flex items-start gap-3 p-4 transition-shadow hover:shadow-[var(--shadow-lift)]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" dir="auto">{untitled(l)}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {t.lectures.sources[l.source]}
                        {l.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(l.duration_sec / 60)))}`}
                        {' · '}{new Date(l.created_at).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB')}
                        {inFolder && activeFolder === 'all' && <> · <span dir="auto">{inFolder.name}</span></>}
                      </p>
                    </div>
                    {l.status !== 'ready' && (
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                        l.status === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200')}>
                        {t.lectures.status[l.status]}
                      </span>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
