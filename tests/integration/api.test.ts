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
});
