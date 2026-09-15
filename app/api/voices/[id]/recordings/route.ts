import { AppError, context, failure } from '@/lib/server';

const allowedAudioTypes = new Set([
  'audio/aac',
  'audio/m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { db, owner, bucket } = await context(request, true);
    if (Number(request.headers.get('content-length')) > 16 * 1024 * 1024) {
      throw new AppError('Please keep the recording under 15 MB.');
    }

    const { id } = await params;
    const voice = await db
      .prepare('SELECT id FROM voices WHERE id=? AND owner=?')
      .bind(id, owner)
      .first();
    if (!voice) throw new AppError('Voice not found.', 404);

    const data = await request.formData();
    const audio = data.get('audio');
    const name = String(data.get('name') || '').trim();
    if (!name || name.length > 100) {
      throw new AppError('Give this recording a title of up to 100 characters.');
    }
    if (data.get('consent') !== 'yes') {
      throw new AppError('Confirm your permission to save this recording.');
    }

    const mime = audio instanceof File ? audio.type.split(';')[0].toLowerCase() : '';
    if (
      !(audio instanceof File) ||
      !audio.size ||
      audio.size > 15 * 1024 * 1024 ||
      !allowedAudioTypes.has(mime)
    ) {
      throw new AppError('Record audio or choose an audio file under 15 MB.');
    }

    const recordingId = crypto.randomUUID();
    const objectKey = `${owner}/${recordingId}`;
    const now = new Date().toISOString();
    await bucket.put(objectKey, await audio.arrayBuffer(), {
      httpMetadata: { contentType: mime },
    });

    try {
      await db
        .prepare('INSERT INTO recordings(id,owner,voice_id,name,kind,object_key,mime,transcript,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(recordingId, owner, id, name, 'original', objectKey, mime, '', now)
        .run();
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }

    return Response.json({ id: recordingId }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
