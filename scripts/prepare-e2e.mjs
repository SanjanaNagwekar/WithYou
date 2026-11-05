import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const statePath = fileURLToPath(new URL('../.wrangler/e2e-state', import.meta.url));
const wrangler = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const config = fileURLToPath(new URL('../dist/server/wrangler.json', import.meta.url));
const migrations = [
  fileURLToPath(new URL('../drizzle/0000_new_makkari.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0001_bizarre_cardiac.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0002_dark_thunderball.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0003_auth_rate_limits.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0004_low_molly_hayes.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0005_public_pilot_limits.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0006_benchmark_foundation.sql', import.meta.url)),
  fileURLToPath(new URL('../drizzle/0007_pairwise_review.sql', import.meta.url)),
];

rmSync(statePath, { recursive: true, force: true });
for (const migration of migrations) {
  execFileSync(
    process.execPath,
    [
      wrangler,
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      config,
      '--persist-to',
      statePath,
      '--file',
      migration,
    ],
    { cwd: projectRoot, stdio: 'inherit' },
  );
}

const reviewToken = 'e2e-private-review-token-1234567890';
const tokenHash = createHash('sha256').update(reviewToken).digest('hex');
const reviewAudio = fileURLToPath(new URL('../.wrangler/e2e-review.wav', import.meta.url));
mkdirSync(fileURLToPath(new URL('../.wrangler', import.meta.url)), { recursive: true });
writeFileSync(reviewAudio, Buffer.from([
  82, 73, 70, 70, 36, 0, 0, 0, 87, 65, 86, 69, 102, 109, 116, 32,
  16, 0, 0, 0, 1, 0, 1, 0, 64, 31, 0, 0, 128, 62, 0, 0,
  2, 0, 16, 0, 100, 97, 116, 97, 0, 0, 0, 0,
]));
for (const key of ['review-e2e/reference.wav', 'review-e2e/a.wav', 'review-e2e/b.wav']) {
  execFileSync(process.execPath, [
    wrangler, 'r2', 'object', 'put', `withyou-audio/${key}`, '--local', '--config', config,
    '--persist-to', statePath, '--file', reviewAudio, '--content-type', 'audio/wav',
  ], { cwd: projectRoot, stdio: 'inherit' });
}
const seedSql = `
INSERT INTO benchmark_review_surveys VALUES ('e2e-survey','e2e-run','E2E blind comparison','active','2026-01-01T00:00:00.000Z');
INSERT INTO benchmark_review_invites VALUES ('e2e-invite','e2e-survey','E2E reviewer','${tokenHash}','2026-01-01T00:00:00.000Z',NULL);
INSERT INTO benchmark_review_items VALUES ('e2e-item','e2e-invite',1,'e2e-case','S01','A familiar voice can make the day feel calmer.','review-e2e/reference.wav','review-e2e/a.wav','review-e2e/b.wav','provider-one','provider-two','2026-01-01T00:00:00.000Z');`;
execFileSync(process.execPath, [
  wrangler, 'd1', 'execute', 'DB', '--local', '--config', config, '--persist-to', statePath,
  '--command', seedSql,
], { cwd: projectRoot, stdio: 'inherit' });
rmSync(reviewAudio, { force: true });
