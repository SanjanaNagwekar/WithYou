import { spawnSync } from 'node:child_process';
import { access, chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  benchmarkProviders,
  buildBenchmarkCases,
  parseParticipantManifest,
  sha256Hex,
  validateParticipant,
  type BenchmarkCase,
  type BenchmarkPromptSet,
  type BenchmarkProvider,
  type ParticipantManifestRow,
} from '@/lib/benchmark-plan';
import { parseBenchmarkEnvironment } from '@/lib/config';
import { CartesiaVoiceProvider } from '@/lib/providers/cartesia';
import { ElevenLabsVoiceProvider } from '@/lib/providers/elevenlabs';
import type { VoiceProvider } from '@/lib/providers/voice-provider';

const root = process.cwd();
const privateRoot = path.join(root, 'benchmarks/private');
const audioRoot = path.join(privateRoot, 'audio');
const manifestPath = path.join(privateRoot, 'manifests/collection-manifest.csv');
const consentRoot = path.join(privateRoot, 'consent');
const promptSetPath = path.join(root, 'benchmarks/prompts/v1.json');
const defaultRunId = 'english-v1-cartesia-sonic36-eleven-v4';
const pinnedCartesiaModel = 'sonic-3.6-2026-08-27';

type Mode = 'dry-run' | 'execute' | 'cleanup';

type AudioInspection = {
  sha256: string;
  durationSeconds: number;
  codec: string;
  sampleRate: number;
  channels: number;
  bytes: number;
};

type PlannedParticipant = {
  speakerId: string;
  enrollmentFile: string;
  referenceFile: string;
  enrollment: AudioInspection;
  reference: AudioInspection;
};

type BenchmarkPlan = {
  schemaVersion: 1;
  runId: string;
  createdAt: string;
  promptSetVersion: string;
  language: string;
  models: Record<BenchmarkProvider, string>;
  preprocessing: 'none';
  participants: PlannedParticipant[];
  cases: BenchmarkCase[];
  totalOutputs: number;
  totalCharacters: number;
  warnings: string[];
};

type CloneCheckpoint = {
  id: string | null;
  status: 'ready' | 'verification-required' | 'deleted';
  requiresVerification: boolean;
  createdAt: string;
  deletedAt?: string;
};

type OutputCheckpoint = {
  status: 'started' | 'succeeded' | 'failed';
  path?: string;
  bytes?: number;
  latencyMs?: number;
  errorCategory?: string;
  updatedAt: string;
};

type BenchmarkState = {
  schemaVersion: 1;
  runId: string;
  planSha256: string;
  status: 'running' | 'completed' | 'failed' | 'cleaned';
  models: Record<BenchmarkProvider, string>;
  clones: Record<string, Partial<Record<BenchmarkProvider, CloneCheckpoint>>>;
  outputs: Record<string, OutputCheckpoint>;
  createdAt: string;
  updatedAt: string;
};

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const env = await readEnvironment(path.join(root, '.env'));
  const models: Record<BenchmarkProvider, string> = {
    cartesia: env.BENCHMARK_CARTESIA_MODEL_ID || pinnedCartesiaModel,
    elevenlabs: parseBenchmarkEnvironment(env).ELEVENLABS_MODEL_ID,
  };
  assertCredential(env.CARTESIA_API_KEY, 'CARTESIA_API_KEY');
  assertCredential(env.ELEVENLABS_API_KEY, 'ELEVENLABS_API_KEY');

  const plan = await createPlan(options.runId, models);
  const runRoot = path.join(privateRoot, 'runs', options.runId);
  await mkdir(runRoot, { recursive: true, mode: 0o700 });
  await writePrivateJson(path.join(runRoot, 'plan.json'), plan);
  printPlan(plan);

  if (options.mode === 'dry-run') {
    console.log('\nDry-run passed. No provider requests were made and no credits were consumed.');
    return;
  }

  const providers = createProviders(env, models);
  if (options.mode === 'cleanup') {
    await cleanupClones(runRoot, plan, providers);
    return;
  }
  await executePlan(runRoot, plan, providers, options.verificationConfirmed);
}

