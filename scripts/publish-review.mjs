import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, '').split('=');
  return [key, rest.length ? rest.join('=') : true];
}));
const runId = String(args.get('run-id') || '');
const reviewerCount = Number(args.get('reviewers') || 3);
const execute = args.has('execute');
const production = args.has('production');

if (!/^[A-Za-z0-9._-]{3,100}$/.test(runId)) throw new Error('Pass a valid --run-id=<private-run-id>.');
if (!Number.isInteger(reviewerCount) || reviewerCount < 1 || reviewerCount > 20) throw new Error('--reviewers must be between 1 and 20.');

const reviewRoot = path.join(root, 'benchmarks', 'private', 'runs', runId, 'analysis', 'listening-review-v1');
const answerKeyPath = path.join(reviewRoot, 'answer-key.json');
const rowsPath = path.join(reviewRoot, 'reviewer-01.csv');
const privateOutput = path.join(reviewRoot, 'pairwise-survey-v1', 'private-links.json');
const deployment = JSON.parse(await readFile(path.join(root, 'deployment.json'), 'utf8'));
const answerKey = JSON.parse(await readFile(answerKeyPath, 'utf8'));
const rows = parseCsv(await readFile(rowsPath, 'utf8'));
const rowByItem = new Map(rows.map((row) => [row.itemId, row]));
const grouped = new Map();

for (const entry of answerKey.items || []) {
  const row = rowByItem.get(entry.itemId);
  if (!row) throw new Error(`Review metadata is missing for opaque item ${entry.itemId}.`);
  const group = grouped.get(entry.caseId) || [];
  group.push({ ...entry, ...row });
  grouped.set(entry.caseId, group);
}
const cases = [...grouped.entries()].map(([caseId, candidates]) => {
  if (candidates.length !== 2) throw new Error(`Case ${caseId} must have exactly two candidates.`);
  return { caseId, candidates };
});
if (!cases.length) throw new Error('No paired review cases were found.');

