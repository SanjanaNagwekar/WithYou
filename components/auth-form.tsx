'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { AudioLines, LockKeyhole } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

type AuthMode = 'sign-in' | 'sign-up' | 'forgot-password';
const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AuthForm({
  googleEnabled,
  emailDeliveryEnabled,
  initialNotice,
  returnTo,
}: {
  googleEnabled: boolean;
  emailDeliveryEnabled: boolean;
  initialNotice: string;
  returnTo: string;
}) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState(initialNotice);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setStatus('');
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');

    try {
      if (mode === 'forgot-password') {
        const result = await authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        });
        if (result.error) throw new Error(result.error.message || 'The reset email could not be sent.');
        setStatus('If that address has a password account, a reset link is on its way.');
        setBusy(false);
        return;
      }

      const result =
        mode === 'sign-up'
          ? await authClient.signUp.email({
              name: String(form.get('name') || '').trim(),
              email,
              password,
            })
          : await authClient.signIn.email({ email, password });

      if (result.error) throw new Error(result.error.message || 'We could not sign you in.');
      if (mode === 'sign-up' && emailDeliveryEnabled && !result.data?.token) {
        setStatus('Check your email to verify your address, then return here to sign in.');
        setBusy(false);
        return;
      }
      router.replace(returnTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We could not sign you in.');
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!googleEnabled) return;
    setBusy(true);
    setError('');
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL: returnTo });
      if (result.error) throw new Error(result.error.message || 'Google sign-in could not be started.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Google sign-in could not be started.');
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        {/* The Vinext development Link shim can load a second React copy after hot reload. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/"><AudioLines /> WithYou<span>VOICE KEEPSAKES</span></a>
        <div>
          <span className="eyebrow">A PRIVATE PLACE FOR FAMILIAR VOICES</span>
          <h1>Keep what matters.<br /><em>Come back anytime.</em></h1>
          <p>Your recordings and keepsakes are kept inside your own private library.</p>
        </div>
        <p className="auth-trust"><LockKeyhole size={15} /> Secure, account-based access</p>
      </section>

      <section className="auth-panel" aria-labelledby="auth-heading">
        <div className="auth-card">
          <span className="auth-icon"><AudioLines /></span>
          <h2 id="auth-heading">
            {mode === 'sign-in'
              ? 'Welcome back'
              : mode === 'sign-up'
                ? 'Create your private space'
                : 'Reset your password'}
          </h2>
          <p>
            {mode === 'sign-in'
              ? 'Sign in to open your voice library.'
              : mode === 'sign-up'
                ? 'Start preserving voices and moments that matter.'
                : 'We’ll send a secure reset link to your email.'}
          </p>

          {mode !== 'forgot-password' && (
            <>
              <button className="google-button" type="button" disabled={busy || !hydrated || !googleEnabled} onClick={() => void signInWithGoogle()}>
                <span aria-hidden="true">G</span> Continue with Google
              </button>
              {!googleEnabled && <p className="provider-note">Google sign-in will be available after OAuth credentials are added.</p>}

              <div className="auth-divider"><span>or continue with email</span></div>
            </>
          )}

          <form className="auth-form" onSubmit={submit}>
            {mode === 'sign-up' && (
              <label htmlFor="name">YOUR NAME<input id="name" name="name" autoComplete="name" required maxLength={80} /></label>
            )}
            <label htmlFor="email">EMAIL<input id="email" name="email" type="email" autoComplete="email" required /></label>
            {mode !== 'forgot-password' && (
              <label htmlFor="password">PASSWORD<input id="password" name="password" type="password" autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'} minLength={8} maxLength={128} required /></label>
            )}
            {mode === 'sign-up' && <p className="password-note">Use at least 8 characters.</p>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            {status && <p className="auth-status" role="status">{status}</p>}
            <button className="primary auth-submit" disabled={busy || !hydrated}>
              {busy
                ? 'Please wait…'
                : mode === 'sign-in'
                  ? 'Sign in'
                  : mode === 'sign-up'
                    ? 'Create account'
                    : 'Send reset link'}
            </button>
          </form>

          {mode === 'sign-in' && emailDeliveryEnabled && (
            <button className="auth-forgot" type="button" disabled={!hydrated} onClick={() => switchMode('forgot-password')}>
              Forgot your password?
            </button>
          )}

          <p className="auth-switch">
            {mode === 'sign-in' ? 'New to WithYou?' : 'Ready to return?'}{' '}
            <button type="button" disabled={!hydrated} onClick={() => switchMode(mode === 'sign-in' ? 'sign-up' : 'sign-in')}>
              {mode === 'sign-in' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </section>
    </main>
  );
}
