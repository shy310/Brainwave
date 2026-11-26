import {
  BookOpen, CalendarClock, CalendarDays, CalendarRange, Clapperboard, ClipboardCheck, Gamepad2, Headphones, Layers, MessageCircle,
  Mic, Network, ScrollText, Search, Settings, Target, Users, type LucideIcon,
} from 'lucide-react';

/**
 * Each BrainWave tool's identity, the way each subject has one (learn/subjects.ts):
 * an icon, a coloured `field` for its page header, a `soft` tint for chips and
 * small badges, and a `tile` gradient for icon tiles in lists.
 *
 * Hues follow the palette's jobs. Blue is BrainWave itself (lectures, learning,
 * the tutor); purple is discovery (podcasts, review, concept maps); mint is
 * progress (calendar, grading); sunshine is the big moment (exams, cheat sheets);
 * coral is play and practice; teal is people. Tools that sit side by side (the
 * study tools grid, Home's menu) never share a hue.
 *
 * Every `field` passes 4.5:1 with white text, except sunshine fields, which carry
 * navy ink (`onField`).
 */
export type Tool =
  | 'learn' | 'lectures' | 'videos' | 'podcasts' | 'tutor' | 'review' | 'practice' | 'exams' | 'calendar'
  | 'schedule' | 'games' | 'groups' | 'grader' | 'search' | 'settings' | 'conceptMap' | 'cheatSheet';

export interface ToolMeta {
  icon: LucideIcon;
  /** The header field: a gradient that carries `onField` text. */
  field: string;
  /** Text colour on the field. */
  onField: string;
  /** Soft chip / badge on a surface. */
  soft: string;
  /** IconTile gradient. */
  tile: string;
  /** The field's art colour (sparks, the brainwave). */
  spark: string;
  /** The tool's ink: its icon on a white tile, its accents on surfaces (AA on white). */
  hue: string;
}

const white = 'text-white';
const navy = 'text-brand-950';

export const TOOL_META: Record<Tool, ToolMeta> = {
  learn: { icon: BookOpen, hue: '#2552d8', field: 'bg-[linear-gradient(135deg,#3268f5,#2552d8)]', onField: white, spark: '#ffd35a',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  lectures: { icon: Mic, hue: '#2552d8', field: 'bg-[linear-gradient(135deg,#3268f5,#1f43ad)]', onField: white, spark: '#ffd35a',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  tutor: { icon: MessageCircle, hue: '#1f43ad', field: 'bg-[linear-gradient(135deg,#2552d8,#172344)]', onField: white, spark: '#518cff',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-600 to-brand-900' },
  videos: { icon: Clapperboard, hue: '#c2412d', field: 'bg-[linear-gradient(135deg,#c2412d,#9c3222)]', onField: white, spark: '#ffd35a',
    soft: 'bg-coral-50 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200', tile: 'from-coral-400 to-coral-600' },
  podcasts: { icon: Headphones, hue: '#7c45db', field: 'bg-[linear-gradient(135deg,#7c45db,#522b93)]', onField: white, spark: '#ffa696',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  review: { icon: Layers, hue: '#6533b8', field: 'bg-[linear-gradient(135deg,#6533b8,#3f2470)]', onField: white, spark: '#ffd35a',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  practice: { icon: Target, hue: '#c2412d', field: 'bg-[linear-gradient(135deg,#c2412d,#9c3222)]', onField: white, spark: '#ffd35a',
    soft: 'bg-coral-50 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200', tile: 'from-coral-400 to-coral-600' },
  exams: { icon: CalendarClock, hue: '#8a5a00', field: 'bg-[linear-gradient(135deg,#ffd35a,#ffc52e)]', onField: navy, spark: '#3268f5',
    soft: 'bg-accent-200 text-accent-600 dark:bg-accent-600/20 dark:text-accent-300', tile: 'from-accent-400 to-accent-500' },
  calendar: { icon: CalendarDays, hue: '#0e6f55', field: 'bg-[linear-gradient(135deg,#0e6f55,#0b4637)]', onField: white, spark: '#ffd35a',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  schedule: { icon: CalendarRange, hue: '#0e6f55', field: 'bg-[linear-gradient(135deg,#0e6f55,#0b4637)]', onField: white, spark: '#ffd35a',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  games: { icon: Gamepad2, hue: '#c2410c', field: 'bg-[linear-gradient(135deg,#c2410c,#9a3412)]', onField: white, spark: '#ffd35a',
    soft: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200', tile: 'from-orange-400 to-orange-600' },
  groups: { icon: Users, hue: '#0f766e', field: 'bg-[linear-gradient(135deg,#0f766e,#115e59)]', onField: white, spark: '#ffd35a',
    soft: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200', tile: 'from-teal-400 to-teal-600' },
  grader: { icon: ClipboardCheck, hue: '#0e6f55', field: 'bg-[linear-gradient(135deg,#0e6f55,#0b4637)]', onField: white, spark: '#ffd35a',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  search: { icon: Search, hue: '#2552d8', field: 'bg-[linear-gradient(135deg,#3268f5,#1f43ad)]', onField: white, spark: '#ffd35a',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  settings: { icon: Settings, hue: '#172344', field: 'bg-[linear-gradient(135deg,#1f43ad,#172344)]', onField: white, spark: '#518cff',
    soft: 'bg-surface-2 text-fg', tile: 'from-brand-800 to-brand-950' },
  conceptMap: { icon: Network, hue: '#7c45db', field: 'bg-[linear-gradient(135deg,#7c45db,#522b93)]', onField: white, spark: '#ffd35a',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  cheatSheet: { icon: ScrollText, hue: '#8a5a00', field: 'bg-[linear-gradient(135deg,#ffd35a,#ffc52e)]', onField: navy, spark: '#3268f5',
    soft: 'bg-accent-200 text-accent-600 dark:bg-accent-600/20 dark:text-accent-300', tile: 'from-accent-400 to-accent-500' },
};
