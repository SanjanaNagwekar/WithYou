import { describe, expect, it, vi } from 'vitest';
import { GoogleTranslationProvider } from '@/lib/providers/google-translation';

describe('GoogleTranslationProvider', () => {
  it('authenticates as a service account and translates with the v3 API', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const credential = JSON.stringify({
      project_id: 'withyou-test',
      client_email: 'translator@withyou-test.iam.gserviceaccount.com',
      private_key: pem(privateKey),
      token_uri: 'https://oauth2.googleapis.com/token',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ access_token: 'short-lived-token', expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        Response.json({ translations: [{ translatedText: 'Bonjour.' }] }),
      );
    const provider = new GoogleTranslationProvider(credential, fetchMock as typeof fetch);

    await expect(
      provider.translate({ text: 'Hello.', sourceLanguage: 'en', targetLanguage: 'fr' }),
    ).resolves.toEqual({ translatedText: 'Bonjour.', provider: 'google' });

    expect(fetchMock.mock.calls[0][0]).toBe('https://oauth2.googleapis.com/token');
    expect(String(fetchMock.mock.calls[0][1].body)).toContain(
      'urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer',
    );
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://translation.googleapis.com/v3/projects/withyou-test/locations/global:translateText',
    );
    expect(fetchMock.mock.calls[1][1].headers).toMatchObject({
      Authorization: 'Bearer short-lived-token',
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({
      contents: ['Hello.'],
      sourceLanguageCode: 'en',
      targetLanguageCode: 'fr',
    });
  });

  it('rejects malformed credentials without exposing their contents', () => {
    expect(() => new GoogleTranslationProvider('{"private_key":"secret"}')).toThrow(
      'Google Translation credentials are invalid.',
    );
  });
});

function pem(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const body = btoa(binary).match(/.{1,64}/g)?.join('\n') ?? '';
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`;
}
