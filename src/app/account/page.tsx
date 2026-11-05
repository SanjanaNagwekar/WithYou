import { redirect } from 'next/navigation';
import { getAccountProfile } from '@/app/auth';
import { AccountSettings } from '@/components/account-settings';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getAccountProfile();
  if (!user) redirect('/sign-in?return_to=%2Faccount');

  return (
    <AccountSettings
      user={{
        displayName: user.displayName,
        email: user.email,
        emailVerified: user.emailVerified,
        providers: user.providers,
      }}
    />
  );
}
