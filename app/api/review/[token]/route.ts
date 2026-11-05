import { AppError } from '@/lib/errors';
import {
  isReviewChoice,
  reviewAccess,
  reviewFailure,
  reviewHeaders,
  type ReviewChoice,
} from '@/lib/review-survey';

type ReviewItemRow = {
  id: string;
  position: number;
  prompt_text: string;
  similarity_choice: ReviewChoice | null;
  naturalness_choice: ReviewChoice | null;
  pronunciation_choice: ReviewChoice | null;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;
    const access = await reviewAccess(token);
    const rows = await access.db
      .prepare(
        `SELECT i.id,i.position,i.prompt_text,
                r.similarity_choice,r.naturalness_choice,r.pronunciation_choice
         FROM benchmark_review_items i
         LEFT JOIN benchmark_review_responses r ON r.item_id=i.id AND r.invite_id=i.invite_id
         WHERE i.invite_id=? ORDER BY i.position`,
      )
      .bind(access.inviteId)
      .all<ReviewItemRow>();
    if (!rows.results.length) throw new AppError('This review does not have any comparisons yet.', 404);
    const items = rows.results.map((item) => ({
      id: item.id,
      position: item.position,
      promptText: item.prompt_text,
      audio: {
        reference: `/api/review/${token}/audio/${item.id}/reference`,
        a: `/api/review/${token}/audio/${item.id}/a`,
        b: `/api/review/${token}/audio/${item.id}/b`,
      },
      response:
        item.similarity_choice && item.naturalness_choice && item.pronunciation_choice
          ? {
              similarity: item.similarity_choice,
              naturalness: item.naturalness_choice,
              pronunciation: item.pronunciation_choice,
            }
          : null,
    }));
    return Response.json(
      {
        title: access.title,
        reviewerLabel: access.reviewerLabel,
        completed: items.filter((item) => item.response).length,
        total: items.length,
        items,
      },
      { headers: reviewHeaders() },
    );
  } catch (error) {
    return reviewFailure(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin) {
      throw new AppError('Request origin is not allowed.', 403);
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 4096) throw new AppError('The review response is too large.', 413);
    const { token } = await params;
    const access = await reviewAccess(token);
    const body = (await request.json()) as Record<string, unknown>;
    const itemId = typeof body.itemId === 'string' ? body.itemId : '';
    if (
      !itemId ||
      !isReviewChoice(body.similarity) ||
      !isReviewChoice(body.naturalness) ||
      !isReviewChoice(body.pronunciation)
    ) {
      throw new AppError('Choose an answer for all three comparisons.', 400);
    }
    const item = await access.db
      .prepare('SELECT id FROM benchmark_review_items WHERE id=? AND invite_id=?')
      .bind(itemId, access.inviteId)
      .first<{ id: string }>();
    if (!item) throw new AppError('This comparison is not part of your review.', 404);
    const now = new Date().toISOString();
    await access.db
      .prepare(
        `INSERT INTO benchmark_review_responses
           (id,invite_id,item_id,similarity_choice,naturalness_choice,pronunciation_choice,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?)
         ON CONFLICT(invite_id,item_id) DO UPDATE SET
           similarity_choice=excluded.similarity_choice,
           naturalness_choice=excluded.naturalness_choice,
           pronunciation_choice=excluded.pronunciation_choice,
           updated_at=excluded.updated_at`,
      )
      .bind(
        crypto.randomUUID(),
        access.inviteId,
        itemId,
        body.similarity,
        body.naturalness,
        body.pronunciation,
        now,
        now,
      )
      .run();
    const counts = await access.db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM benchmark_review_items WHERE invite_id=?) AS total,
           (SELECT COUNT(*) FROM benchmark_review_responses WHERE invite_id=?) AS completed`,
      )
      .bind(access.inviteId, access.inviteId)
      .first<{ total: number; completed: number }>();
    if (counts && counts.completed >= counts.total) {
      await access.db
        .prepare('UPDATE benchmark_review_invites SET completed_at=COALESCE(completed_at,?) WHERE id=?')
        .bind(now, access.inviteId)
        .run();
    }
    return Response.json(
      { saved: true, completed: counts?.completed || 0, total: counts?.total || 0 },
      { headers: reviewHeaders() },
    );
  } catch (error) {
    return reviewFailure(error);
  }
}
