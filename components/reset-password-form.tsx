'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ResetPasswordForm({ token, invalid }: { token: string; invalid: boolean }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(invalid ? 'This reset link is invalid or has expired.' : '');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') || '');
    const confirmation = String(form.get('confirmation') || '');
    if (password !== confirmation) {
      setError('The passwords do not match.');
      setBusy(false);
      return;
    }

    const result = await authClient.resetPassword({ newPassword: password, token });
    if (result.error) {
      setError(result.error.message || 'The password could not be reset.');
      setBusy(false);
      return;
    }
    router.replace('/sign-in?password_reset=true');
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label htmlFor="new-password">NEW PASSWORD<input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={invalid} /></label>
      <label htmlFor="confirm-password">CONFIRM PASSWORD<input id="confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={invalid} /></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary auth-submit" disabled={busy || invalid || !hydrated}>{busy ? 'Saving…' : 'Save new password'}</button>
      {/* The Vinext development Link shim can load a second React copy after hot reload. */}
      <a className="auth-back" href="/sign-in">Back to sign in</a>
    </form>
  );
}
