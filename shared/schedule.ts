// A student's weekly class timetable, used to remind them to record and to
// prefill the lecture. Pure time logic, tested.

export interface ClassSlot {
  id: string;
  name: string;
  /** 0 = Sunday … 6 = Saturday (local time). */
  weekday: number;
  /** "HH:MM", local time. */
  starts: string;
  ends: string;
  folderId: string | null;
  /** Minutes before the start to remind; 0 = no reminder. */
  remindMinutes: number;
}

export const REMIND_OPTIONS = [0, 5, 10, 15, 30] as const;

const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** The next time this class starts (today if it hasn't started yet). */
export const nextStart = (slot: Pick<ClassSlot, 'weekday' | 'starts'>, now: Date): Date => {
  const d = new Date(now);
  const start = minutesOf(slot.starts);
  d.setHours(Math.floor(start / 60), start % 60, 0, 0);
  let days = (slot.weekday - now.getDay() + 7) % 7;
  if (days === 0 && d <= now) days = 7;
  d.setDate(d.getDate() + days);
  return d;
};

/** Is the class happening right now? */
export const isOn = (slot: Pick<ClassSlot, 'weekday' | 'starts' | 'ends'>, now: Date) => {
  const m = now.getHours() * 60 + now.getMinutes();
  return now.getDay() === slot.weekday && m >= minutesOf(slot.starts) && m < minutesOf(slot.ends);
};

/** The class to show in the "up next" banner: on now, or starting within `windowMin`. */
export const upNext = (slots: ClassSlot[], now: Date, windowMin = 30): { slot: ClassSlot; startsAt: Date; on: boolean } | null => {
  const on = slots.find((s) => isOn(s, now));
  if (on) {
    const startsAt = new Date(now); const m = minutesOf(on.starts);
    startsAt.setHours(Math.floor(m / 60), m % 60, 0, 0);
    return { slot: on, startsAt, on: true };
  }
  const soon = slots
    .map((slot) => ({ slot, startsAt: nextStart(slot, now), on: false }))
    .filter((x) => x.startsAt.getTime() - now.getTime() <= windowMin * 60_000)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return soon[0] ?? null;
};

/** When the next reminder for this class fires, or null if it has none. */
export const nextReminder = (slot: ClassSlot, now: Date): Date | null => {
  if (!slot.remindMinutes) return null;
  let start = nextStart(slot, now);
  let at = new Date(start.getTime() - slot.remindMinutes * 60_000);
  if (at <= now) { start = nextStart(slot, new Date(start.getTime() + 60_000)); at = new Date(start.getTime() - slot.remindMinutes * 60_000); }
  return at;
};

/** The weekday, hour and minute a weekly reminder fires (it can fall on the previous day). */
export const reminderClock = (slot: ClassSlot) => {
  let m = minutesOf(slot.starts) - slot.remindMinutes, day = slot.weekday;
  if (m < 0) { m += 24 * 60; day = (day + 6) % 7; }
  return { weekday: day, hour: Math.floor(m / 60), minute: m % 60 };
};

/** Lecture title for a class on a date, e.g. "Calculus — 20 Nov". */
export const classLectureTitle = (name: string, date: Date, locale: string) =>
  `${name} — ${date.toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' })}`;
