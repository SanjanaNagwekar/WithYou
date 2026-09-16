import { AppError } from '@/lib/errors';
import {
  isKeepsakeLanguage,
  type LocalizationGender,
} from '@/lib/languages';

export const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 16 * 1024 * 1024;
export const MAX_KEEPSAKE_CHARACTERS = 1000;

export const allowedAudioTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
]);

export const moodOptions = ['natural', 'warm', 'calm', 'joyful', 'nostalgic', 'proud'] as const;
export type Mood = (typeof moodOptions)[number];

export type DeliverySettings = {
  mood: Mood;
  pace: number;
  volume: number;
};

export function parseDelivery(value: {
  mood?: unknown;
  pace?: unknown;
  volume?: unknown;
}): DeliverySettings {
  if (
    typeof value.mood !== 'string' ||
    !moodOptions.includes(value.mood as Mood) ||
    typeof value.pace !== 'number' ||
    !Number.isFinite(value.pace) ||
    value.pace < 0.6 ||
    value.pace > 1.5 ||
    typeof value.volume !== 'number' ||
    !Number.isFinite(value.volume) ||
    value.volume < 0.5 ||
    value.volume > 2
  ) {
    throw new AppError('Choose valid voice delivery settings.');
  }
  return { mood: value.mood as Mood, pace: value.pace, volume: value.volume };
}

export function parseKeepsakeRequest(value: {
  text?: unknown;
  voiceId?: unknown;
  targetLanguage?: unknown;
  localizationGender?: unknown;
  mood?: unknown;
  pace?: unknown;
  volume?: unknown;
}) {
  if (
    typeof value.text !== 'string' ||
    !value.text.trim() ||
    value.text.length > MAX_KEEPSAKE_CHARACTERS ||
    typeof value.voiceId !== 'string' ||
    !value.voiceId
  ) {
    throw new AppError('Select a voice and enter between 1 and 1,000 characters.');
  }
  const sourceText = value.text.trim();
  const targetLanguage = value.targetLanguage ?? 'en';
  if (!isKeepsakeLanguage(targetLanguage)) {
    throw new AppError('Choose a supported keepsake language.');
  }
  let localizationGender: LocalizationGender | undefined;
  if (targetLanguage !== 'en') {
    if (value.localizationGender !== 'male' && value.localizationGender !== 'female') {
      throw new AppError('Choose the voice type used to localize this voice.');
    }
    localizationGender = value.localizationGender;
  }
  return {
    sourceText,
    voiceId: value.voiceId,
    targetLanguage,
    localizationGender,
    delivery: parseDelivery(value),
  };
}

export function normalizedAudioMime(value: unknown): string {
  return value instanceof File ? value.type.split(';')[0].trim().toLowerCase() : '';
}

export function isValidAudioFile(value: unknown): value is File {
  const mime = normalizedAudioMime(value);
  return value instanceof File && value.size > 0 && value.size <= MAX_AUDIO_BYTES && allowedAudioTypes.has(mime);
}

export function assertRequestSize(contentLength: string | null, message: string): void {
  const bytes = Number(contentLength);
  if (Number.isFinite(bytes) && bytes > MAX_REQUEST_BYTES) throw new AppError(message);
}
