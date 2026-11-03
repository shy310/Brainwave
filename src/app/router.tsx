import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RequireAuth, RequireGuest, RequireUser } from '@/features/auth/guards';
import { PodcastsSoon } from '@/features/home/ComingSoonPage';
import { ProgressProvider } from '@/features/learn/ProgressProvider';

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
      element: <ProgressProvider><AppShell /></ProgressProvider>,
      children: [
        { index: true, lazy: page(() => import('@/features/home/HomePage')) },
        { path: 'learn', lazy: page(() => import('@/features/learn/LearnPage')) },
        { path: 'learn/course/:courseId', lazy: page(() => import('@/features/learn/CoursePage')) },
        { path: 'learn/topic/:topicId', lazy: page(() => import('@/features/learn/TopicPage')) },
        { path: 'learn/topic/:topicId/quiz', lazy: page(() => import('@/features/learn/QuizPage')) },
        { path: 'tutor', lazy: page(() => import('@/features/tutor/TutorPage')) },
        { path: 'lectures', lazy: page(() => import('@/features/lectures/LecturesPage')) },
        { path: 'lectures/new', lazy: page(() => import('@/features/lectures/NewLecturePage')) },
        { path: 'lectures/:id', lazy: page(() => import('@/features/lectures/LecturePage')) },
        { path: 'videos', lazy: page(() => import('@/features/videos/VideosPage')) },
        { path: 'videos/:id', lazy: page(() => import('@/features/videos/VideoPage')) },
        { path: 'podcasts', element: <PodcastsSoon /> },
        { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')) },
        { path: '*', lazy: page(() => import('./NotFoundPage')) },
      ],
    }],
  },
]);
