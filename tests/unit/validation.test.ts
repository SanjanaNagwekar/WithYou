import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { keepsakeLocalizationAccent } from '@/lib/languages';
import {
  MAX_AUDIO_BYTES,
  MAX_REQUEST_BYTES,
  assertRequestSize,
  isValidAudioFile,
  normalizedAudioMime,
  validatedAudioMime,
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

  it('accepts a localized keepsake without obsolete localization settings', () => {
    expect(
      parseKeepsakeRequest({
        text: 'Siempre eres una persona amada.',
        voiceId: 'voice-1',
        targetLanguage: 'es',
        mood: 'warm',
        pace: 1,
        volume: 1,
      }),
    ).toMatchObject({
      targetLanguage: 'es',
      sourceText: 'Siempre eres una persona amada.',
    });
  });
});

describe('voice localization accents', () => {
  it('maps offered languages to Cartesia localizable accent IDs', () => {
    expect(keepsakeLocalizationAccent('es')).toBe('castilian');
    expect(keepsakeLocalizationAccent('hi')).toBe('standard-hindi');
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

  it('verifies audio signatures instead of trusting the browser MIME type', () => {
    const wav = Uint8Array.from([
      82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
    ]).buffer;
    expect(validatedAudioMime(new File([wav], 'voice.wav', { type: 'audio/wav' }), wav)).toBe(
      'audio/wav',
    );

    const disguisedText = new TextEncoder().encode('this is not audio').buffer;
    expect(() =>
      validatedAudioMime(
        new File([disguisedText], 'fake.wav', { type: 'audio/wav' }),
        disguisedText,
      ),
    ).toThrow('The selected file does not contain a supported audio format.');
  });

  it.each([
    ['voice.ogg', 'audio/ogg', [79, 103, 103, 83], 'audio/ogg'],
    ['voice.webm', 'audio/webm', [0x1a, 0x45, 0xdf, 0xa3], 'audio/webm'],
    ['voice.m4a', 'audio/x-m4a', [0, 0, 0, 0, 102, 116, 121, 112], 'audio/mp4'],
    ['voice.mp3', 'audio/mpeg', [73, 68, 51], 'audio/mpeg'],
    ['voice.aac', 'audio/aac', [0xff, 0xf1], 'audio/aac'],
    ['frame.mp3', 'audio/mpeg', [0xff, 0xe3], 'audio/mpeg'],
  ])('accepts a valid %s signature', (_name, type, signature, expected) => {
    const buffer = Uint8Array.from(signature as number[]).buffer;
    expect(validatedAudioMime(new File([buffer], _name, { type }), buffer)).toBe(expected);
  });

  it('rejects declared audio types that do not match the detected bytes', () => {
    const ogg = Uint8Array.from([79, 103, 103, 83]).buffer;
    expect(() => validatedAudioMime(new File([ogg], 'voice.wav', { type: 'audio/wav' }), ogg))
      .toThrow('The selected file does not contain a supported audio format.');
    expect(() => validatedAudioMime(new File([], 'empty.wav', { type: 'audio/wav' }), ogg))
      .toThrow('Choose a supported audio recording under 15 MB.');
  });

  it('rejects requests larger than the transport limit', () => {
    expect(() => assertRequestSize(String(MAX_REQUEST_BYTES + 1), 'Too large.')).toThrowError(
      new AppError('Too large.'),
    );
    expect(() => assertRequestSize(String(MAX_REQUEST_BYTES), 'Too large.')).not.toThrow();
    expect(() => assertRequestSize(null, 'Too large.')).not.toThrow();
  });
});
