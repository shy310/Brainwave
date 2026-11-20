// Study reminders and "ready" notifications, in the Android app (local
// notifications) and on the web (the Notification API).

import { useEffect } from 'react';
import { LocalNotifications } from '@capacitor/local-notifications';
import { isNativeApp } from '@/lib/platform';
import { storage } from '@/lib/storage';

const STUDY_ID = 42_000;
const READY_ID = 42_001;
const KEY = 'bw.studyReminder';

export interface StudyReminder { enabled: boolean; time: string }
export const loadStudyReminder = (): StudyReminder => {
  try { return { enabled: false, time: '19:00', ...JSON.parse(storage.get(KEY) ?? '{}') }; } catch { return { enabled: false, time: '19:00' }; }
};

/** Next time a daily reminder at "HH:MM" fires (today if still ahead, else tomorrow). Pure. */
export const nextDaily = (time: string, now: Date): Date => {
  const [h, m] = time.split(':').map(Number);
  const at = new Date(now); at.setHours(h, m, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
};

/** Save the daily reminder and (in the Android app) schedule or cancel it. */
export const saveStudyReminder = async (r: StudyReminder, text: { title: string; body: string }) => {
  storage.set(KEY, JSON.stringify(r));
  if (!isNativeApp()) return;
  await LocalNotifications.cancel({ notifications: [{ id: STUDY_ID }] }).catch(() => {});
  if (!r.enabled) return;
  const [hour, minute] = r.time.split(':').map(Number);
  await LocalNotifications.schedule({ notifications: [{ id: STUDY_ID, ...text, extra: { open: '/lectures/review' }, schedule: { on: { hour, minute }, allowWhileIdle: true } }] });
};

/**
 * Tell the student something finished while they were in another tab or app.
 * Does nothing when the page is in front (they can see it) or notifications aren't allowed.
 */
export const notifyIfAway = async (title: string, body: string, open: string, onOpen: (path: string) => void) => {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') return;
  if (isNativeApp()) {
    const allowed = (await LocalNotifications.checkPermissions().catch(() => null))?.display === 'granted';
    if (allowed) await LocalNotifications.schedule({ notifications: [{ id: READY_ID, title, body, extra: { open } }] }).catch(() => {});
    return;
  }
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const n = new Notification(title, { body, tag: 'bw-ready' });
  n.onclick = () => { window.focus(); onOpen(open); n.close(); };
};

/** Open the page a tapped notification points to (Android app). */
export const onNotificationOpen = (open: (path: string) => void) => {
  if (!isNativeApp()) return;
  void LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
    const path = (e.notification.extra as { open?: string } | undefined)?.open;
    if (path?.startsWith('/')) open(path);
  });
};

/**
 * On the web, while the app is open: show the daily study reminder at its
 * time, unless the student already studied today.
 */
export const useWebStudyReminder = (text: { title: string; body: string }, studiedToday: () => Promise<boolean>, open: (path: string) => void) => {
  useEffect(() => {
    if (isNativeApp() || typeof Notification === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const plan = () => {
      const r = loadStudyReminder();
      if (!r.enabled || Notification.permission !== 'granted') return;
      const at = nextDaily(r.time, new Date());
      timer = setTimeout(() => {
        const due = Date.now() >= at.getTime() - 1000;
        plan(); // schedule the next step right away (long waits are split into hourly steps)
        if (!due) return;
        void studiedToday().catch(() => false).then((studied) => {
          if (studied) return;
          const n = new Notification(text.title, { body: text.body, tag: 'bw-study' });
          n.onclick = () => { window.focus(); open('/lectures/review'); n.close(); };
        });
      }, Math.max(1000, Math.min(at.getTime() - Date.now(), 60 * 60_000)));
    };
    plan();
    const onChange = () => { if (timer) clearTimeout(timer); plan(); };
    window.addEventListener('bw-study-reminder', onChange);
    return () => { if (timer) clearTimeout(timer); window.removeEventListener('bw-study-reminder', onChange); };
  }, [text, studiedToday, open]);
};
