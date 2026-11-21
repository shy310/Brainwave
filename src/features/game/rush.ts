// Lane Rush: drive down a three-lane road and switch lanes to miss the traffic
// and cones. It speeds up as you go; every so often a checkpoint question
// comes up. Pure: step() moves the world by dt seconds and reports what happened.

import { shuffle, type Rand } from './game';

export const W = 360;
export const H = 540;
export const LANES = 3;
export const LANE_W = 96;
export const CAR_W = 44;
export const CAR_H = 76;
export const CAR_Y = H - 110;
export const SPEED = 260;
export const MAX_SPEED = 520;
/** Pixels per second gained every second. */
export const ACCEL = 5;
/** Seconds of driving between checkpoint questions. */
export const EVERY = 22;
export const SAFE = 1.4;
/** How fast the car slides to its new lane (lanes per second). */
export const STEER = 7;

export const laneX = (lane: number) => W / 2 + (lane - 1) * LANE_W;

export interface Obstacle { lane: number; y: number; kind: 'car' | 'cone'; hue: number; h: number }
export interface Rush {
  lane: number;
  /** Where the car is drawn, sliding toward `lane`. */
  x: number;
  t: number; speed: number;
  /** Metres driven (one metre = 10 px). */
  dist: number;
  obstacles: Obstacle[];
  /** Road scrolled since the last row of traffic. */
  sinceRow: number;
  /** Driving time until the next checkpoint. */
  untilAsk: number;
  safe: number;
}
export type RushEvent = 'crash' | 'checkpoint' | null;

export const startRush = (): Rush => ({ lane: 1, x: laneX(1), t: 0, speed: SPEED, dist: 0, obstacles: [], sinceRow: 0, untilAsk: EVERY, safe: 0 });

export const steer = (s: Rush, dir: -1 | 1): Rush => ({ ...s, lane: Math.max(0, Math.min(LANES - 1, s.lane + dir)) });

/** One row of traffic: one or two lanes blocked, never all three. */
const newRow = (rand: Rand, y: number): Obstacle[] => {
  const blocked = rand() < 0.35 ? 2 : 1;
  const lanes = shuffle([0, 1, 2], rand).slice(0, blocked);
  return lanes.map((lane) => {
    const kind = rand() < 0.3 ? 'cone' : 'car';
    return { lane, y, kind, hue: Math.floor(rand() * 4), h: kind === 'cone' ? 30 : 74 };
  });
};

/** Space between rows: shrinks a little as the road speeds up, but always leaves time to switch lanes. */
export const rowGap = (speed: number) => Math.max(210, 300 - (speed - SPEED) * 0.2);

export const collides = (s: Pick<Rush, 'x'>, o: Obstacle) => {
  const w = o.kind === 'cone' ? 28 : CAR_W;
  return Math.abs(s.x - laneX(o.lane)) < (CAR_W + w) / 2 - 6
    && o.y + o.h / 2 > CAR_Y - CAR_H / 2 + 8 && o.y - o.h / 2 < CAR_Y + CAR_H / 2 - 8;
};

export const stepRush = (s: Rush, dt: number, rand: Rand): { s: Rush; event: RushEvent } => {
  const speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt);
  const move = speed * dt;
  const target = laneX(s.lane);
  const slide = STEER * LANE_W * dt;
  const x = Math.abs(target - s.x) <= slide ? target : s.x + Math.sign(target - s.x) * slide;
  let obstacles = s.obstacles.map((o) => ({ ...o, y: o.y + move })).filter((o) => o.y - o.h / 2 < H + 20);
  let sinceRow = s.sinceRow + move;
  // A short clear stretch at the start.
  if (s.t > 1.2 && sinceRow >= rowGap(speed)) { obstacles = [...obstacles, ...newRow(rand, -60)]; sinceRow = 0; }
  const untilAsk = s.untilAsk - dt;
  const safe = Math.max(0, s.safe - dt);
  const next: Rush = { ...s, x, t: s.t + dt, speed, dist: s.dist + move / 10, obstacles, sinceRow, untilAsk: untilAsk <= 0 ? EVERY : untilAsk, safe };
  if (safe === 0 && obstacles.some((o) => collides(next, o))) return { s: next, event: 'crash' };
  return { s: next, event: untilAsk <= 0 ? 'checkpoint' : null };
};

/** After a crash (or a rescue): the traffic around the car is cleared and it's briefly safe. */
export const recoverRush = (s: Rush): Rush => ({
  ...s,
  obstacles: s.obstacles.filter((o) => o.y + o.h / 2 < CAR_Y - CAR_H - 140 || o.y - o.h / 2 > CAR_Y + CAR_H),
  safe: SAFE,
  speed: Math.max(SPEED, s.speed * 0.85),
});
