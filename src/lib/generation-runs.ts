import { AppError } from '@/lib/errors';

export type GenerationOperation = 'create' | 'update' | 'benchmark';
export type GenerationStage = 'translation' | 'clone' | 'localization' | 'synthesis';

type GenerationRunInput = {
  owner: string;
  voiceId: string;
  operation: GenerationOperation;
  provider: string;
  model: string;
  sourceLanguage?: string;
  targetLanguage: string;
  inputCharacters: number;
};

type GenerationSuccess = {
  recordingId: string;
  outputBytes: number;
  translationProvider: string;
};

export class GenerationRunTracker {
  readonly id = crypto.randomUUID();
  private readonly startedAt = performance.now();
  private readonly timings = new Map<GenerationStage, number>();
  private referenceBytes: number | null = null;

  private constructor(private readonly db: D1Database) {}

  static async start(db: D1Database, input: GenerationRunInput) {
    const createdAt = new Date().toISOString();
    const tracker = new GenerationRunTracker(db);
    await db
      .prepare(
        `INSERT INTO generation_runs(
          id,owner,voice_id,operation,provider,model,source_language,target_language,
          input_characters,status,created_at
        ) VALUES(?,?,?,?,?,?,?,?,?,'started',?)`,
      )
      .bind(
        tracker.id,
        input.owner,
        input.voiceId,
        input.operation,
        input.provider,
        input.model,
        input.sourceLanguage ?? 'en',
        input.targetLanguage,
        input.inputCharacters,
        createdAt,
      )
      .run();
    return tracker;
  }

  async measure<T>(stage: GenerationStage, action: () => Promise<T>): Promise<T> {
    const startedAt = performance.now();
    try {
      return await action();
    } finally {
      this.timings.set(stage, Math.max(0, Math.round(performance.now() - startedAt)));
    }
  }

  setReferenceBytes(bytes: number) {
    this.referenceBytes = bytes;
  }

  successStatement(result: GenerationSuccess): D1PreparedStatement {
    const completedAt = new Date().toISOString();
    return this.db
      .prepare(
        `UPDATE generation_runs SET
          recording_id=?,reference_bytes=?,translation_provider=?,
          translation_latency_ms=?,clone_latency_ms=?,localization_latency_ms=?,
          synthesis_latency_ms=?,total_latency_ms=?,output_bytes=?,status='succeeded',
          completed_at=? WHERE id=?`,
      )
      .bind(
        result.recordingId,
        this.referenceBytes,
        result.translationProvider,
        this.timing('translation'),
        this.timing('clone'),
        this.timing('localization'),
        this.timing('synthesis'),
        this.elapsed(),
        result.outputBytes,
        completedAt,
        this.id,
      );
  }

  async fail(error: unknown): Promise<void> {
    await this.db
      .prepare(
        `UPDATE generation_runs SET
          reference_bytes=?,translation_latency_ms=?,clone_latency_ms=?,
          localization_latency_ms=?,synthesis_latency_ms=?,total_latency_ms=?,
          status='failed',error_category=?,completed_at=? WHERE id=? AND status='started'`,
      )
      .bind(
        this.referenceBytes,
        this.timing('translation'),
        this.timing('clone'),
        this.timing('localization'),
        this.timing('synthesis'),
        this.elapsed(),
        categorizeGenerationError(error),
        new Date().toISOString(),
        this.id,
      )
      .run();
  }

  private timing(stage: GenerationStage): number | null {
    return this.timings.get(stage) ?? null;
  }

  private elapsed(): number {
    return Math.max(0, Math.round(performance.now() - this.startedAt));
  }
}

export function categorizeGenerationError(error: unknown): string {
  if (!(error instanceof AppError)) return 'internal';
  if (error.status === 401 || error.status === 403) return 'authorization';
  if (error.status === 404) return 'not_found';
  if (error.status === 409) return 'conflict';
  if (error.status === 429) return 'rate_limit';
  if (error.status >= 500) return 'dependency';
  return 'validation';
}
