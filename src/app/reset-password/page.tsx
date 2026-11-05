import { AudioLines, LockKeyhole } from 'lucide-react';
import { ResetPasswordForm } from '@/components/reset-password-form';

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const parameters = await searchParams;
  const token = parameters.token || '';
  const invalid = Boolean(parameters.error || !token);

  return (
    <main className="auth-page">
      <section className="auth-story">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a className="brand" href="/" aria-label="WithYou home"><AudioLines /> WithYou</a>
        <div><span className="eyebrow">PRIVATE ACCOUNT RECOVERY</span><h1>Return to the voices<br /><em>that matter.</em></h1><p>Choose a new password for your private library.</p></div>
        <p className="auth-trust"><LockKeyhole size={15} /> Secure, one-time recovery link</p>
      </section>
      <section className="auth-panel" aria-labelledby="reset-heading">
        <div className="auth-card">
          <span className="auth-icon"><LockKeyhole /></span>
          <h2 id="reset-heading">Choose a new password</h2>
          <p>Use at least 8 characters. Your other sessions will be signed out.</p>
          <ResetPasswordForm token={token} invalid={invalid} />
        </div>
      </section>
    </main>
  );
}
