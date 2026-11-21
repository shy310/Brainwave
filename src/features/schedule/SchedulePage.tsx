import { useEffect, useState, type FormEvent } from 'react';
import { Bell, CalendarDays, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Select } from '@/ui/Field';
import { Spinner } from '@/ui/Spinner';
import { BackLink } from '@/features/learn/CoursePage';
import { folderRepo, type Folder } from '@/features/lectures/folders';
import { REMIND_OPTIONS, type ClassSlot } from '@shared/schedule';
import { scheduleRepo } from './scheduleRepo';
import { PushNote } from './PushNote';
import { enableReminders, notificationsSupported, remindersAllowed, syncNativeReminders } from './reminders';
import { dateLocale } from '@shared/locales';
import { EmptyState } from '@/ui/EmptyState';

type Draft = Omit<ClassSlot, 'id'> & { id?: string };
const blank = (): Draft => ({ name: '', weekday: new Date().getDay(), starts: '10:00', ends: '11:30', folderId: null, remindMinutes: 10 });

export const weekdayName = (day: number, locale: string, style: 'long' | 'short' = 'long') =>
  new Date(2026, 10, 15 + day).toLocaleDateString(dateLocale(locale), { weekday: style }); // 15 Nov 2026 is a Sunday

/** The weekly class timetable, with reminders to record. */
export default function SchedulePage() {
  const { t, locale } = useI18n();
  const ts = t.schedule;
  const [slots, setSlots] = useState<ClassSlot[] | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    Promise.all([scheduleRepo.list(), folderRepo.list()]).then(([s, f]) => { setSlots(s); setFolders(f); }).catch(() => setSlots([]));
    remindersAllowed().then(setAllowed).catch(() => setAllowed(false));
  }, []);

  const text = (s: ClassSlot) => ({ title: ts.reminderTitle(s.name), body: ts.reminderBody(s.remindMinutes) });
  const resync = (all: ClassSlot[]) => { void syncNativeReminders(all, text).catch((err) => console.warn('Could not schedule reminders', err)); };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim()) return;
    if (draft.ends <= draft.starts) { setError(ts.endBeforeStart); return; }
    try {
      const saved = await scheduleRepo.save({ ...draft, name: draft.name.trim().slice(0, 80) });
      const all = [...(slots ?? []).filter((s) => s.id !== saved.id), saved].sort((a, b) => a.weekday - b.weekday || a.starts.localeCompare(b.starts));
      setSlots(all);
      setDraft(null);
      setError('');
      resync(all);
    } catch { setError(t.auth.errors.generic); }
  };

  const remove = async (s: ClassSlot) => {
    if (!window.confirm(ts.confirmRemove(s.name))) return;
    await scheduleRepo.remove(s.id).catch(() => {});
    const all = (slots ?? []).filter((x) => x.id !== s.id);
    setSlots(all);
    resync(all);
  };

  const turnOn = async () => {
    const ok = await enableReminders().catch(() => false);
    setAllowed(ok);
    setBlocked(!ok);
    if (ok) resync(slots ?? []);
  };

  if (!slots) return <p className="flex items-center gap-2 text-muted"><Spinner className="size-5" />{t.common.loading}</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink to="/lectures" label={t.lectures.title} />
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{ts.title}</h1>
        <p className="text-muted">{ts.subtitle}</p>
      </header>

      {notificationsSupported() && (
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-700 dark:text-brand-300"><Bell className="size-5" aria-hidden="true" /></span>
            <p className="min-w-0 flex-1 font-medium">{allowed ? ts.enabled : ts.enable}</p>
            {!allowed && <Button size="sm" onClick={() => void turnOn()}>{ts.enable}</Button>}
          </div>
          {/* The note gets the full width, not a squeezed column beside the button. */}
          <PushNote className="text-sm text-muted" />
          {blocked && <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{ts.blocked}</p>}
        </Card>
      )}

      {slots.length === 0 && !draft && <EmptyState icon={CalendarDays} body={ts.empty} />}

      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((s) => (
            <li key={s.id}>
              <Card className="flex items-center gap-3 p-4">
                <div className="w-20 shrink-0 text-sm">
                  <p className="font-semibold">{weekdayName(s.weekday, locale, 'short')}</p>
                  <p className="tabular-nums text-muted" dir="ltr">{s.starts}–{s.ends}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" dir="auto">{s.name}</p>
                  <p className="truncate text-xs text-muted">
                    {ts.remindOption(s.remindMinutes)}{s.folderId && folders.find((f) => f.id === s.folderId) ? ` · ${folders.find((f) => f.id === s.folderId)!.name}` : ''}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`${ts.edit}: ${s.name}`} onClick={() => { setDraft({ ...s }); setError(''); }}>
                  <Pencil className="size-4" aria-hidden="true" />
                </Button>
                <Button variant="ghost" size="sm" className="size-9 px-0" aria-label={`${ts.remove}: ${s.name}`} onClick={() => void remove(s)}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {draft ? (
        <Card className="p-6">
          <form onSubmit={save} className="space-y-4">
            <Field label={ts.name}>
              {(id) => <Input id={id} value={draft.name} maxLength={80} placeholder={ts.namePlaceholder} dir="auto" autoFocus onChange={(e) => setDraft({ ...draft, name: e.target.value })} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={ts.day}>
                {(id) => (
                  <Select id={id} value={draft.weekday} onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}>
                    {[0, 1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{weekdayName(d, locale)}</option>)}
                  </Select>
                )}
              </Field>
              <Field label={ts.starts}>{(id) => <Input id={id} type="time" value={draft.starts} required onChange={(e) => setDraft({ ...draft, starts: e.target.value })} />}</Field>
              <Field label={ts.ends}>{(id) => <Input id={id} type="time" value={draft.ends} required onChange={(e) => setDraft({ ...draft, ends: e.target.value })} />}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={ts.remind}>
                {(id) => (
                  <Select id={id} value={draft.remindMinutes} onChange={(e) => setDraft({ ...draft, remindMinutes: Number(e.target.value) })}>
                    {REMIND_OPTIONS.map((m) => <option key={m} value={m}>{ts.remindOption(m)}</option>)}
                  </Select>
                )}
              </Field>
              {folders.length > 0 && (
                <Field label={ts.folder}>
                  {(id) => (
                    <Select id={id} value={draft.folderId ?? ''} onChange={(e) => setDraft({ ...draft, folderId: e.target.value || null })}>
                      <option value="">{ts.noFolder}</option>
                      {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </Select>
                  )}
                </Field>
              )}
            </div>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="submit">{ts.save}</Button>
              <Button variant="secondary" onClick={() => { setDraft(null); setError(''); }}>{t.common.cancel}</Button>
            </div>
          </form>
        </Card>
      ) : (
        <Button icon={<CalendarPlus className="size-4" />} onClick={() => { setDraft(blank()); setError(''); }}>{ts.add}</Button>
      )}
    </div>
  );
}
