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
      }),
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

  it.each([
    [401, {}, 503],
    [429, {}, 429],
    [500, {}, 502],
    [402, { error_code: 'plan_upgrade_required' }, 503],
  ])('maps provider status %s to a safe application error', async (status, body, expectedStatus) => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(body, { status }));
    const provider = new CartesiaVoiceProvider(config, fetchMock as typeof fetch);
    const error = await provider
      .synthesize('Hello', 'voice', { mood: 'natural', pace: 1, volume: 1 })
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
