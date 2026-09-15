import { describe, expect, it } from 'vitest';
import { parseAuthEnvironment, parseProviderEnvironment } from '@/lib/config';
import { AppError } from '@/lib/errors';

describe('parseProviderEnvironment', () => {
  it('supplies the default model and treats an empty key as unconfigured', () => {
    expect(parseProviderEnvironment({ CARTESIA_API_KEY: '' })).toEqual({
      CARTESIA_API_KEY: undefined,
      CARTESIA_MODEL_ID: 'sonic-3.6',
      WITHYOU_VOICE_PROVIDER: 'cartesia',
      WITHYOU_ALLOW_MOCK_PROVIDER: 'false',
    });
  });

  it('accepts a configured provider', () => {
    expect(
      parseProviderEnvironment({
        CARTESIA_API_KEY: 'test-key',
        CARTESIA_MODEL_ID: 'sonic-custom_1.0',
      }),
    ).toEqual({
      CARTESIA_API_KEY: 'test-key',
      CARTESIA_MODEL_ID: 'sonic-custom_1.0',
      WITHYOU_VOICE_PROVIDER: 'cartesia',
      WITHYOU_ALLOW_MOCK_PROVIDER: 'false',
    });
  });

  it('requires an explicit safeguard before enabling the mock provider', () => {
    expect(() => parseProviderEnvironment({ WITHYOU_VOICE_PROVIDER: 'mock' })).toThrow(
      'The mock voice provider must be explicitly enabled.',
    );
    expect(
      parseProviderEnvironment({
        WITHYOU_VOICE_PROVIDER: 'mock',
        WITHYOU_ALLOW_MOCK_PROVIDER: 'true',
      }).WITHYOU_VOICE_PROVIDER,
    ).toBe('mock');
  });

  it('rejects unsafe model identifiers without exposing configuration values', () => {
    expect(() =>
      parseProviderEnvironment({
        CARTESIA_API_KEY: 'private-value',
        CARTESIA_MODEL_ID: '../../invalid model',
      }),
    ).toThrowError(new AppError('Voice provider configuration is invalid: CARTESIA_MODEL_ID.', 503));

    try {
      parseProviderEnvironment({
        CARTESIA_API_KEY: 'private-value',
        CARTESIA_MODEL_ID: '../../invalid model',
      });
    } catch (error) {
      expect(String(error)).not.toContain('private-value');
    }
  });
});

describe('parseAuthEnvironment', () => {
  it('accepts email and password authentication without Google credentials', () => {
    expect(parseAuthEnvironment({ BETTER_AUTH_URL: 'http://localhost:5173' })).toEqual({
      BETTER_AUTH_URL: 'http://localhost:5173',
    });
  });

  it('accepts complete Google credentials without exposing their values', () => {
    expect(
      parseAuthEnvironment({
        GOOGLE_CLIENT_ID: 'google-client-id',
        GOOGLE_CLIENT_SECRET: 'google-client-secret',
      }),
    ).toEqual({
      GOOGLE_CLIENT_ID: 'google-client-id',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
    });
  });

  it('rejects partial Google credentials', () => {
    expect(() => parseAuthEnvironment({ GOOGLE_CLIENT_ID: 'google-client-id' })).toThrow(
      'Authentication configuration is invalid: GOOGLE_CLIENT_ID.',
    );
  });

  it('accepts complete email delivery credentials and rejects partial configuration', () => {
    expect(
      parseAuthEnvironment({
        RESEND_API_KEY: 'resend-test-key',
        AUTH_EMAIL_FROM: 'accounts@withyou.example',
      }),
    ).toEqual({
      RESEND_API_KEY: 'resend-test-key',
      AUTH_EMAIL_FROM: 'accounts@withyou.example',
    });
    expect(() => parseAuthEnvironment({ RESEND_API_KEY: 'resend-test-key' })).toThrow(
      'Authentication configuration is invalid: RESEND_API_KEY.',
    );
  });

  it('rejects short secrets and unsafe URL schemes', () => {
    expect(() => parseAuthEnvironment({ BETTER_AUTH_SECRET: 'short' })).toThrow(
      'Authentication configuration is invalid: BETTER_AUTH_SECRET.',
    );
    expect(() => parseAuthEnvironment({ BETTER_AUTH_URL: 'ftp://example.com' })).toThrow(
      'Authentication configuration is invalid: BETTER_AUTH_URL.',
    );
  });
});
