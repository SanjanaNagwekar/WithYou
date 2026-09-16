import Studio from '../studio';
import { requireAuthenticatedUser } from '../auth';
import { providerConfiguration } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const user = await requireAuthenticatedUser('/studio');
  providerConfiguration();
  return <Studio user={{ displayName: user.displayName, email: user.email }} />;
}
