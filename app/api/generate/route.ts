import { AppError, context, failure } from '@/lib/server';
import { getVoiceProvider, isVoiceProviderConfigured } from '@/lib/providers';
import { getTranslationProvider } from '@/lib/providers/translation';
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
      targetLanguage?: unknown;
      localizationGender?: unknown;
      mood?: unknown;
      pace?: unknown;
      volume?: unknown;
    };
    const {
      sourceText,
      voiceId,
      targetLanguage,
      localizationGender,
      delivery,
    } = parseKeepsakeRequest(body);

    const voice = await db
      .prepare(
        'SELECT id,name,voice_id,localization_gender FROM voices WHERE id=? AND owner=?',
      )
      .bind(voiceId, owner)
      .first<{
        id: string;
        name: string;
        voice_id: string | null;
        localization_gender: 'male' | 'female' | null;
      }>();
    if (!voice) throw new AppError('Voice not found.', 404);

    const translation =
      targetLanguage === 'en'
        ? { translatedText: sourceText, provider: 'none' as const }
        : await getTranslationProvider().translate({
            text: sourceText,
            sourceLanguage: 'en',
            targetLanguage,
          });
    const transcript = translation.translatedText;

    await acquireGenerationLock(db, voice.id);
    release = () =>
      db.prepare('DELETE FROM generation_locks WHERE voice_id=?').bind(voice.id).run();
    await enforceGenerationLimit(db, owner);

    const provider = getVoiceProvider();
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
      voice.voice_id = await provider.cloneVoice({
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

    let synthesisVoiceId = voice.voice_id;
    if (targetLanguage !== 'en') {
      if (!localizationGender) {
        throw new AppError('Choose the voice type used to localize this voice.');
      }
      if (
        voice.localization_gender &&
        voice.localization_gender !== localizationGender
      ) {
        throw new AppError(
          'This voice profile already uses a different localization voice type.',
          409,
        );
      }
      if (!voice.localization_gender) {
        await db
          .prepare('UPDATE voices SET localization_gender=? WHERE id=? AND owner=?')
          .bind(localizationGender, voice.id, owner)
          .run();
        voice.localization_gender = localizationGender;
      }

      const existingVariant = await db
        .prepare(
          'SELECT provider_voice_id FROM voice_variants WHERE voice_id=? AND owner=? AND language=?',
        )
        .bind(voice.id, owner, targetLanguage)
        .first<{ provider_voice_id: string }>();
      if (existingVariant) {
        synthesisVoiceId = existingVariant.provider_voice_id;
      } else {
        const localizedVoiceId = await provider.localizeVoice({
          providerVoiceId: voice.voice_id,
          language: targetLanguage,
          gender: localizationGender,
          name: voice.name,
        });
        try {
          await db
            .prepare(
              'INSERT INTO voice_variants(id,owner,voice_id,language,provider_voice_id,created_at) VALUES(?,?,?,?,?,?)',
            )
            .bind(
              crypto.randomUUID(),
              owner,
              voice.id,
              targetLanguage,
              localizedVoiceId,
              new Date().toISOString(),
            )
            .run();
        } catch (error) {
          await provider.deleteVoice(localizedVoiceId).catch(() => {});
          throw error;
        }
        synthesisVoiceId = localizedVoiceId;
      }
    }

    const audioBytes = await synthesizeKeepsake(
      transcript,
      synthesisVoiceId,
      delivery,
      targetLanguage,
    );
    const id = crypto.randomUUID();
    const key = `${owner}/${id}`;
    const now = new Date().toISOString();
    await bucket.put(key, audioBytes, { httpMetadata: { contentType: 'audio/wav' } });

    try {
      await db.batch([
        db
          .prepare(
            'INSERT INTO recordings(id,owner,voice_id,name,kind,object_key,mime,transcript,source_transcript,source_language,target_language,translation_provider,translation_edited,mood,pace,volume,updated_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
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
            sourceText,
            'en',
            targetLanguage,
            translation.provider,
            0,
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

    return Response.json({ id, targetLanguage }, { status: 201 });
  } catch (error) {
    return failure(error);
  } finally {
    if (release) await release().catch(() => {});
  }
}