function parseArguments(args: string[]): {
  mode: Mode;
  runId: string;
  verificationConfirmed: Set<string>;
} {
  const modes = args.filter((value) => ['--dry-run', '--execute', '--cleanup'].includes(value));
  if (modes.length > 1) throw new Error('Choose only one of --dry-run, --execute, or --cleanup.');
  const mode: Mode = modes[0] === '--execute' ? 'execute' : modes[0] === '--cleanup' ? 'cleanup' : 'dry-run';
  const runIdArgument = args.find((value) => value.startsWith('--run-id='));
  const runId = runIdArgument?.slice('--run-id='.length) || defaultRunId;
  if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(runId)) {
    throw new Error('Run ID must contain only lowercase letters, numbers, and hyphens.');
  }
  const verificationArgument = args.find((value) => value.startsWith('--verification-confirmed='));
  const verificationConfirmed = new Set(
    verificationArgument
      ? verificationArgument
          .slice('--verification-confirmed='.length)
          .split(',')
          .filter(Boolean)
      : [],
  );
  return { mode, runId, verificationConfirmed };
}

async function createPlan(
  runId: string,
  models: Record<BenchmarkProvider, string>,
): Promise<BenchmarkPlan> {
  ensureFfprobeAvailable();
  const [manifestCsv, promptJson] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(promptSetPath, 'utf8'),
  ]);
  const participants = parseParticipantManifest(manifestCsv);
  if (participants.length < 3 || participants.length > 5) {
    throw new Error(`Expected 3–5 benchmark participants; found ${participants.length}.`);
  }
  const speakerIds = participants.map((participant) => participant.speaker_id);
  if (new Set(speakerIds).size !== speakerIds.length) {
    throw new Error('The participant manifest contains duplicate speaker IDs.');
  }
  for (const participant of participants) {
    const problems = validateParticipant(participant);
    if (problems.length > 0) {
      throw new Error(`${participant.speaker_id}: ${problems.join('; ')}.`);
    }
  }

  const promptSet = JSON.parse(promptJson) as BenchmarkPromptSet;
  validatePromptSet(promptSet);
  const warnings: string[] = [];
  const plannedParticipants: PlannedParticipant[] = [];
  for (const participant of participants) {
    plannedParticipants.push(await inspectParticipant(participant, warnings));
  }
  const cases = await buildBenchmarkCases(runId, participants, promptSet);
  const totalCharacters =
    promptSet.prompts.reduce((sum, prompt) => sum + prompt.text.length, 0) *
    participants.length *
    benchmarkProviders.length;

  return {
    schemaVersion: 1,
    runId,
    createdAt: new Date().toISOString(),
    promptSetVersion: promptSet.version,
    language: promptSet.sourceLanguage,
    models,
    preprocessing: 'none',
    participants: plannedParticipants,
    cases,
    totalOutputs: cases.length * benchmarkProviders.length,
    totalCharacters,
    warnings,
  };
}

async function inspectParticipant(
  participant: ParticipantManifestRow,
  warnings: string[],
): Promise<PlannedParticipant> {
  for (const fileName of [participant.enrollment_file, participant.reference_file]) {
    if (path.basename(fileName) !== fileName) {
      throw new Error(`${participant.speaker_id}: audio filenames cannot contain a path.`);
    }
  }
  const consentPath = path.join(consentRoot, `${participant.speaker_id}.md`);
  await access(consentPath).catch(() => {
    throw new Error(`${participant.speaker_id}: private consent record is missing.`);
  });
  const enrollmentPath = path.join(audioRoot, participant.enrollment_file);
  const referencePath = path.join(audioRoot, participant.reference_file);
  const [enrollment, reference] = await Promise.all([
    inspectAudio(enrollmentPath),
    inspectAudio(referencePath),
  ]);
  validateAudio(participant.speaker_id, 'enrollment', enrollment, 45);
  validateAudio(participant.speaker_id, 'reference', reference, 10);
  if (enrollment.durationSeconds < 60) {
    warnings.push(
      `${participant.speaker_id} enrollment is ${enrollment.durationSeconds.toFixed(1)}s; 60–120s is preferred.`,
    );
  }
  if (reference.durationSeconds < 20) {
    warnings.push(
      `${participant.speaker_id} held-out reference is ${reference.durationSeconds.toFixed(1)}s; 20–30s is preferred.`,
    );
  }
  return {
    speakerId: participant.speaker_id,
    enrollmentFile: participant.enrollment_file,
    referenceFile: participant.reference_file,
    enrollment,
    reference,
  };
}

