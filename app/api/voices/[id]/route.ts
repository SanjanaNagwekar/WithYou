import { AppError, context, failure } from '@/lib/server';
import { getVoiceProvider } from '@/lib/providers';

type VoiceRow = {
  id: string;
  voice_id: string | null;
};

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, owner, bucket } = await context(request, true);
    const { id } = await params;
    const voice = await db
      .prepare('SELECT id,voice_id FROM voices WHERE id=? AND owner=?')
      .bind(id, owner)
      .first<VoiceRow>();
    if (!voice) throw new AppError('Voice not found.', 404);

    const objects = await db
      .prepare('SELECT object_key FROM recordings WHERE voice_id=? AND owner=?')
      .bind(id, owner)
      .all<{ object_key: string }>();

    const variants = await db
      .prepare('SELECT provider_voice_id FROM voice_variants WHERE voice_id=? AND owner=?')
      .bind(id, owner)
      .all<{ provider_voice_id: string }>();

    if (voice.voice_id || variants.results.length) {
      const provider = getVoiceProvider();
      for (const variant of variants.results) {
        await provider.deleteVoice(variant.provider_voice_id);
      }
      if (voice.voice_id) await provider.deleteVoice(voice.voice_id);
    }
    const keys = objects.results.map((recording) => recording.object_key);
    for (let index = 0; index < keys.length; index += 1000) {
      await bucket.delete(keys.slice(index, index + 1000));
    }

    await db.batch([
      db.prepare('DELETE FROM generation_locks WHERE voice_id=?').bind(id),
      db.prepare('DELETE FROM generation_events WHERE voice_id=? AND owner=?').bind(id, owner),
      db.prepare('DELETE FROM voice_variants WHERE voice_id=? AND owner=?').bind(id, owner),
      db.prepare('DELETE FROM recordings WHERE voice_id=? AND owner=?').bind(id, owner),
      db.prepare('DELETE FROM voices WHERE id=? AND owner=?').bind(id, owner),
    ]);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
