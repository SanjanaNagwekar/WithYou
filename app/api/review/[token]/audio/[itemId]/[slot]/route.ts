import { AppError } from '@/lib/errors';
import { reviewAccess, reviewFailure, reviewHeaders } from '@/lib/review-survey';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; itemId: string; slot: string }> },
) {
  try {
    const { token, itemId, slot } = await params;
    if (!['reference', 'a', 'b'].includes(slot)) throw new AppError('Audio not found.', 404);
    const access = await reviewAccess(token);
    const item = await access.db
      .prepare(
        `SELECT reference_key,candidate_a_key,candidate_b_key
         FROM benchmark_review_items WHERE id=? AND invite_id=?`,
      )
      .bind(itemId, access.inviteId)
      .first<{ reference_key: string; candidate_a_key: string; candidate_b_key: string }>();
    if (!item) throw new AppError('Audio not found.', 404);
    const key =
      slot === 'reference'
        ? item.reference_key
        : slot === 'a'
          ? item.candidate_a_key
          : item.candidate_b_key;
    const audio = await access.bucket.get(key);
    if (!audio) throw new AppError('Audio is temporarily unavailable.', 404);
    const headers = new Headers(reviewHeaders());
    headers.set('Content-Type', audio.httpMetadata?.contentType || 'audio/wav');
    headers.set('Content-Length', String(audio.size));
    headers.set('Content-Disposition', `inline; filename="review-${slot}.wav"`);
    return new Response(audio.body, { headers });
  } catch (error) {
    return reviewFailure(error);
  }
}
