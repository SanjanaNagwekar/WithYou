import { redirect } from 'next/navigation';
import { getAuthenticatedUser, safeReturnPath } from '@/app/auth';
import { AuthForm } from '@/components/auth-form';
import { isAuthEmailConfigured, isGoogleSignInConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{
    return_to?: string;
    password_reset?: string;
    account_deleted?: string;
  }>;
}) {
  const parameters = await searchParams;
  const returnTo = safeReturnPath(parameters.return_to || '/');
  if (await getAuthenticatedUser()) redirect(returnTo);
  const initialNotice = parameters.password_reset
    ? 'Your password has been reset. Sign in with your new password.'
    : parameters.account_deleted
      ? 'Your account and private library were deleted.'
      : '';

  return (
    <AuthForm
      emailDeliveryEnabled={isAuthEmailConfigured()}
      googleEnabled={isGoogleSignInConfigured()}
      initialNotice={initialNotice}
      returnTo={returnTo}
    />
  );
}
