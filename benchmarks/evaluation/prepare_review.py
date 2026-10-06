#!/usr/bin/env python3
"""Build a private, provider-blinded listening-review package."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import random
import shutil
import sys
import tempfile
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = ROOT / "benchmarks" / "private"
PROMPTS_PATH = ROOT / "benchmarks" / "prompts" / "v1.json"


def main() -> None:
    arguments = parse_arguments()
    run_root = PRIVATE_ROOT / "runs" / arguments.run_id
    plan = read_json(run_root / "plan.json")
    state = read_json(run_root / "state.json")
    if state.get("status") != "completed":
        raise RuntimeError("Benchmark generation must be completed before review preparation.")

    review_root = run_root / "analysis" / "listening-review-v1"
    if review_root.exists():
        raise RuntimeError(
            f"Review package already exists at {review_root}. "
            "Keep completed response forms and use a new package version for changes."
        )
    audio_root = review_root / "audio"
    audio_root.mkdir(parents=True, mode=0o700)

    prompt_set = read_json(PROMPTS_PATH)
    prompts = {prompt["key"]: prompt["text"] for prompt in prompt_set["prompts"]}
    cases = {case["id"]: case for case in plan["cases"]}
    wave_root = run_root / "analysis" / "wav-16khz"
    seed = arguments.seed if arguments.seed is not None else default_seed(arguments.run_id)
    rng = random.Random(seed)

    reference_names: dict[str, str] = {}
    for index, participant in enumerate(sorted(plan["participants"], key=lambda p: p["speakerId"]), 1):
        filename = f"reference-{index:02d}.wav"
        copy_private(
            wave_root / f"{participant['speakerId']}-reference.wav",
            audio_root / filename,
        )
        reference_names[participant["speakerId"]] = filename

    output_entries = [
        (output_key, output_state)
        for output_key, output_state in state["outputs"].items()
        if output_state.get("status") == "succeeded"
    ]
    if len(output_entries) != len(plan["cases"]) * 2:
        raise RuntimeError("The run does not contain a complete pair for every benchmark case.")
    rng.shuffle(output_entries)

    review_items: list[dict[str, str]] = []
    answer_items: list[dict[str, str]] = []
    for index, (output_key, _) in enumerate(output_entries, 1):
        case_id, provider = output_key.rsplit(":", 1)
        benchmark_case = cases[case_id]
        item_id = f"C{index:03d}"
        candidate_name = f"candidate-{index:03d}.wav"
        copy_private(
            wave_root / f"{case_id}-{provider}.wav",
            audio_root / candidate_name,
        )
        review_items.append(
            {
                "itemId": item_id,
                "referenceAudio": f"audio/{reference_names[benchmark_case['speakerId']]}",
                "candidateAudio": f"audio/{candidate_name}",
                "promptText": prompts[benchmark_case["promptKey"]],
            }
        )
        answer_items.append(
            {
                "itemId": item_id,
                "caseId": case_id,
                "speakerId": benchmark_case["speakerId"],
                "promptKey": benchmark_case["promptKey"],
                "provider": provider,
                "model": plan["models"][provider],
            }
        )

    write_private_text(review_root / "README.md", review_instructions(arguments.reviewers))
    for reviewer_number in range(1, arguments.reviewers + 1):
        reviewer_items = review_items.copy()
        random.Random(seed + reviewer_number).shuffle(reviewer_items)
        write_response_form(
            review_root / f"reviewer-{reviewer_number:02d}.csv", reviewer_items
        )

    write_private_json(
        review_root / "answer-key.json",
        {
            "schemaVersion": 1,
            "runId": arguments.run_id,
            "seed": seed,
            "reviewerCount": arguments.reviewers,
            "items": sorted(answer_items, key=lambda item: item["itemId"]),
        },
    )
    print(f"Created blinded review package: {review_root}")
    print(f"Reviewers: {arguments.reviewers}; candidates per reviewer: {len(review_items)}")
    print("Keep answer-key.json private from reviewers.")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--reviewers", type=positive_integer, default=3)
    parser.add_argument("--seed", type=int)
    return parser.parse_args()


def positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("value must be at least 1")
    return parsed


def default_seed(run_id: str) -> int:
    return int(hashlib.sha256(run_id.encode("utf8")).hexdigest()[:8], 16)


def review_instructions(reviewer_count: int) -> str:
    return f"""# WithYou blinded listening review

This package contains provider-blinded voice-cloning samples. It has {reviewer_count} independently shuffled response forms. Give each reviewer one CSV file and the `audio/` directory. Do not share `answer-key.json` until every response is final.

For each row:

1. Listen to the reference clip to learn the person's voice.
2. Read the displayed prompt, then listen to the candidate clip.
3. Enter an integer from 1 (very poor) to 5 (excellent) for speaker similarity, naturalness, and pronunciation accuracy.
4. Mark audible artifacts `yes` or `no`. Comments are optional and must not include a participant's real name.

Use headphones in a quiet room, keep the playback device and volume constant, finish the rows in the supplied order, and do not discuss ratings with other reviewers. Speaker similarity means whether the candidate sounds like the same person—not whether it merely sounds pleasant. Naturalness means whether the clip sounds like human speech rather than synthesized speech. Pronunciation accuracy means whether the spoken words match the displayed prompt and are clear.

All recordings are private evaluation data. Do not upload, forward, publish, or retain copies outside the approved review process.
"""


def write_response_form(path: Path, items: list[dict[str, str]]) -> None:
    fields = [
        "itemOrder",
        "itemId",
        "referenceAudio",
        "candidateAudio",
        "promptText",
        "speakerSimilarity1to5",
        "naturalness1to5",
        "pronunciationAccuracy1to5",
        "audibleArtifactsYesNo",
        "comments",
    ]
    temporary = path.with_suffix(".tmp.csv")
    with temporary.open("w", encoding="utf8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for index, item in enumerate(items, 1):
            writer.writerow({"itemOrder": index, **item})
    os.replace(temporary, path)
    path.chmod(0o600)


def copy_private(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"Required review audio is missing: {source}")
    shutil.copyfile(source, destination)
    destination.chmod(0o600)


def read_json(path: Path) -> Any:
    with path.open(encoding="utf8") as handle:
        return json.load(handle)


def write_private_text(path: Path, value: str) -> None:
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf8", dir=path.parent, delete=False
    ) as handle:
        handle.write(value)
        temporary = Path(handle.name)
    temporary.chmod(0o600)
    os.replace(temporary, path)
    path.chmod(0o600)


def write_private_json(path: Path, value: Any) -> None:
    write_private_text(path, json.dumps(value, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Review preparation stopped: {error}", file=sys.stderr)
        raise
