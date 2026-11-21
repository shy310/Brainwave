import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useAuth } from './AuthProvider';
import { takeReturnTo } from './guards';
import { useI18n } from '@/i18n';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input, Select } from '@/ui/Field';
import { Segmented } from '@/ui/Segmented';
import { Alert } from '@/ui/Alert';
import { Logo } from '@/ui/Logo';
import { GRADES, type Grade } from '@shared/grades';
import { NATIVE_NAME, LOCALES, type Locale } from '@shared/locales';
import { STUDY_GOALS, summaryModeForGoal, type StudyGoal } from '@shared/profile';
import { LECTURE_LANGUAGES, type LectureLanguage } from '@shared/lectures';

export default function OnboardingPage() {
  const { t, locale, setLocale } = useI18n();
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [grade, setGrade] = useState<Grade>(profile?.grade ?? '9');
  const [goal, setGoal] = useState<StudyGoal>(profile?.study_goal ?? 'understand');
  const [lectureLanguage, setLectureLanguage] = useState<LectureLanguage>(profile?.lecture_language ?? 'auto');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  if (profile?.onboarded) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setError(false);
    try {
      await updateProfile({
        display_name: name.trim(), grade, locale, onboarded: true,
        // The goal sets how notes are written; both can be changed later in Settings.
        study_goal: goal, summary_mode: summaryModeForGoal(goal), lecture_language: lectureLanguage,
      });
      navigate(takeReturnTo(), { replace: true });
    } catch { setError(true); } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-4 py-10">
      <Logo className="mb-8 self-center" />
      <Card className="p-6 sm:p-8 animate-fade-up">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h1 className="text-2xl font-semibold">{t.onboarding.title}</h1>
            <p className="mt-1 text-muted">{t.onboarding.subtitle}</p>
          </div>
          {error && <Alert tone="error">{t.auth.errors.generic}</Alert>}
          <Field label={t.onboarding.name}>
            {id => <Input id={id} required maxLength={60} autoComplete="given-name" placeholder={t.onboarding.namePlaceholder} value={name} onChange={e => setName(e.target.value)} />}
          </Field>
          <Field label={t.onboarding.grade}>
            {id => (
              <Select id={id} value={grade} onChange={e => setGrade(e.target.value as Grade)}>
                {GRADES.map(g => <option key={g} value={g}>{t.grades[g]}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t.home.goal}>
            {id => (
              <Select id={id} value={goal} onChange={e => setGoal(e.target.value as StudyGoal)}>
                {STUDY_GOALS.map(g => <option key={g} value={g}>{t.home.goals[g]}</option>)}
              </Select>
            )}
          </Field>
          <Field label={t.home.lectureLanguage}>
            {id => (
              <Select id={id} value={lectureLanguage} onChange={e => setLectureLanguage(e.target.value as LectureLanguage)}>
                {LECTURE_LANGUAGES.map(l => <option key={l} value={l}>{t.lectures.languages[l]}</option>)}
              </Select>
            )}
          </Field>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium">{t.onboarding.language}</span>
            <Segmented<Locale> label={t.onboarding.language} value={locale} onChange={setLocale}
              options={LOCALES.map((l) => ({ value: l, label: NATIVE_NAME[l] }))} />
          </div>
          <Button type="submit" block size="lg" loading={busy} disabled={!name.trim()}>{t.onboarding.finish}</Button>
        </form>
      </Card>
    </div>
  );
}