async function inspectAudio(filePath: string): Promise<AudioInspection> {
  const bytes = new Uint8Array(await readFile(filePath));
  const result = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name,sample_rate,channels:format=duration',
      '-of',
      'json',
      filePath,
    ],
    { encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(`ffprobe could not inspect ${path.basename(filePath)}.`);
  const data = JSON.parse(result.stdout) as {
    streams?: Array<{ codec_name?: string; sample_rate?: string; channels?: number }>;
    format?: { duration?: string };
  };
  const stream = data.streams?.[0];
  if (!stream) throw new Error(`${path.basename(filePath)} does not contain an audio stream.`);
  return {
    sha256: await sha256Hex(bytes),
    durationSeconds: Number(data.format?.duration),
    codec: stream.codec_name ?? 'unknown',
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels),
    bytes: bytes.byteLength,
  };
}

function validateAudio(
  speakerId: string,
  kind: 'enrollment' | 'reference',
  audio: AudioInspection,
  minimumSeconds: number,
) {
  if (!Number.isFinite(audio.durationSeconds) || audio.durationSeconds < minimumSeconds) {
    throw new Error(`${speakerId}: ${kind} audio must be at least ${minimumSeconds} seconds.`);
  }
  if (audio.channels !== 1) throw new Error(`${speakerId}: ${kind} audio must be mono.`);
  if (audio.sampleRate < 16000) {
    throw new Error(`${speakerId}: ${kind} sample rate must be at least 16 kHz.`);
  }
}

function validatePromptSet(promptSet: BenchmarkPromptSet) {
  if (!promptSet.version || promptSet.sourceLanguage !== 'en' || promptSet.prompts.length === 0) {
    throw new Error('The benchmark prompt set is invalid.');
  }
  const keys = promptSet.prompts.map((prompt) => prompt.key);
  if (new Set(keys).size !== keys.length) throw new Error('Benchmark prompt keys must be unique.');
  for (const prompt of promptSet.prompts) {
    if (!prompt.key || !prompt.category || !prompt.text.trim()) {
      throw new Error('Every benchmark prompt must include a key, category, and text.');
    }
  }
}

function createProviders(
  env: Record<string, string>,
  models: Record<BenchmarkProvider, string>,
): Record<BenchmarkProvider, VoiceProvider> & {
  elevenlabs: ElevenLabsVoiceProvider;
} {
  return {
    cartesia: new CartesiaVoiceProvider({
      CARTESIA_API_KEY: env.CARTESIA_API_KEY,
      CARTESIA_MODEL_ID: models.cartesia,
    }),
    elevenlabs: new ElevenLabsVoiceProvider({
      ELEVENLABS_API_KEY: env.ELEVENLABS_API_KEY,
      ELEVENLABS_MODEL_ID: models.elevenlabs,
    }),
  };
}

