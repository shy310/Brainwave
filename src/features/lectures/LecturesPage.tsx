import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, ArrowRight, BookOpen, BookOpenCheck, FileType, MonitorPlay, CalendarClock, CalendarDays, Camera, FileText, Gamepad2, Layers, Folder as FolderIcon, FolderInput, FolderPlus, Mic, MoreHorizontal, Pencil, Star, StarOff, Check, Plus, Search, Trash2, Upload, Users } from 'lucide-react';
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
import { useDragReorder } from './useDragReorder';
import { useDueCount } from './reviews';
import { UpNextBanner } from '@/features/schedule/UpNext';
import { IconTile } from '@/ui/IconTile';
import { dateLocale } from '@shared/locales';
import { EmptyState } from '@/ui/EmptyState';
import { StarBurst } from '@/ui/Feedback';
import { ContextMenu, useContextTriggers, type ContextMenuState } from '@/ui/ContextMenu';
import { Sheet } from '@/ui/Sheet';
import { ListSection } from '@/ui/List';
import { askConfirm } from '@/ui/Confirm';

const SOURCE_ICON = { record: Mic, upload: Upload, text: FileText, pdf: BookOpen, image: Camera, youtube: MonitorPlay, document: FileType } as const;
const VIEW_KEY = 'bw.lectures.view';

