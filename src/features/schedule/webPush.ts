// Reminders on the website that arrive even when BrainWave is closed (Web Push).
// The browser gives this device a push address; it's saved for the signed-in
// student, with their time zone and daily reminder time, and the server sends
// reminders when they're due (migration 0017). Demo accounts and the Android
// app keep their own reminders (in-tab and native).

import { supabase } from '@/lib/supabase';
import { apiUrl, isNativeApp } from '@/lib/platform';
import { storage } from '@/lib/storage';
import type { StudyReminder } from './notify';

const ACTIVE = 'bw.pushActive';

export const pushSupported = () =>
  Boolean(supabase) && !isNativeApp() && typeof window !== 'undefined'
  && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhones and iPads only allow web push once the site is added to the Home Screen. */
export const needsHomeScreen = () => {
  if (typeof navigator === 'undefined') return false;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
};

/** Reminders on this device come by push, so the in-tab timers stay quiet (no doubles). */
export const pushActive = () => storage.get(ACTIVE) === '1';

export const registerServiceWorker = () => {
  if (!pushSupported()) return;
  void navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('Service worker not registered', err));
};

const timeZone = () => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

/** URL-safe base64 → bytes, for the server's public key. */
export const keyBytes = (b64: string) => {
  const padded = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const authHeader = async (): Promise<Record<string, string>> => {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

/** Save the reminder time and this device's time zone. */
export const saveReminderSettings = async (study: StudyReminder) => {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { error } = await supabase.from('reminder_settings').upsert({
    user_id: data.user.id, timezone: timeZone(), study_enabled: study.enabled, study_time: study.time, updated_at: new Date().toISOString(),
  });
  if (error) throw error;
};

/**
 * Turn on push for this device (after notifications are allowed). Returns
 * false when this browser can't, or the server isn't set up for it.
 */
export const subscribePush = async (study: StudyReminder): Promise<boolean> => {
  if (!pushSupported() || !supabase || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const res = await fetch(apiUrl('/api/push/key'), { headers: await authHeader() });
      if (!res.ok) return false;
      const { publicKey } = (await res.json()) as { publicKey: string };
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) });
    }
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
    const { error } = await supabase.rpc('save_push_subscription', { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
    if (error) throw error;
    await saveReminderSettings(study);
    storage.set(ACTIVE, '1');
    return true;
  } catch (err) {
    console.warn('Push reminders not available here', err);
    return false;
  }
};

/** Stop pushes to this device (signing out, or the student turned reminders off everywhere). */
export const unsubscribePush = async () => {
  storage.remove?.(ACTIVE);
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => undefined);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  if (!sub) return;
  await supabase?.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe().catch(() => false);
};
