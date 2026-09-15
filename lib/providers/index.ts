import { env } from 'cloudflare:workers';
import { parseProviderEnvironment } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { CartesiaVoiceProvider } from '@/lib/providers/cartesia';
import { MockVoiceProvider } from '@/lib/providers/mock';
import type { VoiceProvider } from '@/lib/providers/voice-provider';

export function providerConfiguration() {
  return parseProviderEnvironment({
    CARTESIA_API_KEY: env.CARTESIA_API_KEY,
    CARTESIA_MODEL_ID: env.CARTESIA_MODEL_ID,
    WITHYOU_VOICE_PROVIDER: env.WITHYOU_VOICE_PROVIDER,
    WITHYOU_ALLOW_MOCK_PROVIDER: env.WITHYOU_ALLOW_MOCK_PROVIDER,
  });
}

export function isVoiceProviderConfigured(): boolean {
  const config = providerConfiguration();
  return config.WITHYOU_VOICE_PROVIDER === 'mock' || Boolean(config.CARTESIA_API_KEY);
}

export function voiceProviderMode(): 'cartesia' | 'mock' {
  return providerConfiguration().WITHYOU_VOICE_PROVIDER;
}

export function getVoiceProvider(): VoiceProvider {
  const config = providerConfiguration();
  if (config.WITHYOU_VOICE_PROVIDER === 'mock') return new MockVoiceProvider();
  if (!config.CARTESIA_API_KEY) {
    throw new AppError(
      'Voice generation is not available yet. Your original recording is safely saved.',
      503,
    );
  }
  return new CartesiaVoiceProvider({ ...config, CARTESIA_API_KEY: config.CARTESIA_API_KEY });
}
