import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { FullPageSpinner } from '@/ui/Spinner';
import { useT } from '@/i18n';

/** Signed-in, onboarded students only. */
const RETURN_KEY = 'bw.returnTo';
/** Where to go after signing in (and onboarding): the page the visitor asked for. */
export const takeReturnTo = (): string => {
  try {
    const to = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return to && to.startsWith('/') && !to.startsWith('//') ? to : '/';
  } catch { return '/'; }
};
const rememberReturnTo = (path: string) => {
  try { if (path !== '/' && path !== '/signin') sessionStorage.setItem(RETURN_KEY, path); } catch { /* ignore */ }
};

export const RequireAuth = () => {
  const { user, profile, loading } = useAuth();
  const t = useT();
  const location = useLocation();
  if (loading) return <FullPageSpinner label={t.common.loading} />;
  if (!user) { rememberReturnTo(location.pathname + location.search); return <Navigate to="/signin" replace state={{ from: location.pathname }} />; }
  if (!profile?.onboarded) { rememberReturnTo(location.pathname + location.search); return <Navigate to="/onboarding" replace />; }
  return <Outlet />;
};

/** Signed-in students who still need onboarding. */
export const RequireUser = () => {
  const { user, loading } = useAuth();
  const t = useT();
  if (loading) return <FullPageSpinner label={t.common.loading} />;
  if (!user) return <Navigate to="/signin" replace />;
  return <Outlet />;
};

/** Pages for signed-out visitors (sign-in). */
export const RequireGuest = () => {
  const { user, loading } = useAuth();
  const t = useT();
  if (loading) return <FullPageSpinner label={t.common.loading} />;
  if (user) return <Navigate to={takeReturnTo()} replace />;
  return <Outlet />;
};