const surveyId = `survey_${digest(runId).slice(0, 20)}`;
const baseUrl = production ? deployment.production.url : 'http://127.0.0.1:8787';
let manifest;
try {
  manifest = JSON.parse(await readFile(privateOutput, 'utf8'));
  if (manifest.runId !== runId || manifest.reviewers.length !== reviewerCount) {
    throw new Error('The existing private link manifest does not match this run or reviewer count.');
  }
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
  manifest = {
    schemaVersion: 1,
    surveyId,
    runId,
    createdAt: new Date().toISOString(),
    reviewers: Array.from({ length: reviewerCount }, (_, index) => {
      const token = randomBytes(32).toString('base64url');
      return {
        inviteId: `invite_${digest(`${surveyId}:${index + 1}`).slice(0, 20)}`,
        reviewerLabel: `Reviewer ${index + 1}`,
        token,
        tokenHash: digest(token),
        url: `${baseUrl}/review/${token}`,
      };
    }),
  };
  await mkdir(path.dirname(privateOutput), { recursive: true });
  await writeFile(privateOutput, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
}
manifest.reviewers = manifest.reviewers.map((reviewer) => ({
  ...reviewer,
  url: `${baseUrl}/review/${reviewer.token}`,
}));
await writeFile(privateOutput, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const createdAt = manifest.createdAt;
const audio = new Map();
const sql = [
  `INSERT INTO benchmark_review_surveys (id,run_id,title,status,created_at) VALUES (${q(surveyId)},${q(runId)},${q('WithYou blind voice comparison')},'active',${q(createdAt)}) ON CONFLICT(id) DO UPDATE SET title=excluded.title,status='active';`,
];

for (const [reviewerIndex, reviewer] of manifest.reviewers.entries()) {
  sql.push(`INSERT INTO benchmark_review_invites (id,survey_id,reviewer_label,token_hash,created_at) VALUES (${q(reviewer.inviteId)},${q(surveyId)},${q(reviewer.reviewerLabel)},${q(reviewer.tokenHash)},${q(createdAt)}) ON CONFLICT(id) DO UPDATE SET reviewer_label=excluded.reviewer_label,token_hash=excluded.token_hash;`);
  const ordered = seededShuffle(cases, `${surveyId}:${reviewerIndex}:order`);
  ordered.forEach(({ caseId, candidates }, position) => {
    const flip = Number.parseInt(digest(`${surveyId}:${reviewerIndex}:${caseId}`).slice(0, 2), 16) % 2 === 1;
    const [a, b] = flip ? [candidates[1], candidates[0]] : candidates;
    const reference = registerAudio(audio, reviewRoot, a.referenceAudio, surveyId);
    const candidateA = registerAudio(audio, reviewRoot, a.candidateAudio, surveyId);
    const candidateB = registerAudio(audio, reviewRoot, b.candidateAudio, surveyId);
    const itemId = `review_${digest(`${reviewer.inviteId}:${caseId}`).slice(0, 22)}`;
    sql.push(`INSERT INTO benchmark_review_items (id,invite_id,position,case_id,speaker_id,prompt_text,reference_key,candidate_a_key,candidate_b_key,candidate_a_provider,candidate_b_provider,created_at) VALUES (${q(itemId)},${q(reviewer.inviteId)},${position + 1},${q(caseId)},${q(a.speakerId)},${q(a.promptText)},${q(reference.key)},${q(candidateA.key)},${q(candidateB.key)},${q(a.provider)},${q(b.provider)},${q(createdAt)}) ON CONFLICT(id) DO UPDATE SET position=excluded.position,prompt_text=excluded.prompt_text,reference_key=excluded.reference_key,candidate_a_key=excluded.candidate_a_key,candidate_b_key=excluded.candidate_b_key,candidate_a_provider=excluded.candidate_a_provider,candidate_b_provider=excluded.candidate_b_provider;`);
  });
}

console.log(`Prepared ${cases.length} anonymous A/B comparisons for ${reviewerCount} reviewers.`);
console.log(`Private reviewer links: ${path.relative(root, privateOutput)}`);
if (!execute) {
  console.log('Dry run only. Add --execute after applying migration 0007 and deploying the survey UI.');
  process.exit(0);
}

const wrangler = path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const configArgs = production
  ? ['--remote']
  : ['--local', '--config', path.join(root, 'dist', 'server', 'wrangler.json'), '--persist-to', path.join(root, '.wrangler', 'state')];
const bucket = production ? deployment.production.r2BucketName : 'withyou-audio';
const database = production ? deployment.production.d1DatabaseName : 'DB';
let uploaded = 0;
for (const value of audio.values()) {
  execFileSync(process.execPath, [wrangler, 'r2', 'object', 'put', `${bucket}/${value.key}`, '--file', value.file, '--content-type', 'audio/wav', ...configArgs], { cwd: root, stdio: 'ignore' });
  uploaded += 1;
  if (uploaded % 10 === 0 || uploaded === audio.size) console.log(`Uploaded ${uploaded}/${audio.size} private audio objects.`);
}
const temporary = await mkdtemp(path.join(tmpdir(), 'withyou-review-'));
const sqlFile = path.join(temporary, 'seed.sql');
await writeFile(sqlFile, `BEGIN;\n${sql.join('\n')}\nCOMMIT;\n`);
execFileSync(process.execPath, [wrangler, 'd1', 'execute', database, '--file', sqlFile, '--yes', ...configArgs], { cwd: root, stdio: 'inherit' });
console.log('Survey published. Share one private URL per reviewer from the ignored link manifest.');

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function q(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function registerAudio(map, base, relative, id) {
  const file = path.resolve(base, relative);
  if (!file.startsWith(`${path.resolve(base)}${path.sep}`)) throw new Error('Review audio path escaped its private package.');
  const name = path.basename(file);
  const key = `benchmark-reviews/${id}/audio/${name}`;
  map.set(key, { key, file });
  return { key, file };
}

function seededShuffle(values, seed) {
  return values
    .map((value, index) => ({ value, rank: digest(`${seed}:${index}`) }))
    .sort((left, right) => left.rank.localeCompare(right.rank))
    .map(({ value }) => value);
}

function parseCsv(input) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ',') { record.push(field); field = ''; }
    else if (character === '\n') { record.push(field.replace(/\r$/, '')); records.push(record); record = []; field = ''; }
    else field += character;
  }
  if (field || record.length) { record.push(field.replace(/\r$/, '')); records.push(record); }
  const [headers, ...rows] = records.filter((candidate) => candidate.some(Boolean));
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}
