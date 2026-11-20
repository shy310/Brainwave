import { useState } from 'react';
import { Bell } from 'lucide-react';
import { useI18n } from '@/i18n';
import { Button } from '@/ui/Button';
import { Input } from '@/ui/Field';
import { enableReminders, notificationsSupported } from '@/features/schedule/reminders';
import { loadStudyReminder, saveStudyReminder, type StudyReminder } from '@/features/schedule/notify';

/** Settings: a daily reminder to study. */
export const StudyReminderControl = () => {
  const { t } = useI18n();
  const tn = t.notify;
  const [r, setR] = useState<StudyReminder>(loadStudyReminder);
  const [blocked, setBlocked] = useState(false);
  if (!notificationsSupported()) return null;

  const save = async (next: StudyReminder) => {
    setR(next);
    await saveStudyReminder(next, { title: tn.studyTitle, body: tn.studyBody }).catch(() => {});
    window.dispatchEvent(new Event('bw-study-reminder'));
  };
  const turnOn = async () => {
    const ok = await enableReminders().catch(() => false);
    setBlocked(!ok);
    if (ok) await save({ ...r, enabled: true });
  };

  return (
    <div className="space-y-2 border-t border-line pt-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Bell className="size-4" aria-hidden="true" />{tn.daily}</p>
      <p className="text-sm text-muted">{r.enabled ? tn.on(r.time) : tn.dailyHint}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Input type="time" aria-label={tn.time} className="w-32" value={r.time} onChange={(e) => void save({ ...r, time: e.target.value || r.time })} />
        {r.enabled
          ? <Button variant="secondary" onClick={() => void save({ ...r, enabled: false })}>{tn.turnOff}</Button>
          : <Button onClick={() => void turnOn()}>{tn.turnOn}</Button>}
      </div>
      {blocked && <p className="text-sm text-rose-600" role="alert">{tn.blocked}</p>}
    </div>
  );
};
