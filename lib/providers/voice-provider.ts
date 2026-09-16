import type { DeliverySettings } from '@/lib/validation';
import type { KeepsakeLanguage, LocalizationGender } from '@/lib/languages';

export type CloneVoiceInput = {
  audio: ArrayBuffer;
  mime: string;
  fileName: string;
  name: string;
};

export type LocalizeVoiceInput = {
  providerVoiceId: string;
  language: Exclude<KeepsakeLanguage, 'en'>;
  gender: LocalizationGender;
  name: string;
};

export interface VoiceProvider {
  cloneVoice(input: CloneVoiceInput): Promise<string>;
  localizeVoice(input: LocalizeVoiceInput): Promise<string>;
  deleteVoice(providerVoiceId: string): Promise<void>;
  synthesize(
    transcript: string,
    providerVoiceId: string,
    delivery: DeliverySettings,
    language: KeepsakeLanguage,
  ): Promise<ArrayBuffer>;
}
