import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import { audioFixture, createTestRuntime } from '@/tests/helpers/test-runtime';

const state = vi.hoisted(() => ({
  env: {} as Record<string, unknown>,
  user: { userId: 'user-a', email: 'a@example.test', displayName: 'A', fullName: 'A' } as {
    userId: string;
    email: string;
    displayName: string;
    fullName: string | null;
  } | null,
}));

vi.mock('cloudflare:workers', () => ({ env: state.env }));
vi.mock('@/app/auth', () => ({ getAuthenticatedUser: vi.fn(async () => state.user) }));

import { GET as getLibrary, POST as createVoice } from '@/app/api/library/route';
import { POST as generateKeepsake } from '@/app/api/generate/route';
import { DELETE as deleteRecording, PATCH as updateRecording } from '@/app/api/recordings/[id]/route';
import { DELETE as deleteVoice } from '@/app/api/voices/[id]/route';
import { GET as getAudio } from '@/app/api/audio/[id]/route';

describe('recording API lifecycle', () => {
  let runtime: Miniflare | undefined;
  let db: Awaited<ReturnType<typeof createTestRuntime>>['db'];
  let bucket: Awaited<ReturnType<typeof createTestRuntime>>['bucket'];

  beforeEach(async () => {
    const testRuntime = await createTestRuntime();
    runtime = testRuntime.runtime;
    db = testRuntime.db;
    bucket = testRuntime.bucket;
    Object.assign(state.env, {
      DB: testRuntime.db,
      BUCKET: testRuntime.bucket,
      CARTESIA_API_KEY: undefined,
      CARTESIA_MODEL_ID: 'sonic-3.6',
      WITHYOU_VOICE_PROVIDER: 'mock',
      WITHYOU_ALLOW_MOCK_PROVIDER: 'true',
      WITHYOU_TRANSLATION_PROVIDER: 'mock',
      WITHYOU_ALLOW_MOCK_TRANSLATION: 'true',
    });
    state.user = {
      userId: 'user-a',
      email: 'a@example.test',
      displayName: 'A',
      fullName: 'A',
    };
  });

  afterEach(async () => {
    await runtime?.dispose();
    for (const key of Object.keys(state.env)) delete state.env[key];
  });

  it('creates, generates, updates, serves, and deletes private recordings', async () => {
    const form = new FormData();
    form.set('name', 'Grandma');
    form.set('relationship', 'Grandmother');
    form.set('consent', 'yes');
    form.set('audio', audioFixture());
    const created = await createVoice(new Request('http://localhost/api/library', { method: 'POST', body: form }));
    expect(created.status).toBe(201);
    const voiceId = ((await created.json()) as { id: string }).id;

    const generated = await generateKeepsake(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'I am proud of you.',
          voiceId,
          mood: 'warm',
          pace: 1.1,
          volume: 0.9,
        }),
      }),
    );
    expect(generated.status).toBe(201);
    const recordingId = ((await generated.json()) as { id: string }).id;

    const library = await getLibrary(new Request('http://localhost/api/library'));
    const data = (await library.json()) as { voices: unknown[]; recordings: Array<{ id: string }> };
    expect(data.voices).toHaveLength(1);
    expect(data.recordings).toHaveLength(2);
    expect(data.recordings.some((recording) => recording.id === recordingId)).toBe(true);
    const originalRecordingId = data.recordings.find((recording) => recording.id !== recordingId)!.id;
    const originalObject = await db
      .prepare('SELECT object_key FROM recordings WHERE id=?')
      .bind(originalRecordingId)
      .first<{ object_key: string }>();

    const audio = await getAudio(new Request(`http://localhost/api/audio/${recordingId}`), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(audio.status).toBe(200);
    expect(audio.headers.get('content-type')).toBe('audio/wav');
    expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(44);

    const updated = await updateRecording(
      new Request(`http://localhost/api/recordings/${recordingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: 'proud', pace: 0.9, volume: 1.2 }),
      }),
      { params: Promise.resolve({ id: recordingId }) },
    );
    expect(updated.status).toBe(200);

    const generationRuns = await db
      .prepare(
        'SELECT operation,provider,model,status,clone_latency_ms,synthesis_latency_ms,total_latency_ms,output_bytes,error_category FROM generation_runs WHERE owner=? ORDER BY created_at',
      )
      .bind('user-a')
      .all<{
        operation: string;
        provider: string;
        model: string;
        status: string;
        clone_latency_ms: number | null;
        synthesis_latency_ms: number | null;
        total_latency_ms: number;
        output_bytes: number;
        error_category: string | null;
      }>();
    expect(generationRuns.results).toHaveLength(2);
    expect(generationRuns.results[0]).toMatchObject({
      operation: 'create',
      provider: 'mock',
      model: 'deterministic-wav-v1',
      status: 'succeeded',
      error_category: null,
    });
    expect(generationRuns.results[0].clone_latency_ms).not.toBeNull();
    expect(generationRuns.results[0].synthesis_latency_ms).not.toBeNull();
    expect(generationRuns.results[0].total_latency_ms).toBeGreaterThanOrEqual(0);
    expect(generationRuns.results[0].output_bytes).toBeGreaterThan(44);
    expect(generationRuns.results[1]).toMatchObject({
      operation: 'update',
      provider: 'mock',
      model: 'deterministic-wav-v1',
      status: 'succeeded',
      clone_latency_ms: null,
      error_category: null,
    });

    const deleted = await deleteRecording(
      new Request(`http://localhost/api/recordings/${recordingId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: recordingId }) },
    );
    expect(deleted.status).toBe(204);

    const missing = await getAudio(new Request(`http://localhost/api/audio/${recordingId}`), {
      params: Promise.resolve({ id: recordingId }),
    });
    expect(missing.status).toBe(404);

    const deletedVoice = await deleteVoice(
      new Request(`http://localhost/api/voices/${voiceId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: voiceId }) },
    );
    expect(deletedVoice.status).toBe(204);
    const emptyLibrary = await getLibrary(new Request('http://localhost/api/library'));
    expect((await emptyLibrary.json()) as { voices: unknown[]; recordings: unknown[] }).toMatchObject({
      voices: [],
      recordings: [],
    });
    const missingOriginal = await getAudio(
      new Request(`http://localhost/api/audio/${originalRecordingId}`),
      { params: Promise.resolve({ id: originalRecordingId }) },
    );
    expect(missingOriginal.status).toBe(404);
    expect(await bucket.get(originalObject!.object_key)).toBeNull();
  });

  it('isolates each user and rejects anonymous access', async () => {
    const form = new FormData();
    form.set('name', 'Private voice');
    form.set('relationship', 'Family');
    form.set('consent', 'yes');
    form.set('audio', audioFixture('private.wav'));
    const created = await createVoice(new Request('http://localhost/api/library', { method: 'POST', body: form }));
    expect(created.status).toBe(201);
    const privateVoiceId = ((await created.json()) as { id: string }).id;

    state.user = { userId: 'user-b', email: 'b@example.test', displayName: 'B', fullName: 'B' };
    const otherLibrary = await getLibrary(new Request('http://localhost/api/library'));
    const otherData = (await otherLibrary.json()) as { voices: unknown[]; recordings: unknown[] };
    expect(otherData.voices).toHaveLength(0);
    expect(otherData.recordings).toHaveLength(0);
    const forbiddenDelete = await deleteVoice(
      new Request(`http://localhost/api/voices/${privateVoiceId}`, { method: 'DELETE' }),
      { params: Promise.resolve({ id: privateVoiceId }) },
    );
    expect(forbiddenDelete.status).toBe(404);

    state.user = null;
    const anonymous = await getLibrary(new Request('http://localhost/api/library'));
    expect(anonymous.status).toBe(401);
  });

  it('translates, localizes, and persists multilingual keepsake provenance', async () => {
    const form = new FormData();
    form.set('name', 'Mom');
    form.set('relationship', 'Mother');
    form.set('consent', 'yes');
    form.set('audio', audioFixture());
    const created = await createVoice(
      new Request('http://localhost/api/library', { method: 'POST', body: form }),
    );
    const voiceId = ((await created.json()) as { id: string }).id;

    const generated = await generateKeepsake(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'You are loved, always.',
          voiceId,
          targetLanguage: 'es',
          mood: 'warm',
          pace: 1,
          volume: 1,
        }),
      }),
    );
    expect(generated.status).toBe(201);
    const recordingId = ((await generated.json()) as { id: string }).id;

    const recording = await db
      .prepare(
        'SELECT transcript,source_transcript,target_language,translation_provider FROM recordings WHERE id=?',
      )
      .bind(recordingId)
      .first<Record<string, string>>();
    expect(recording).toMatchObject({
      transcript: 'Siempre eres una persona amada.',
      source_transcript: 'You are loved, always.',
      target_language: 'es',
      translation_provider: 'mock',
    });
    expect(
      await db
        .prepare('SELECT language FROM voice_variants WHERE voice_id=?')
        .bind(voiceId)
        .first(),
    ).toMatchObject({ language: 'es' });
    expect(
      await db
        .prepare(
          'SELECT target_language,translation_provider,translation_latency_ms,localization_latency_ms,status FROM generation_runs WHERE recording_id=?',
        )
        .bind(recordingId)
        .first(),
    ).toMatchObject({
      target_language: 'es',
      translation_provider: 'mock',
      status: 'succeeded',
    });
  });

  it('records a privacy-safe failure category without storing the requested text', async () => {
    const form = new FormData();
    form.set('name', 'Test voice');
    form.set('relationship', 'Friend');
    form.set('consent', 'yes');
    form.set('audio', audioFixture());
    const created = await createVoice(
      new Request('http://localhost/api/library', { method: 'POST', body: form }),
    );
    const voiceId = ((await created.json()) as { id: string }).id;

    state.env.WITHYOU_TRANSLATION_PROVIDER = 'google';
    state.env.GOOGLE_TRANSLATE_SERVICE_ACCOUNT_JSON = undefined;
    const privateText = 'This text must never be copied into generation telemetry.';
    const response = await generateKeepsake(
      new Request('http://localhost/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: privateText,
          voiceId,
          targetLanguage: 'es',
          mood: 'natural',
          pace: 1,
          volume: 1,
        }),
      }),
    );
    expect(response.status).toBe(503);

    const failedRun = await db
      .prepare(
        'SELECT status,error_category,input_characters,translation_latency_ms FROM generation_runs WHERE voice_id=?',
      )
      .bind(voiceId)
      .first<{
        status: string;
        error_category: string;
        input_characters: number;
        translation_latency_ms: number | null;
      }>();
    expect(failedRun).toMatchObject({
      status: 'failed',
      error_category: 'dependency',
      input_characters: privateText.length,
    });
    expect(failedRun!.translation_latency_ms).not.toBeNull();
    expect(JSON.stringify(failedRun)).not.toContain(privateText);
  });

  it('rejects cross-origin writes before changing storage', async () => {
    const form = new FormData();
    form.set('name', 'Blocked');
    form.set('relationship', 'Family');
    form.set('consent', 'yes');
    form.set('audio', audioFixture());
    const response = await createVoice(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { Origin: 'https://attacker.example' },
        body: form,
      }),
    );
    expect(response.status).toBe(403);
    const library = await getLibrary(new Request('http://localhost/api/library'));
    expect(((await library.json()) as { voices: unknown[] }).voices).toHaveLength(0);
  });

  it('rate limits repeated recording uploads without storing raw IP addresses', async () => {
    for (let index = 0; index < 20; index += 1) {
      const form = new FormData();
      form.set('name', `Voice ${index}`);
      form.set('relationship', 'Test');
      form.set('consent', 'yes');
      form.set('audio', audioFixture(`voice-${index}.wav`));
      const response = await createVoice(
        new Request('http://localhost/api/library', {
          method: 'POST',
          headers: { 'cf-connecting-ip': '203.0.113.7' },
          body: form,
        }),
      );
      expect(response.status).toBe(201);
    }

    const blockedForm = new FormData();
    blockedForm.set('name', 'Blocked voice');
    blockedForm.set('relationship', 'Test');
    blockedForm.set('consent', 'yes');
    blockedForm.set('audio', audioFixture('blocked.wav'));
    const blocked = await createVoice(
      new Request('http://localhost/api/library', {
        method: 'POST',
        headers: { 'cf-connecting-ip': '203.0.113.7' },
        body: blockedForm,
      }),
    );
    expect(blocked.status).toBe(429);
    expect(await db.prepare("SELECT key FROM request_limits WHERE key LIKE '%203.0.113.7%'").first()).toBeNull();
  });
});
