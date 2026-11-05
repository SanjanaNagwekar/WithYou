import { AppError, context, failure } from '@/lib/server';
import {
  getVoiceProvider,
  isVoiceProviderConfigured,
  voiceProviderDescriptor,
} from '@/lib/providers';
import { GenerationRunTracker } from '@/lib/generation-runs';
import { isKeepsakeLanguage, keepsakeLocalizationAccent } from '@/lib/languages';
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
  voice_name: string;
};

async function findRecording(db: D1Database, owner: string, id: string) {
  return db
    .prepare(
      `SELECT r.id,r.voice_id,r.kind,r.object_key,r.transcript,r.target_language,
              v.voice_id AS provider_voice_id,v.name AS voice_name
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
    await db.batch([
      db
        .prepare(
          'DELETE FROM benchmark_ratings WHERE benchmark_output_id IN (SELECT id FROM benchmark_outputs WHERE recording_id=? OR benchmark_case_id IN (SELECT id FROM benchmark_cases WHERE source_recording_id=?))',
        )
        .bind(id, id),
      db
        .prepare(
          'DELETE FROM benchmark_scores WHERE benchmark_output_id IN (SELECT id FROM benchmark_outputs WHERE recording_id=? OR benchmark_case_id IN (SELECT id FROM benchmark_cases WHERE source_recording_id=?))',
        )
        .bind(id, id),
      db
        .prepare(
          'DELETE FROM benchmark_outputs WHERE recording_id=? OR benchmark_case_id IN (SELECT id FROM benchmark_cases WHERE source_recording_id=?)',
        )
        .bind(id, id),
      db.prepare('DELETE FROM benchmark_cases WHERE source_recording_id=?').bind(id),
      db.prepare('DELETE FROM generation_runs WHERE recording_id=? AND owner=?').bind(id, owner),
      db.prepare('DELETE FROM recordings WHERE id=? AND owner=?').bind(id, owner),
    ]);
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
  let run: GenerationRunTracker | undefined;

  try {
    const { db, owner, bucket } = await context(request, true);
    if (!isVoiceProviderConfigured()) {
      throw new AppError('Voice generation is not available yet.', 503);
    }

    const { id } = await params;
    const recording = await findRecording(db, owner, id);
    if (!recording) throw new AppError('Keepsake not found.', 404);
    const targetLanguage = recording.target_language;
    if (recording.kind !== 'generated') {
      throw new AppError('Delivery can only be changed for generated keepsakes.');
    }
    if (
      !recording.transcript ||
      !recording.provider_voice_id ||
      !isKeepsakeLanguage(targetLanguage)
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

    const provider = getVoiceProvider();
    run = await GenerationRunTracker.start(db, {
      owner,
      voiceId: recording.voice_id,
      operation: 'update',
      ...voiceProviderDescriptor(),
      targetLanguage,
      inputCharacters: recording.transcript.length,
    });

    let synthesisVoiceId = recording.provider_voice_id;
    if (targetLanguage !== 'en') {
      const variant = await db
        .prepare(
          'SELECT provider_voice_id FROM voice_variants WHERE voice_id=? AND owner=? AND language=?',
        )
        .bind(recording.voice_id, owner, targetLanguage)
        .first<{ provider_voice_id: string }>();
      if (variant) {
        synthesisVoiceId = variant.provider_voice_id;
      } else {
        synthesisVoiceId = await run.measure('localization', () =>
          provider.localizeVoice({
            providerVoiceId: recording.provider_voice_id!,
            language: targetLanguage,
            accent: keepsakeLocalizationAccent(targetLanguage),
            name: recording.voice_name,
          }),
        );
        try {
          await db
            .prepare(
              'INSERT INTO voice_variants(id,owner,voice_id,language,provider_voice_id,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              owner,
              recording.voice_id,
              targetLanguage,
              synthesisVoiceId,
              new Date().toISOString(),
            )
            .run();
        } catch (error) {
          await provider.deleteVoice(synthesisVoiceId).catch(() => {});
          throw error;
        }
      }
    }

    const audioBytes = await run.measure('synthesis', () =>
      synthesizeKeepsake(
        recording.transcript,
        synthesisVoiceId,
        delivery,
        targetLanguage,
      ),
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
        run.successStatement({
          recordingId: id,
          outputBytes: audioBytes.byteLength,
          translationProvider: 'none',
        }),
      ]);
    } catch (error) {
      await bucket.delete(newKey);
      throw error;
    }

    await bucket.delete(recording.object_key).catch(() => {});
    return Response.json({ id, updatedAt: now });
  } catch (error) {
    if (run) await run.fail(error).catch(() => {});
    return failure(error);
  } finally {
    if (release) await release().catch(() => {});
  }
}
