import { describe, expect, it } from 'vitest';
import { isOn, nextReminder, nextStart, reminderClock, upNext, type ClassSlot } from '../../shared/schedule';

// Friday 20 Nov 2026, 09:50 local time.
const NOW = new Date(2026, 10, 20, 9, 50);
const slot = (o: Partial<ClassSlot>): ClassSlot => ({ id: 'c', name: 'Calculus', weekday: 5, starts: '10:00', ends: '11:30', folderId: null, remindMinutes: 10, ...o });

describe('class schedule', () => {
  it('finds the next start, later today or next week', () => {
    expect(nextStart(slot({}), NOW)).toEqual(new Date(2026, 10, 20, 10, 0));
    expect(nextStart(slot({ starts: '08:00' }), NOW)).toEqual(new Date(2026, 10, 27, 8, 0));
    expect(nextStart(slot({ weekday: 1 }), NOW)).toEqual(new Date(2026, 10, 23, 10, 0)); // Monday
  });

  it('knows when a class is on', () => {
    expect(isOn(slot({ starts: '09:30' }), NOW)).toBe(true);
    expect(isOn(slot({}), NOW)).toBe(false);
    expect(isOn(slot({ weekday: 4, starts: '09:30' }), NOW)).toBe(false);
  });

  it('shows what is on now, else what starts soonest within the window', () => {
    const slots = [slot({ id: 'a', starts: '10:15' }), slot({ id: 'b', starts: '10:00' }), slot({ id: 'c', starts: '13:00' })];
    expect(upNext(slots, NOW)).toMatchObject({ slot: { id: 'b' }, on: false });
    expect(upNext([slot({ id: 'now', starts: '09:00' }), ...slots], NOW)).toMatchObject({ slot: { id: 'now' }, on: true });
    expect(upNext([slot({ starts: '13:00' })], NOW)).toBeNull();
  });

  it('schedules the reminder before the class, moving to next week once it has passed', () => {
    expect(nextReminder(slot({}), NOW)).toEqual(new Date(2026, 10, 27, 9, 50)); // due exactly now → next week's
    expect(nextReminder(slot({}), new Date(2026, 10, 20, 9, 40))).toEqual(new Date(2026, 10, 20, 9, 50));
    expect(nextReminder(slot({ remindMinutes: 0 }), NOW)).toBeNull();
  });

  it('reminders before midnight classes fall on the previous day', () => {
    expect(reminderClock(slot({ weekday: 1, starts: '00:10', remindMinutes: 15 }))).toEqual({ weekday: 0, hour: 23, minute: 55 });
    expect(reminderClock(slot({ weekday: 0, starts: '00:05', remindMinutes: 10 }))).toEqual({ weekday: 6, hour: 23, minute: 55 });
  });
});

describe('invite links', async () => {
  const { inviteCodeFrom } = await import('../../src/features/groups/GroupsPage');
  it('reads the code from a link or a bare code', () => {
    expect(inviteCodeFrom('https://brainwave.app/join/0123456789abcdef01234567')).toBe('0123456789abcdef01234567');
    expect(inviteCodeFrom('  0123456789abcdef01234567 ')).toBe('0123456789abcdef01234567');
    expect(inviteCodeFrom('https://brainwave.app/join/short')).toBe('');
    expect(inviteCodeFrom('../../etc')).toBe('');
  });
});
