import Studio from './studio';
import {requireAuthenticatedUser} from './auth';
import {providerConfiguration} from '@/lib/providers';
export const dynamic='force-dynamic';
export default async function Page(){await requireAuthenticatedUser('/');providerConfiguration();return <Studio/>}
