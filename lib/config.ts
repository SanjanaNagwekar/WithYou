import { z } from 'zod';
import { AppError } from '@/lib/errors';

const optionalSecret = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().min(1).optional(),
);

const providerEnvironmentSchema = z.object({
  CARTESIA_API_KEY: optionalSecret,
  CARTESIA_MODEL_ID: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/)
    .default('sonic-3.6'),
  WITHYOU_VOICE_PROVIDER: z.enum(['cartesia', 'mock']).default('cartesia'),
  WITHYOU_ALLOW_MOCK_PROVIDER: z.enum(['true', 'false']).default('false'),
});

const optionalUrl = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.string().trim().url().refine((value) => value.startsWith('http://') || value.startsWith('https://')).optional(),
);

const authEnvironmentSchema = z
  .object({
    BETTER_AUTH_SECRET: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().min(32).optional(),
    ),
    BETTER_AUTH_URL: optionalUrl,
    GOOGLE_CLIENT_ID: optionalSecret,
    GOOGLE_CLIENT_SECRET: optionalSecret,
    RESEND_API_KEY: optionalSecret,
    AUTH_EMAIL_FROM: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().email().optional(),
    ),
  })
  .superRefine((value, context) => {
    if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'Google OAuth credentials must be configured together.',
      });
    }
    if (Boolean(value.RESEND_API_KEY) !== Boolean(value.AUTH_EMAIL_FROM)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'Email delivery credentials must be configured together.',
      });
    }
  });

export type ProviderEnvironment = z.infer<typeof providerEnvironmentSchema>;
export type AuthEnvironment = z.infer<typeof authEnvironmentSchema>;

export function parseProviderEnvironment(input: Record<string, unknown>): ProviderEnvironment {
  const result = providerEnvironmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))]
      .filter(Boolean)
      .join(', ');
    throw new AppError(
      `Voice provider configuration is invalid${fields ? `: ${fields}` : ''}.`,
      503,
    );
  }
  if (
    result.data.WITHYOU_VOICE_PROVIDER === 'mock' &&
    result.data.WITHYOU_ALLOW_MOCK_PROVIDER !== 'true'
  ) {
    throw new AppError('The mock voice provider must be explicitly enabled.', 503);
  }
  return result.data;
}

export function parseAuthEnvironment(input: Record<string, unknown>): AuthEnvironment {
  const result = authEnvironmentSchema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))]
      .filter(Boolean)
      .join(', ');
    throw new AppError(`Authentication configuration is invalid${fields ? `: ${fields}` : ''}.`, 503);
  }
  return result.data;
}
