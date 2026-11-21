// Glide: a paper plane flies through gaps between stacks of books. Tap to
// climb, gravity does the rest. Every few gates a checkpoint question comes up.
// Pure: step() moves the world by dt seconds and reports what happened.

import type { Rand } from './game';

export const W = 360;
export const H = 540;
export const GROUND = H - 36;
export const PLANE_X = 96;
export const PLANE_R = 12;
export const GRAVITY = 1500;
export const FLAP = -430;
export const MAX_FALL = 620;
export const GATE_W = 64;
export const GAP = 158;
export const SPACING = 230;
export const SPEED = 150;
export const MAX_SPEED = 230;
/** A checkpoint question every this many gates. */
export const EVERY = 6;
/** Seconds you can't crash after recovering. */
export const SAFE = 1.4;

export interface Gate { x: number; gapY: number; passed: boolean; hue: number }
export interface Glide {
  y: number; vy: number;
  /** Before the first tap the plane just hovers. */
  started: boolean;
  t: number; speed: number;
  gates: Gate[];
  passed: number;
  safe: number;
}
export type GlideEvent = 'gate' | 'crash' | 'checkpoint' | null;

export const startGlide = (): Glide => ({ y: H / 2 - 20, vy: 0, started: false, t: 0, speed: SPEED, gates: [], passed: 0, safe: 0 });

export const flap = (s: Glide): Glide => ({ ...s, started: true, vy: FLAP });

const newGate = (x: number, rand: Rand): Gate => {
  const margin = 70;
  return { x, gapY: margin + GAP / 2 + rand() * (GROUND - margin * 2 - GAP), passed: false, hue: Math.floor(rand() * 4) };
};

/** True when the plane (a circle) touches a gate's top or bottom stack. */
export const hits = (y: number, g: Gate) => {
  const nearX = Math.max(g.x, Math.min(PLANE_X, g.x + GATE_W));
  const r = PLANE_R - 2; // a little forgiving
  const touches = (top: number, bottom: number) => {
    const nearY = Math.max(top, Math.min(y, bottom));
    return (PLANE_X - nearX) ** 2 + (y - nearY) ** 2 < r * r;
  };
  return touches(-1000, g.gapY - GAP / 2) || touches(g.gapY + GAP / 2, GROUND);
};

export const stepGlide = (s: Glide, dt: number, rand: Rand): { s: Glide; event: GlideEvent } => {
  if (!s.started) return { s: { ...s, t: s.t + dt }, event: null };
  const t = s.t + dt;
  const speed = Math.min(MAX_SPEED, SPEED + s.passed * 3);
  const vy = Math.min(MAX_FALL, s.vy + GRAVITY * dt);
  let y = s.y + vy * dt;
  let nextVy = vy;
  if (y < PLANE_R) { y = PLANE_R; nextVy = 0; }
  let gates: Gate[] = s.gates.map((g) => ({ ...g, x: g.x - speed * dt })).filter((g) => g.x + GATE_W > -10);
  const last = gates.at(-1);
  if (!last || last.x < W - SPACING) gates = [...gates, newGate((last?.x ?? W) + (last ? SPACING : 80), rand)];
  let passed = s.passed;
  let event: GlideEvent = null;
  for (const g of gates) {
    if (!g.passed && g.x + GATE_W < PLANE_X - PLANE_R) { g.passed = true; passed += 1; event = passed % EVERY === 0 ? 'checkpoint' : 'gate'; }
  }
  const safe = Math.max(0, s.safe - dt);
  const next: Glide = { ...s, t, speed, y, vy: nextVy, gates, passed, safe };
  if (safe === 0 && (y + PLANE_R >= GROUND || gates.some((g) => hits(y, g)))) return { s: next, event: 'crash' };
  return { s: next, event };
};

/** After a crash (or a rescue): back in the middle of the next gap, briefly safe. */
export const recoverGlide = (s: Glide): Glide => {
  const ahead = s.gates.find((g) => g.x + GATE_W >= PLANE_X - PLANE_R);
  return { ...s, y: ahead ? ahead.gapY : H / 2, vy: FLAP / 2, safe: SAFE };
};
