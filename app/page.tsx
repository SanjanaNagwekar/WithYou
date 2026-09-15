import Studio from './studio';
import {requireAuthenticatedUser} from './auth';
import {providerConfiguration} from '@/lib/providers';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireAuthenticatedUser('/');providerConfiguration();return <Studio user={{displayName:user.displayName,email:user.email}}/>}
