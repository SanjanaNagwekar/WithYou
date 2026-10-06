import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { ElevenLabsVoiceProvider } from '@/lib/providers/elevenlabs';

const config = {
  ELEVENLABS_API_KEY: 'test-key',
  ELEVENLABS_MODEL_ID: 'eleven_v4',
};

describe('ElevenLabsVoiceProvider', () => {
  it('creates a private instant voice clone without provider noise removal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ voice_id: 'voice-123', requires_verification: true }),
    );
    const provider = new ElevenLabsVoiceProvider(config, fetchMock as typeof fetch);

    await expect(
      provider.cloneVoiceWithMetadata({
        audio: new TextEncoder().encode('audio').buffer,
        mime: 'audio/mp4',
        fileName: 'S01_enrollment.m4a',
        name: 'WithYou benchmark S01',
      }),
    ).resolves.toEqual({ id: 'voice-123', requiresVerification: true });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.elevenlabs.io/v1/voices/add');
    expect(init.headers).toMatchObject({ 'xi-api-key': 'test-key' });
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('remove_background_noise')).toBe('false');
  });

  it('builds a deterministic high-similarity Eleven v4 request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('mp3-bytes'));
    const provider = new ElevenLabsVoiceProvider(config, fetchMock as typeof fetch);

    await expect(
      provider.synthesize(
        'Hello',
        'voice/123',
        { mood: 'natural', pace: 1, volume: 1 },
        'en',
      ),
    ).resolves.toBeInstanceOf(ArrayBuffer);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voice%2F123?output_format=mp3_44100_128',
    );
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'xi-api-key': 'test-key',
    });
    expect(JSON.parse(init.body)).toEqual({
      text: 'Hello',
      model_id: 'eleven_v4',
      language_code: 'en',
      voice_settings: { stability: 0.5, similarity_boost: 0.9 },
      seed: 20261005,
    });
  });

  it('does not create redundant localized clones', async () => {
    const provider = new ElevenLabsVoiceProvider(config, vi.fn() as unknown as typeof fetch);
    await expect(
      provider.localizeVoice({
        providerVoiceId: 'voice-123',
        language: 'es',
        accent: 'mexican',
        name: 'S01',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('deletes a clone and treats an already missing voice as deleted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = new ElevenLabsVoiceProvider(config, fetchMock as typeof fetch);

    await expect(provider.deleteVoice('voice/123')).resolves.toBeUndefined();
    await expect(provider.deleteVoice('voice/123')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.elevenlabs.io/v1/voices/voice%2F123',
    );
  });

  it.each([
    [401, 503],
    [429, 429],
    [500, 502],
  ])('maps provider status %s to a safe error', async (status, expectedStatus) => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ detail: { status: 'provider_error' } }, { status }),
    );
    const provider = new ElevenLabsVoiceProvider(config, fetchMock as typeof fetch);
    const error = await provider
      .synthesize('Hello', 'voice', { mood: 'natural', pace: 1, volume: 1 }, 'en')
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(expectedStatus);
    expect(error.message).not.toContain('test-key');
  });

  it('rejects malformed clone responses', async () => {
    const provider = new ElevenLabsVoiceProvider(
      config,
      vi.fn().mockResolvedValue(Response.json({})) as unknown as typeof fetch,
    );
    await expect(
      provider.cloneVoice({
        audio: new ArrayBuffer(1),
        mime: 'audio/mp4',
        fileName: 'sample.m4a',
        name: 'Sample voice',
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
