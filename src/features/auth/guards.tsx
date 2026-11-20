import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider';
import { FullPageSpinner } from '@/ui/Spinner';
import { useT } from '@/i18n';

/** Signed-in, onboarded students only. */
export const RequireAuth = () => {
  const { user, profile, loading } = useAuth();
  const t = useT();
  const location = useLocation();
  if (loading) return <FullPageSpinner label={t.common.loading} />;
  if (!user) return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  if (!profile?.onboarded) return <Navigate to="/onboarding" replace />;
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
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
};
