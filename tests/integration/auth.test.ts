import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import { createTestRuntime } from '@/tests/helpers/test-runtime';

const state = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('cloudflare:workers', () => ({ env: state.env }));

import { POST as authPost } from '@/app/api/auth/[...all]/route';
import { GET as authGet } from '@/app/api/auth/[...all]/route';

describe('authentication API', () => {
  let runtime: Miniflare;

  beforeAll(async () => {
    const testRuntime = await createTestRuntime();
    runtime = testRuntime.runtime;
    Object.assign(state.env, {
      DB: testRuntime.db,
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
});
