import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { enableReminders, notificationsSupported } from '@/features/schedule/reminders';
import { loadStudyReminder, saveStudyReminder, type StudyReminder } from '@/features/schedule/notify';
import { PushNote } from '@/features/schedule/PushNote';

/** The daily study reminder, kept in sync wherever it's shown. */
export const useStudyReminder = () => {
  const [r, setR] = useState<StudyReminder>(loadStudyReminder);
  useEffect(() => {
    const sync = () => setR(loadStudyReminder());
    window.addEventListener('bw-study-reminder', sync);
    return () => window.removeEventListener('bw-study-reminder', sync);
  }, []);
  return r;
};

/** Settings: the time of the daily reminder and turning it on or off. */
export const StudyReminderControl = () => {
  const { t } = useI18n();
  const tn = t.notify;
  const r = useStudyReminder();
  const [blocked, setBlocked] = useState(false);
  if (!notificationsSupported()) return <p className="text-sm text-muted">{tn.blocked}</p>;

  const save = async (next: StudyReminder) => {
    await saveStudyReminder(next, { title: tn.studyTitle, body: tn.studyBody }).catch(() => {});
    window.dispatchEvent(new Event('bw-study-reminder'));
  };
  const turnOn = async () => {
    const ok = await enableReminders().catch(() => false);
    setBlocked(!ok);
    if (ok) await save({ ...r, enabled: true });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{tn.dailyHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="time" aria-label={tn.time} className="w-32" value={r.time} onChange={(e) => void save({ ...r, time: e.target.value || r.time })} />
        {r.enabled
          ? <Button variant="secondary" onClick={() => void save({ ...r, enabled: false })}>{tn.turnOff}</Button>
          : <Button onClick={() => void turnOn()}>{tn.turnOn}</Button>}
      </div>
      {r.enabled && <p className="text-sm text-muted">{tn.on(r.time)}</p>}
      {blocked && <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">{tn.blocked}</p>}
      {r.enabled && <PushNote className="text-sm text-muted" />}
    </div>
  );
};
