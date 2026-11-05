import { AppError } from '@/lib/errors';
import { getVoiceProvider, providerConfiguration } from '@/lib/providers';
export { parseDelivery } from '@/lib/validation';
import type { DeliverySettings } from '@/lib/validation';
import type { KeepsakeLanguage } from '@/lib/languages';

export async function synthesizeKeepsake(
  transcript: string,
  providerVoiceId: string,
  delivery: DeliverySettings,
  language: KeepsakeLanguage,
) {
  return getVoiceProvider().synthesize(transcript, providerVoiceId, delivery, language);
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
  const config = providerConfiguration();
  const boundary = new Date(Date.now() - 86400000).toISOString();
  const [ownerCount, globalCount] = await Promise.all([
    db
      .prepare('SELECT COUNT(*) AS n FROM generation_events WHERE owner=? AND created_at>?')
      .bind(owner, boundary)
      .first<{ n: number }>(),
    db
      .prepare('SELECT COUNT(*) AS n FROM generation_events WHERE created_at>?')
      .bind(boundary)
      .first<{ n: number }>(),
  ]);
  if ((globalCount?.n || 0) >= config.WITHYOU_GLOBAL_DAILY_GENERATION_LIMIT) {
    throw new AppError('The public pilot has reached today’s generation capacity.', 429);
  }
  if ((ownerCount?.n || 0) >= config.WITHYOU_DAILY_GENERATION_LIMIT) {
    throw new AppError(
      `You have reached the limit of ${config.WITHYOU_DAILY_GENERATION_LIMIT} voice generations per day.`,
      429,
    );
  }
}
