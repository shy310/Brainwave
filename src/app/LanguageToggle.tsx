import { Languages } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';

/** One-tap switch between English and Hebrew (saved to the profile when signed in). */
export const LanguageToggle = () => {
  const { locale, setLocale, t } = useI18n();
  const { profile, updateProfile } = useAuth();
  const next = locale === 'en' ? 'he' : 'en';
  const onClick = () => {
    setLocale(next);
    if (profile?.onboarded) updateProfile({ locale: next }).catch(() => {});
  };
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
      <Languages className="size-4" aria-hidden="true" />
      <span>{next === 'he' ? 'עברית' : 'English'}</span>
      <span className="sr-only">{t.onboarding.language}</span>
    </button>
  );
};
