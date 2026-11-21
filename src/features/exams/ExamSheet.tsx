import { useEffect, useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/ui/Button';
import { Field, Input, Select } from '@/ui/Field';
import { Sheet } from '@/ui/Sheet';
import { DrawCheck } from '@/ui/Feedback';
import { cn } from '@/lib/cn';
import { localDay } from '@shared/activity';
import { addDays, type Exam } from '@shared/exam';
import { folderRepo, type Folder } from '@/features/lectures/folders';
import type { StudyLecture } from '@/features/lectures/repo';
import type { NewExam } from './examRepo';

const PICK = '__pick__';

/** Add or edit an exam: its name, its date, and the lectures it covers. */
export const ExamSheet = ({ open, onClose, onSave, exam, pool, title }: {
  open: boolean; onClose: () => void; onSave: (e: NewExam) => Promise<void>;
  exam?: Exam; pool: StudyLecture[]; title: (l: StudyLecture) => string;
}) => {
  const { t } = useI18n();
  const te = t.exams;
  const [name, setName] = useState(exam?.title ?? '');
  const [date, setDate] = useState(exam?.date ?? addDays(localDay(), 14));
  const [source, setSource] = useState(exam?.lectureIds.length ? PICK : exam?.folderId ?? '');
  const [picked, setPicked] = useState<Set<string>>(new Set(exam?.lectureIds ?? []));
  const [folders, setFolders] = useState<Folder[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { folderRepo.list().then(setFolders).catch(() => setFolders([])); }, []);

  const valid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && (source !== PICK || picked.size > 0);
  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      await onSave({ title: name.trim(), date, folderId: source && source !== PICK ? source : null, lectureIds: source === PICK ? [...picked] : [] });
      onClose();
    } finally { setBusy(false); }
  };
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <Sheet open={open} onClose={onClose} title={exam ? te.edit : te.add}
      footer={<Button block size="lg" loading={busy} disabled={!valid} onClick={() => void save()}>{te.save}</Button>}>
      <form onSubmit={save} className="space-y-4">
        <Field label={te.name}>
          {(id) => <Input id={id} value={name} maxLength={120} placeholder={te.namePlaceholder} onChange={(e) => setName(e.target.value)} dir="auto" autoFocus={!exam} />}
        </Field>
        <Field label={te.date}>
          {(id) => <Input id={id} type="date" value={date} min={localDay()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={te.covers}>
          {(id) => (
            <Select id={id} value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">{te.allLectures}</option>
              {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              <option value={PICK}>{te.pickLectures}</option>
            </Select>
          )}
        </Field>
        {source === PICK && (
          <div role="group" aria-label={te.pickLectures} className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
            {pool.map((l) => {
              const on = picked.has(l.id);
              return (
                <button key={l.id} type="button" role="checkbox" aria-checked={on} onClick={() => toggle(l.id)}
                  className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-start hover:bg-surface-2">
                  <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line')} aria-hidden="true">
                    {on && <DrawCheck className="size-3" />}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium" dir="auto">{title(l)}</span>
                </button>
              );
            })}
            {!picked.size && <p className="px-3 py-2 text-sm text-muted">{te.pickOne}</p>}
          </div>
        )}
      </form>
    </Sheet>
  );
};
