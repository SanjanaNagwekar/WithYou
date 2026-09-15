import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

const migrations = ['../../drizzle/0000_new_makkari.sql', '../../drizzle/0001_bizarre_cardiac.sql'];

export async function createTestRuntime() {
  const runtime = new Miniflare({
    modules: true,
    script: 'export default { fetch() { return new Response("test runtime") } }',
    d1Databases: ['DB'],
    r2Buckets: ['BUCKET'],
  });
  const db = await runtime.getD1Database('DB');
  const bucket = await runtime.getR2Bucket('BUCKET');

  for (const migration of migrations) {
    const sql = await readFile(fileURLToPath(new URL(migration, import.meta.url)), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map((part) => part.trim())) {
      if (statement) await db.prepare(statement).run();
    }
  }
  return { runtime, db, bucket };
}

export function audioFixture(name = 'sample.wav') {
  return new File([minimalWav()], name, { type: 'audio/wav' });
}

export function minimalWav(): ArrayBuffer {
  return Uint8Array.from([
    82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
    16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0,
    2, 0, 16, 0, 100, 97, 116, 97, 0, 0, 0, 0,
  ]).buffer;
}
