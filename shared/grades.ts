// Grade levels supported by BrainWave, K through college.
export const GRADES = ['k', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'college'] as const;
export type Grade = (typeof GRADES)[number];

export const isGrade = (v: unknown): v is Grade => typeof v === 'string' && (GRADES as readonly string[]).includes(v);

/** Coarse band used to tune AI tone and difficulty. */
export const gradeBand = (g: Grade): 'early' | 'elementary' | 'middle' | 'high' | 'college' => {
  if (g === 'k' || g === '1' || g === '2') return 'early';
  if (g === 'college') return 'college';
  const n = Number(g);
  if (n <= 5) return 'elementary';
  if (n <= 8) return 'middle';
  return 'high';
};
