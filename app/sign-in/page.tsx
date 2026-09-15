import { redirect } from 'next/navigation';
import { getAuthenticatedUser, safeReturnPath } from '@/app/auth';
import { AuthForm } from '@/components/auth-form';
import { isGoogleSignInConfigured } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const parameters = await searchParams;
  const returnTo = safeReturnPath(parameters.return_to || '/');
  if (await getAuthenticatedUser()) redirect(returnTo);

  return <AuthForm googleEnabled={isGoogleSignInConfigured()} returnTo={returnTo} />;
}
