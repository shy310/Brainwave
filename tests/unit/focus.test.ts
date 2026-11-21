import { describe, expect, it } from 'vitest';
import { focusLogic as f } from '../../src/features/focus/focus';

const MIN = 60_000;

describe('focus timer', () => {
  it('counts down, pauses without losing time, and resumes', () => {
    let s = f.start(25, 0);
    expect(f.left(s, 10 * MIN)).toBe(15 * MIN);
    s = f.pause(s, 10 * MIN);
    expect(f.left(s, 60 * MIN)).toBe(15 * MIN); // paused: time stands still
    s = f.resume(s, 60 * MIN);
    expect(f.left(s, 65 * MIN)).toBe(10 * MIN);
  });

  it('counts each whole focused minute once', () => {
    let s = f.start(25, 0);
    expect(f.newMinutes(s, 2.5 * MIN)).toBe(2);
    s = { ...s, credited: 2 * MIN };
    expect(f.newMinutes(s, 2.9 * MIN)).toBe(0);
    expect(f.newMinutes(s, 3 * MIN)).toBe(1);
    // After the end, at most the session length counts.
    expect(f.newMinutes(f.tick(s, 99 * MIN), 99 * MIN)).toBe(23);
  });

  it('ends the focus phase on time, then runs a 5-minute break', () => {
    let s = f.tick(f.start(25, 0), 25 * MIN - 1);
    expect(s.phase).toBe('focus');
    s = f.tick(s, 25 * MIN);
    expect(s.phase).toBe('focusDone');
    s = f.startBreak(s, 30 * MIN);
    expect(f.left(s, 31 * MIN)).toBe(4 * MIN);
    expect(f.tick(s, 35 * MIN).phase).toBe('breakDone');
  });
});
