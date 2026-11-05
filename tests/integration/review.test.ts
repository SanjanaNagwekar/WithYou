import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Miniflare } from 'miniflare';
import { createTestRuntime, minimalWav } from '../helpers/test-runtime';

const state = vi.hoisted(() => ({ env: {} as Record<string, unknown> }));
vi.mock('cloudflare:workers', () => ({ env: state.env }));

import { GET as getReview, POST as saveReview } from '@/app/api/review/[token]/route';
import { GET as getReviewAudio } from '@/app/api/review/[token]/audio/[itemId]/[slot]/route';
import { hashReviewToken } from '@/lib/review-survey';

const token = 'private-review-token-1234567890abcd';

describe('private pairwise review API', () => {
  let runtime: Miniflare | undefined;
  let db: Awaited<ReturnType<typeof createTestRuntime>>['db'];

  beforeEach(async () => {
    const testRuntime = await createTestRuntime();
    runtime = testRuntime.runtime;
    db = testRuntime.db;
    Object.assign(state.env, { DB: testRuntime.db, BUCKET: testRuntime.bucket });
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO benchmark_review_surveys VALUES ('survey-1','run-1','Blind comparison','active',?)").bind(now).run();
    await db.prepare("INSERT INTO benchmark_review_invites VALUES ('invite-1','survey-1','Reviewer 1',?,?,NULL)").bind(await hashReviewToken(token), now).run();
    await db.prepare(
      `INSERT INTO benchmark_review_items VALUES
       ('item-1','invite-1',1,'case-1','S01','A familiar voice can make the day feel calmer.',
        'reviews/reference.wav','reviews/a.wav','reviews/b.wav','cartesia','elevenlabs',?)`,
    ).bind(now).run();
    for (const key of ['reviews/reference.wav', 'reviews/a.wav', 'reviews/b.wav']) {
      await testRuntime.bucket.put(key, minimalWav(), { httpMetadata: { contentType: 'audio/wav' } });
    }
  });

  afterEach(async () => {
    await runtime?.dispose();
    for (const key of Object.keys(state.env)) delete state.env[key];
  });

  it('returns anonymous comparisons without exposing provider identities', async () => {
    const response = await getReview(new Request(`http://localhost/api/review/${token}`), {
      params: Promise.resolve({ token }),
    });
    expect(response.status).toBe(200);
    const body = await response.json() as { items: Array<{ audio: Record<string, string> }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].audio).toEqual({
      reference: `/api/review/${token}/audio/item-1/reference`,
      a: `/api/review/${token}/audio/item-1/a`,
      b: `/api/review/${token}/audio/item-1/b`,
    });
    const serialized = JSON.stringify(body).toLowerCase();
    expect(serialized).not.toContain('cartesia');
    expect(serialized).not.toContain('elevenlabs');
    expect(serialized).not.toContain('candidate_a_provider');
  });

  it('serves only audio belonging to the private invite', async () => {
    const response = await getReviewAudio(new Request(`http://localhost/api/review/${token}/audio/item-1/a`), {
      params: Promise.resolve({ token, itemId: 'item-1', slot: 'a' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/wav');
    expect(response.headers.get('cache-control')).toContain('no-store');

    const denied = await getReviewAudio(new Request(`http://localhost/api/review/${token}/audio/other/a`), {
      params: Promise.resolve({ token, itemId: 'other', slot: 'a' }),
    });
    expect(denied.status).toBe(404);
  });

  it('saves, resumes, and protects responses against cross-origin submission', async () => {
    const saved = await saveReview(new Request(`http://localhost/api/review/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost' },
      body: JSON.stringify({ itemId: 'item-1', similarity: 'a', naturalness: 'tie', pronunciation: 'b' }),
    }), { params: Promise.resolve({ token }) });
    expect(saved.status).toBe(200);

    const resumed = await getReview(new Request(`http://localhost/api/review/${token}`), {
      params: Promise.resolve({ token }),
    });
    const body = await resumed.json() as { completed: number; items: Array<{ response: unknown }> };
    expect(body.completed).toBe(1);
    expect(body.items[0].response).toEqual({ similarity: 'a', naturalness: 'tie', pronunciation: 'b' });

    const denied = await saveReview(new Request(`http://localhost/api/review/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://attacker.example' },
      body: JSON.stringify({ itemId: 'item-1', similarity: 'a', naturalness: 'a', pronunciation: 'a' }),
    }), { params: Promise.resolve({ token }) });
    expect(denied.status).toBe(403);
  });
});
