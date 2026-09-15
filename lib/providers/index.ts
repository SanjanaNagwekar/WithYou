import { env } from 'cloudflare:workers';
import { parseProviderEnvironment } from '@/lib/config';
import { AppError } from '@/lib/errors';
import { CartesiaVoiceProvider } from '@/lib/providers/cartesia';
import type { VoiceProvider } from '@/lib/providers/voice-provider';

export function providerConfiguration() {
  return parseProviderEnvironment({
    CARTESIA_API_KEY: env.CARTESIA_API_KEY,
    CARTESIA_MODEL_ID: env.CARTESIA_MODEL_ID,
  });
}

export function isVoiceProviderConfigured(): boolean {
  return Boolean(providerConfiguration().CARTESIA_API_KEY);
}

export function getVoiceProvider(): VoiceProvider {
  const config = providerConfiguration();
  if (!config.CARTESIA_API_KEY) {
    throw new AppError(
      'Voice generation is not available yet. Your original recording is safely saved.',
      503,
    );
  }
  return new CartesiaVoiceProvider({ ...config, CARTESIA_API_KEY: config.CARTESIA_API_KEY });
}
