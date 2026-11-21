// Reminders to record a class. In the Android app they are real weekly
// notifications, delivered even when the app is closed. On the web, the
// browser can only show them while BrainWave is open in a tab.

import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '@/lib/platform';
import { nextReminder, reminderClock, type ClassSlot } from '@shared/schedule';
import { scheduleRepo } from './scheduleRepo';
import { loadStudyReminder } from './notify';
import { pushActive, subscribePush } from './webPush';

/** Notification ids for class reminders (stable per slot). */
const BASE_ID = 41_000;
const idFor = (i: number) => BASE_ID + i;

export const notificationsSupported = () => isNativeApp() || (typeof window !== 'undefined' && 'Notification' in window);

/** Ask for permission to show reminders. */
export const enableReminders = async (): Promise<boolean> => {
  if (isNativeApp()) return (await LocalNotifications.requestPermissions()).display === 'granted';
  if (!('Notification' in window)) return false;
  const ok = (await Notification.requestPermission()) === 'granted';
  // With an account, reminders also come when the site is closed.
  if (ok) await subscribePush(loadStudyReminder());
  return ok;
};

export const remindersAllowed = async (): Promise<boolean> => {
  if (isNativeApp()) return (await LocalNotifications.checkPermissions()).display === 'granted';
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
};

/** Replace the app's scheduled weekly reminders with these classes (Android app only). */
export const syncNativeReminders = async (slots: ClassSlot[], text: (s: ClassSlot) => { title: string; body: string }) => {
  if (!isNativeApp()) return;
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 1000);
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });
  const notifications = slots.filter((s) => s.remindMinutes > 0).map((s, i) => {
    const at = reminderClock(s);
    return {
      id: idFor(i), ...text(s), extra: { classId: s.id },
      // Capacitor counts weekdays from 1 = Sunday.
      schedule: { on: { weekday: at.weekday + 1, hour: at.hour, minute: at.minute }, allowWhileIdle: true },
    };
  });
  if (notifications.length) await LocalNotifications.schedule({ notifications });
};

/** Tapping a reminder opens the recorder for that class. */
export const onReminderTap = (open: (classId: string) => void) => {
  if (!isNativeApp()) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const classId = (e.notification.extra as { classId?: string } | undefined)?.classId;
    if (classId) open(classId);
  });
};

/**
 * On the web, while the app is open: show the next class reminder at its
 * time (if notifications are allowed).
 */
export const useWebReminders = (text: (s: ClassSlot) => { title: string; body: string }, open: (classId: string) => void) => {
  useEffect(() => {
    // Push delivers them on this device already (even when closed): no doubles.
    if (isNativeApp() || typeof Notification === 'undefined' || pushActive()) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const plan = async () => {
      if (cancelled || Notification.permission !== 'granted') return;
      const slots = await scheduleRepo.list().catch(() => [] as ClassSlot[]);
      const now = new Date();
      const next = slots.map((s) => ({ s, at: nextReminder(s, now) })).filter((x) => x.at)
        .sort((a, b) => a.at!.getTime() - b.at!.getTime())[0];
      if (!next || cancelled) return;
      // Long timers drift and browsers cap them; re-plan at least every hour.
      const wait = Math.min(next.at!.getTime() - now.getTime(), 60 * 60_000);
      timer = setTimeout(() => {
        if (Date.now() >= next.at!.getTime() - 1000) {
          const n = new Notification(text(next.s).title, { body: text(next.s).body, tag: `class-${next.s.id}` });
          n.onclick = () => { window.focus(); open(next.s.id); n.close(); };
        }
        void plan();
      }, Math.max(1000, wait));
    };
    void plan();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
    // Re-plan when the page loads; the schedule page re-mounts this after changes.
  }, [text, open]);
};
