import type {
  TranslationInput,
  TranslationProvider,
  TranslationResult,
} from '@/lib/providers/translation-provider';

const knownTranslations: Partial<Record<TranslationInput['targetLanguage'], Record<string, string>>> = {
  es: {
    'You are loved, always.': 'Siempre eres una persona amada.',
    'I love you, always.': 'Te quiero, siempre.',
    'I am so proud of you.': 'Estoy muy orgulloso de ti.',
  },
  fr: {
    'You are loved, always.': 'Tu es aimé, pour toujours.',
    'I love you, always.': 'Je t’aime, pour toujours.',
  },
};

export class MockTranslationProvider implements TranslationProvider {
  async translate(input: TranslationInput): Promise<TranslationResult> {
    if (input.targetLanguage === input.sourceLanguage) {
      return { translatedText: input.text, provider: 'none' };
    }
    return {
      translatedText:
        knownTranslations[input.targetLanguage]?.[input.text] ??
        `[${input.targetLanguage}] ${input.text}`,
      provider: 'mock',
    };
  }
}
