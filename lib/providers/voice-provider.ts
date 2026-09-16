import type { DeliverySettings } from '@/lib/validation';

export type CloneVoiceInput = {
  audio: ArrayBuffer;
  mime: string;
  fileName: string;
  name: string;
};

export interface VoiceProvider {
  cloneVoice(input: CloneVoiceInput): Promise<string>;
  deleteVoice(providerVoiceId: string): Promise<void>;
  synthesize(transcript: string, providerVoiceId: string, delivery: DeliverySettings): Promise<ArrayBuffer>;
}
