import { Link } from 'react-router';
import { useT } from '@/i18n';
import { Mascot } from '@/ui/Mascot';

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center sm:py-24">
      <Mascot mood="confused" size={140} />
      <h1 className="mt-4 text-3xl font-bold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.body}</p>
      <Link to="/" className="btn-lip relative mt-6 inline-flex h-12 items-center rounded-[var(--radius-control)] bg-brand-600 px-5 font-semibold text-white [--lip:var(--color-brand-800)] hover:bg-brand-700">{t.notFound.home}</Link>
    </div>
  );
}
