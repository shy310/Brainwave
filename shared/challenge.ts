// Group challenges: a weekly game leaderboard and one question a day for the
// whole group. Pure and tested; the database keeps the scores.

const DAY = 86_400_000;

/** Today as "YYYY-MM-DD" in UTC (the same day for every member, wherever they are). */
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);

/** The Monday (UTC) that starts the week of `d`, "YYYY-MM-DD". */
export const weekStart = (d = new Date()) => {
  const back = (d.getUTCDay() + 6) % 7; // Monday = 0
  return utcDay(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - back * DAY));
};

/** The same pick for every member of a group on a given day: an index into `n` questions. */
export const dailyIndex = (groupId: string, day: string, n: number): number => {
  if (n <= 0) return -1;
  let h = 2166136261;
  for (const ch of `${groupId}|${day}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h % n;
};

export interface BoardRow { userId: string; name: string; best: number }
export interface RankedRow extends BoardRow { rank: number; you: boolean }

/** Highest first; equal scores share a place (1, 2, 2, 4). */
export const rankBoard = (rows: BoardRow[], me: string): RankedRow[] => {
  const sorted = [...rows].sort((a, b) => b.best - a.best || a.name.localeCompare(b.name));
  return sorted.map((r, i) => ({ ...r, rank: i > 0 && sorted[i - 1].best === r.best ? 0 : i + 1, you: r.userId === me }))
    .map((r, i, all) => ({ ...r, rank: r.rank || all.slice(0, i).reverse().find((x) => x.rank)!.rank }));
};

/** A medal for the top three. */
export const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '');
