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

export type ProviderEnvironment = z.infer<typeof providerEnvironmentSchema>;

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
