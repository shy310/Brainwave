import { useState, type FormEvent } from 'react';
import { useAuth } from './AuthProvider';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input } from '@/ui/Field';
import { Alert } from '@/ui/Alert';
import { Logo } from '@/ui/Logo';
import { LanguageToggle } from '@/app/LanguageToggle';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.2 6.6 2.2 12s4.4 9.8 9.8 9.8c5.7 0 9.4-4 9.4-9.6 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

export default function SignInPage() {
  const t = useT();
  const auth = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
    } catch (err) { setError(friendly(err)); } finally { setBusy(false); }
  };

  const forgot = async () => {
    if (!email.trim()) return;
    setError(null);
    try { await auth.resetPassword(email.trim()); setNotice(t.auth.resetSent); } catch (err) { setError(friendly(err)); }
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(60rem_40rem_at_10%_-10%,rgb(109_85_251/0.18),transparent),radial-gradient(50rem_30rem_at_110%_10%,rgb(255_107_61/0.14),transparent)]">
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between">
          <Logo />
          <LanguageToggle />
        </header>
        <main className="grid flex-1 items-center gap-10 py-10 lg:grid-cols-2">
          <section className="animate-fade-up">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">{t.auth.welcomeTitle}</h1>
            <p className="mt-4 max-w-lg text-lg text-muted">{t.auth.welcomeBody}</p>
          </section>

          <Card className="mx-auto w-full max-w-md p-6 sm:p-8 animate-fade-up">
            {auth.demo ? (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">{t.auth.demoTitle}</h2>
                <p className="text-muted">{t.auth.demoBody}</p>
                <Button block size="lg" onClick={auth.startDemo}>{t.auth.demoStart}</Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4" noValidate>
                <h2 className="text-xl font-semibold">{mode === 'signin' ? t.auth.signInTitle : t.auth.signUpTitle}</h2>
                <Button variant="secondary" block icon={<GoogleIcon />} onClick={() => auth.signInWithGoogle().catch(err => setError(friendly(err)))}>
                  {t.auth.google}
                </Button>
                <div className="flex items-center gap-3 text-xs uppercase text-muted">
                  <span className="h-px flex-1 bg-line" />{t.common.or}<span className="h-px flex-1 bg-line" />
                </div>
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
                  <button type="button" onClick={forgot} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-300">{t.auth.forgot}</button>
                )}
                <Button type="submit" block size="lg" loading={busy}>{mode === 'signin' ? t.auth.signIn : t.auth.signUp}</Button>
                <p className="text-center text-sm text-muted">
                  {mode === 'signin' ? t.auth.noAccount : t.auth.haveAccount}{' '}
                  <button type="button" className="font-medium text-brand-600 hover:underline dark:text-brand-300"
                    onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}>
                    {mode === 'signin' ? t.auth.switchToSignUp : t.auth.switchToSignIn}
                  </button>
                </p>
              </form>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
