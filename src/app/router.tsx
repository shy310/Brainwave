import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RequireAuth, RequireGuest, RequireUser } from '@/features/auth/guards';
import { LearnSoon, LecturesSoon, VideosSoon, PodcastsSoon } from '@/features/home/ComingSoonPage';

// Pages are code-split: each loads only when visited.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default });

export const router = createBrowserRouter([
  {
    element: <RequireGuest />,
    children: [{ path: '/signin', lazy: page(() => import('@/features/auth/SignInPage')) }],
  },
  {
    element: <RequireUser />,
    children: [{ path: '/onboarding', lazy: page(() => import('@/features/auth/OnboardingPage')) }],
  },
  {
    element: <RequireAuth />,
    children: [{
      element: <AppShell />,
      children: [
        { index: true, lazy: page(() => import('@/features/home/HomePage')) },
        { path: 'learn', element: <LearnSoon /> },
        { path: 'lectures', element: <LecturesSoon /> },
        { path: 'videos', element: <VideosSoon /> },
        { path: 'podcasts', element: <PodcastsSoon /> },
        { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')) },
        { path: '*', lazy: page(() => import('./NotFoundPage')) },
      ],
    }],
  },
]);
