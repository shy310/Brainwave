import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { RequireAuth, RequireGuest, RequireUser } from '@/features/auth/guards';
import { ProgressProvider } from '@/features/learn/ProgressProvider';
import { RouteError } from './RouteError';
import { isChunkError, reloadOnce } from './chunks';

// Pages are code-split: each loads only when visited. If the code file is gone
// because the app was updated since this tab opened, reload once to get the new version.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => {
  try {
    return { Component: (await load()).default };
  } catch (err) {
    const to = router.state.navigation.location;
    if (isChunkError(err) && reloadOnce(to ? `${to.pathname}${to.search}${to.hash}` : undefined)) return new Promise<never>(() => {}); // loading the new version
    throw err;
  }
};

export const router = createBrowserRouter([{
  // Any page that fails shows a friendly screen (with Reload) instead of the router's developer message.
  errorElement: <RouteError />,
  children: [
  {
    element: <RequireGuest />,
    children: [{ path: '/signin', lazy: page(() => import('@/features/auth/SignInPage')) }],
  },
  {
    element: <RequireUser />,
    children: [{ path: '/onboarding', lazy: page(() => import('@/features/auth/OnboardingPage')) }],
  },
  // How to delete an account: public, for the Google Play listing.
  { path: '/delete-account', lazy: page(() => import('@/features/settings/DeleteAccountInfoPage')) },
  // Notes shared by link: open to anyone, no sign-in.
  { path: '/s/:token', lazy: page(() => import('@/features/lectures/SharedLecturePage')) },
  {
    element: <RequireAuth />,
    children: [{
      // A clean page for printing or saving notes as PDF (no app header or menus).
      path: '/lectures/:id/print', lazy: page(() => import('@/features/lectures/PrintLecturePage')),
    }, {
      element: <ProgressProvider><AppShell /></ProgressProvider>,
      children: [
        { index: true, lazy: page(() => import('@/features/home/HomePage')) },
        { path: 'learn', lazy: page(() => import('@/features/learn/LearnPage')) },
        { path: 'learn/course/:courseId', lazy: page(() => import('@/features/learn/CoursePage')) },
        { path: 'learn/topic/:topicId', lazy: page(() => import('@/features/learn/TopicPage')) },
        { path: 'learn/topic/:topicId/quiz', lazy: page(() => import('@/features/learn/QuizPage')) },
        { path: 'tutor', lazy: page(() => import('@/features/tutor/TutorPage')) },
        { path: 'grader', lazy: page(() => import('@/features/grader/GraderPage')) },
        { path: 'search', lazy: page(() => import('@/features/search/SearchPage')) },
        { path: 'exams', lazy: page(() => import('@/features/exams/ExamsPage')) },
        { path: 'exams/:id', lazy: page(() => import('@/features/exams/ExamPage')) },
        { path: 'play', lazy: page(() => import('@/features/game/GamesPage')) },
        { path: 'play/:game', lazy: page(() => import('@/features/game/PlayPage')) },
        { path: 'groups', lazy: page(() => import('@/features/groups/GroupsPage')) },
        { path: 'groups/:id', lazy: page(() => import('@/features/groups/GroupPage')) },
        { path: 'groups/:id/s/:shareId', lazy: page(() => import('@/features/groups/SharedItemPage')) },
        { path: 'join/:code', lazy: page(() => import('@/features/groups/JoinGroupPage')) },
        { path: 'lectures', lazy: page(() => import('@/features/lectures/LecturesPage')) },
        { path: 'lectures/new', lazy: page(() => import('@/features/lectures/NewLecturePage')) },
        { path: 'lectures/study', lazy: page(() => import('@/features/lectures/StudyFolderPage')) },
        { path: 'lectures/review', lazy: page(() => import('@/features/lectures/ReviewPage')) },
        { path: 'lectures/schedule', lazy: page(() => import('@/features/schedule/SchedulePage')) },
        { path: 'lectures/:id', lazy: page(() => import('@/features/lectures/LecturePage')) },
        { path: 'videos', lazy: page(() => import('@/features/videos/VideosPage')) },
        { path: 'videos/:id', lazy: page(() => import('@/features/videos/VideoPage')) },
        { path: 'podcasts', lazy: page(() => import('@/features/podcasts/PodcastsPage')) },
        { path: 'podcasts/:id', lazy: page(() => import('@/features/podcasts/PodcastPage')) },
        { path: 'settings', lazy: page(() => import('@/features/settings/SettingsPage')) },
        { path: '*', lazy: page(() => import('./NotFoundPage')) },
      ],
    }],
  },
]}]);
