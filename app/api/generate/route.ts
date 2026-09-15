import { AppError, context, failure } from '@/lib/server';
import { getVoiceProvider, isVoiceProviderConfigured } from '@/lib/providers';
import { parseKeepsakeRequest } from '@/lib/validation';
import {
  acquireGenerationLock,
  enforceGenerationLimit,
  synthesizeKeepsake,
} from '@/lib/voice-generation';

export async function POST(request: Request) {
  let release: (() => Promise<unknown>) | undefined;

  try {
    const { db, owner, bucket } = await context(request, true);
    if (!isVoiceProviderConfigured()) {
      throw new AppError('Voice generation is not available yet.', 503);
    }

    const body = (await request.json()) as {
      text?: unknown;
      voiceId?: unknown;
      mood?: unknown;
      pace?: unknown;
      volume?: unknown;
    };
    const { transcript, voiceId, delivery } = parseKeepsakeRequest(body);

    const voice = await db
      .prepare('SELECT id,name,voice_id FROM voices WHERE id=? AND owner=?')
      .bind(voiceId, owner)
      .first<{ id: string; name: string; voice_id: string | null }>();
    if (!voice) throw new AppError('Voice not found.', 404);

    await acquireGenerationLock(db, voice.id);
    release = () =>
      db.prepare('DELETE FROM generation_locks WHERE voice_id=?').bind(voice.id).run();
    await enforceGenerationLimit(db, owner);

    if (!voice.voice_id) {
      const recording = await db
        .prepare(
          "SELECT object_key,mime,name FROM recordings WHERE voice_id=? AND owner=? AND kind='original' ORDER BY created_at DESC LIMIT 1",
        )
        .bind(voice.id, owner)
        .first<{ object_key: string; mime: string; name: string }>();
      if (!recording) throw new AppError('Please add an original recording first.');

      const source = await bucket.get(recording.object_key);
      if (!source) throw new AppError('Reference recording unavailable.');
      voice.voice_id = await getVoiceProvider().cloneVoice({
        audio: await source.arrayBuffer(),
        mime: recording.mime,
        fileName: recording.name,
        name: voice.name,
      });
      await db
        .prepare('UPDATE voices SET voice_id=? WHERE id=? AND owner=?')
        .bind(voice.voice_id, voice.id, owner)
        .run();
    }

    const audioBytes = await synthesizeKeepsake(transcript, voice.voice_id, delivery);
    const id = crypto.randomUUID();
    const key = `${owner}/${id}`;
    const now = new Date().toISOString();
    await bucket.put(key, audioBytes, { httpMetadata: { contentType: 'audio/wav' } });

    try {
      await db.batch([
        db
          .prepare(
            'INSERT INTO recordings(id,owner,voice_id,name,kind,object_key,mime,transcript,mood,pace,volume,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
          )
          .bind(
            id,
            owner,
            voice.id,
            transcript.slice(0, 45),
            'generated',
            key,
            'audio/wav',
            transcript,
            delivery.mood,
            delivery.pace,
            delivery.volume,
            now,
            now,
          ),
        db
          .prepare(
            'INSERT INTO generation_events(id,owner,voice_id,recording_id,action,created_at) VALUES(?,?,?,?,?,?)',
          )
          .bind(crypto.randomUUID(), owner, voice.id, id, 'create', now),
      ]);
    } catch (error) {
      await bucket.delete(key);
      throw error;
    }

    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return failure(error);
  } finally {
    if (release) await release().catch(() => {});
  }
}
