import { BookOpen, Home, Mic, Clapperboard, Headphones, type LucideIcon } from 'lucide-react';
import type { Dict } from '@/i18n/en';

export interface NavItem { to: string; icon: LucideIcon; label: (t: Dict) => string }

export const NAV: NavItem[] = [
  { to: '/', icon: Home, label: t => t.nav.home },
  { to: '/learn', icon: BookOpen, label: t => t.nav.learn },
  { to: '/lectures', icon: Mic, label: t => t.nav.lectures },
  { to: '/videos', icon: Clapperboard, label: t => t.nav.videos },
  { to: '/podcasts', icon: Headphones, label: t => t.nav.podcasts },
];
