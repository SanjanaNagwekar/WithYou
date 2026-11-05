import { env } from 'cloudflare:workers';
import { AppError } from '@/lib/errors';
import { parseTranslationEnvironment } from '@/lib/config';
import { GoogleTranslationProvider } from '@/lib/providers/google-translation';
import { MockTranslationProvider } from '@/lib/providers/mock-translation';
import type { TranslationProvider } from '@/lib/providers/translation-provider';

export function translationConfiguration() {
  return parseTranslationEnvironment({
    GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON: env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON,
    WITHYOU_TRANSLATION_PROVIDER: env.WITHYOU_TRANSLATION_PROVIDER,
    WITHYOU_ALLOW_MOCK_TRANSLATION: env.WITHYOU_ALLOW_MOCK_TRANSLATION,
  });
}

export function isTranslationProviderConfigured(): boolean {
  const config = translationConfiguration();
  return (
    config.WITHYOU_TRANSLATION_PROVIDER === 'mock' ||
    Boolean(config.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON)
  );
}

export function translationProviderMode(): 'google' | 'mock' {
  return translationConfiguration().WITHYOU_TRANSLATION_PROVIDER;
}

export function getTranslationProvider(): TranslationProvider {
  const config = translationConfiguration();
  if (config.WITHYOU_TRANSLATION_PROVIDER === 'mock') return new MockTranslationProvider();
  if (!config.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON) {
    throw new AppError('Translation is not configured yet.', 503);
  }
  return new GoogleTranslationProvider(config.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON);
}
