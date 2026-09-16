import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';
import { CartesiaVoiceProvider } from '@/lib/providers/cartesia';

const config = {
  CARTESIA_API_KEY: 'test-key',
  CARTESIA_MODEL_ID: 'sonic-3.6',
  WITHYOU_VOICE_PROVIDER: 'cartesia' as const,
  WITHYOU_ALLOW_MOCK_PROVIDER: 'false' as const,
};

describe('CartesiaVoiceProvider', () => {
  it('builds a deterministic synthesis request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('wav-bytes'));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);

    await expect(
      provider.synthesize('Hello', 'provider-voice', {
        mood: 'warm',
        pace: 1.2,
        volume: 0.8,
      }, 'es'),
    ).resolves.toBeInstanceOf(ArrayBuffer);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cartesia.ai/tts/bytes');
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer test-key',
      'Cartesia-Version': '2026-08-14',
    });
    expect(JSON.parse(init.body)).toMatchObject({
      model_id: 'sonic-3.6',
      transcript: 'Hello',
      voice: { mode: 'id', id: 'provider-voice' },
      generation_config: { speed: 1.2, volume: 0.8, emotion: 'affectionate' },
      language: 'es',
    });
  });

  it('returns the cloned provider voice ID', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'clone-123' }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);
    await expect(
      provider.cloneVoice({
        audio: new TextEncoder().encode('audio').buffer,
        mime: 'audio/wav',
        fileName: 'sample.wav',
        name: 'Sample voice',
      }),
    ).resolves.toBe('clone-123');
  });

  it('creates a dedicated localized voice', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'localized-123' }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);

    await expect(
      provider.localizeVoice({
        providerVoiceId: 'clone-123',
        language: 'fr',
        accent: 'parisian',
        name: 'Sample voice',
      }),
    ).resolves.toBe('localized-123');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.cartesia.ai/voices/localize');
    expect(JSON.parse(init.body)).toMatchObject({
      voice_id: 'clone-123',
      accent: 'parisian',
      access: 'private',
    });
  });

  it('deletes a cloned provider voice and treats an already missing voice as deleted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);

    await expect(provider.deleteVoice('clone/123')).resolves.toBeUndefined();
    await expect(provider.deleteVoice('clone/123')).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.cartesia.ai/voices/clone%2F123');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });

  it.each([
    [401, 503],
    [429, 429],
    [500, 502],
  ])('maps provider deletion status %s to a safe application error', async (status, expectedStatus) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);
    const error = await provider.deleteVoice('clone-123').catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(expectedStatus);
    expect(error.message).not.toContain('test-key');
  });

  it.each([
    [401, {}, 503],
    [429, {}, 429],
    [500, {}, 502],
    [402, { error_code: 'plan_upgrade_required' }, 503],
  ])('maps provider status %s to a safe application error', async (status, body, expectedStatus) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);
    const error = await provider
      .synthesize('Hello', 'voice', { mood: 'natural', pace: 1, volume: 1 }, 'en')
      .catch((caught) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect(error.status).toBe(expectedStatus);
    expect(error.message).not.toContain('test-key');
  });

  it('rejects malformed clone responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({}));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);
    await expect(
      provider.cloneVoice({
        audio: new ArrayBuffer(1),
        mime: 'audio/wav',
        fileName: 'sample.wav',
        name: 'Sample voice',
      }),
    ).rejects.toMatchObject({ status: 502 });
  });
});
