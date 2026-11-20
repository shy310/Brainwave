// Word error rate for comparing transcription models against a checked reference.
// WER = (substitutions + deletions + insertions) / words in the reference.

/** Lowercase, drop Hebrew niqqud/cantillation and punctuation, unify spaces. */
export const normalizeForWer = (text: string): string[] =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '') // Hebrew points and cantillation marks
    .replace(/[׳״'"`׳״]/g, '') // geresh/gershayim and quotes inside words (צ׳, ת״א)
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** Edit distance between word lists, counted by kind. */
export const wordErrors = (ref: string[], hyp: string[]) => {
  const n = ref.length, m = hyp.length;
  // dp[j] = cost for ref[0..i) vs hyp[0..j); track the operation counts alongside.
  type Cell = { cost: number; sub: number; del: number; ins: number };
  let prev: Cell[] = Array.from({ length: m + 1 }, (_, j) => ({ cost: j, sub: 0, del: 0, ins: j }));
  for (let i = 1; i <= n; i++) {
    const cur: Cell[] = [{ cost: i, sub: 0, del: i, ins: 0 }];
    for (let j = 1; j <= m; j++) {
      const same = ref[i - 1] === hyp[j - 1];
      const diag = prev[j - 1], up = prev[j], left = cur[j - 1];
      const options: Cell[] = [
        { ...diag, cost: diag.cost + (same ? 0 : 1), sub: diag.sub + (same ? 0 : 1) },
        { ...up, cost: up.cost + 1, del: up.del + 1 },
        { ...left, cost: left.cost + 1, ins: left.ins + 1 },
      ];
      cur.push(options.reduce((a, b) => (b.cost < a.cost ? b : a)));
    }
    prev = cur;
  }
  const { cost, sub, del, ins } = prev[m];
  return { errors: cost, substitutions: sub, deletions: del, insertions: ins, words: n };
};

export const wer = (reference: string, hypothesis: string): number => {
  const ref = normalizeForWer(reference);
  const { errors } = wordErrors(ref, normalizeForWer(hypothesis));
  return ref.length ? errors / ref.length : errors ? 1 : 0;
};
