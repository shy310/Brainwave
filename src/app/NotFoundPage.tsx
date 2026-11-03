import { Link } from 'react-router';
import { useT } from '@/i18n';

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-3xl font-semibold">{t.notFound.title}</h1>
      <p className="mt-2 text-muted">{t.notFound.body}</p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand-600 px-4 font-medium text-white hover:bg-brand-700">{t.notFound.home}</Link>
    </div>
  );
}
