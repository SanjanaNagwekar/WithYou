import { describe, expect, it } from 'vitest';
import {
  parseAuthEnvironment,
  parseBenchmarkEnvironment,
  parseProviderEnvironment,
  parseTranslationEnvironment,
} from '@/lib/config';
import { AppError } from '@/lib/errors';

describe('parseProviderEnvironment', () => {
  it('supplies the default model and treats an empty key as unconfigured', () => {
    expect(parseProviderEnvironment({ CARTESIA_API_KEY: '' })).toEqual({
      CARTESIA_API_KEY: undefined,
      CARTESIA_MODEL_ID: 'sonic-3.6',
      WITHYOU_VOICE_PROVIDER: 'cartesia',
      WITHYOU_ALLOW_MOCK_PROVIDER: 'false',
      WITHYOU_GENERATION_ENABLED: 'true',
      WITHYOU_DAILY_GENERATION_LIMIT: 30,
      WITHYOU_GLOBAL_DAILY_GENERATION_LIMIT: 300,
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
      WITHYOU_GENERATION_ENABLED: 'true',
      WITHYOU_DAILY_GENERATION_LIMIT: 30,
      WITHYOU_GLOBAL_DAILY_GENERATION_LIMIT: 300,
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

  it('validates public-pilot generation limits and kill switch', () => {
    expect(
      parseProviderEnvironment({
        WITHYOU_GENERATION_ENABLED: 'false',
        WITHYOU_DAILY_GENERATION_LIMIT: '12',
        WITHYOU_GLOBAL_DAILY_GENERATION_LIMIT: '80',
      }),
    ).toMatchObject({
      WITHYOU_GENERATION_ENABLED: 'false',
      WITHYOU_DAILY_GENERATION_LIMIT: 12,
      WITHYOU_GLOBAL_DAILY_GENERATION_LIMIT: 80,
    });
    expect(() => parseProviderEnvironment({ WITHYOU_DAILY_GENERATION_LIMIT: '0' })).toThrow(
      'Voice provider configuration is invalid: WITHYOU_DAILY_GENERATION_LIMIT.',
    );
  });
});

describe('parseTranslationEnvironment', () => {
  it('defaults to Google and treats an empty credential as unconfigured', () => {
    expect(parseTranslationEnvironment({ GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: '' })).toEqual({
      GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: undefined,
      WITHYOU_TRANSLATION_PROVIDER: 'google',
      WITHYOU_ALLOW_MOCK_TRANSLATION: 'false',
    });
  });

  it('requires an explicit safeguard before enabling mock translation', () => {
    expect(() =>
      parseTranslationEnvironment({ WITHYOU_TRANSLATION_PROVIDER: 'mock' }),
    ).toThrow('The mock translation provider must be explicitly enabled.');
    expect(
      parseTranslationEnvironment({
        WITHYOU_TRANSLATION_PROVIDER: 'mock',
        WITHYOU_ALLOW_MOCK_TRANSLATION: 'true',
      }).WITHYOU_TRANSLATION_PROVIDER,
    ).toBe('mock');
  });
});

describe('parseBenchmarkEnvironment', () => {
  it('defaults to Eleven v4 without requiring a benchmark key at app startup', () => {
    expect(parseBenchmarkEnvironment({})).toEqual({ ELEVENLABS_MODEL_ID: 'eleven_v4' });
  });

  it('accepts a scoped ElevenLabs key and explicit model', () => {
    expect(
      parseBenchmarkEnvironment({
        ELEVENLABS_API_KEY: 'benchmark-key',
        ELEVENLABS_MODEL_ID: 'eleven_v4',
      }),
    ).toEqual({
      ELEVENLABS_API_KEY: 'benchmark-key',
      ELEVENLABS_MODEL_ID: 'eleven_v4',
    });
  });

  it('rejects malformed benchmark model identifiers', () => {
    expect(() => parseBenchmarkEnvironment({ ELEVENLABS_MODEL_ID: '../model' })).toThrow(
      'Benchmark provider configuration is invalid: ELEVENLABS_MODEL_ID.',
    );
  });
});

describe('parseAuthEnvironment', () => {
  it('accepts email and password authentication without Google credentials', () => {
    expect(parseAuthEnvironment({ BETTER_AUTH_URL: 'http://localhost:5173' })).toEqual({
      BETTER_AUTH_URL: 'http://localhost:5173',
      WITHYOU_ALLOW_UNVERIFIED_EMAIL_SIGNUP: 'false',
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
      WITHYOU_ALLOW_UNVERIFIED_EMAIL_SIGNUP: 'false',
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
      WITHYOU_ALLOW_UNVERIFIED_EMAIL_SIGNUP: 'false',
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
