import { Link } from 'react-router';
import { useI18n } from '@/i18n';
import { Card } from '@/ui/Card';
import { Logo } from '@/ui/Logo';
import { LanguageToggle } from '@/app/LanguageToggle';
import { supportEmail } from './AccountSection';

/** Public page explaining how to delete an account (linked from the Google Play listing). */
export default function DeleteAccountInfoPage() {
  const { t } = useI18n();
  const ta = t.account;
  const email = supportEmail();
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-2xl items-center px-4">
          <Link to="/" aria-label="BrainWave"><Logo /></Link>
          <div className="ms-auto"><LanguageToggle /></div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <h1 className="text-3xl font-bold">{ta.publicTitle}</h1>
        <Card className="space-y-4 p-6">
          <ol className="list-decimal space-y-2 ps-6">{ta.publicSteps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="text-muted">{ta.publicWhat}</p>
          <p className="text-muted">{email ? ta.publicHelp(email) : ta.publicNoEmail}</p>
        </Card>
        <Link to="/settings" className="inline-flex h-11 items-center rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">{t.nav.settings}</Link>
      </main>
    </div>
  );
}
