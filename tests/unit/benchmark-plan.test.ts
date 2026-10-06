import { describe, expect, it } from 'vitest';
import {
  buildBenchmarkCases,
  parseParticipantManifest,
  validateParticipant,
  type BenchmarkPromptSet,
} from '@/lib/benchmark-plan';

const header =
  'speaker_id,enrollment_file,reference_file,recorded_at,consent_at,age_confirmed,cartesia_consent,elevenlabs_consent,private_review_consent,audio_publication_consent,withdrawn_at,quality_notes';

describe('benchmark planning', () => {
  it('parses quoted CSV values without leaking identity fields into the schema', () => {
    const rows = parseParticipantManifest(
      `${header}\nS01,S01_enrollment.m4a,S01_reference.m4a,,2026-10-05,confirmed,confirmed,confirmed,confirmed,false,,"quiet, furnished room"\n`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].quality_notes).toBe('quiet, furnished room');
  });

  it('requires consent and rejects withdrawn participants', () => {
    const [participant] = parseParticipantManifest(
      `${header}\nS01,a.m4a,b.m4a,,2026-10-05,confirmed,confirmed,reported,confirmed,false,2026-10-06,\n`,
    );
    expect(validateParticipant(participant)).toEqual([
      'elevenlabs_consent is not confirmed',
      'consent has been withdrawn',
    ]);
  });

  it('creates stable paired cases with alternating provider order', async () => {
    const participants = parseParticipantManifest(
      `${header}\nS01,a.m4a,b.m4a,,2026-10-05,confirmed,confirmed,confirmed,confirmed,false,,\nS02,c.m4a,d.m4a,,2026-10-05,confirmed,confirmed,confirmed,confirmed,false,,\n`,
    );
    const promptSet: BenchmarkPromptSet = {
      version: '1.0.0',
      sourceLanguage: 'en',
      description: 'test',
      prompts: [
        { key: 'one', category: 'neutral', text: 'First prompt.' },
        { key: 'two', category: 'neutral', text: 'Second prompt.' },
      ],
    };
    const first = await buildBenchmarkCases('run-1', participants, promptSet);
    const second = await buildBenchmarkCases('run-1', participants, promptSet);

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(new Set(first.map((item) => item.id))).toHaveLength(4);
    expect(first[0].providerOrder).toEqual(['cartesia', 'elevenlabs']);
    expect(first[1].providerOrder).toEqual(['elevenlabs', 'cartesia']);
  });
});
