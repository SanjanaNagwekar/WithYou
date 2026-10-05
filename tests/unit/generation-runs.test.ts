import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { categorizeGenerationError } from '@/lib/generation-runs';

describe('generation error categorization', () => {
  it.each([
    [new AppError('bad input', 400), 'validation'],
    [new AppError('signed out', 401), 'authorization'],
    [new AppError('missing', 404), 'not_found'],
    [new AppError('busy', 409), 'conflict'],
    [new AppError('limited', 429), 'rate_limit'],
    [new AppError('provider failed', 502), 'dependency'],
    [new Error('database unavailable'), 'internal'],
  ])('maps an error to a non-sensitive category', (error, category) => {
    expect(categorizeGenerationError(error)).toBe(category);
  });
});
