import { useState, type FormEvent } from 'react';
import { Bell, BookOpenText, Languages, LifeBuoy, LogOut, Mail, Mic, Palette, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme, type Theme } from '@/app/ThemeProvider';
import { Button } from '@/ui/Button';
import { Field, Input, Select, Textarea } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Alert } from '@/ui/Alert';
import { Sheet } from '@/ui/Sheet';
import { ExpandRow, ListItem, ListRow, ListSection } from '@/ui/List';
import { GRADES, type Grade } from '@shared/grades';
import { NATIVE_NAME, LOCALES, type Locale } from '@shared/locales';
import { LECTURE_LANGUAGES, SUMMARY_MODES, type LectureLanguage, type SummaryMode } from '@shared/lectures';
import { supabase } from '@/lib/supabase';
import { ChangeEmail, DeleteAccount, supportEmail } from './AccountSection';
import { StudyReminderControl, useStudyReminder } from './StudyReminderControl';

/** A list of choices that applies on tap (radio semantics), used inside rows that open in place. */
const Choices = <T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string; lang?: string }[]; onChange: (v: T) => void }) => (
  <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
    {options.map((o) => (
      <button key={o.value} type="button" role="radio" aria-checked={value === o.value} lang={o.lang} onClick={() => onChange(o.value)}
        className={value === o.value
          ? 'h-10 rounded-full bg-brand-600 px-4 text-sm font-medium text-white'
          : 'h-10 rounded-full border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2'}>
        {o.label}
      </button>
    ))}
  </div>
);

/** Name, grade and learning style: the one place with a Save button. */
const ProfileSheet = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useI18n();
  const { profile, updateProfile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [grade, setGrade] = useState<Grade>(profile?.grade ?? '9');
  const [style, setStyle] = useState(profile?.tutor_style ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    setStatus('saving');
    try {
      await updateProfile({ display_name: name.trim() || profile?.display_name, grade, tutor_style: style.trim() || null });
      setStatus('idle');
      onClose();
    } catch { setStatus('error'); }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t.settings.editProfile}
      footer={<Button block size="lg" loading={status === 'saving'} onClick={() => void save()}>{t.common.save}</Button>}>
      <form onSubmit={save} className="space-y-4">
        <Field label={t.onboarding.name}>
          {(id) => <Input id={id} maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t.onboarding.grade}>
          {(id) => (
            <Select id={id} value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
              {GRADES.map((g) => <option key={g} value={g}>{t.grades[g]}</option>)}
            </Select>
          )}
        </Field>
        <Field label={t.tutor.styleLabel} hint={t.tutor.styleHint}>
          {(id) => <Textarea id={id} rows={3} maxLength={500} value={style} onChange={(e) => setStyle(e.target.value)} />}
        </Field>
        {status === 'error' && <Alert tone="error">{t.auth.errors.generic}</Alert>}
      </form>
    </Sheet>
  );
};

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const ts = t.settings;
  const { profile, user, demo, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const reminder = useStudyReminder();
  const [editing, setEditing] = useState(false);
  const name = profile?.display_name ?? '';
  const mode = profile?.summary_mode ?? 'detailed';
  const lectureLanguage = profile?.lecture_language ?? 'auto';
  const support = supportEmail();
  const themes: { value: Theme; label: string }[] = [
    { value: 'system', label: ts.themeSystem }, { value: 'light', label: ts.themeLight }, { value: 'dark', label: ts.themeDark },
  ];

  return (
    <div className="stagger mx-auto max-w-2xl space-y-7">
      <h1 className="text-3xl font-semibold tracking-tight">{ts.title}</h1>

      {/* Who you are: tap Edit to change it. */}
      <div className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-soft)]">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-semibold text-white" aria-hidden="true">
          {(name.trim()[0] ?? '?').toLocaleUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold" dir="auto">{name || t.home.greeting('')}</p>
          <p className="truncate text-sm text-muted">{t.grades[profile?.grade ?? '9']}{!demo && user?.email ? ` · ${user.email}` : ''}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)} aria-label={ts.editProfile}>{ts.edit}</Button>
      </div>
      <ProfileSheet key={editing ? 'open' : 'closed'} open={editing} onClose={() => setEditing(false)} />

      <ListSection title={ts.study}>
        <ExpandRow icon={BookOpenText} label={t.lectures.notesStyle} value={t.lectures.summaryModes[mode]}>
          <div className="space-y-2">
            <Choices<SummaryMode> label={t.lectures.notesStyle} value={mode} onChange={(m) => void updateProfile({ summary_mode: m }).catch(() => {})}
              options={SUMMARY_MODES.map((m) => ({ value: m, label: t.lectures.summaryModes[m] }))} />
            <p className="text-sm text-muted">{t.lectures.notesStyleHint}</p>
          </div>
        </ExpandRow>
        <ExpandRow icon={Mic} label={ts.lectureLanguage} value={t.lectures.languages[lectureLanguage]}>
          <div className="space-y-2">
            <Choices<LectureLanguage> label={ts.lectureLanguage} value={lectureLanguage} onChange={(l) => void updateProfile({ lecture_language: l }).catch(() => {})}
              options={LECTURE_LANGUAGES.map((l) => ({ value: l, label: t.lectures.languages[l] }))} />
            <p className="text-sm text-muted">{t.home.lectureLanguageHint}</p>
          </div>
        </ExpandRow>
        <ExpandRow icon={Bell} label={t.notify.daily} value={reminder.enabled ? ts.reminderValue(reminder.time) : ts.off}>
          <StudyReminderControl />
        </ExpandRow>
      </ListSection>

      <ListSection title={ts.appearance}>
        <ExpandRow icon={Languages} label={t.onboarding.language} value={<span lang={locale}>{NATIVE_NAME[locale]}</span>}>
          <Choices<Locale> label={t.onboarding.language} value={locale} onChange={(l) => void updateProfile({ locale: l }).catch(() => {})}
            options={LOCALES.map((l) => ({ value: l, label: NATIVE_NAME[l], lang: l }))} />
        </ExpandRow>
        <ExpandRow icon={Palette} label={ts.theme} value={themes.find((x) => x.value === theme)?.label}>
          <Segmented<Theme> label={ts.theme} value={theme} onChange={setTheme} options={themes} />
        </ExpandRow>
      </ListSection>

      <ListSection title={ts.account} footer={demo ? ts.demoNote : undefined}>
        {!demo && supabase && (
          <ExpandRow icon={Mail} label={t.account.email} value={<span dir="ltr">{user?.email}</span>}>
            <ChangeEmail />
          </ExpandRow>
        )}
        {support && (
          <ListItem icon={LifeBuoy} label={ts.support} hint={t.account.supportHint}>
            <a className="inline-flex h-9 shrink-0 items-center rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2"
              href={`mailto:${support}?subject=${encodeURIComponent('BrainWave')}`}>{t.account.support}</a>
          </ListItem>
        )}
        <ListRow icon={LogOut} label={t.nav.signOut} onClick={() => void signOut()} chevron={false} />
      </ListSection>

      {/* Destructive, last and on its own. */}
      <ListSection>
        <ExpandRow icon={Trash2} danger label={demo ? t.account.deleteDemo : t.account.deleteStart}>
          <DeleteAccount />
        </ExpandRow>
      </ListSection>
    </div>
  );
}
