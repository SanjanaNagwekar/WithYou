import { env } from 'cloudflare:workers';

export type AccountProvider = 'credential' | 'google' | string;

export async function accountProviders(userId: string): Promise<AccountProvider[]> {
  if (!env.DB) throw new Error('Cloudflare D1 binding `DB` is unavailable.');
  const result = await env.DB.prepare(
    'SELECT providerId FROM account WHERE userId = ? ORDER BY providerId',
  )
    .bind(userId)
    .all<{ providerId: string }>();
  return result.results.map((row) => row.providerId);
}

export async function deleteOwnedUserData(userId: string): Promise<void> {
  if (!env.DB || !env.BUCKET) {
    throw new Error('Account storage is unavailable.');
  }

  const objects = await env.DB.prepare('SELECT object_key AS objectKey FROM recordings WHERE owner = ?')
    .bind(userId)
    .all<{ objectKey: string }>();
  const keys = objects.results.map((row) => row.objectKey);
  for (let index = 0; index < keys.length; index += 1000) {
    await env.BUCKET.delete(keys.slice(index, index + 1000));
  }

  await env.DB.batch([
    env.DB.prepare(
      'DELETE FROM generation_locks WHERE voice_id IN (SELECT id FROM voices WHERE owner = ?)',
    ).bind(userId),
    env.DB.prepare('DELETE FROM generation_events WHERE owner = ?').bind(userId),
    env.DB.prepare('DELETE FROM recordings WHERE owner = ?').bind(userId),
    env.DB.prepare('DELETE FROM voices WHERE owner = ?').bind(userId),
  ]);
}
