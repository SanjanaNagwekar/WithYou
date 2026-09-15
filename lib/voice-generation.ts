import { AppError, cartesia, providerConfig } from '@/lib/server';

export const moodOptions = ['natural', 'warm', 'calm', 'joyful', 'nostalgic', 'proud'] as const;

export type Mood = (typeof moodOptions)[number];

const providerEmotion: Record<Mood, string | undefined> = {
  natural: undefined,
  warm: 'affectionate',
  calm: 'calm',
  joyful: 'happy',
  nostalgic: 'nostalgic',
  proud: 'proud',
};

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

  return {
    mood: value.mood as Mood,
    pace: value.pace,
    volume: value.volume,
  };
}

export async function synthesizeKeepsake(
  transcript: string,
  providerVoiceId: string,
  delivery: DeliverySettings,
) {
  const emotion = providerEmotion[delivery.mood];
  const generationConfig = {
    speed: delivery.pace,
    volume: delivery.volume,
    ...(emotion ? { emotion } : {}),
  };
  const audio = await cartesia('/tts/bytes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model_id: providerConfig().model,
      transcript,
      voice: { mode: 'id', id: providerVoiceId },
      language: 'en',
      generation_config: generationConfig,
      output_format: {
        container: 'wav',
        encoding: 'pcm_s16le',
        sample_rate: 44100,
      },
    }),
  });

  return audio.arrayBuffer();
}

export async function acquireGenerationLock(db: D1Database, voiceId: string) {
  const lock = await db
    .prepare(
      'INSERT INTO generation_locks(voice_id,expires) VALUES(?,?) ON CONFLICT(voice_id) DO UPDATE SET expires=excluded.expires WHERE generation_locks.expires<? RETURNING voice_id',
    )
    .bind(voiceId, Date.now() + 240000, Date.now())
    .first();
  if (!lock) {
    throw new AppError('This voice is already creating audio. Please wait a moment.', 409);
  }
}

export async function enforceGenerationLimit(db: D1Database, owner: string) {
  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM generation_events WHERE owner=? AND created_at>?')
    .bind(owner, new Date(Date.now() - 86400000).toISOString())
    .first<{ n: number }>();
  if ((count?.n || 0) >= 30) {
    throw new AppError('You have reached the MVP limit of 30 voice generations per day.', 429);
  }
}
