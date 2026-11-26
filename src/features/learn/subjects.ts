import { Calculator, FlaskConical, Globe2, Landmark, Laptop, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Subject } from '@shared/curriculum';

/**
 * Each subject's identity in the BrainWave system: an icon, its colour field
 * (`field`: the card's illustrated header, carrying white art), a soft tint for
 * chips and small badges, and the icon-tile gradient used in lists.
 * Maths blue and purple, Science mint, Geography teal, History amber,
 * Coding purple, Economics navy and gold.
 */
export const SUBJECT_META: Record<Subject, { icon: LucideIcon; tint: string; soft: string; field: string }> = {
  math: { icon: Calculator, tint: 'from-brand-500 to-violet-600', field: 'bg-[linear-gradient(135deg,#3268f5,#6a54ea)]', soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' },
  science: { icon: FlaskConical, tint: 'from-emerald-400 to-emerald-600', field: 'bg-[linear-gradient(135deg,#1fb68b,#128a69)]', soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
  geography: { icon: Globe2, tint: 'from-teal-400 to-teal-600', field: 'bg-[linear-gradient(135deg,#14b8a6,#0f766e)]', soft: 'bg-teal-50 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200' },
  history: { icon: Landmark, tint: 'from-amber-400 to-orange-600', field: 'bg-[linear-gradient(135deg,#f0a33a,#c2581c)]', soft: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  coding: { icon: Laptop, tint: 'from-violet-500 to-violet-700', field: 'bg-[linear-gradient(135deg,#9560ec,#6533b8)]', soft: 'bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200' },
  economics: { icon: TrendingUp, tint: 'from-brand-800 to-brand-950', field: 'bg-[linear-gradient(135deg,#1f43ad,#172344)]', soft: 'bg-accent-200 text-accent-600 dark:bg-accent-600/20 dark:text-accent-300' },
};
