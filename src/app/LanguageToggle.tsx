import { Check, Languages } from '@/ui/icons';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/cn';
import { useAuth } from '@/features/auth/AuthProvider';
import { Menu } from '@/ui/Menu';
import { LOCALES, NATIVE_NAME, type Locale } from '@shared/locales';

/** The app language: English, Hebrew, Arabic or Russian (saved to the profile when signed in). */
export const LanguageToggle = ({ className }: { className?: string }) => {
  const { locale, setLocale, t } = useI18n();
  const { profile, updateProfile } = useAuth();
  const choose = (l: Locale) => {
    setLocale(l);
    if (profile?.onboarded) updateProfile({ locale: l }).catch(() => {});
  };
  return (
    <Menu label={t.onboarding.language} align="end"
      items={LOCALES.map((l) => ({
        label: NATIVE_NAME[l],
        icon: l === locale ? <Check /> : <span className="inline-block size-4" />,
        onSelect: () => choose(l),
      }))}
      trigger={({ ref, props }) => (
        <button ref={ref} type="button" {...props}
          className={cn('inline-flex h-10 items-center gap-2 rounded-xl px-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg sm:px-3', className)}>
          <Languages className="size-4" aria-hidden="true" />
          {/* On the narrowest phones only the icon shows; the name stays for screen readers. */}
          <span className="max-lg:sr-only" lang={locale}>{NATIVE_NAME[locale]}</span>
          <span className="sr-only">{t.onboarding.language}</span>
        </button>
      )} />
  );
};