async function executePlan(
  runRoot: string,
  plan: BenchmarkPlan,
  providers: ReturnType<typeof createProviders>,
  verificationConfirmed: Set<string>,
) {
  const statePath = path.join(runRoot, 'state.json');
  const state = await loadOrCreateState(statePath, plan);
  const prompts = (JSON.parse(await readFile(promptSetPath, 'utf8')) as BenchmarkPromptSet).prompts;
  const promptByKey = new Map(prompts.map((prompt) => [prompt.key, prompt]));
  try {
    for (const participant of plan.participants) {
      state.clones[participant.speakerId] ??= {};
      for (const providerName of benchmarkProviders) {
        const existing = state.clones[participant.speakerId][providerName];
        if (existing?.status === 'ready') continue;
        if (existing?.status === 'verification-required') {
          if (!verificationConfirmed.has(participant.speakerId)) {
            throw new Error(
              `${participant.speakerId} requires ElevenLabs speaker verification. Complete it in ElevenLabs, then resume with --verification-confirmed=${participant.speakerId}.`,
            );
          }
          existing.status = 'ready';
          state.updatedAt = new Date().toISOString();
          await writePrivateJson(statePath, state);
          continue;
        }
        console.log(`Creating ${providerName} clone for ${participant.speakerId}…`);
        const enrollmentPath = path.join(audioRoot, participant.enrollmentFile);
        const audio = await readFile(enrollmentPath);
        if (providerName === 'elevenlabs') {
          const result = await providers.elevenlabs.cloneVoiceWithMetadata({
            audio: toArrayBuffer(audio),
            mime: mimeForFile(participant.enrollmentFile),
            fileName: participant.enrollmentFile,
            name: `WithYou benchmark ${participant.speakerId}`,
          });
          state.clones[participant.speakerId][providerName] = {
            id: result.id,
            status: result.requiresVerification ? 'verification-required' : 'ready',
            requiresVerification: result.requiresVerification,
            createdAt: new Date().toISOString(),
          };
        } else {
          const id = await providers.cartesia.cloneVoice({
            audio: toArrayBuffer(audio),
            mime: mimeForFile(participant.enrollmentFile),
            fileName: participant.enrollmentFile,
            name: `WithYou benchmark ${participant.speakerId}`,
          });
          state.clones[participant.speakerId][providerName] = {
            id,
            status: 'ready',
            requiresVerification: false,
            createdAt: new Date().toISOString(),
          };
        }
        state.updatedAt = new Date().toISOString();
        await writePrivateJson(statePath, state);
      }
    }

    const outputsRoot = path.join(runRoot, 'outputs');
    await mkdir(outputsRoot, { recursive: true, mode: 0o700 });
    for (const benchmarkCase of plan.cases) {
      const prompt = promptByKey.get(benchmarkCase.promptKey);
      if (!prompt) throw new Error(`Prompt ${benchmarkCase.promptKey} is missing.`);
      for (const providerName of benchmarkCase.providerOrder) {
        const outputKey = `${benchmarkCase.id}:${providerName}`;
        const existing = state.outputs[outputKey];
        if (existing?.status === 'succeeded' && existing.path) {
          await access(path.join(runRoot, existing.path));
          continue;
        }
        const clone = state.clones[benchmarkCase.speakerId]?.[providerName];
        if (!clone?.id || clone.status !== 'ready') {
          throw new Error(`${benchmarkCase.speakerId}: ${providerName} clone is not ready.`);
        }
        const extension = providerName === 'cartesia' ? 'wav' : 'mp3';
        const relativeOutputPath = path.join(
          'outputs',
          `${benchmarkCase.id}-${providerName}.${extension}`,
        );
        state.outputs[outputKey] = { status: 'started', updatedAt: new Date().toISOString() };
        state.updatedAt = new Date().toISOString();
        await writePrivateJson(statePath, state);
        console.log(
          `Generating ${benchmarkCase.speakerId}/${benchmarkCase.promptKey}/${providerName}…`,
        );
        const startedAt = performance.now();
        try {
          const audio = await providers[providerName].synthesize(
            prompt.text,
            clone.id,
            { mood: 'natural', pace: 1, volume: 1 },
            'en',
          );
          await writePrivateBytes(path.join(runRoot, relativeOutputPath), new Uint8Array(audio));
          state.outputs[outputKey] = {
            status: 'succeeded',
            path: relativeOutputPath,
            bytes: audio.byteLength,
            latencyMs: Math.round(performance.now() - startedAt),
            updatedAt: new Date().toISOString(),
          };
        } catch (error) {
          state.outputs[outputKey] = {
            status: 'failed',
            errorCategory: categorizeError(error),
            latencyMs: Math.round(performance.now() - startedAt),
            updatedAt: new Date().toISOString(),
          };
          throw error;
        } finally {
          state.updatedAt = new Date().toISOString();
          await writePrivateJson(statePath, state);
        }
      }
    }
    state.status = 'completed';
    state.updatedAt = new Date().toISOString();
    await writePrivateJson(statePath, state);
    console.log(`\nBenchmark generation completed: ${plan.totalOutputs} private outputs.`);
  } catch (error) {
    state.status = 'failed';
    state.updatedAt = new Date().toISOString();
    await writePrivateJson(statePath, state);
    throw error;
  }
}

async function cleanupClones(
  runRoot: string,
  plan: BenchmarkPlan,
  providers: ReturnType<typeof createProviders>,
) {
  const statePath = path.join(runRoot, 'state.json');
  const state = await readPrivateJson<BenchmarkState>(statePath).catch(() => null);
  if (!state) throw new Error(`No executed state exists for run ${plan.runId}.`);
  await assertMatchingPlan(state, plan);
  for (const [speakerId, clones] of Object.entries(state.clones)) {
    for (const providerName of benchmarkProviders) {
      const clone = clones[providerName];
      if (!clone?.id || clone.status === 'deleted') continue;
      console.log(`Deleting ${providerName} clone for ${speakerId}…`);
      await providers[providerName].deleteVoice(clone.id);
      clone.id = null;
      clone.status = 'deleted';
      clone.deletedAt = new Date().toISOString();
      state.updatedAt = new Date().toISOString();
      await writePrivateJson(statePath, state);
    }
  }
  state.status = 'cleaned';
  state.updatedAt = new Date().toISOString();
  await writePrivateJson(statePath, state);
  console.log('Provider clones were deleted. Private generated outputs were retained for evaluation.');
}

