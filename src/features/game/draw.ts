// Drawing for the arcade games, on a 360×540 canvas. Colours follow the app's
// Ocean palette, with a night version for dark mode.

import { GAP, GATE_W, GROUND, H as GH, PLANE_R, PLANE_X, W as GW, type Glide } from './glide';
import { CAR_H, CAR_W, CAR_Y, H as RH, LANE_W, W as RW, laneX, type Rush } from './rush';

export interface Look { dark: boolean; reduced: boolean }

const BOOKS = ['#2356e8', '#ffc23d', '#ff6b5e', '#14b8a6'];
const SPINES = ['#17327a', '#8f5f00', '#a8322a', '#0b6e63'];
const CARS = ['#ff6b5e', '#14b8a6', '#ffc23d', '#8b5cf6'];

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

const cloud = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.arc(x, y, 16 * s, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 18 * s, y - 12 * s, 18 * s, Math.PI, Math.PI * 1.85);
  ctx.arc(x + 40 * s, y - 4 * s, 14 * s, Math.PI * 1.2, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
};

/** A stack of books from y0 to y1, spines facing us. `seed` keeps each stack's look steady. */
const books = (ctx: CanvasRenderingContext2D, x: number, y0: number, y1: number, seed: number) => {
  const bookH = 22;
  let i = 0;
  for (let y = y1 - bookH; y > y0 - bookH; y -= bookH, i++) {
    const k = (seed + i * 3) % 4;
    const inset = ((seed * 7 + i * 5) % 3) * 3;
    const top = Math.max(y, y0);
    const h = Math.min(bookH, y + bookH - top);
    if (h <= 0) continue;
    ctx.fillStyle = BOOKS[k];
    roundRect(ctx, x + inset, top, GATE_W - inset * 2, h - 1, 3);
    ctx.fill();
    ctx.fillStyle = SPINES[k];
    ctx.fillRect(x + inset + 8, top + 4, 4, Math.max(0, h - 9));
    ctx.fillRect(x + GATE_W - inset - 14, top + 4, 4, Math.max(0, h - 9));
  }
};

export const drawGlide = (ctx: CanvasRenderingContext2D, s: Glide, look: Look) => {
  const sky = ctx.createLinearGradient(0, 0, 0, GH);
  sky.addColorStop(0, look.dark ? '#0b1430' : '#bcd2ff');
  sky.addColorStop(1, look.dark ? '#1b2a55' : '#eef3fe');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, GW, GH);

  // Slow clouds (still when motion is reduced).
  ctx.fillStyle = look.dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.85)';
  const drift = look.reduced ? 0 : s.t * 18;
  for (const [cx, cy, sc] of [[40, 90, 1], [220, 150, 0.8], [330, 60, 1.2], [140, 260, 0.7]] as const) {
    cloud(ctx, ((cx - drift) % (GW + 120) + GW + 120) % (GW + 120) - 60, cy, sc);
  }
  if (look.dark) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 18; i++) ctx.fillRect((i * 97) % GW, (i * 53) % 300, 1.5, 1.5);
  }

  for (const g of s.gates) {
    books(ctx, g.x, -10, g.gapY - GAP / 2, g.hue);
    books(ctx, g.x, g.gapY + GAP / 2, GROUND, g.hue + 2);
  }

  // The desk the stacks stand on.
  ctx.fillStyle = look.dark ? '#3a2a1c' : '#c98d55';
  ctx.fillRect(0, GROUND, GW, GH - GROUND);
  ctx.fillStyle = look.dark ? '#4c3726' : '#dba26b';
  ctx.fillRect(0, GROUND, GW, 6);
  ctx.strokeStyle = look.dark ? 'rgba(0,0,0,0.25)' : 'rgba(120,70,30,0.25)';
  const grain = look.reduced ? 0 : (s.t * s.speed) % 40;
  for (let x = -grain; x < GW; x += 40) { ctx.beginPath(); ctx.moveTo(x, GROUND + 14); ctx.lineTo(x + 24, GROUND + 14); ctx.stroke(); }

  // The paper plane, tilted with its speed; it blinks while safe after a crash.
  if (s.safe > 0 && Math.floor(s.safe * 10) % 2 === 0) ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.translate(PLANE_X, s.y);
  ctx.rotate(Math.max(-0.5, Math.min(0.9, s.vy / 700)));
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#17327a';
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(PLANE_R + 6, 0);
  ctx.lineTo(-PLANE_R - 4, -PLANE_R + 2);
  ctx.lineTo(-PLANE_R + 2, 0);
  ctx.lineTo(-PLANE_R - 4, PLANE_R - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d6e2ff';
  ctx.beginPath();
  ctx.moveTo(PLANE_R + 6, 0);
  ctx.lineTo(-PLANE_R + 2, 0);
  ctx.lineTo(-PLANE_R - 4, PLANE_R - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
};

export const drawShield = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) => {
  ctx.strokeStyle = 'rgba(255,194,61,0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, r + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,207,77,0.18)';
  ctx.fill();
};

