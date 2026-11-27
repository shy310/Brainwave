import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { BookOpenText, ClipboardCheck, FileAudio, GraduationCap, Hand, Mic, Sparkles } from '@/ui/icons';
import { useAuth } from './AuthProvider';
import { useI18n, useT } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input } from '@/ui/Field';
import { Alert } from '@/ui/Alert';
import { Logo } from '@/ui/Logo';
import { Mascot } from '@/ui/Mascot';
import { WaveEdge } from '@/ui/Wave';
import { LanguageToggle } from '@/app/LanguageToggle';
import { SUBJECTS } from '@shared/curriculum';
import { SubjectArt } from '@/features/learn/SubjectArt';
import { SUBJECT_META } from '@/features/learn/subjects';
import { LandingHero } from './LandingHero';

/** Ask Supabase whether Google sign-in is switched on, so the button only shows when it works. */
const useGoogleEnabled = () => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    let alive = true;
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then(r => (r.ok ? r.json() : null))
      .then((s: { external?: { google?: boolean } } | null) => { if (alive) setEnabled(Boolean(s?.external?.google)); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return enabled;
};

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export default function SignInPage() {
  const t = useT();
  const auth = useAuth();
  const googleEnabled = useGoogleEnabled();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // After deleting an account, say it worked.
  const [notice, setNotice] = useState<string | null>(() => {
    try {
      if (!sessionStorage.getItem('bw.accountDeleted')) return null;
      sessionStorage.removeItem('bw.accountDeleted');
      return t.account.deleted;
    } catch { return null; }
  });

  const friendly = (err: unknown) => {
    const msg = (err as { message?: string })?.message?.toLowerCase() ?? '';
    if (msg.includes('invalid login')) return t.auth.errors.invalid;
    if (msg.includes('already registered') || msg.includes('already exists')) return t.auth.errors.emailTaken;
    if (msg.includes('password')) return t.auth.errors.weakPassword;
    return t.auth.errors.generic;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    if (mode === 'signup' && password.length < 8) { setError(t.auth.errors.weakPassword); return; }
    setBusy(true);
    try {
      if (mode === 'signin') await auth.signIn(email.trim(), password);
      else {
        const { needsConfirmation } = await auth.signUp(email.trim(), password);
        if (needsConfirmation) { setNotice(t.auth.checkEmail); setMode('signin'); }
      }
    } catch (err) {
      const message = friendly(err);
      setError(message);
      // The email already has an account: switch to signing in, keeping what was typed.
      if (message === t.auth.errors.emailTaken) setMode('signin');
    } finally { setBusy(false); }
  };

  const forgot = async () => {
    if (!email.trim()) return;
    setError(null);
    try { await auth.resetPassword(email.trim()); setNotice(t.auth.resetSent); } catch (err) { setError(friendly(err)); }
  };

  const panel = useRef<HTMLDivElement>(null);
  // "Create an account" / "Sign in" in the hero open the form in that mode.
  const goTo = (m: 'signin' | 'signup') => {
    setMode(m);
    setError(null);
    panel.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
    window.setTimeout(() => panel.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true }), 450);
  };

  return (
    <div className="min-h-dvh bg-bg">
      {/* The hero: Signature Blue owns the first viewport and ends in a brainwave. */}
      <div className="relative overflow-hidden bg-brand-600 text-white">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(40rem_28rem_at_85%_30%,rgb(81_140_255/0.4),transparent_70%),radial-gradient(30rem_22rem_at_5%_100%,rgb(149_96_236/0.18),transparent_70%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pt-5 sm:px-6">
          <header className="flex items-center gap-3">
            <Logo className="[&_span]:text-white" />
            <span className="flex-1" />
            <LanguageToggle className="text-white! hover:bg-brand-700!" />
            {!auth.demo && <button type="button" onClick={() => goTo('signin')} className="hidden h-10 rounded-full px-4 text-sm font-semibold text-white ring-1 ring-white/40 transition-colors hover:bg-brand-700 sm:block">{t.landing.signIn}</button>}
          </header>
          <main className="grid items-center gap-6 pb-6 pt-6 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pb-10 lg:pt-10">
            <div className="order-2 lg:order-1">
              <h1 className="max-w-[14ch] text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl lg:text-[4.25rem]">{t.landing.title}</h1>
              <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-white sm:text-xl">{t.landing.body}</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {auth.demo ? (
                  <Button variant="sun" size="xl" onClick={auth.startDemo}>{t.auth.demoStart}</Button>
                ) : (
                  <>
                    <Button variant="sun" size="xl" onClick={() => goTo('signup')}>{t.landing.start}</Button>
                    <Button size="xl" variant="onColor" onClick={() => goTo('signin')}>{t.landing.haveAccount}</Button>
                  </>
                )}
              </div>
              {auth.demo && <p className="mt-4 max-w-[46ch] text-sm text-white">{t.auth.demoBody}</p>}
            </div>
            <div className="order-1 lg:order-2"><LandingHero /></div>
          </main>
        </div>
        <WaveEdge className="text-bg" />
      </div>

      <div className="mx-auto max-w-6xl space-y-24 px-4 py-14 sm:px-6 sm:py-20">
        <HowItWorks />
        <Showcase />
        <Subjects />
        <Languages />

        {/* Start: the sign-in panel, with Wave encouraging. */}
        <section id="start" aria-labelledby="start-title" className="relative overflow-hidden rounded-[var(--radius-field)] bg-brand-50 px-5 py-10 dark:bg-brand-900/25 sm:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div className="flex items-center gap-5">
              <Mascot mood="encouraging" size={120} className="hidden sm:block" />
              <div>
                <h2 id="start-title" className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{t.landing.join.title}</h2>
                <p className="mt-2 max-w-md text-lg text-muted">{t.landing.join.body}</p>
              </div>
            </div>
            <div ref={panel} className="flex justify-center">
              <Card className="w-full max-w-md p-6 shadow-[var(--shadow-float)] sm:p-8">
                {auth.demo ? (
                  <div className="space-y-4">
                    {notice && <Alert tone="success">{notice}</Alert>}
                    <h2 className="text-xl font-semibold">{t.auth.demoTitle}</h2>
                    <p className="text-muted">{t.auth.demoBody}</p>
                    <Button block size="lg" onClick={auth.startDemo}>{t.onboarding.finish}</Button>
                  </div>
                ) : (
                  <form onSubmit={submit} className="space-y-4" noValidate>
                    <h2 className="text-xl font-semibold">{mode === 'signin' ? t.auth.signInTitle : t.auth.signUpTitle}</h2>
                    {googleEnabled && (
                      <>
                        <Button variant="secondary" block icon={<GoogleIcon />} onClick={() => auth.signInWithGoogle().catch(err => setError(friendly(err)))}>
                          {t.auth.google}
                        </Button>
                        <div className="flex items-center gap-3 text-sm text-muted">
                          <span className="h-px flex-1 bg-line" />{t.common.or}<span className="h-px flex-1 bg-line" />
                        </div>
                      </>
                    )}
                    {error && <Alert tone="error">{error}</Alert>}
                    {notice && <Alert tone="success">{notice}</Alert>}
                    <Field label={t.auth.email}>
                      {id => <Input id={id} type="email" autoComplete="email" required dir="ltr" value={email} onChange={e => setEmail(e.target.value)} />}
                    </Field>
                    <Field label={t.auth.password} hint={mode === 'signup' ? t.auth.passwordHint : undefined}>
                      {(id, d) => <Input id={id} aria-describedby={d} type="password" required dir="ltr" minLength={mode === 'signup' ? 8 : undefined}
                        autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} />}
                    </Field>
                    {mode === 'signin' && (
                      <button type="button" onClick={forgot} className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-300">{t.auth.forgot}</button>
                    )}
                    <Button type="submit" block size="lg" loading={busy}>{mode === 'signin' ? t.auth.signIn : t.auth.signUp}</Button>
                    <p className="text-center text-sm text-muted">
                      {mode === 'signin' ? t.auth.noAccount : t.auth.haveAccount}{' '}
                      <button type="button" className="font-medium text-brand-700 hover:underline dark:text-brand-300"
                        onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
                        {mode === 'signin' ? t.auth.switchToSignUp : t.auth.switchToSignIn}
                      </button>
                    </p>
                  </form>
                )}
              </Card>
            </div>
          </div>
        </section>
      </div>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
          <Logo className="scale-90" />
          <span className="flex-1" />
          <a href="/delete-account" className="hover:text-fg hover:underline">{t.landing.deleteAccount}</a>
        </div>
      </footer>
    </div>
  );
}