async function loadOrCreateState(
  statePath: string,
  plan: BenchmarkPlan,
): Promise<BenchmarkState> {
  const existing = await readPrivateJson<BenchmarkState>(statePath).catch(() => null);
  if (existing) {
    await assertMatchingPlan(existing, plan);
    if (existing.status === 'cleaned') {
      throw new Error('This run was cleaned and cannot be resumed with deleted clones.');
    }
    existing.status = 'running';
    return existing;
  }
  const now = new Date().toISOString();
  const state: BenchmarkState = {
    schemaVersion: 1,
    runId: plan.runId,
    planSha256: await planSha256(plan),
    status: 'running',
    models: plan.models,
    clones: {},
    outputs: {},
    createdAt: now,
    updatedAt: now,
  };
  await writePrivateJson(statePath, state);
  return state;
}

async function assertMatchingPlan(state: BenchmarkState, plan: BenchmarkPlan) {
  if (state.runId !== plan.runId || state.planSha256 !== (await planSha256(plan))) {
    throw new Error('The saved run state does not match the current plan. Use a new run ID.');
  }
}

async function planSha256(plan: BenchmarkPlan): Promise<string> {
  return sha256Hex(
    JSON.stringify({
      schemaVersion: plan.schemaVersion,
      runId: plan.runId,
      promptSetVersion: plan.promptSetVersion,
      language: plan.language,
      models: plan.models,
      preprocessing: plan.preprocessing,
      participants: plan.participants,
      cases: plan.cases,
      totalOutputs: plan.totalOutputs,
      totalCharacters: plan.totalCharacters,
    }),
  );
}

async function readEnvironment(filePath: string): Promise<Record<string, string>> {
  const contents = await readFile(filePath, 'utf8');
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const equals = line.indexOf('=');
        const key = line.slice(0, equals).trim();
        const raw = line.slice(equals + 1).trim();
        const value =
          (raw.startsWith('"') && raw.endsWith('"')) ||
          (raw.startsWith("'") && raw.endsWith("'"))
            ? raw.slice(1, -1)
            : raw;
        return [key, value];
      }),
  );
}

function assertCredential(value: string | undefined, name: string): asserts value is string {
  if (!value) throw new Error(`${name} is required for the benchmark.`);
}

function ensureFfprobeAvailable() {
  const result = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' });
  if (result.status !== 0) throw new Error('ffprobe is required to validate benchmark audio.');
}

function printPlan(plan: BenchmarkPlan) {
  console.log(`Benchmark run: ${plan.runId}`);
  console.log(`Participants: ${plan.participants.length}`);
  console.log(`Prompt cases: ${plan.cases.length}`);
  console.log(`Expected outputs: ${plan.totalOutputs}`);
  console.log(`Billable text characters across providers: ${plan.totalCharacters}`);
  console.log(`Cartesia model: ${plan.models.cartesia}`);
  console.log(`ElevenLabs model: ${plan.models.elevenlabs}`);
  console.log('Preprocessing: none (identical enrollment bytes sent to both providers)');
  for (const warning of plan.warnings) console.warn(`Warning: ${warning}`);
}

function mimeForFile(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.m4a' || extension === '.mp4') return 'audio/mp4';
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.flac') return 'audio/flac';
  throw new Error(`Unsupported enrollment audio extension: ${extension || '(none)'}.`);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}

function categorizeError(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = Number((error as { status: unknown }).status);
    if (status === 429) return 'rate_limit';
    if (status === 401 || status === 403) return 'authorization';
    if (status >= 500) return 'dependency';
    if (status >= 400) return 'validation';
  }
  return 'internal';
}

async function writePrivateJson(filePath: string, value: unknown) {
  await writePrivateBytes(filePath, new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`));
}

async function writePrivateBytes(filePath: string, bytes: Uint8Array) {
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, bytes, { mode: 0o600 });
  await rename(temporaryPath, filePath);
  await chmod(filePath, 0o600);
}

async function readPrivateJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Unknown benchmark failure.';
  console.error(`Benchmark stopped: ${message}`);
  process.exitCode = 1;
});
