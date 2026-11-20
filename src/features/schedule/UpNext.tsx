import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CalendarClock, Mic } from 'lucide-react';
import { useI18n } from '@/i18n';
import { isNativeApp } from '@/lib/platform';
import { upNext, type ClassSlot } from '@shared/schedule';
import { scheduleRepo } from './scheduleRepo';
import { onReminderTap, syncNativeReminders, useWebReminders } from './reminders';

/** "Calculus starts at 10:00 — Record it", shown shortly before and during a class. */
export const UpNextBanner = () => {
  const { t, locale } = useI18n();
  const [slots, setSlots] = useState<ClassSlot[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { scheduleRepo.list().then(setSlots).catch(() => {}); }, []);
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(id); }, []);

  const next = upNext(slots, now);
  if (!next) return null;
  const time = next.startsAt.toLocaleTimeString(locale === 'he' ? 'he-IL' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-accent-300 bg-accent-400/10 p-4" role="status">
      <CalendarClock className="size-5 shrink-0 text-accent-600" aria-hidden="true" />
      <p className="min-w-0 flex-1 font-medium" dir="auto">{next.on ? t.schedule.on(next.slot.name) : t.schedule.soon(next.slot.name, time)}</p>
      <Link to={`/lectures/new?class=${next.slot.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent-500 px-3 text-sm font-medium text-white hover:bg-accent-600">
        <Mic className="size-4" aria-hidden="true" />{t.schedule.record}
      </Link>
    </div>
  );
};

/** Background part of reminders, mounted once in the app shell. */
export const ClassReminders = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const text = useCallback((s: ClassSlot) => ({ title: t.schedule.reminderTitle(s.name), body: t.schedule.reminderBody(s.remindMinutes) }), [t]);
  const open = useCallback((id: string) => navigate(`/lectures/new?class=${id}`), [navigate]);
  useWebReminders(text, open);
  useEffect(() => {
    if (!isNativeApp()) return;
    onReminderTap(open);
    // Keep the phone's weekly reminders in step with the schedule (another device may have changed it).
    scheduleRepo.list().then((s) => syncNativeReminders(s, text)).catch(() => {});
  }, [open, text]);
  return null;
};