const car = (ctx: CanvasRenderingContext2D, x: number, y: number, body: string, player: boolean) => {
  const w = CAR_W, h = CAR_H;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, x - w / 2 + 3, y - h / 2 + 5, w, h, 10);
  ctx.fill();
  ctx.fillStyle = body;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 10);
  ctx.fill();
  // Windows: the front of the player's car points up, traffic points down.
  ctx.fillStyle = 'rgba(15,23,42,0.75)';
  const front = player ? y - h / 2 + 16 : y + h / 2 - 30;
  roundRect(ctx, x - w / 2 + 6, front, w - 12, 14, 4);
  ctx.fill();
  roundRect(ctx, x - w / 2 + 7, player ? y + 12 : y - 26, w - 14, 12, 4);
  ctx.fill();
  ctx.fillStyle = player ? '#ffe08a' : '#fff4f2';
  const lightY = player ? y - h / 2 + 2 : y + h / 2 - 6;
  ctx.fillRect(x - w / 2 + 6, lightY, 8, 4);
  ctx.fillRect(x + w / 2 - 14, lightY, 8, 4);
  if (player) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(x - 3, y - h / 2 + 34, 6, 10);
  }
};

const cone = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.fillStyle = '#ff7a1a';
  ctx.beginPath();
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x + 13, y + 12);
  ctx.lineTo(x - 13, y + 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 7, y - 1, 14, 5);
  ctx.fillStyle = '#c2410c';
  ctx.fillRect(x - 16, y + 11, 32, 5);
};

export const drawRush = (ctx: CanvasRenderingContext2D, s: Rush, look: Look) => {
  const road = LANE_W * 3;
  const left = (RW - road) / 2;
  // Verges.
  ctx.fillStyle = look.dark ? '#0f2a26' : '#9fd8b8';
  ctx.fillRect(0, 0, RW, RH);
  const scroll = (s.dist * 10) % 60;
  ctx.fillStyle = look.dark ? '#14352f' : '#86cba5';
  for (let y = -60 + scroll; y < RH; y += 60) { ctx.fillRect(8, y, 14, 30); ctx.fillRect(RW - 22, y + 30, 14, 30); }
  // Road and kerbs.
  ctx.fillStyle = look.dark ? '#1a2030' : '#3a4256';
  ctx.fillRect(left, 0, road, RH);
  const off = (s.dist * 10) % 40;
  for (let i = -2; i * 20 + off < RH; i++) {
    ctx.fillStyle = (i + 2) % 2 === 0 ? '#ffffff' : '#ff6b5e';
    ctx.fillRect(left - 8, i * 20 + off, 8, 20);
    ctx.fillRect(left + road, i * 20 + off, 8, 20);
  }
  // Lane dashes.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let lane = 1; lane < 3; lane++) {
    const x = left + lane * LANE_W - 2;
    for (let y = -50 + ((s.dist * 10) % 50); y < RH; y += 50) ctx.fillRect(x, y, 4, 26);
  }

  for (const o of s.obstacles) {
    if (o.kind === 'cone') cone(ctx, laneX(o.lane), o.y);
    else car(ctx, laneX(o.lane), o.y, CARS[o.hue % CARS.length], false);
  }

  if (s.safe > 0 && Math.floor(s.safe * 10) % 2 === 0) ctx.globalAlpha = 0.35;
  car(ctx, s.x, CAR_Y, '#2356e8', true);
  ctx.globalAlpha = 1;
};
