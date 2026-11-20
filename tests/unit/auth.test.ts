import { describe, expect, it } from 'vitest';
import { alreadyRegistered } from '../../src/features/auth/AuthProvider';

describe('signing up with an email that already has an account', () => {
  it('is recognised from the empty identities Supabase returns', () => {
    expect(alreadyRegistered({ identities: [] })).toBe(true);
  });
  it('a real new account is not', () => {
    expect(alreadyRegistered({ identities: [{ provider: 'email' }] })).toBe(false);
    expect(alreadyRegistered({ identities: null })).toBe(false);
    expect(alreadyRegistered(null)).toBe(false);
  });
});
