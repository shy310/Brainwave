import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { LifeBuoy, Mail, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { postApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { clearLocalData } from '@/lib/wipe';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Field, Input } from '@/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';

export const supportEmail = () => import.meta.env.VITE_SUPPORT_EMAIL?.trim() || '';

/** Change email, contact support, and delete the account (required by Google Play). */
export const AccountSection = () => {
  const { t } = useI18n();
  const ta = t.account;
  const { user, demo, signOut } = useAuth();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const [email, setEmail] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const changeEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    const { error: err } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/settings` });
    setEmailNote(err ? t.auth.errors.generic : ta.emailSent);
    if (!err) setEmail('');
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      if (!demo) await postApi('/api/account/delete', { confirm: 'DELETE' });
      await clearLocalData();
      // Signing out sends the student to the sign-in page, which reads this note.
      try { sessionStorage.setItem('bw.accountDeleted', '1'); } catch { /* ignore */ }
      await signOut().catch(() => {});
      navigate('/signin', { replace: true });
    } catch (err) {
      setError(toMessage(err) || t.auth.errors.generic);
      setBusy(false);
    }
  };

  const support = supportEmail();
  const word = ta.confirmWord;

  return (
    <>
      {!demo && supabase && (
        <Card className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Mail className="size-5" aria-hidden="true" />{ta.email}</h2>
          <p className="text-sm text-muted" dir="ltr">{user?.email}</p>
          <form onSubmit={changeEmail} className="flex flex-col gap-2 sm:flex-row">
            <Input type="email" aria-label={ta.newEmail} placeholder={ta.newEmail} value={email} onChange={(e) => { setEmail(e.target.value); setEmailNote(''); }} dir="ltr" />
            <Button type="submit" variant="secondary" disabled={!email.includes('@')}>{ta.changeEmail}</Button>
          </form>
          {emailNote && <p className="text-sm" role="status">{emailNote}</p>}
        </Card>
      )}

      {support && (
        <Card className="flex flex-wrap items-center gap-3 p-6">
          <LifeBuoy className="size-5 text-brand-600 dark:text-brand-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{ta.support}</h2>
            <p className="text-sm text-muted">{ta.supportHint}</p>
          </div>
          <a className="inline-flex h-9 items-center rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
            href={`mailto:${support}?subject=${encodeURIComponent('BrainWave')}`}>{support}</a>
        </Card>
      )}

      <Card className="space-y-3 border-rose-200 p-6 dark:border-rose-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-rose-700 dark:text-rose-300"><Trash2 className="size-5" aria-hidden="true" />{ta.deleteTitle}</h2>
        <p className="text-sm text-muted">{demo ? ta.deleteDemoBody : ta.deleteBody}</p>
        {!confirming ? (
          <Button variant="secondary" onClick={() => setConfirming(true)}>{demo ? ta.deleteDemo : ta.deleteStart}</Button>
        ) : (
          <div className="space-y-3">
            <Field label={ta.typeToConfirm(word)}>
              {(id) => <Input id={id} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} dir="auto" />}
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" loading={busy} disabled={typed.trim().toLocaleUpperCase() !== word.toLocaleUpperCase()} onClick={() => void remove()}>
                {busy ? ta.deleting : ta.deleteNow}
              </Button>
              <Button variant="secondary" disabled={busy} onClick={() => { setConfirming(false); setTyped(''); setError(''); }}>{t.common.cancel}</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
};
