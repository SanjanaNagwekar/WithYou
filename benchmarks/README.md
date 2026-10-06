# Benchmark assets

This directory contains only public, reproducible benchmark definitions and blank templates. Never commit participant audio, signed consent records, identity mappings, provider voice IDs, or generated clips.

## Tracked files

- `prompts/v1.json`: fixed text used to generate paired model outputs.
- `results/english-v1-automated.md`: de-identified preliminary results from the first controlled run.
- `templates/participant-consent.md`: plain-language consent checklist to review with each participant.
- `templates/collection-manifest.example.csv`: schema for the private, de-identified collection log.

## Private local layout

Create the following ignored directories from the repository root:

```bash
mkdir -p benchmarks/private/audio benchmarks/private/consent benchmarks/private/manifests
cp benchmarks/templates/collection-manifest.example.csv benchmarks/private/manifests/collection-manifest.csv
```

Use this structure:

```text
benchmarks/private/
  audio/
    S01_enrollment.mp3
    S01_reference.mp3
  consent/
    S01.md
  manifests/
    collection-manifest.csv
```

The entire `benchmarks/private/` directory and common audio formats under `benchmarks/` are Git-ignored. Confirm with `git status --short` before every commit. Keep the separate mapping from `S01` to a person's identity outside the repository and outside this directory.

Collection instructions and the exact scripts are in [`docs/BENCHMARKING.md`](../docs/BENCHMARKING.md).

## Runner safety

The runner defaults to a zero-cost dry-run:

```bash
npm run benchmark:dry-run
```

It validates consent flags, source files, audio metadata, prompt hashes, credentials, model IDs, and the complete paired case plan. Provider calls require the explicit `benchmark:run` command. Progress is checkpointed under `benchmarks/private/runs/`, so retries skip completed clones and outputs. `benchmark:cleanup` deletes provider clones while retaining private outputs for evaluation.

After generation, install the pinned local evaluator dependencies in `.venv-benchmark` and run:

```bash
npm run benchmark:evaluate -- --run-id=<private-run-id>
npm run benchmark:prepare-review -- --run-id=<private-run-id>
```

Evaluation is local-only. ECAPA speaker embeddings compare each generated clip with its held-out reference, Whisper plus JiWER measures WER and CER against the fixed prompt, and UTMOSv2 estimates naturalness. Per-clip transcriptions and scores remain private.

The review-package command creates three independently shuffled, provider-blinded response forms under the ignored run directory. Its answer key must remain hidden from reviewers until all ratings are complete.
