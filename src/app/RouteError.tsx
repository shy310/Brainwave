import { Link, isRouteErrorResponse, useRouteError } from 'react-router';
import { useT } from '@/i18n';
import { Button } from '@/ui/Button';
import { Mascot } from '@/ui/Mascot';
import { isChunkError } from './chunks';

/** Shown instead of a page that failed: friendly, in the app's language, with a way out. */
export const RouteError = () => {
  const t = useT();
  const err = useRouteError();
  const updated = isChunkError(err);
  if (!updated) console.error(err);
  const notFound = isRouteErrorResponse(err) && err.status === 404;
  return (
    <div role="alert" className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Mascot mood={updated ? 'waving' : 'confused'} size={120} />
      <div className="space-y-1">
        <p className="font-display text-xl font-bold">{updated ? t.errors.updated : notFound ? t.errors.notFound : t.errors.boundary}</p>
        {updated && <p className="text-sm text-muted">{t.errors.updatedHint}</p>}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => window.location.reload()}>{t.errors.reload}</Button>
        <Link to="/" className="btn-lip relative inline-flex h-11 items-center rounded-[var(--radius-control)] border border-line bg-surface px-4 text-sm font-semibold [--lip:var(--line)] hover:bg-surface-2">{t.errors.home}</Link>
      </div>
    </div>
  );
};
