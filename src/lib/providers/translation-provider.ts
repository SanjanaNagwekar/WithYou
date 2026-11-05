import type { KeepsakeLanguage } from '@/lib/languages';

export type TranslationInput = {
  text: string;
  sourceLanguage: 'en';
  targetLanguage: KeepsakeLanguage;
};

export type TranslationResult = {
  translatedText: string;
  provider: 'google' | 'mock' | 'none';
};

export interface TranslationProvider {
  translate(input: TranslationInput): Promise<TranslationResult>;
}