export const lectureTitle = (l: Pick<LectureSummary, 'title' | 'created_at'>, untitled: string, locale: string) =>
  l.title || `${untitled} · ${new Date(l.created_at).toLocaleDateString(dateLocale(locale), { day: 'numeric', month: 'short' })}`;

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
  const navigate = useNavigate();
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const triggers = useContextTriggers();
  // The lecture being renamed or moved from the menu.
  const [editing, setEditing] = useState<{ lecture: LectureSummary; mode: 'rename' | 'move' } | null>(null);
  const [lectureName, setLectureName] = useState('');

  useEffect(() => {
    Promise.all([lectureRepo.list(), folderRepo.list()])
      .then(([l, f]) => { setItems(l); setFolders(f); })
      .catch((err) => { console.error(err); setError(true); });
  }, []);

  const due = useDueCount();

  useEffect(() => { storage.set(VIEW_KEY, JSON.stringify({ sort, folder })); }, [sort, folder]);
  // A remembered folder that no longer exists falls back to All.
  const current = folders.find((f) => f.id === folder);
  const hasFavorites = Boolean(items?.some((l) => l.favorite));
  const activeFolder = folder === 'all' || folder === 'none' || current || (folder === 'favorites' && hasFavorites) ? folder : 'all';

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
    if (!current || !(await askConfirm({ message: tl.confirmRemove(current.name), action: 'delete' }))) return;
    await folderRepo.remove(current.id).catch(() => setError(true));
    setFolders((all) => all.filter((f) => f.id !== current.id));
    setItems((all) => all?.map((l) => (l.folder_id === current.id ? { ...l, folder_id: null } : l)) ?? null);
    setFolder('all');
  };

  // Drag folders to reorder them (mouse, or long-press on touch); the arrow buttons do the same from the keyboard.
  const drag = useDragReorder(folders.map((f) => f.id), (ids) => {
    const next = ids.map((id, position) => ({ ...folders.find((f) => f.id === id)!, position }));
    setFolders(next);
    void folderRepo.reorder(ids).catch(() => setError(true));
  });
  const shownFolders = drag.order.map((id) => folders.find((f) => f.id === id)).filter((f): f is Folder => !!f);

  const hasAny = Boolean(items?.length);

  const patchLecture = async (id: string, patch: Partial<LectureSummary>) => {
    setItems((all) => all?.map((l) => (l.id === id ? { ...l, ...patch } : l)) ?? null);
    await lectureRepo.update(id, patch).catch((err) => { console.error(err); setError(true); });
  };
  const deleteLecture = async (l: LectureSummary) => {
    if (!(await askConfirm({ message: t.lectures.confirmDelete, action: 'delete' }))) return;
    setItems((all) => all?.filter((x) => x.id !== l.id) ?? null);
    await lectureRepo.remove(l.id).catch((err) => { console.error(err); setError(true); });
  };
  const saveLectureName = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !lectureName.trim()) return;
    await patchLecture(editing.lecture.id, { title: lectureName.trim() });
    setEditing(null);
  };
  const openMenu = (l: LectureSummary) => (x: number, y: number) => setMenu({
    x, y, label: tl.options(untitled(l)),
    items: [
      { label: tl.open, icon: <ArrowRight className="rtl:rotate-180" />, onSelect: () => navigate(`/lectures/${l.id}`) },
      { label: tl.renameLecture, icon: <Pencil />, onSelect: () => { setLectureName(l.title); setEditing({ lecture: l, mode: 'rename' }); } },
      l.favorite
        ? { label: tl.unfavorite, icon: <StarOff />, onSelect: () => void patchLecture(l.id, { favorite: false }) }
        : { label: tl.favorite, icon: <Star />, onSelect: () => void patchLecture(l.id, { favorite: true }) },
      ...(folders.length ? [{ label: tl.moveLecture, icon: <FolderInput />, onSelect: () => setEditing({ lecture: l, mode: 'move' }) }] : []),
      { label: tl.deleteLecture, icon: <Trash2 />, danger: true, onSelect: () => void deleteLecture(l) },
    ],
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">{t.lectures.title}</h1>
          <p className="text-muted">{t.lectures.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/search" aria-label={t.search.open} title={t.search.open}
            className={cn(linkButton, 'border border-line bg-surface px-3 hover:bg-surface-2')}>
            <Search className="size-4" aria-hidden="true" /><span className="max-sm:sr-only">{t.home.quick.search}</span>
          </Link>
          <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
            <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
          </Link>
        </div>
      </header>

      <UpNextBanner />

      {error && <Alert tone="error">{t.auth.errors.generic}</Alert>}
      {!items && !error && <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>}

      {items?.length === 0 && (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <IconTile icon={Mic} tint="from-rose-500 to-rose-700" size="lg" />
          <div>
            <h2 className="text-lg font-semibold">{t.lectures.empty}</h2>
            <p className="mt-1 max-w-md text-muted">{t.lectures.emptyBody}</p>
          </div>
          <Link to="/lectures/new" className={cn(linkButton, 'bg-brand-600 text-white hover:bg-brand-700')}>
            <Plus className="size-4" aria-hidden="true" />{t.lectures.newLecture}
          </Link>
        </Card>
      )}

      <StudyTools due={due} />

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
            {hasFavorites && (
              <button type="button" className={chip(activeFolder === 'favorites')} aria-pressed={activeFolder === 'favorites'} onClick={() => setFolder('favorites')}>
                <Star className="size-4 shrink-0" aria-hidden="true" />{tl.favorites} <span className="opacity-70">{items!.filter((l) => l.favorite).length}</span>
              </button>
            )}
            {shownFolders.map((f) => (
              <button key={f.id} type="button" {...drag.itemProps(f.id)}
                className={cn(chip(activeFolder === f.id), 'touch-pan-x select-none', drag.dragging === f.id && 'cursor-grabbing opacity-80 shadow-[var(--shadow-lift)] ring-2 ring-brand-400')}
                aria-pressed={activeFolder === f.id} onClick={() => { setFolder(f.id); setRenaming(false); }}>
                <FolderIcon className="size-4 shrink-0" aria-hidden="true" /><span className="max-w-[12rem] truncate" dir="auto" title={f.name}>{f.name}</span> <span className="opacity-70">{count(f.id)}</span>
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

          {activeFolder !== 'none' && activeFolder !== 'favorites' && (activeFolder === 'all' ? items!.length : count(activeFolder)) > 0 && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/lectures/study?folder=${activeFolder}`} className={cn(linkButton, 'flex-1 border border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100 sm:flex-none dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-100')}>
                <BookOpenCheck className="size-4" aria-hidden="true" />{activeFolder === 'all' ? t.lectures.study.studyAll : t.lectures.study.studyFolder}
              </Link>
              <Link to={`/play?folder=${activeFolder}`} className={cn(linkButton, 'flex-1 border border-line bg-surface hover:bg-surface-2 sm:flex-none')}>
                <Gamepad2 className="size-4" aria-hidden="true" />{t.game.play}
              </Link>
            </div>
          )}

          {shown.length === 0 && (
            <div className="space-y-2 text-center">
              <EmptyState icon={query.trim() ? Search : FolderIcon} body={query.trim() ? tl.noResults(query.trim()) : tl.emptyFolder} className="border-0 bg-transparent" />
              {query.trim() && (
                <Link to={`/search?q=${encodeURIComponent(query.trim())}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">
                  <Search className="size-4" aria-hidden="true" />{t.search.open}
                </Link>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {shown.map((l) => {
              const Icon = SOURCE_ICON[l.source];
              const inFolder = folders.find((f) => f.id === l.folder_id);
              return (
                // Right-click, long-press or the ⋯ button for Rename, Favorite, Move and Delete.
                <div key={l.id} className="relative min-w-0 select-none [-webkit-touch-callout:none]" {...triggers(openMenu(l))}>
                <Link to={`/lectures/${l.id}`} className="block min-w-0 rounded-[var(--radius-card)]">
                  <Card className="flex items-start gap-3 p-4 pe-12 transition-shadow hover:shadow-[var(--shadow-lift)]">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-muted">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1.5 font-medium">
                        <span className="truncate" dir="auto">{untitled(l)}</span>
                        {l.favorite && <StarBurst label={tl.starred} />}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">
                        {t.lectures.sources[l.source]}
                        {l.duration_sec > 0 && ` · ${t.lectures.minutes(Math.max(1, Math.round(l.duration_sec / 60)))}`}
                        {' · '}{new Date(l.created_at).toLocaleDateString(dateLocale(locale))}
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
                <button type="button" aria-label={tl.options(untitled(l))} aria-haspopup="menu"
                  onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); openMenu(l)(r.left, r.bottom + 4); }}
                  className="absolute end-2 top-3 flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg">
                  <MoreHorizontal className="size-5" aria-hidden="true" />
                </button>
                </div>
              );
            })}
          </div>

          <ContextMenu menu={menu} onClose={closeMenu} />

          <Sheet open={editing?.mode === 'rename'} onClose={() => setEditing(null)} title={tl.renameLecture}
            footer={<Button block size="lg" onClick={(e) => void saveLectureName(e)} disabled={!lectureName.trim()}>{t.common.save}</Button>}>
            <form onSubmit={saveLectureName}>
              <Input aria-label={tl.renameLecture} value={lectureName} maxLength={200} onChange={(e) => setLectureName(e.target.value)} autoFocus dir="auto" />
            </form>
          </Sheet>

          <Sheet open={editing?.mode === 'move'} onClose={() => setEditing(null)} title={tl.moveLecture}>
            <div role="radiogroup" aria-label={tl.moveLecture}>
              <ListSection>
                {[{ id: '', name: tl.noFolder }, ...folders].map((f) => {
                  const on = (editing?.lecture.folder_id ?? '') === f.id;
                  return (
                    <button key={f.id || 'none'} type="button" role="radio" aria-checked={on}
                      onClick={() => { if (editing) void patchLecture(editing.lecture.id, { folder_id: f.id || null }); setEditing(null); }}
                      className="flex min-h-14 w-full items-center gap-3 px-4 text-start hover:bg-surface-2">
                      <FolderIcon className="size-[18px] shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate font-medium" dir="auto">{f.name}</span>
                      {on && <Check className="size-5 shrink-0 text-brand-700 dark:text-brand-300" aria-hidden="true" />}
                    </button>
                  );
                })}
              </ListSection>
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}

/** Everything for studying the lectures, in one place: review, exams, games, study groups and the class schedule. */
const StudyTools = ({ due }: { due: number }) => {
  const { t } = useI18n();
  const tt = t.lectures.tools;
  const tools = [
    { to: '/lectures/review', icon: Layers, title: tt.review, body: due > 0 ? t.lectures.review.due(due) : tt.reviewBody, tint: 'bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-200', highlight: due > 0 },
    { to: '/exams', icon: CalendarClock, title: tt.exams, body: tt.examsBody, tint: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' },
    { to: '/play', icon: Gamepad2, title: tt.games, body: tt.gamesBody, tint: 'bg-accent-400/15 text-accent-600 dark:text-accent-300' },
    { to: '/groups', icon: Users, title: tt.groups, body: tt.groupsBody, tint: 'bg-rose-500/12 text-rose-700 dark:text-rose-300' },
    { to: '/lectures/schedule', icon: CalendarDays, title: tt.schedule, body: tt.scheduleBody, tint: 'bg-sky-500/12 text-sky-700 dark:text-sky-300' },
  ];
  return (
    <section aria-label={tt.title}>
      {/* One surface split by hairlines (the gap shows the border colour), not four separate cards. */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] border border-line bg-line shadow-[var(--shadow-soft)] lg:grid-cols-5 [&>:last-child]:col-span-2 lg:[&>:last-child]:col-span-1">
        {tools.map((x) => (
          <Link key={x.to} to={x.to}
            className={cn('group flex min-w-0 flex-col gap-2.5 p-4 transition-colors focus-visible:-outline-offset-2 sm:flex-row sm:items-center sm:gap-3',
              x.highlight ? 'bg-brand-50 hover:bg-brand-100 dark:bg-brand-900/30 dark:hover:bg-brand-900/50' : 'bg-surface hover:bg-surface-2')}>
            <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-xl', x.tint)}>
              <x.icon className="size-5" aria-hidden="true" />
              {x.highlight && <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-accent-500 ring-2 ring-brand-50 dark:ring-brand-900" aria-hidden="true" />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{x.title}</span>
              <span className={cn('mt-0.5 block text-sm leading-snug', x.highlight ? 'font-medium text-brand-700 dark:text-brand-200' : 'text-muted')}>{x.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
