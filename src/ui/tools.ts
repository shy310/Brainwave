import {
  BookOpen, CalendarClock, House, CalendarDays, CalendarRange, Clapperboard, ClipboardCheck, Gamepad2, Headphones, Layers, MessageCircle,
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
  | 'home' | 'learn' | 'lectures' | 'videos' | 'podcasts' | 'tutor' | 'review' | 'practice' | 'exams' | 'calendar'
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
  home: { icon: House, hue: '#2f49d6', field: 'bg-[linear-gradient(135deg,#3b5cf6,#263cb0)]', onField: white, spark: '#ffcb45',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-400 to-brand-700' },
  learn: { icon: BookOpen, hue: '#2f49d6', field: 'bg-[linear-gradient(135deg,#3b5cf6,#2f49d6)]', onField: white, spark: '#ffcb45',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  lectures: { icon: Mic, hue: '#2f49d6', field: 'bg-[linear-gradient(135deg,#3b5cf6,#263cb0)]', onField: white, spark: '#ffcb45',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  tutor: { icon: MessageCircle, hue: '#263cb0', field: 'bg-[linear-gradient(135deg,#2f49d6,#141a3c)]', onField: white, spark: '#5e7dff',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-600 to-brand-900' },
  videos: { icon: Clapperboard, hue: '#c43c2a', field: 'bg-[linear-gradient(135deg,#c43c2a,#9e2f21)]', onField: white, spark: '#ffcb45',
    soft: 'bg-coral-50 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200', tile: 'from-coral-400 to-coral-600' },
  podcasts: { icon: Headphones, hue: '#7c3aed', field: 'bg-[linear-gradient(135deg,#7c3aed,#5524a8)]', onField: white, spark: '#ffa696',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  review: { icon: Layers, hue: '#6a2cd4', field: 'bg-[linear-gradient(135deg,#6a2cd4,#3f1d7a)]', onField: white, spark: '#ffcb45',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  practice: { icon: Target, hue: '#c43c2a', field: 'bg-[linear-gradient(135deg,#c43c2a,#9e2f21)]', onField: white, spark: '#ffcb45',
    soft: 'bg-coral-50 text-coral-700 dark:bg-coral-700/25 dark:text-coral-200', tile: 'from-coral-400 to-coral-600' },
  exams: { icon: CalendarClock, hue: '#8a5a00', field: 'bg-[linear-gradient(135deg,#ffcb45,#ffbc1f)]', onField: navy, spark: '#3b5cf6',
    soft: 'bg-accent-200 text-accent-600 dark:bg-accent-600/20 dark:text-accent-300', tile: 'from-accent-400 to-accent-500' },
  calendar: { icon: CalendarDays, hue: '#0d7f5e', field: 'bg-[linear-gradient(135deg,#0d7f5e,#094434)]', onField: white, spark: '#ffcb45',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  schedule: { icon: CalendarRange, hue: '#0d7f5e', field: 'bg-[linear-gradient(135deg,#0d7f5e,#094434)]', onField: white, spark: '#ffcb45',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  games: { icon: Gamepad2, hue: '#c2410c', field: 'bg-[linear-gradient(135deg,#c2410c,#9a3412)]', onField: white, spark: '#ffcb45',
    soft: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200', tile: 'from-orange-400 to-orange-600' },
  groups: { icon: Users, hue: '#0f766e', field: 'bg-[linear-gradient(135deg,#0f766e,#115e59)]', onField: white, spark: '#ffcb45',
    soft: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200', tile: 'from-teal-400 to-teal-600' },
  grader: { icon: ClipboardCheck, hue: '#0d7f5e', field: 'bg-[linear-gradient(135deg,#0d7f5e,#094434)]', onField: white, spark: '#ffcb45',
    soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200', tile: 'from-emerald-400 to-emerald-600' },
  search: { icon: Search, hue: '#2f49d6', field: 'bg-[linear-gradient(135deg,#3b5cf6,#263cb0)]', onField: white, spark: '#ffcb45',
    soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200', tile: 'from-brand-500 to-brand-700' },
  settings: { icon: Settings, hue: '#141a3c', field: 'bg-[linear-gradient(135deg,#263cb0,#141a3c)]', onField: white, spark: '#5e7dff',
    soft: 'bg-surface-2 text-fg', tile: 'from-brand-800 to-brand-950' },
  conceptMap: { icon: Network, hue: '#7c3aed', field: 'bg-[linear-gradient(135deg,#7c3aed,#5524a8)]', onField: white, spark: '#ffcb45',
    soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200', tile: 'from-violet-500 to-violet-700' },
  cheatSheet: { icon: ScrollText, hue: '#8a5a00', field: 'bg-[linear-gradient(135deg,#ffcb45,#ffbc1f)]', onField: navy, spark: '#3b5cf6',
    soft: 'bg-accent-200 text-accent-600 dark:bg-accent-600/20 dark:text-accent-300', tile: 'from-accent-400 to-accent-500' },
};
