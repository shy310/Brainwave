import { useState, type FormEvent } from 'react';
import { useI18n } from '@/i18n';
import { useAuth } from '@/features/auth/AuthProvider';
import { useTheme, type Theme } from '@/app/ThemeProvider';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Field, Input, Select, Textarea } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Alert } from '@/ui/Alert';
import { GRADES, type Grade } from '@shared/grades';
import { NATIVE_NAME, LOCALES, type Locale } from '@shared/locales';
import { LECTURE_LANGUAGES, SUMMARY_MODES, type LectureLanguage, type SummaryMode } from '@shared/lectures';
import { AccountSection } from './AccountSection';
import { StudyReminderControl } from './StudyReminderControl';

export default function SettingsPage() {
  const { t, locale } = useI18n();
  const { profile, user, demo, updateProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [grade, setGrade] = useState<Grade>(profile?.grade ?? '9');
  const [style, setStyle] = useState(profile?.tutor_style ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('saving');
    try { await updateProfile({ display_name: name.trim() || profile?.display_name, grade, tutor_style: style.trim() || null }); setStatus('saved'); }
    catch { setStatus('error'); }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t.settings.title}</h1>

      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">{t.settings.profile}</h2>
        <form onSubmit={save} className="space-y-4">
          <Field label={t.onboarding.name}>
            {id => <Input id={id} maxLength={60} value={name} onChange={e => { setName(e.target.value); setStatus('idle'); }} />}
          </Field>
          <Field label={t.onboarding.grade}>
            {id => (
              <Select id={id} value={grade} onChange={e => { setGrade(e.target.value as Grade); setStatus('idle'); }}>
                {GRADES.map(g => <option key={g} value={g}>{t.grades[g]}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t.tutor.styleLabel} hint={t.tutor.styleHint}>
            {id => <Textarea id={id} rows={2} maxLength={500} value={style} onChange={e => { setStyle(e.target.value); setStatus('idle'); }} />}
          </Field>
          {status === 'error' && <Alert tone="error">{t.auth.errors.generic}</Alert>}
          <Button type="submit" loading={status === 'saving'}>{status === 'saved' ? t.common.saved : t.common.save}</Button>
        </form>
      </Card>

      <Card className="space-y-3 p-6">
        <h2 className="text-lg font-semibold">{t.settings.study}</h2>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{t.lectures.notesStyle}</span>
          <Segmented<SummaryMode> label={t.lectures.notesStyle} value={profile?.summary_mode ?? 'detailed'}
            onChange={m => updateProfile({ summary_mode: m }).catch(() => {})}
            options={SUMMARY_MODES.map(m => ({ value: m, label: t.lectures.summaryModes[m] }))} />
          <p className="text-sm text-muted">{t.lectures.notesStyleHint}</p>
        </div>
        <Field label={t.home.lectureLanguage} hint={t.home.lectureLanguageHint}>
          {id => (
            <Select id={id} value={profile?.lecture_language ?? 'auto'} onChange={e => updateProfile({ lecture_language: e.target.value as LectureLanguage }).catch(() => {})}>
              {LECTURE_LANGUAGES.map(l => <option key={l} value={l}>{t.lectures.languages[l]}</option>)}
            </Select>
          )}
        </Field>
        <StudyReminderControl />
      </Card>

      <Card className="space-y-5 p-6">
        <h2 className="text-lg font-semibold">{t.settings.appearance}</h2>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{t.onboarding.language}</span>
          <Segmented<Locale> label={t.onboarding.language} value={locale} onChange={l => updateProfile({ locale: l }).catch(() => {})}
            options={LOCALES.map((l) => ({ value: l, label: NATIVE_NAME[l] }))} />
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium">{t.settings.theme}</span>
          <Segmented<Theme> label={t.settings.theme} value={theme} onChange={setTheme}
            options={[{ value: 'light', label: t.settings.themeLight }, { value: 'dark', label: t.settings.themeDark }, { value: 'system', label: t.settings.themeSystem }]} />
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <h2 className="text-lg font-semibold">{t.settings.account}</h2>
        <p className="text-muted">{demo ? t.settings.demoNote : t.settings.signedInAs(user?.email ?? '')}</p>
        <Button variant="secondary" onClick={signOut}>{t.nav.signOut}</Button>
      </Card>

      <AccountSection />
    </div>
  );
}
