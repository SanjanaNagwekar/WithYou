export const benchmarkProviders = ['cartesia', 'elevenlabs'] as const;

export type BenchmarkProvider = (typeof benchmarkProviders)[number];

export type BenchmarkPrompt = {
  key: string;
  category: string;
  text: string;
};

export type BenchmarkPromptSet = {
  version: string;
  sourceLanguage: string;
  description: string;
  prompts: BenchmarkPrompt[];
};

export type ParticipantManifestRow = {
  speaker_id: string;
  enrollment_file: string;
  reference_file: string;
  recorded_at: string;
  consent_at: string;
  age_confirmed: string;
  cartesia_consent: string;
  elevenlabs_consent: string;
  private_review_consent: string;
  audio_publication_consent: string;
  withdrawn_at: string;
  quality_notes: string;
};

export type BenchmarkCase = {
  id: string;
  speakerId: string;
  promptKey: string;
  promptSha256: string;
  language: string;
  providerOrder: readonly BenchmarkProvider[];
};

const expectedManifestColumns: Array<keyof ParticipantManifestRow> = [
  'speaker_id',
  'enrollment_file',
  'reference_file',
  'recorded_at',
  'consent_at',
  'age_confirmed',
  'cartesia_consent',
  'elevenlabs_consent',
  'private_review_consent',
  'audio_publication_consent',
  'withdrawn_at',
  'quality_notes',
];

export function parseParticipantManifest(csv: string): ParticipantManifestRow[] {
  const records = parseCsv(csv);
  if (records.length < 2) throw new Error('The participant manifest has no participant rows.');
  const [header, ...rows] = records;
  const missing = expectedManifestColumns.filter((column) => !header.includes(column));
  if (missing.length > 0) {
    throw new Error(`The participant manifest is missing columns: ${missing.join(', ')}.`);
  }

  return rows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map((row) =>
      Object.fromEntries(
        expectedManifestColumns.map((column) => [column, row[header.indexOf(column)]?.trim() ?? '']),
      ) as ParticipantManifestRow,
    );
}

export function validateParticipant(row: ParticipantManifestRow): string[] {
  const problems: string[] = [];
  if (!/^S\d{2,4}$/.test(row.speaker_id)) problems.push('speaker ID must look like S01');
  if (!row.enrollment_file) problems.push('enrollment file is missing');
  if (!row.reference_file) problems.push('reference file is missing');
  if (!row.consent_at) problems.push('consent date is missing');
  for (const field of [
    'age_confirmed',
    'cartesia_consent',
    'elevenlabs_consent',
    'private_review_consent',
  ] as const) {
    if (row[field].toLowerCase() !== 'confirmed') problems.push(`${field} is not confirmed`);
  }
  if (row.withdrawn_at) problems.push('consent has been withdrawn');
  return problems;
}

export async function buildBenchmarkCases(
  runId: string,
  participants: ParticipantManifestRow[],
  promptSet: BenchmarkPromptSet,
): Promise<BenchmarkCase[]> {
  const cases: BenchmarkCase[] = [];
  for (const participant of participants) {
    for (const prompt of promptSet.prompts) {
      const promptSha256 = await sha256Hex(prompt.text);
      const id = (await sha256Hex(
        `${runId}\n${participant.speaker_id}\n${promptSet.version}\n${prompt.key}\n${promptSha256}\n${promptSet.sourceLanguage}`,
      )).slice(0, 24);
      const providerOrder =
        cases.length % 2 === 0
          ? benchmarkProviders
          : ([benchmarkProviders[1], benchmarkProviders[0]] as const);
      cases.push({
        id,
        speakerId: participant.speaker_id,
        promptKey: prompt.key,
        promptSha256,
        language: promptSet.sourceLanguage,
        providerOrder,
      });
    }
  }
  return cases;
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes =
    typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error('The participant manifest contains an unterminated quoted value.');
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
