import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export type AuthenticatedUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = 'x-withyou-user-id';
const USER_EMAIL_HEADER = 'x-withyou-user-email';
const USER_FULL_NAME_HEADER = 'x-withyou-user-full-name';

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const requestHeaders = await headers();
  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!userId || !email) return null;

  const fullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  return {
    userId,
    email,
    fullName,
    displayName: fullName || email,
  };
}

export async function requireAuthenticatedUser(
  returnTo: string,
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (user) return user;

  redirect(`/sign-in?return_to=${encodeURIComponent(safeReturnPath(returnTo))}`);
}

function safeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://withyou.local');
    if (url.origin !== 'https://withyou.local' || url.pathname === '/sign-in') return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
