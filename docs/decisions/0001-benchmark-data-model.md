# ADR 0001: Separate product telemetry from benchmark evaluation

- Status: accepted
- Date: 2026-10-04

## Context

WithYou needs enough operational evidence to diagnose generation quality and a reproducible structure for comparing voice models. Product generations and controlled experiments overlap technically, but they have different lifecycles: a user generation is a private keepsake, while a benchmark case may produce several blinded outputs and several automated or human scores.

Storing everything in `recordings` would couple the product UI to experimental fields, encourage sparse columns, and make evaluator versioning difficult. Storing raw transcripts or provider errors in telemetry would also create unnecessary privacy exposure.

## Decision

Use `generation_runs` as the shared, append-oriented operational record for generation attempts. It records provider/model identity, languages, input size, stage timings, output size, completion status, and a coarse error category. It never records message text or raw error details.

Represent controlled experiments with normalized `benchmark_runs`, `benchmark_cases`, `benchmark_outputs`, `benchmark_scores`, and `benchmark_ratings` tables. Prompt text remains in a versioned repository file; each case stores its key and digest. Automated scores record evaluator name and version. Human ratings are separate, blinded observations.

Application deletion paths remove linked operational and benchmark metadata along with private audio. The schema does not rely on database cascades because deletion also coordinates R2 objects and external provider clones.

## Consequences

- Production traffic supplies latency and reliability evidence before the comparison runner exists.
- Two or more models can be compared using the same case without changing the schema.
- Evaluators can be upgraded without overwriting historical results.
- Privacy exposure is reduced because telemetry excludes content and detailed errors.
- The application must explicitly maintain cross-store deletion order.
- A separate runner and analysis export are still required before benchmark results can be published.

## Alternatives considered

- **Add benchmark columns to `recordings`:** simpler initially, but mixes user content with experiments and cannot naturally represent multiple evaluator versions or reviewers.
- **Store one JSON result per experiment:** flexible, but makes validation, aggregation, uniqueness, and partial retries harder.
- **Use only provider dashboards:** insufficient for paired prompt controls, human ratings, cross-provider comparisons, or portfolio-grade reproducibility.
