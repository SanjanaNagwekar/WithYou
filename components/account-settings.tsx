'use client';

import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, KeyRound, Link2, LockKeyhole, LogOut, Trash2, UserRound } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

type AccountUser = {
  displayName: string;
  email: string;
  emailVerified: boolean;
  providers: string[];
};

type BusyAction = 'profile' | 'password' | 'sessions' | 'delete' | null;
const subscribeToHydration = () => () => undefined;
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AccountSettings({ user }: { user: AccountUser }) {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const hasPassword = user.providers.includes('credential');
  const hasGoogle = user.providers.includes('google');

  function begin(action: BusyAction) {
    setBusy(action);
    setNotice('');
    setError('');
  }

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    begin('profile');
    try {
      const form = new FormData(event.currentTarget);
      const name = String(form.get('name') || '').trim();
      if (!name || name.length > 80) throw new Error('Enter a name between 1 and 80 characters.');
      const result = await authClient.updateUser({ name });
      if (result.error) throw new Error(result.error.message || 'Your profile could not be updated.');
      setNotice('Profile updated.');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, 'Your profile could not be updated.'));
    } finally {
      setBusy(null);
    }
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    begin('password');
    try {
      const form = new FormData(formElement);
      const currentPassword = String(form.get('currentPassword') || '');
      const newPassword = String(form.get('newPassword') || '');
      const confirmationValue = String(form.get('confirmation') || '');
      if (newPassword !== confirmationValue) throw new Error('The new passwords do not match.');
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) throw new Error(result.error.message || 'Your password could not be changed.');
      formElement.reset();
      setNotice('Password changed and other sessions signed out.');
    } catch (caught) {
      setError(errorMessage(caught, 'Your password could not be changed.'));
    } finally {
      setBusy(null);
    }
  }

  async function revokeOtherSessions() {
    begin('sessions');
    try {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error(result.error.message || 'Other sessions could not be signed out.');
      setNotice('Other devices have been signed out.');
    } catch (caught) {
      setError(errorMessage(caught, 'Other sessions could not be signed out.'));
    } finally {
      setBusy(null);
    }
  }

  async function deleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== 'DELETE') return;
    begin('delete');
    try {
      const form = new FormData(event.currentTarget);
      const password = String(form.get('deletePassword') || '');
      const result = await authClient.deleteUser(hasPassword ? { password } : {});
      if (result.error) throw new Error(result.error.message || 'Your account could not be deleted.');
      router.replace('/sign-in?account_deleted=true');
      router.refresh();
    } catch (caught) {
      setError(errorMessage(caught, 'Your account could not be deleted.'));
      setBusy(null);
    }
  }

  return (
    <main className="account-page">
      <header className="account-header">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/" aria-label="WithYou home"><LockKeyhole /> WithYou</a>
        <a className="account-back" href="/studio"><ArrowLeft size={15} /> Back to library</a>
      </header>

      <div className="account-layout">
        <section className="account-intro">
          <span className="account-avatar">{user.displayName.slice(0, 1).toUpperCase()}</span>
          <span className="eyebrow">YOUR PRIVATE ACCOUNT</span>
          <h1>{user.displayName}</h1>
          <p>{user.email}</p>
          <span className={`verification-badge ${user.emailVerified ? 'verified' : ''}`}>
            {user.emailVerified ? <Check size={13} /> : <LockKeyhole size={13} />}
            {user.emailVerified ? 'Verified email' : 'Email verification pending'}
          </span>
        </section>

        <div className="account-sections">
          {(notice || error) && <p className={error ? 'account-message error' : 'account-message'} role={error ? 'alert' : 'status'}>{error || notice}</p>}

          <section className="account-card">
            <div className="account-card-heading"><UserRound /><div><h2>Profile</h2><p>The name shown inside your private library.</p></div></div>
            <form onSubmit={updateProfile}>
              <label htmlFor="profile-name">DISPLAY NAME<input id="profile-name" name="name" defaultValue={user.displayName} required maxLength={80} autoComplete="name" /></label>
              <button className="primary" disabled={!hydrated || busy !== null}>{busy === 'profile' ? 'Saving…' : 'Save profile'}</button>
            </form>
          </section>

          <section className="account-card">
            <div className="account-card-heading"><Link2 /><div><h2>Sign-in methods</h2><p>Your linked methods use the same private library.</p></div></div>
            <div className="provider-list">
              {hasGoogle && <div><span className="provider-mark">G</span><span><strong>Google</strong><small>Connected</small></span><Check size={15} /></div>}
              {hasPassword && <div><KeyRound /><span><strong>Email and password</strong><small>{user.email}</small></span><Check size={15} /></div>}
            </div>
          </section>

          {hasPassword && (
            <section className="account-card">
              <div className="account-card-heading"><KeyRound /><div><h2>Change password</h2><p>Changing it will sign out every other device.</p></div></div>
              <form className="account-password-form" onSubmit={changePassword}>
                <label htmlFor="current-password">CURRENT PASSWORD<input id="current-password" name="currentPassword" type="password" autoComplete="current-password" minLength={8} maxLength={128} required /></label>
                <label htmlFor="account-new-password">NEW PASSWORD<input id="account-new-password" name="newPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
                <label htmlFor="account-confirm-password">CONFIRM NEW PASSWORD<input id="account-confirm-password" name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
                <button className="primary" disabled={!hydrated || busy !== null}>{busy === 'password' ? 'Updating…' : 'Change password'}</button>
              </form>
            </section>
          )}

          <section className="account-card">
            <div className="account-card-heading"><LogOut /><div><h2>Active sessions</h2><p>Keep this device signed in and remove access from every other session.</p></div></div>
            <button className="secondary account-action" type="button" disabled={!hydrated || busy !== null} onClick={() => void revokeOtherSessions()}>{busy === 'sessions' ? 'Signing out…' : 'Sign out other devices'}</button>
          </section>

          <section className="account-card danger-zone">
            <div className="account-card-heading"><Trash2 /><div><h2>Delete account</h2><p>Permanently removes your profile, recordings, generated keepsakes, and stored audio.</p></div></div>
            <form onSubmit={deleteAccount}>
              {hasPassword && <label htmlFor="delete-password">CURRENT PASSWORD<input id="delete-password" name="deletePassword" type="password" autoComplete="current-password" required /></label>}
              <label htmlFor="delete-confirmation">TYPE DELETE TO CONFIRM<input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required /></label>
              <button className="danger-button" disabled={!hydrated || busy !== null || confirmation !== 'DELETE'}>{busy === 'delete' ? 'Deleting…' : 'Delete my account and data'}</button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
