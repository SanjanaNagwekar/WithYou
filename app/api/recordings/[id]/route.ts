import { AppError, context, failure } from '@/lib/server';
import { getVoiceProvider, isVoiceProviderConfigured } from '@/lib/providers';
import { isKeepsakeLanguage } from '@/lib/languages';
import {
  acquireGenerationLock,
  enforceGenerationLimit,
  parseDelivery,
  synthesizeKeepsake,
} from '@/lib/voice-generation';

type RecordingRow = {
  id: string;
  voice_id: string;
  kind: string;
  object_key: string;
  transcript: string;
  provider_voice_id: string | null;
  target_language: string;
  localization_gender: 'male' | 'female' | null;
  voice_name: string;
};

async function findRecording(db: D1Database, owner: string, id: string) {
  return db
    .prepare(
      `SELECT r.id,r.voice_id,r.kind,r.object_key,r.transcript,r.target_language,
              v.voice_id AS provider_voice_id,v.localization_gender,v.name AS voice_name
       FROM recordings r
       JOIN voices v ON v.id=r.voice_id AND v.owner=r.owner
       WHERE r.id=? AND r.owner=?`,
    )
    .bind(id, owner)
    .first<RecordingRow>();
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, owner, bucket } = await context(request, true);
    const { id } = await params;
    const recording = await findRecording(db, owner, id);
    if (!recording) throw new AppError('Recording not found.', 404);

    await bucket.delete(recording.object_key);
    await db.prepare('DELETE FROM recordings WHERE id=? AND owner=?').bind(id, owner).run();
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let release: (() => Promise<unknown>) | undefined;

  try {
    const { db, owner, bucket } = await context(request, true);
    if (!isVoiceProviderConfigured()) {
      throw new AppError('Voice generation is not available yet.', 503);
    }

    const { id } = await params;
    const recording = await findRecording(db, owner, id);
    if (!recording) throw new AppError('Keepsake not found.', 404);
    if (recording.kind !== 'generated') {
      throw new AppError('Delivery can only be changed for generated keepsakes.');
    }
    if (
      !recording.transcript ||
      !recording.provider_voice_id ||
      !isKeepsakeLanguage(recording.target_language)
    ) {
      throw new AppError('This keepsake cannot be regenerated with its current voice.', 409);
    }

    const body = (await request.json()) as {
      mood?: unknown;
      pace?: unknown;
      volume?: unknown;
    };
    const delivery = parseDelivery(body);

    await acquireGenerationLock(db, recording.voice_id);
    release = () =>
      db
        .prepare('DELETE FROM generation_locks WHERE voice_id=?')
        .bind(recording.voice_id)
        .run();
    await enforceGenerationLimit(db, owner);

    let synthesisVoiceId = recording.provider_voice_id;
    if (recording.target_language !== 'en') {
      if (!recording.localization_gender) {
        throw new AppError('This keepsake is missing voice localization settings.', 409);
      }
      const variant = await db
        .prepare(
          'SELECT provider_voice_id FROM voice_variants WHERE voice_id=? AND owner=? AND language=?',
        )
        .bind(recording.voice_id, owner, recording.target_language)
        .first<{ provider_voice_id: string }>();
      if (variant) {
        synthesisVoiceId = variant.provider_voice_id;
      } else {
        synthesisVoiceId = await getVoiceProvider().localizeVoice({
          providerVoiceId: recording.provider_voice_id,
          language: recording.target_language,
          gender: recording.localization_gender,
          name: recording.voice_name,
        });
        try {
          await db
            .prepare(
              'INSERT INTO voice_variants(id,owner,voice_id,language,provider_voice_id,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              owner,
              recording.voice_id,
              recording.target_language,
              synthesisVoiceId,
              new Date().toISOString(),
            )
            .run();
        } catch (error) {
          await getVoiceProvider().deleteVoice(synthesisVoiceId).catch(() => {});
          throw error;
        }
      }
    }

    const audioBytes = await synthesizeKeepsake(
      recording.transcript,
      synthesisVoiceId,
      delivery,
      recording.target_language,
    );
    const newKey = `${owner}/${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    await bucket.put(newKey, audioBytes, { httpMetadata: { contentType: 'audio/wav' } });

    try {
      await db.batch([
        db
          .prepare(
            'UPDATE recordings SET object_key=?,mime=?,mood=?,pace=?,volume=?,updated_at=? WHERE id=? AND owner=?',
          )
          .bind(
            newKey,
            'audio/wav',
            delivery.mood,
            delivery.pace,
            delivery.volume,
            now,
            id,
            owner,
          ),
        db
          .prepare(
            'INSERT INTO generation_events(id,owner,voice_id,recording_id,action,created_at) VALUES(?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), owner, recording.voice_id, id, 'update', now),
      ]);
    } catch (error) {
      await bucket.delete(newKey);
      throw error;
    }

    await bucket.delete(recording.object_key).catch(() => {});
    return Response.json({ id, updatedAt: now });
  } catch (error) {
    return failure(error);
  } finally {
    if (release) await release().catch(() => {});
  }
}
