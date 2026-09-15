import { describe, expect, it } from 'vitest';
import { parseProviderEnvironment } from '@/lib/config';
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
