import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { getAuth } from '@/lib/auth';

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const LEGACY_LOCAL_OWNER = 'local_withyou';
let localDataClaimed = false;

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) return null;

  await claimLegacyLocalData(session.user.id);
  const fullName = session.user.name?.trim() || null;
  return {
    userId: session.user.id,
    email: session.user.email,
    fullName,
    displayName: fullName || session.user.email,
  };
}

export async function requireAuthenticatedUser(
  returnTo: string,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;

  redirect(`/sign-in?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

export function safeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://withyou.local');
    if (url.origin !== 'https://withyou.local' || url.pathname === '/sign-in') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

async function claimLegacyLocalData(userId: string) {
  if (localDataClaimed || process.env.NODE_ENV === 'production' || !env.DB) return;
  await env.DB.batch([
    env.DB.prepare('UPDATE voices SET owner = ? WHERE owner = ?').bind(userId, LEGACY_LOCAL_OWNER),
    env.DB.prepare('UPDATE recordings SET owner = ? WHERE owner = ?').bind(userId, LEGACY_LOCAL_OWNER),
    env.DB.prepare('UPDATE generation_events SET owner = ? WHERE owner = ?').bind(
      userId,
      LEGACY_LOCAL_OWNER,
    ),
  ]);
  localDataClaimed = true;
}
