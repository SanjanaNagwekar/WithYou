import { execFileSync } from 'node:child_process';
import { rmSync } from 'node:fs';
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
