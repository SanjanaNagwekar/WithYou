import { AppError, context, failure } from '@/lib/server';
import { isVoiceProviderConfigured } from '@/lib/providers';
import { assertRequestSize, isValidAudioFile, normalizedAudioMime } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const { db, owner } = await context(request);
    const [voices, recordings] = await Promise.all([
      db.prepare('SELECT id,name,relationship,voice_id FROM voices WHERE owner=? ORDER BY created_at DESC').bind(owner).all(),
      db.prepare('SELECT id,name,kind,transcript,voice_id,mood,pace,volume,updated_at,created_at FROM recordings WHERE owner=? ORDER BY created_at DESC').bind(owner).all(),
    ]);
    return Response.json(
      { voices: voices.results, recordings: recordings.results, configured: isVoiceProviderConfigured() },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { db, owner, bucket } = await context(request, true);
    assertRequestSize(request.headers.get('content-length'), 'Please choose a recording under 15 MB.');
    const data = await request.formData();
    const name = String(data.get('name') || '').trim();
    const relationship = String(data.get('relationship') || '').trim();
    const audio = data.get('audio');
    if (!name || name.length > 80 || relationship.length > 80 || data.get('consent') !== 'yes') {
      throw new AppError('Add a name and confirm your permission to preserve this voice.');
    }
    if (!isValidAudioFile(audio)) {
      throw new AppError('Choose an MP3, WAV, M4A, AAC, OGG or WebM recording under 15 MB.');
    }

    const voiceId = crypto.randomUUID();
    const recordingId = crypto.randomUUID();
    const objectKey = `${owner}/${recordingId}`;
    const now = new Date().toISOString();
    const mime = normalizedAudioMime(audio);
    await bucket.put(objectKey, await audio.arrayBuffer(), { httpMetadata: { contentType: mime } });
    try {
      await db.batch([
        db.prepare('INSERT INTO voices(id,owner,name,relationship,consent_at,created_at) VALUES(?,?,?,?,?,?)').bind(voiceId, owner, name, relationship, now, now),
        db.prepare('INSERT INTO recordings(id,owner,voice_id,name,kind,object_key,mime,transcript,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(recordingId, owner, voiceId, audio.name.slice(0, 150), 'original', objectKey, mime, '', now),
      ]);
    } catch (error) {
      await bucket.delete(objectKey);
      throw error;
    }
    return Response.json({ id: voiceId }, { status: 201 });
  } catch (error) {
    return failure(error);
  }
}
