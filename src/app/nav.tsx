import type { Dict } from '@/i18n/en';
import type { Tool } from '@/ui/tools';

export interface NavItem { to: string; tool: Tool; label: (t: Dict) => string }

/** The four pillars and Home: the phone's tab bar and the top of the sidebar. */
export const NAV: NavItem[] = [
  { to: '/', tool: 'home', label: (t) => t.nav.home },
  { to: '/learn', tool: 'learn', label: (t) => t.nav.learn },
  { to: '/lectures', tool: 'lectures', label: (t) => t.nav.lectures },
  { to: '/videos', tool: 'videos', label: (t) => t.nav.videos },
  { to: '/podcasts', tool: 'podcasts', label: (t) => t.nav.podcasts },
];

/** Tools for studying what you already have. */
export const STUDY_NAV: NavItem[] = [
  { to: '/lectures/review', tool: 'review', label: (t) => t.lectures.tools.review },
  { to: '/practice', tool: 'practice', label: (t) => t.lectures.tools.weak },
  { to: '/exams', tool: 'exams', label: (t) => t.lectures.tools.exams },
  { to: '/play', tool: 'games', label: (t) => t.lectures.tools.games },
  { to: '/calendar', tool: 'calendar', label: (t) => t.lectures.tools.calendar },
  { to: '/groups', tool: 'groups', label: (t) => t.lectures.tools.groups },
];

/** Help when you're stuck. */
export const HELP_NAV: NavItem[] = [
  { to: '/tutor', tool: 'tutor', label: (t) => t.tutor.title },
  { to: '/search', tool: 'search', label: (t) => t.home.quick.search },
  { to: '/grader', tool: 'grader', label: (t) => t.grader.title },
];

export const ALL_NAV = [...NAV, ...STUDY_NAV, ...HELP_NAV];

/** The item a path belongs to: the deepest match, so /lectures/review is Review, not Lectures. */
export const activeItem = (items: NavItem[], pathname: string) => items.reduce<NavItem | null>((best, item) => {
  const match = item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`);
  return match && (!best || item.to.length > best.to.length) ? item : best;
}, null);
