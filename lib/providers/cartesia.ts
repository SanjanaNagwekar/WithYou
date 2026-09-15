import { AppError } from '@/lib/errors';
import type { ProviderEnvironment } from '@/lib/config';
import type { CloneVoiceInput, VoiceProvider } from '@/lib/providers/voice-provider';
import type { DeliverySettings, Mood } from '@/lib/validation';

const providerEmotion: Record<Mood, string | undefined> = {
  natural: undefined,
  warm: 'affectionate',
  calm: 'calm',
  joyful: 'happy',
  nostalgic: 'nostalgic',
  proud: 'proud',
};

export class CartesiaVoiceProvider implements VoiceProvider {
  constructor(
    private readonly config: ProviderEnvironment & { CARTESIA_API_KEY: string },
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async cloneVoice(input: CloneVoiceInput): Promise<string> {
    const form = new FormData();
    form.set('clip', new Blob([input.audio], { type: input.mime }), input.fileName);
    form.set('name', input.name);
    form.set('language', 'en');
    form.set('access', 'private');
    form.set('description', 'Private WithYou voice keepsake');

    const response = await this.request('/voices/clone', { method: 'POST', body: form });
    const clone = (await response.json()) as { id?: string };
    if (!clone.id) throw new AppError('The voice service returned an invalid voice.', 502);
    return clone.id;
  }

  async synthesize(
    transcript: string,
    providerVoiceId: string,
    delivery: DeliverySettings,
  ): Promise<ArrayBuffer> {
    const emotion = providerEmotion[delivery.mood];
    const response = await this.request('/tts/bytes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model_id: this.config.CARTESIA_MODEL_ID,
        transcript,
        voice: { mode: 'id', id: providerVoiceId },
        language: 'en',
        generation_config: {
          speed: delivery.pace,
          volume: delivery.volume,
          ...(emotion ? { emotion } : {}),
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 44100,
        },
      }),
    });
    return response.arrayBuffer();
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchImplementation(`https://api.cartesia.ai${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${this.config.CARTESIA_API_KEY}`,
        'Cartesia-Version': '2026-08-14',
      },
      signal: AbortSignal.timeout(90000),
    });
    if (response.ok) return response;

    const detail = (await response.json().catch(() => null)) as { error_code?: string } | null;
    const code =
      typeof detail?.error_code === 'string' && /^[a-z_]{1,80}$/.test(detail.error_code)
        ? detail.error_code
        : 'unknown';
    console.error('Voice service rejected request', {
      stage: path === '/voices/clone' ? 'cloning' : 'generation',
      status: response.status,
      code,
    });
    if (code === 'plan_upgrade_required') {
      throw new AppError(
        'Voice cloning is not enabled on the current service plan. The app owner needs to upgrade the voice service plan. Your recording is saved.',
        503,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new AppError(
        'The voice service is not authorized for this request. Please contact the app owner.',
        503,
      );
    }
    if (response.status === 429) {
      throw new AppError('The voice service has reached its usage limit. Please try again later.', 429);
    }
    throw new AppError(
      `The voice service could not ${path === '/voices/clone' ? 'create a voice from this recording' : 'generate this audio'}. Please try again or contact the app owner.`,
      502,
    );
  }
}
