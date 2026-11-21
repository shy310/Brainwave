import { describe, expect, it } from 'vitest';
import { BONUS, LIVES, answer, buildGame, crash, newRun, score } from '../../src/features/game/game';
import { EVERY, FLAP, GAP, GATE_W, GROUND, PLANE_X, flap, hits, recoverGlide, startGlide, stepGlide } from '../../src/features/game/glide';
import { CAR_Y, EVERY as RUSH_EVERY, LANES, collides, laneX, recoverRush, rowGap, startRush, steer, stepRush, SPEED } from '../../src/features/game/rush';

/** Repeatable "random" numbers. */
const seeded = (seed = 1) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const card = (front: string, back: string) => ({ front, back });
const lecture = (id: string, cards: { front: string; back: string }[], quiz: unknown[] = []) => ({
  id, title: id, created_at: '', status: 'ready' as const, folder_id: null,
  flashcards: { cards }, quiz: quiz.length ? { questions: quiz } : null,
}) as never;

describe('game questions', () => {
  it('turns flashcards into 4-option questions with distinct wrong answers from other cards', () => {
    const qs = buildGame([lecture('a', [card('1+1', '2'), card('2+2', '4'), card('3+3', '6'), card('4+4', '8'), card('5+5', '10')])], (l) => (l as { id: string }).id, seeded());
    expect(qs).toHaveLength(5);
    for (const q of qs) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
      expect(Number(q.options[q.correct])).toBe(Number(q.prompt[0]) * 2);
      expect(q.card?.lectureId).toBe('a');
    }
  });

  it('needs 4 different answers before using flashcards; uses quiz choice questions as they are', () => {
    const quiz = [{ kind: 'choice', prompt: 'Q?', options: ['x', 'y', 'z'], correctIndex: 2 }, { kind: 'input', prompt: 'Typed?', options: [], correctIndex: -1 }];
    const qs = buildGame([lecture('a', [card('a', '1'), card('b', '2')], quiz)], () => 'A', seeded());
    expect(qs).toEqual([{ prompt: 'Q?', options: ['x', 'y', 'z'], correct: 2, from: 'A' }]);
  });

  it('deals at most `size` questions', () => {
    const many = Array.from({ length: 30 }, (_, i) => card(`q${i}`, `a${i}`));
    expect(buildGame([lecture('a', many)], () => 'A', seeded(), 10)).toHaveLength(10);
  });
});

describe('lives, shield and questions', () => {
  it('a right checkpoint answer gives a shield and bonus points; a wrong one costs a life', () => {
    const r = answer(newRun(), 'checkpoint', true, 0);
    expect(r).toMatchObject({ shield: true, bonus: BONUS, right: 1, asked: 1, lives: LIVES });
    const w = answer(newRun(), 'checkpoint', false, 4);
    expect(w).toMatchObject({ shield: false, lives: LIVES - 1, missed: [4] });
  });

  it('a crash uses up the shield without a question, otherwise asks a rescue question', () => {
    const shielded = { ...newRun(), shield: true };
    expect(crash(shielded)).toEqual({ run: { ...shielded, shield: false }, ask: null });
    expect(crash(newRun()).ask).toBe('rescue');
    const kept = answer(newRun(), 'rescue', true, 0);
    expect(kept.lives).toBe(LIVES);
    expect(kept.shield).toBe(false);
  });

  it('ends after three lives are lost, and lists each missed question once', () => {
    let r = newRun();
    for (const i of [2, 2, 5]) r = answer(r, 'rescue', false, i);
    expect(r.over).toBe(true);
    expect(r.missed).toEqual([2, 5]);
    expect(score({ ...r, points: 30, bonus: 50 })).toBe(80);
  });
});

const run = <S, E>(s: S, step: (s: S, dt: number, rand: () => number) => { s: S; event: E }, seconds: number, each?: (s: S) => S) => {
  const events: E[] = [];
  const rand = seeded(7);
  for (let t = 0; t < seconds; t += 1 / 60) {
    const r = step(each ? each(s) : s, 1 / 60, rand);
    s = r.s;
    if (r.event) events.push(r.event);
  }
  return { s, events };
};

