import { env } from 'cloudflare:workers';
import { AppError } from '@/lib/errors';

export const reviewChoices = ['a', 'b', 'tie'] as const;
export type ReviewChoice = (typeof reviewChoices)[number];

export type ReviewAccess = {
  db: D1Database;
  bucket: R2Bucket;
  inviteId: string;
  surveyId: string;
  title: string;
  reviewerLabel: string;
};

export function isReviewChoice(value: unknown): value is ReviewChoice {
  return typeof value === 'string' && reviewChoices.includes(value as ReviewChoice);
}

export function isReviewToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{24,128}$/.test(value);
}

export async function hashReviewToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function reviewAccess(token: string): Promise<ReviewAccess> {
  if (!isReviewToken(token)) throw new AppError('This private review link is invalid.', 404);
  if (!env.DB || !env.BUCKET) throw new AppError('The review is temporarily unavailable.', 503);
  const tokenHash = await hashReviewToken(token);
  const invite = await env.DB.prepare(
    `SELECT i.id AS invite_id,i.survey_id,i.reviewer_label,s.title
     FROM benchmark_review_invites i
     JOIN benchmark_review_surveys s ON s.id=i.survey_id
     WHERE i.token_hash=? AND s.status='active'`,
  )
    .bind(tokenHash)
    .first<{ invite_id: string; survey_id: string; reviewer_label: string; title: string }>();
  if (!invite) throw new AppError('This private review link is invalid or closed.', 404);
  return {
    db: env.DB,
    bucket: env.BUCKET,
    inviteId: invite.invite_id,
    surveyId: invite.survey_id,
    title: invite.title,
    reviewerLabel: invite.reviewer_label,
  };
}

export function reviewFailure(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json(
      { error: error.message },
      { status: error.status, headers: reviewHeaders() },
    );
  }
  console.error('WithYou review request failed', error instanceof Error ? error.message : 'Unknown error');
  return Response.json(
    { error: 'The review could not be loaded. Please try again.' },
    { status: 503, headers: reviewHeaders() },
  );
}

export function reviewHeaders(): HeadersInit {
  return {
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
  };
}
