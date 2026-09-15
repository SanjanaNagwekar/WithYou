import Studio from './studio';
import {requireAuthenticatedUser} from './auth';
export const dynamic='force-dynamic';
export default async function Page(){await requireAuthenticatedUser('/');return <Studio/>}
