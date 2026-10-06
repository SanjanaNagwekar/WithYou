# Benchmark assets

This directory contains only public, reproducible benchmark definitions and blank templates. Never commit participant audio, signed consent records, identity mappings, provider voice IDs, or generated clips.

## Tracked files

- `prompts/v1.json`: fixed text used to generate paired model outputs.
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
