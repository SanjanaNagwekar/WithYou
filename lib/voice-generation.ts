import { AppError } from '@/lib/errors';
import { getVoiceProvider } from '@/lib/providers';
export { parseDelivery } from '@/lib/validation';
import type { DeliverySettings } from '@/lib/validation';

export async function synthesizeKeepsake(
  transcript: string,
  providerVoiceId: string,
  delivery: DeliverySettings,
) {
  return getVoiceProvider().synthesize(transcript, providerVoiceId, delivery);
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
