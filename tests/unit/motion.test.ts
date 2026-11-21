import { describe, expect, it } from 'vitest';
import { project, rubberband, velocityTracker } from '../../src/ui/motion';

describe('fluid motion helpers', () => {
  it('projects how far a flick carries, further for faster flicks', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(2000)).toBeGreaterThan(project(1000));
    expect(project(-1000)).toBeLessThan(0);
    expect(project(1000, 0.99)).toBeLessThan(project(1000));
  });

  it('rubber-bands: follows less the further you pull, and never passes the limit', () => {
    const a = rubberband(50, 400), b = rubberband(200, 400), c = rubberband(10_000, 400);
    expect(a).toBeLessThan(50);
    expect(b - a).toBeLessThan(150);
    expect(c).toBeLessThan(400);
    expect(rubberband(-50, 400)).toBeCloseTo(-a);
  });

  it('measures release velocity from the last 100ms only', () => {
    const v = velocityTracker();
    v.add(0, 0);
    v.add(500, 900); // old, slow movement
    v.add(520, 960);
    v.add(600, 1000);
    expect(v.velocity()).toBeCloseTo(((600 - 500) / 100) * 1000, 0);
    v.reset();
    expect(v.velocity()).toBe(0);
  });
});
