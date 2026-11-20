import { Calculator, FlaskConical, Globe2, Landmark, Laptop, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Subject } from '@shared/curriculum';

export const SUBJECT_META: Record<Subject, { icon: LucideIcon; tint: string; soft: string }> = {
  math: { icon: Calculator, tint: 'from-brand-500 to-brand-700', soft: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200' },
  science: { icon: FlaskConical, tint: 'from-emerald-500 to-teal-600', soft: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' },
  geography: { icon: Globe2, tint: 'from-sky-500 to-cyan-600', soft: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200' },
  history: { icon: Landmark, tint: 'from-amber-500 to-orange-600', soft: 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200' },
  coding: { icon: Laptop, tint: 'from-slate-600 to-slate-800', soft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' },
  economics: { icon: TrendingUp, tint: 'from-accent-400 to-accent-600', soft: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200' },
};
