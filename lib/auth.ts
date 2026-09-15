import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { parseAuthEnvironment } from '@/lib/config';

const LOCAL_DEVELOPMENT_SECRET = 'withyou-local-development-secret-only-2026';

function authConfiguration() {
  const config = parseAuthEnvironment({
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });

  if (!env.DB) {
    throw new Error('Cloudflare D1 binding `DB` is unavailable for authentication.');
  }

  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && !config.BETTER_AUTH_SECRET) {
    throw new Error('BETTER_AUTH_SECRET must be configured in production.');
  }
  if (isProduction && !config.BETTER_AUTH_URL) {
    throw new Error('BETTER_AUTH_URL must be configured in production.');
  }

  const google =
    config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: config.GOOGLE_CLIENT_ID,
            clientSecret: config.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined;

  return {
    appName: 'WithYou',
    database: env.DB,
    secret: config.BETTER_AUTH_SECRET || LOCAL_DEVELOPMENT_SECRET,
    ...(config.BETTER_AUTH_URL ? { baseURL: config.BETTER_AUTH_URL } : {}),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    ...(google ? { socialProviders: google } : {}),
    advanced: {
      database: {
        generateId: () => crypto.randomUUID(),
      },
    },
  } as const;
}

function createAuth() {
  return betterAuth(authConfiguration());
}

let authInstance: ReturnType<typeof createAuth> | undefined;

export function getAuth(): ReturnType<typeof createAuth> {
  authInstance ??= createAuth();
  return authInstance;
}

export function isGoogleSignInConfigured(): boolean {
  const config = parseAuthEnvironment({
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
  });
  return Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
}
