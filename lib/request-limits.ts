import { AppError } from '@/lib/errors';

const UPLOAD_WINDOW_SECONDS = 60 * 60;
const UPLOAD_ATTEMPTS_PER_WINDOW = 20;

export async function enforceUploadLimit(
  request: Request,
  db: D1Database,
  owner: string,
): Promise<void> {
  const address =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const identity = await fingerprint(`${owner}:${address}`);
  const now = Math.floor(Date.now() / 1000);
  const boundary = now - UPLOAD_WINDOW_SECONDS;
  const result = await db
    .prepare(
      `INSERT INTO request_limits(key,count,window_start) VALUES(?,1,?)
       ON CONFLICT(key) DO UPDATE SET
         count=CASE WHEN request_limits.window_start<? THEN 1 ELSE request_limits.count+1 END,
         window_start=CASE WHEN request_limits.window_start<? THEN excluded.window_start ELSE request_limits.window_start END
       RETURNING count`,
    )
    .bind(`upload:${identity}`, now, boundary, boundary)
    .first<{ count: number }>();
  if ((result?.count ?? UPLOAD_ATTEMPTS_PER_WINDOW + 1) > UPLOAD_ATTEMPTS_PER_WINDOW) {
    throw new AppError('Too many recording uploads. Please try again later.', 429);
  }
}

async function fingerprint(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 16), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
