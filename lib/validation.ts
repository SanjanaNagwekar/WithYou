import { AppError } from '@/lib/errors';
import { isKeepsakeLanguage } from '@/lib/languages';

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
  return {
    sourceText,
    voiceId: value.voiceId,
    targetLanguage,
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

export function validatedAudioMime(file: File, buffer: ArrayBuffer): string {
  if (!isValidAudioFile(file)) {
    throw new AppError('Choose a supported audio recording under 15 MB.');
  }

  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 16));
  const claimed = normalizedAudioMime(file);
  const detected = detectAudioMime(bytes, claimed);
  if (!detected || !mimeFamiliesMatch(claimed, detected)) {
    throw new AppError('The selected file does not contain a supported audio format.');
  }
  return detected;
}

function detectAudioMime(bytes: Uint8Array, claimed: string): string | undefined {
  const ascii = (start: number, value: string) =>
    value.split('').every((character, index) => bytes[start + index] === character.charCodeAt(0));

  if (bytes.length >= 12 && ascii(0, 'RIFF') && ascii(8, 'WAVE')) return 'audio/wav';
  if (bytes.length >= 4 && ascii(0, 'OggS')) return 'audio/ogg';
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return 'audio/webm';
  }
  if (bytes.length >= 8 && ascii(4, 'ftyp')) return 'audio/mp4';
  if (bytes.length >= 3 && ascii(0, 'ID3')) return 'audio/mpeg';
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0) {
    return claimed === 'audio/mpeg' ? 'audio/mpeg' : 'audio/aac';
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  return undefined;
}

function mimeFamiliesMatch(claimed: string, detected: string): boolean {
  if (claimed === detected) return true;
  if (detected === 'audio/wav') return claimed === 'audio/x-wav';
  if (detected === 'audio/mp4') return ['audio/m4a', 'audio/x-m4a'].includes(claimed);
  return false;
}

export function assertRequestSize(contentLength: string | null, message: string): void {
  const bytes = Number(contentLength);
  if (Number.isFinite(bytes) && bytes > MAX_REQUEST_BYTES) throw new AppError(message);
}