describe('Glide', () => {
  it('hovers until the first tap, then falls and crashes into the desk', () => {
    const idle = run(startGlide(), stepGlide, 2);
    expect(idle.s.y).toBe(startGlide().y);
    expect(idle.events).toEqual([]);
    const fell = run(flap(startGlide()), stepGlide, 3);
    expect(fell.events).toContain('crash');
    expect(fell.s.y).toBeGreaterThan(GROUND - 20);
  });

  it('a flap sends the plane up', () => {
    const s = stepGlide(flap(startGlide()), 0.1, seeded()).s;
    expect(s.y).toBeLessThan(startGlide().y);
    expect(flap(startGlide()).vy).toBe(FLAP);
  });

  it('scores a gate when the plane gets past it, and every few gates is a checkpoint', () => {
    // Fly straight through the middle of each gap (steer the plane to it every frame).
    const { events } = run(flap(startGlide()), stepGlide, 40, (s) => {
      const g = s.gates.find((x) => x.x + GATE_W >= PLANE_X - 20);
      return { ...s, y: g ? g.gapY : s.y, vy: 0 };
    });
    expect(events).not.toContain('crash');
    expect(events.filter((e) => e === 'checkpoint').length).toBeGreaterThan(0);
    const firstCheckpoint = events.indexOf('checkpoint');
    expect(events.slice(0, firstCheckpoint).every((e) => e === 'gate')).toBe(true);
    expect(firstCheckpoint).toBe(EVERY - 1);
  });

  it('touching a stack of books is a hit; the gap is not', () => {
    const g = { x: PLANE_X - 10, gapY: 250, passed: false, hue: 0 };
    expect(hits(250, g)).toBe(false);
    expect(hits(250 - GAP / 2 - 2, g)).toBe(true);
    expect(hits(250 + GAP / 2 + 2, g)).toBe(true);
  });

  it('after a crash the plane is put back in the next gap and is safe for a moment', () => {
    const s = { ...startGlide(), started: true, gates: [{ x: PLANE_X + 30, gapY: 200, passed: false, hue: 0 }], y: GROUND };
    const r = recoverGlide(s);
    expect(r.y).toBe(200);
    expect(r.safe).toBeGreaterThan(1);
    expect(stepGlide({ ...r, y: GROUND }, 1 / 60, seeded()).event).not.toBe('crash');
  });
});

describe('Lane Rush', () => {
  it('steers between the three lanes and stays on the road', () => {
    let s = startRush();
    s = steer(steer(steer(s, -1), -1), -1);
    expect(s.lane).toBe(0);
    s = steer(steer(steer(s, 1), 1), 1);
    expect(s.lane).toBe(LANES - 1);
    const moved = run(s, stepRush, 0.5).s;
    expect(moved.x).toBe(laneX(LANES - 1));
  });

  it('never blocks all three lanes in a row, and leaves room to change lanes', () => {
    const { s } = run({ ...startRush(), safe: 999 }, stepRush, 30);
    const rows = new Map<number, number>();
    for (const o of s.obstacles) rows.set(Math.round(o.y), (rows.get(Math.round(o.y)) ?? 0) + 1);
    expect(s.obstacles.length).toBeGreaterThan(0);
    expect(Math.max(...rows.values())).toBeLessThan(3);
    expect(rowGap(10_000)).toBeGreaterThanOrEqual(200);
  });

  it('speeds up, crashes into traffic in its lane, and asks a checkpoint question every so often', () => {
    const { s, events } = run(startRush(), stepRush, RUSH_EVERY + 1);
    expect(s.speed).toBeGreaterThan(SPEED);
    expect(events).toContain('crash');
    const safe = run({ ...startRush(), safe: 999 }, stepRush, RUSH_EVERY + 1);
    expect(safe.events).toEqual(['checkpoint']);
  });

  it('a car in the same lane collides; one lane over does not', () => {
    const o = { lane: 1, y: CAR_Y, kind: 'car' as const, hue: 0, h: 74 };
    expect(collides({ x: laneX(1) }, o)).toBe(true);
    expect(collides({ x: laneX(0) }, o)).toBe(false);
  });

  it('after a crash the traffic around the car is cleared', () => {
    const s = { ...startRush(), obstacles: [{ lane: 1, y: CAR_Y, kind: 'car' as const, hue: 0, h: 74 }, { lane: 0, y: -40, kind: 'cone' as const, hue: 0, h: 30 }] };
    const r = recoverRush(s);
    expect(r.obstacles).toHaveLength(1);
    expect(r.safe).toBeGreaterThan(1);
  });
});
