import { describe, expect, it } from 'vitest';
import { oauthErrorMessage } from '@/lib/auth-errors';

describe('Google OAuth errors', () => {
  it('explains a user-canceled authorization without implying an account failure', () => {
    expect(oauthErrorMessage('access_denied')).toBe(
      'Google sign-in was canceled. No account changes were made.',
    );
  });

  it('does not expose provider error details to the sign-in page', () => {
    expect(oauthErrorMessage('provider_internal_detail')).toBe(
      'Google could not complete sign-in. Please try again or use email and password.',
    );
  });

  it('returns no message without an OAuth error', () => {
    expect(oauthErrorMessage()).toBe('');
  });
});
