import { env } from 'cloudflare:workers';
import { betterAuth } from 'better-auth';
import { parseAuthEnvironment } from '@/lib/config';
import { deleteOwnedUserData } from '@/lib/account';
import { emailDeliveryConfigured, sendAuthEmail } from '@/lib/email';

const LOCAL_DEVELOPMENT_SECRET = 'withyou-local-development-secret-only-2026';

function authConfiguration() {
  const config = parseAuthEnvironment({
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: env.BETTER_AUTH_URL,
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    RESEND_API_KEY: env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
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
  const emailEnabled = emailDeliveryConfigured(config);

  return {
    appName: 'WithYou',
    database: env.DB,
    secret: config.BETTER_AUTH_SECRET || LOCAL_DEVELOPMENT_SECRET,
    ...(config.BETTER_AUTH_URL ? { baseURL: config.BETTER_AUTH_URL } : {}),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification: emailEnabled,
      revokeSessionsOnPasswordReset: true,
      ...(emailEnabled
        ? {
            sendResetPassword: ({ user, url }: { user: { email: string }; url: string }) =>
              sendAuthEmail(config, {
                to: user.email,
                subject: 'Reset your WithYou password',
                heading: 'Reset your password',
                copy: 'Use this secure link to choose a new password. The link expires in one hour.',
                action: 'Reset password',
                url,
              }),
          }
        : {}),
    },
    ...(emailEnabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: true,
            autoSignInAfterVerification: true,
            expiresIn: 3600,
            sendVerificationEmail: ({ user, url }: { user: { email: string }; url: string }) =>
              sendAuthEmail(config, {
                to: user.email,
                subject: 'Verify your WithYou email',
                heading: 'Verify your email',
                copy: 'Confirm your email address to finish securing your private WithYou library.',
                action: 'Verify email',
                url,
              }),
          },
        }
      : {}),
    ...(google ? { socialProviders: google } : {}),
    account: {
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'] as string[],
        allowDifferentEmails: false,
        allowUnlinkingAll: false,
      },
    },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: (user: { id: string }) => deleteOwnedUserData(user.id),
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 15,
    },
    verification: {
      storeIdentifier: 'hashed',
    },
    rateLimit: {
      enabled: true,
      storage: 'database',
      modelName: 'authRateLimit',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    trustedOrigins: isProduction
      ? [new URL(config.BETTER_AUTH_URL!).origin]
      : [
          'http://localhost:*',
          'http://127.0.0.1:*',
          ...(config.BETTER_AUTH_URL ? [new URL(config.BETTER_AUTH_URL).origin] : []),
        ],
    advanced: {
      useSecureCookies: isProduction,
      ipAddress: {
        ipAddressHeaders: ['cf-connecting-ip'] as string[],
      },
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
      },
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

export function isAuthEmailConfigured(): boolean {
  const config = parseAuthEnvironment({
    RESEND_API_KEY: env.RESEND_API_KEY,
    AUTH_EMAIL_FROM: env.AUTH_EMAIL_FROM,
  });
  return emailDeliveryConfigured(config);
}
