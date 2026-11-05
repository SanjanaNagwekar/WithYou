import { AppError, context, failure } from '@/lib/server';
import {
  getVoiceProvider,
  isVoiceProviderConfigured,
  voiceProviderDescriptor,
} from '@/lib/providers';
import { getTranslationProvider } from '@/lib/providers/translation';
import { GenerationRunTracker } from '@/lib/generation-runs';
import { parseKeepsakeRequest } from '@/lib/validation';
import { keepsakeLocalizationAccent } from '@/lib/languages';
import {
  acquireGenerationLock,
  enforceGenerationLimit,
  synthesizeKeepsake,
} from '@/lib/voice-generation';

export async function POST(request: Request) {
  let release: (() => Promise<unknown>) | undefined;
  let run: GenerationRunTracker | undefined;

  try {
    const { db, owner, bucket } = await context(request, true);
    if (!isVoiceProviderConfigured()) {
      throw new AppError('Voice generation is not available yet.', 503);
    }

    const body = (await request.json()) as {
      text?: unknown;
      voiceId?: unknown;
      targetLanguage?: unknown;
      mood?: unknown;
      pace?: unknown;
      volume?: unknown;
    };
    const {
      sourceText,
      voiceId,
      targetLanguage,
      delivery,
    } = parseKeepsakeRequest(body);

    const voice = await db
      .prepare(
        'SELECT id,name,voice_id FROM voices WHERE id=? AND owner=?',
      )
      .bind(voiceId, owner)
      .first<{
        id: string;
        name: string;
        voice_id: string | null;
      }>();
    if (!voice) throw new AppError('Voice not found.', 404);

    // Reject over-quota requests before either paid provider is called.
    await enforceGenerationLimit(db, owner);
    await acquireGenerationLock(db, voice.id);
    release = () =>
      db.prepare('DELETE FROM generation_locks WHERE voice_id=?').bind(voice.id).run();

    const provider = getVoiceProvider();
    const providerDescriptor = voiceProviderDescriptor();
    run = await GenerationRunTracker.start(db, {
      owner,
      voiceId: voice.id,
      operation: 'create',
      ...providerDescriptor,
      targetLanguage,
      inputCharacters: sourceText.length,
    });

    const translation =
      targetLanguage === 'en'
        ? { translatedText: sourceText, provider: 'none' as const }
        : await run.measure('translation', () =>
            getTranslationProvider().translate({
              text: sourceText,
              sourceLanguage: 'en',
              targetLanguage,
            }),
          );
    const transcript = translation.translatedText;

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
      const referenceAudio = await source.arrayBuffer();
      run.setReferenceBytes(referenceAudio.byteLength);
      voice.voice_id = await run.measure('clone', () =>
        provider.cloneVoice({
          audio: referenceAudio,
          mime: recording.mime,
          fileName: recording.name,
          name: voice.name,
        }),
      );
      await db
        .prepare('UPDATE voices SET voice_id=? WHERE id=? AND owner=?')
        .bind(voice.voice_id, voice.id, owner)
        .run();
    }

    let synthesisVoiceId = voice.voice_id;
    if (targetLanguage !== 'en') {
      const existingVariant = await db
        .prepare(
          'SELECT provider_voice_id FROM voice_variants WHERE voice_id=? AND owner=? AND language=?',
        )
        .bind(voice.id, owner, targetLanguage)
        .first<{ provider_voice_id: string }>();
      if (existingVariant) {
        synthesisVoiceId = existingVariant.provider_voice_id;
      } else {
        const localizedVoiceId = await run.measure('localization', () =>
          provider.localizeVoice({
            providerVoiceId: voice.voice_id!,
            language: targetLanguage,
            accent: keepsakeLocalizationAccent(targetLanguage),
            name: voice.name,
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

    const audioBytes = await run.measure('synthesis', () =>
      synthesizeKeepsake(transcript, synthesisVoiceId, delivery, targetLanguage),
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
        run.successStatement({
          recordingId: id,
          outputBytes: audioBytes.byteLength,
          translationProvider: translation.provider,
        }),
      ]);
    } catch (error) {
      await bucket.delete(key);
      throw error;
    }

    return Response.json({ id, targetLanguage }, { status: 201 });
  } catch (error) {
    if (run) await run.fail(error).catch(() => {});
    return failure(error);
  } finally {
    if (release) await release().catch(() => {});
  }
}
