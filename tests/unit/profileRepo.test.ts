import { describe, expect, it } from 'vitest';
import { withoutMissingColumn } from '../../src/features/auth/profileRepo';

describe('saving a profile before a migration is run', () => {
  const patch = { display_name: 'Noa', onboarded: true, study_goal: 'exams', lecture_language: 'he', summary_mode: 'exam' } as const;

  it('drops a newer setting the database does not have yet', () => {
    const error = { code: 'PGRST204', message: "Could not find the 'study_goal' column of 'profiles' in the schema cache" };
    expect(withoutMissingColumn(patch, error)).toEqual({ display_name: 'Noa', onboarded: true, lecture_language: 'he', summary_mode: 'exam' });
    const pg = { code: '42703', message: 'column "lecture_language" of relation "profiles" does not exist' };
    expect(withoutMissingColumn(patch, pg)).not.toHaveProperty('lecture_language');
  });

  it('never drops required fields or hides other errors', () => {
    expect(withoutMissingColumn(patch, { code: 'PGRST204', message: "Could not find the 'display_name' column" })).toBeNull();
    expect(withoutMissingColumn(patch, { code: '42501', message: "permission denied for 'study_goal'" })).toBeNull();
    expect(withoutMissingColumn({ display_name: 'Noa' }, { code: 'PGRST204', message: "Could not find the 'study_goal' column" })).toBeNull();
    expect(withoutMissingColumn(patch, null)).toBeNull();
  });
});