/** A real sequence, so it is numbered: bring the class, get notes, practise, be ready. */
const HowItWorks = () => {
  const t = useT();
  const th = t.landing.how;
  const icons = [Mic, BookOpenText, ClipboardCheck, GraduationCap];
  const tones = ['bg-coral-500 text-white', 'bg-brand-600 text-white', 'bg-violet-500 text-white', 'bg-emerald-400 text-brand-950'];
  return (
    <section aria-labelledby="how" className="space-y-10">
      <h2 id="how" className="max-w-2xl font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{th.title}</h2>
      <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
        {/* The brainwave connecting the four steps (desktop). */}
        <svg aria-hidden="true" viewBox="0 0 1000 60" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-[6%] top-7 hidden h-14 w-[88%] text-brand-200 md:block dark:text-brand-800">
          <path d="M0 30 C80 -6 170 66 250 30 S420 -6 500 30 S670 66 750 30 S920 -6 1000 30" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeDasharray="2 12" />
        </svg>
        {th.steps.map((step, i) => {
          const Icon = icons[i];
          return (
            <li key={i} className="relative flex gap-4 md:flex-col md:items-start">
              <span className={cn('relative flex size-14 shrink-0 items-center justify-center rounded-[1.25rem] shadow-[var(--shadow-soft)] ring-4 ring-bg', tones[i])}>
                <Icon className="size-6" aria-hidden="true" />
                <span className="absolute -end-2 -top-2 flex size-6 items-center justify-center rounded-full bg-brand-950 font-display text-xs font-bold text-white dark:bg-white dark:text-brand-950">{i + 1}</span>
              </span>
              <div>
                <h3 className="font-display text-xl font-bold">{step.t}</h3>
                <p className="mt-1.5 text-muted">{step.b}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
};

/** Two things BrainWave does that are worth seeing: the tutor (and Talk mode), and podcasts you can interrupt. */
const Showcase = () => {
  const t = useT();
  const tl = t.landing;
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Feature icon={Sparkles} tone="bg-violet-500" title={tl.tutor.title} body={tl.tutor.body}>
        <div className="space-y-3 rounded-[1.5rem] bg-surface p-4 shadow-[var(--shadow-soft)]" aria-hidden="true">
          <p className="ms-auto w-fit max-w-[80%] rounded-2xl rounded-ee-md bg-brand-600 px-3.5 py-2 text-sm text-white">{tl.tutor.q}</p>
          <div className="flex items-end gap-2">
            <Mascot mood="happy" size={40} animate={false} />
            <p className="max-w-[80%] rounded-2xl rounded-es-md bg-surface-2 px-3.5 py-2 text-sm">{tl.tutor.a}</p>
          </div>
          <p className="flex items-center gap-2 text-xs font-semibold text-violet-700 dark:text-violet-300"><Mic className="size-3.5" aria-hidden="true" />{tl.tutor.talk}</p>
        </div>
      </Feature>
      <Feature icon={FileAudio} tone="bg-coral-500" title={tl.podcast.title} body={tl.podcast.body}>
        <div className="rounded-[1.5rem] bg-surface p-4 shadow-[var(--shadow-soft)]" aria-hidden="true">
          <div className="flex items-center gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-accent-400 to-coral-400 text-brand-950"><FileAudio className="size-6" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{tl.podcast.now}</p>
              <p className="truncate font-semibold">{tl.podcast.ep}</p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-surface-2"><div className="h-full w-2/5 rounded-full bg-brand-600" /></div>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent-200 px-3 py-1.5 text-sm font-semibold text-accent-600 dark:bg-accent-600/20 dark:text-accent-300"><Hand className="size-4" />{tl.podcast.hand}</p>
        </div>
      </Feature>
    </div>
  );
};

const Feature = ({ icon: Icon, tone, title, body, children }: { icon: typeof Mic; tone: string; title: string; body: string; children: ReactNode }) => (
  <section className="flex min-w-0 flex-col gap-5 rounded-[var(--radius-field)] bg-brand-50/70 p-5 sm:p-8 dark:bg-white/[0.03]">
    <span className={cn('flex size-11 items-center justify-center rounded-2xl text-white', tone)}><Icon className="size-5" aria-hidden="true" /></span>
    <div>
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-2 max-w-[48ch] text-muted">{body}</p>
    </div>
    <div className="mt-auto min-w-0">{children}</div>
  </section>
);

/** The curriculum's six subjects, each in its own colours. */
const Subjects = () => {
  const t = useT();
  return (
    <section aria-labelledby="subjects" className="space-y-8">
      <div className="max-w-2xl">
        <h2 id="subjects" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t.landing.learn.title}</h2>
        <p className="mt-3 text-lg text-muted">{t.landing.learn.body}</p>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {SUBJECTS.map((s) => (
          <li key={s} className="group overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]" tabIndex={-1}>
            <div className={cn('px-3 pt-3', SUBJECT_META[s].field)}><SubjectArt subject={s} className="h-20 w-full" /></div>
            <p className="px-3 py-2.5 font-semibold">{t.subjects[s]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};

/** Four languages, both directions: said in each language's own words. */
const Languages = () => {
  const { t } = useI18n();
  const hello = [['Hello', 'ltr', 'bg-brand-600 text-white'], ['שלום', 'rtl', 'bg-accent-400 text-brand-950'], ['مرحبا', 'rtl', 'bg-emerald-400 text-brand-950'], ['Привет', 'ltr', 'bg-coral-400 text-brand-950']] as const;
  return (
    <section aria-labelledby="langs" className="grid items-center gap-8 lg:grid-cols-2">
      <div>
        <h2 id="langs" className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{t.landing.langs.title}</h2>
        <p className="mt-3 max-w-[46ch] text-lg text-muted">{t.landing.langs.body}</p>
      </div>
      <ul className="flex flex-wrap gap-3" aria-hidden="true">
        {hello.map(([w, dir, tone], i) => (
          <li key={w} dir={dir} className={cn('rounded-[1.4rem] px-6 py-4 font-display text-3xl font-extrabold shadow-[var(--shadow-soft)]', tone, i % 2 ? 'rotate-2' : '-rotate-2')}>{w}</li>
        ))}
      </ul>
    </section>
  );
};
