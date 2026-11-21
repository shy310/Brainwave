import { useT } from '@/i18n';
import { isNativeApp } from '@/lib/platform';
import { needsHomeScreen, pushActive } from './webPush';

/** How reminders reach this device on the website: by push (even when closed), or only while a tab is open. */
export const PushNote = ({ className }: { className?: string }) => {
  const t = useT();
  if (isNativeApp()) return null;
  const text = pushActive() ? t.notify.pushOn : needsHomeScreen() ? t.notify.homeScreen : t.schedule.webNote;
  return <p className={className ?? 'text-xs text-muted'}>{text}</p>;
};
