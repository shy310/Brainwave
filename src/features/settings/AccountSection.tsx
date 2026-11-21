import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '@/i18n';
import { postApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { clearLocalData } from '@/lib/wipe';
import { useAiError } from '@/lib/useAiError';
import { Alert } from '@/ui/Alert';
import { Button } from '@/ui/Button';
import { Field, Input } from '@/ui/Field';
import { useAuth } from '@/features/auth/AuthProvider';

export const supportEmail = () => import.meta.env.VITE_SUPPORT_EMAIL?.trim() || '';

/** Change the account's email address (a confirmation link goes to both inboxes). */
export const ChangeEmail = () => {
  const { t } = useI18n();
  const ta = t.account;
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !email.trim()) return;
    const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/settings` });
    setNote(error ? t.auth.errors.generic : ta.emailSent);
    if (!error) setEmail('');
  };
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input type="email" aria-label={ta.newEmail} placeholder={ta.newEmail} value={email} onChange={(e) => { setEmail(e.target.value); setNote(''); }} dir="ltr" />
        <Button type="submit" variant="secondary" disabled={!email.includes('@')}>{ta.changeEmail}</Button>
      </div>
      {note && <p className="text-sm" role="status">{note}</p>}
    </form>
  );
};

/** Delete the account (or this browser's demo data) after typing the confirmation word. Required by Google Play. */
export const DeleteAccount = () => {
  const { t } = useI18n();
  const ta = t.account;
  const { demo, signOut } = useAuth();
  const navigate = useNavigate();
  const toMessage = useAiError();
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const word = ta.confirmWord;

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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{demo ? ta.deleteDemoBody : ta.deleteBody}</p>
      <Field label={ta.typeToConfirm(word)}>
        {(id) => <Input id={id} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} dir="auto" />}
      </Field>
      {error && <Alert tone="error">{error}</Alert>}
      <Button variant="danger" loading={busy} disabled={typed.trim().toLocaleUpperCase() !== word.toLocaleUpperCase()} onClick={() => void remove()}>
        {busy ? ta.deleting : ta.deleteNow}
      </Button>
    </div>
  );
};
