import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import { createTestRuntime } from '@/tests/helpers/test-runtime';

const state = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('cloudflare:workers', () => ({ env: state.env }));

import { POST as authPost } from '@/app/api/auth/[...all]/route';
import { GET as authGet } from '@/app/api/auth/[...all]/route';

describe('authentication API', () => {
  let runtime: Miniflare;
  let db: D1Database;
  let bucket: Awaited<ReturnType<typeof createTestRuntime>>['bucket'];

  beforeAll(async () => {
    const testRuntime = await createTestRuntime();
    runtime = testRuntime.runtime;
    db = testRuntime.db;
    bucket = testRuntime.bucket;
    Object.assign(state.env, {
      DB: db,
      BUCKET: bucket,
      BETTER_AUTH_SECRET: 'integration-test-secret-with-at-least-32-characters',
      BETTER_AUTH_URL: 'http://localhost',
      GOOGLE_CLIENT_ID: 'test-google-client-id',
      GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    });
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  it('creates an account, issues a session, and signs back in with a password', async () => {
    const registration = await authPost(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Sanjana',
          email: 'sanjana@example.test',
          password: 'secure-password',
        }),
      }),
    );

    expect(registration.status).toBe(200);
    const registrationBody = (await registration.json()) as { user: { email: string } };
    expect(registrationBody.user.email).toBe('sanjana@example.test');

    const sessionCookie = registration.headers.get('set-cookie');
    expect(sessionCookie).toContain('better-auth.session_token');
    const session = await authGet(
      new Request('http://localhost/api/auth/get-session', {
        headers: { Cookie: sessionCookie || '' },
      }),
    );
    expect(session.status).toBe(200);
    expect(((await session.json()) as { user: { name: string } }).user.name).toBe('Sanjana');

    const signIn = await authPost(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sanjana@example.test', password: 'secure-password' }),
      }),
    );
    expect(signIn.status).toBe(200);
    expect(signIn.headers.get('set-cookie')).toContain('better-auth.session_token');
  });

  it('starts the Google OAuth flow when provider credentials are configured', async () => {
    const response = await authPost(
      new Request('http://localhost/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
      }),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { redirect: boolean; url: string };
    expect(body.redirect).toBe(true);
    expect(new URL(body.url).origin).toBe('https://accounts.google.com');
  });

  it('updates a profile, changes a password, revokes sessions, and deletes all owned data', async () => {
    const email = 'account-lifecycle@example.test';
    const registration = await authPost(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Original Name', email, password: 'original-password' }),
      }),
    );
    let cookie = registration.headers.get('set-cookie') || '';
    expect(cookie).toContain('better-auth.session_token');

    const update = await authPost(
      new Request('http://localhost/api/auth/update-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ name: 'Updated Name' }),
      }),
    );
    expect(update.status).toBe(200);
    expect(
      (await db.prepare('SELECT name FROM user WHERE email = ?').bind(email).first<{ name: string }>())
        ?.name,
    ).toBe('Updated Name');

    const changePassword = await authPost(
      new Request('http://localhost/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({
          currentPassword: 'original-password',
          newPassword: 'replacement-password',
          revokeOtherSessions: true,
        }),
      }),
    );
    expect(changePassword.status).toBe(200);
    cookie = changePassword.headers.get('set-cookie') || cookie;

    const oldPassword = await authPost(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'original-password' }),
      }),
    );
    expect(oldPassword.status).toBe(401);
    const newPassword = await authPost(
      new Request('http://localhost/api/auth/sign-in/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'replacement-password' }),
      }),
    );
    expect(newPassword.status).toBe(200);

    const user = await db.prepare('SELECT id FROM user WHERE email = ?').bind(email).first<{ id: string }>();
    expect(user).not.toBeNull();
    const voiceId = crypto.randomUUID();
    const recordingId = crypto.randomUUID();
    const objectKey = `users/${user!.id}/recordings/${recordingId}.wav`;
    await db.batch([
      db.prepare('INSERT INTO voices (id, owner, name, relationship, consent_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(
        voiceId,
        user!.id,
        'Test Voice',
        'Family',
        new Date().toISOString(),
        new Date().toISOString(),
      ),
      db.prepare('INSERT INTO recordings (id, owner, voice_id, name, kind, object_key, mime, transcript, mood, pace, volume, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(
        recordingId,
        user!.id,
        voiceId,
        'Test recording',
        'original',
        objectKey,
        'audio/wav',
        '',
        'natural',
        1,
        1,
        new Date().toISOString(),
        new Date().toISOString(),
      ),
    ]);
    await bucket.put(objectKey, new Uint8Array([1, 2, 3]));

    const deletion = await authPost(
      new Request('http://localhost/api/auth/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ password: 'replacement-password' }),
      }),
    );
    expect(deletion.status).toBe(200);
    expect(await db.prepare('SELECT id FROM user WHERE id = ?').bind(user!.id).first()).toBeNull();
    expect(await db.prepare('SELECT id FROM recordings WHERE owner = ?').bind(user!.id).first()).toBeNull();
    expect(await bucket.get(objectKey)).toBeNull();
  });
});
