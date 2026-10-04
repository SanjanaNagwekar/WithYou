export function oauthErrorMessage(error?: string): string {
  if (!error) return '';

  if (error === 'access_denied') {
    return 'Google sign-in was canceled. No account changes were made.';
  }

  return 'Google could not complete sign-in. Please try again or use email and password.';
}
