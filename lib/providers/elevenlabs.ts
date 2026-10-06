import { AppError } from '@/lib/errors';
import type { BenchmarkEnvironment } from '@/lib/config';
import type {
  CloneVoiceInput,
  LocalizeVoiceInput,
  VoiceProvider,
} from '@/lib/providers/voice-provider';
import type { KeepsakeLanguage } from '@/lib/languages';
import type { DeliverySettings, Mood } from '@/lib/validation';

type CloneResult = {
  id: string;
  requiresVerification: boolean;
};

const stabilityByMood: Record<Mood, number> = {
  natural: 0.5,
  warm: 0.42,
  calm: 0.68,
  joyful: 0.35,
  nostalgic: 0.55,
  proud: 0.48,
};

export class ElevenLabsVoiceProvider implements VoiceProvider {
  constructor(
    private readonly config: Pick<
      BenchmarkEnvironment,
      'ELEVENLABS_API_KEY' | 'ELEVENLABS_MODEL_ID'
    > & { ELEVENLABS_API_KEY: string },
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {}

  async cloneVoice(input: CloneVoiceInput): Promise<string> {
    return (await this.cloneVoiceWithMetadata(input)).id;
  }

  async cloneVoiceWithMetadata(input: CloneVoiceInput): Promise<CloneResult> {
    const form = new FormData();
    form.append('files', new Blob([input.audio], { type: input.mime }), input.fileName);
    form.set('name', input.name);
    form.set('description', 'Private WithYou controlled voice-model benchmark');
    form.set('remove_background_noise', 'false');

    const response = await this.request('/v1/voices/add', { method: 'POST', body: form }, 'clone');
    const clone = (await response.json()) as {
      voice_id?: unknown;
      requires_verification?: unknown;
    };
    if (typeof clone.voice_id !== 'string' || clone.voice_id.length === 0) {
      throw new AppError('The benchmark voice service returned an invalid voice.', 502);
    }
    return {
      id: clone.voice_id,
      requiresVerification: clone.requires_verification === true,
    };
  }

  async localizeVoice(input: LocalizeVoiceInput): Promise<string> {
    void input;
    throw new AppError(
      'ElevenLabs benchmark voices synthesize languages directly and do not create localized voice copies.',
      400,
    );
  }

  async deleteVoice(providerVoiceId: string): Promise<void> {
    const response = await this.fetchImplementation(
      `https://api.elevenlabs.io/v1/voices/${encodeURIComponent(providerVoiceId)}`,
      {
        method: 'DELETE',
        headers: this.headers(),
        signal: AbortSignal.timeout(30000),
      },
    );
    if (response.ok || response.status === 404) return;
    throw mapProviderError(response.status, 'delete');
  }

  async synthesize(
    transcript: string,
    providerVoiceId: string,
    delivery: DeliverySettings,
    language: KeepsakeLanguage,
  ): Promise<ArrayBuffer> {
    const response = await this.request(
      `/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          model_id: this.config.ELEVENLABS_MODEL_ID,
          language_code: language,
          voice_settings: {
            stability: stabilityByMood[delivery.mood],
            similarity_boost: 0.9,
          },
          seed: 20261005,
        }),
      },
      'synthesize',
    );
    return response.arrayBuffer();
  }

  private headers(): Record<string, string> {
    return { 'xi-api-key': this.config.ELEVENLABS_API_KEY };
  }

  private async request(
    path: string,
    init: RequestInit,
    stage: 'clone' | 'synthesize',
  ): Promise<Response> {
    const response = await this.fetchImplementation(`https://api.elevenlabs.io${path}`, {
      ...init,
      headers: { ...init.headers, ...this.headers() },
      signal: AbortSignal.timeout(90000),
    });
    if (response.ok) return response;

    const detail = (await response.json().catch(() => null)) as {
      detail?: { status?: unknown } | string;
    } | null;
    const rawCode =
      detail?.detail && typeof detail.detail === 'object' ? detail.detail.status : undefined;
    const code =
      typeof rawCode === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(rawCode)
        ? rawCode
        : 'unknown';
    console.error('Benchmark voice service rejected request', {
      provider: 'elevenlabs',
      stage,
      status: response.status,
      code,
    });
    throw mapProviderError(response.status, stage, code);
  }
}

function mapProviderError(
  status: number,
  stage: 'clone' | 'synthesize' | 'delete',
  code = 'unknown',
): AppError {
  if (code === 'can_not_use_instant_voice_cloning') {
    return new AppError(
      'ElevenLabs Instant Voice Cloning is not enabled for this account. Upgrade to Starter or above, then resume the benchmark with a new run ID.',
      503,
    );
  }
  if (status === 401 || status === 403) {
    return new AppError('The benchmark voice service is not authorized for this request.', 503);
  }
  if (status === 429) {
    return new AppError('The benchmark voice service has reached its usage limit.', 429);
  }
  const action =
    stage === 'clone'
      ? 'create the benchmark voice'
      : stage === 'delete'
        ? 'delete the benchmark voice'
        : 'generate benchmark audio';
  return new AppError(`The benchmark voice service could not ${action}.`, 502);
}
