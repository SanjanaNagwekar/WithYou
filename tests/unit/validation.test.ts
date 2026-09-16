import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import {
  MAX_AUDIO_BYTES,
  MAX_REQUEST_BYTES,
  assertRequestSize,
  isValidAudioFile,
  normalizedAudioMime,
  parseDelivery,
  parseKeepsakeRequest,
} from '@/lib/validation';

describe('delivery validation', () => {
  it('accepts boundary values', () => {
    expect(parseDelivery({ mood: 'warm', pace: 0.6, volume: 2 })).toEqual({
      mood: 'warm',
      pace: 0.6,
      volume: 2,
    });
    expect(parseDelivery({ mood: 'natural', pace: 1.5, volume: 0.5 })).toEqual({
      mood: 'natural',
      pace: 1.5,
      volume: 0.5,
    });
  });

  it.each([
    { mood: 'angry', pace: 1, volume: 1 },
    { mood: 'warm', pace: 0.59, volume: 1 },
    { mood: 'warm', pace: 1.51, volume: 1 },
    { mood: 'warm', pace: 1, volume: Number.NaN },
    { mood: 'warm', pace: 1, volume: 2.01 },
  ])('rejects invalid delivery settings: %j', (delivery) => {
    expect(() => parseDelivery(delivery)).toThrow('Choose valid voice delivery settings.');
  });
});

describe('keepsake request validation', () => {
  it('trims valid text and returns normalized input', () => {
    expect(
      parseKeepsakeRequest({
        text: '  I am proud of you.  ',
        voiceId: 'voice-1',
        mood: 'proud',
        pace: 1.1,
        volume: 0.9,
      }),
    ).toEqual({
      sourceText: 'I am proud of you.',
      voiceId: 'voice-1',
      targetLanguage: 'en',
      localizationGender: undefined,
      delivery: { mood: 'proud', pace: 1.1, volume: 0.9 },
    });
  });

  it.each([
    { text: '', voiceId: 'voice-1' },
    { text: '   ', voiceId: 'voice-1' },
    { text: 'a'.repeat(1001), voiceId: 'voice-1' },
    { text: 'hello', voiceId: '' },
    { text: 'hello', voiceId: 3 },
  ])('rejects incomplete or oversized input', (input) => {
    expect(() =>
      parseKeepsakeRequest({ ...input, mood: 'natural', pace: 1, volume: 1 }),
    ).toThrow('Select a voice and enter between 1 and 1,000 characters.');
  });

  it('accepts a localized keepsake and rejects missing localization settings', () => {
    expect(
      parseKeepsakeRequest({
        text: 'Siempre eres una persona amada.',
        voiceId: 'voice-1',
        targetLanguage: 'es',
        localizationGender: 'female',
        mood: 'warm',
        pace: 1,
        volume: 1,
      }),
    ).toMatchObject({
      targetLanguage: 'es',
      localizationGender: 'female',
    });
    expect(() =>
      parseKeepsakeRequest({
        text: 'Hola',
        voiceId: 'voice-1',
        targetLanguage: 'es',
        mood: 'natural',
        pace: 1,
        volume: 1,
      }),
    ).toThrow('Choose the voice type used to localize this voice.');
  });
});

describe('audio validation', () => {
  it('normalizes MIME parameters and accepts supported audio', () => {
    const audio = new File(['audio'], 'voice.wav', { type: 'Audio/WAV; codecs=1' });
    expect(normalizedAudioMime(audio)).toBe('audio/wav');
    expect(isValidAudioFile(audio)).toBe(true);
  });

  it('rejects empty, unsupported, and oversized files', () => {
    expect(isValidAudioFile(new File([], 'empty.wav', { type: 'audio/wav' }))).toBe(false);
    expect(isValidAudioFile(new File(['text'], 'note.txt', { type: 'text/plain' }))).toBe(false);
    expect(
      isValidAudioFile(new File([new Uint8Array(MAX_AUDIO_BYTES + 1)], 'large.wav', { type: 'audio/wav' })),
    ).toBe(false);
    expect(isValidAudioFile(null)).toBe(false);
  });

  it('rejects requests larger than the transport limit', () => {
    expect(() => assertRequestSize(String(MAX_REQUEST_BYTES + 1), 'Too large.')).toThrowError(
      new AppError('Too large.'),
    );
    expect(() => assertRequestSize(String(MAX_REQUEST_BYTES), 'Too large.')).not.toThrow();
    expect(() => assertRequestSize(null, 'Too large.')).not.toThrow();
  });
});
