#!/usr/bin/env python3
"""Offline, privacy-preserving evaluation for a completed WithYou benchmark run."""

from __future__ import annotations

import argparse
import csv
import importlib.metadata
import json
import math
import os
from pathlib import Path
import statistics
import subprocess
import sys
import tempfile
import time
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
PRIVATE_ROOT = ROOT / "benchmarks" / "private"
PROMPTS_PATH = ROOT / "benchmarks" / "prompts" / "v1.json"
CACHE_ROOT = ROOT / ".cache" / "benchmark-models"
SPEAKER_MODEL_ID = "speechbrain/spkrec-ecapa-voxceleb"
WHISPER_MODEL_ID = "base.en"
UTMOS_MODEL_ID = "sarulab-speech/UTMOSv2"
UTMOS_CONFIG = "fusion_stage3"
UTMOS_FOLD = 0
UTMOS_SEED = 42

os.environ.setdefault("HF_HOME", str(CACHE_ROOT / "huggingface"))
os.environ.setdefault("TORCH_HOME", str(CACHE_ROOT / "torch"))
os.environ.setdefault("XDG_CACHE_HOME", str(CACHE_ROOT))
# UTMOSv2 v1.3.0 intentionally exposes this misspelled environment variable.
os.environ.setdefault("UTMOSV2_CHACHE", str(CACHE_ROOT / "utmosv2"))


def main() -> None:
    arguments = parse_arguments()
    run_root = PRIVATE_ROOT / "runs" / arguments.run_id
    plan = read_json(run_root / "plan.json")
    state = read_json(run_root / "state.json")
    if state.get("status") != "completed":
        raise RuntimeError("Benchmark generation must be completed before evaluation.")

    analysis_root = run_root / "analysis"
    wave_root = analysis_root / "wav-16khz"
    model_root = analysis_root / "models"
    analysis_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    wave_root.mkdir(parents=True, exist_ok=True, mode=0o700)
    model_root.mkdir(parents=True, exist_ok=True, mode=0o700)

    prompt_set = read_json(PROMPTS_PATH)
    prompts = {prompt["key"]: prompt for prompt in prompt_set["prompts"]}
    cases = {case["id"]: case for case in plan["cases"]}
    checkpoints_path = analysis_root / "scores.json"
    scores: dict[str, dict[str, Any]] = (
        read_json(checkpoints_path) if checkpoints_path.exists() else {}
    )

    prepare_analysis_audio(plan, state, run_root, wave_root)
    ordered_outputs = sorted(state["outputs"].items())
    base_metrics_pending = any(
        output_key not in scores
        or scores[output_key].get("status") != "succeeded"
        or any(
            metric not in scores[output_key]
            for metric in ("speakerSimilarity", "wordErrorRate", "characterErrorRate")
        )
        for output_key, output_state in ordered_outputs
        if output_state.get("status") == "succeeded"
    )
    speaker_revision = cached_speaker_revision(model_root)
    speaker_model = None
    reference_embeddings: dict[str, Any] = {}
    whisper_model = None
    normalizer = None
    if base_metrics_pending:
        print("Loading SpeechBrain ECAPA speaker-verification model…", flush=True)
        speaker_model, speaker_revision = load_speaker_model(model_root)
        reference_embeddings = load_reference_embeddings(plan, wave_root, speaker_model)
        print("Loading Whisper base.en model…", flush=True)
        whisper_model = load_whisper_model()
        normalizer = load_text_normalizer()

    for index, (output_key, output_state) in enumerate(ordered_outputs, start=1):
        if output_state.get("status") != "succeeded":
            raise RuntimeError(f"Generated output {output_key} is not successful.")
        existing = scores.get(output_key, {})
        if existing.get("status") == "succeeded" and all(
            metric in existing
            for metric in ("speakerSimilarity", "wordErrorRate", "characterErrorRate")
        ):
            continue
        case_id, provider = output_key.rsplit(":", 1)
        benchmark_case = cases[case_id]
        prompt = prompts[benchmark_case["promptKey"]]
        speaker_id = benchmark_case["speakerId"]
        output_wave = wave_root / f"{case_id}-{provider}.wav"
        print(
            f"Scoring {index}/{len(ordered_outputs)} "
            f"{speaker_id}/{benchmark_case['promptKey']}/{provider}…",
            flush=True,
        )
        started_at = time.perf_counter()
        try:
            if speaker_model is None or whisper_model is None or normalizer is None:
                raise RuntimeError("Base evaluator models were not initialized.")
            similarity = speaker_similarity(
                speaker_model,
                reference_embeddings[speaker_id],
                output_wave,
            )
            transcription = whisper_model.transcribe(
                str(output_wave),
                language="en",
                task="transcribe",
                temperature=0,
                condition_on_previous_text=False,
                fp16=False,
                verbose=None,
            )["text"].strip()
            normalized_reference = normalizer(prompt["text"])
            normalized_hypothesis = normalizer(transcription)
            word_error_rate, character_error_rate = error_rates(
                normalized_reference,
                normalized_hypothesis,
            )
            scores[output_key] = {
                "status": "succeeded",
                "caseId": case_id,
                "speakerId": speaker_id,
                "promptKey": benchmark_case["promptKey"],
                "provider": provider,
                "model": plan["models"][provider],
                "speakerSimilarity": similarity,
                "wordErrorRate": word_error_rate,
                "characterErrorRate": character_error_rate,
                "transcription": transcription,
                "generationLatencyMs": output_state.get("latencyMs"),
                "outputBytes": output_state.get("bytes"),
                "evaluationLatencyMs": round((time.perf_counter() - started_at) * 1000),
                "updatedAt": utc_now(),
            }
        except Exception as error:
            scores[output_key] = {
                "status": "failed",
                "caseId": case_id,
                "provider": provider,
                "errorCategory": type(error).__name__,
                "updatedAt": utc_now(),
            }
            write_private_json(checkpoints_path, scores)
            raise
        write_private_json(checkpoints_path, scores)

    naturalness_pending = [
        (output_key, output_state)
        for output_key, output_state in ordered_outputs
        if output_state.get("status") == "succeeded"
        and "predictedNaturalness" not in scores.get(output_key, {})
    ]
    if naturalness_pending:
        print("Loading UTMOSv2 predicted-naturalness model…", flush=True)
        naturalness_model = load_naturalness_model()
        for index, (output_key, _) in enumerate(naturalness_pending, start=1):
            case_id, provider = output_key.rsplit(":", 1)
            score = scores[output_key]
            output_wave = wave_root / f"{case_id}-{provider}.wav"
            print(
                f"Scoring naturalness {index}/{len(naturalness_pending)} "
                f"{score['speakerId']}/{score['promptKey']}/{provider}…",
                flush=True,
            )
            score["predictedNaturalness"] = predict_naturalness(
                naturalness_model, output_wave
            )
            score["updatedAt"] = utc_now()
            write_private_json(checkpoints_path, scores)

    metadata = {
        "schemaVersion": 1,
        "runId": arguments.run_id,
        "evaluatedAt": utc_now(),
        "evaluators": {
            "speakerSimilarity": {
                "name": SPEAKER_MODEL_ID,
                "revision": speaker_revision,
                "speechbrainVersion": package_version("speechbrain"),
            },
            "intelligibility": {
                "name": f"openai-whisper/{WHISPER_MODEL_ID}",
                "openaiWhisperVersion": package_version("openai-whisper"),
                "jiwerVersion": package_version("jiwer"),
            },
            "predictedNaturalness": {
                "name": UTMOS_MODEL_ID,
                "version": package_version("utmosv2"),
                "config": UTMOS_CONFIG,
                "fold": UTMOS_FOLD,
                "seed": UTMOS_SEED,
                "predictDataset": "sarulab",
                "numRepetitions": 1,
                "removeSilentSection": True,
            },
        },
        "normalization": "whisper.normalizers.EnglishTextNormalizer",
        "analysisAudio": "mono PCM 16-bit 16 kHz",
        "naturalnessMetric": "UTMOSv2 predicted MOS",
    }
    write_private_json(analysis_root / "evaluation-metadata.json", metadata)
    write_private_csv(analysis_root / "scores.csv", scores)
    summary = aggregate_scores(arguments.run_id, plan, scores, metadata)
    write_private_json(analysis_root / "aggregate-summary.json", summary)
    print_summary(summary)


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True)
    return parser.parse_args()


def prepare_analysis_audio(
    plan: dict[str, Any],
    state: dict[str, Any],
    run_root: Path,
    wave_root: Path,
) -> None:
    for participant in plan["participants"]:
        reference_source = PRIVATE_ROOT / "audio" / participant["referenceFile"]
        convert_audio(reference_source, wave_root / f"{participant['speakerId']}-reference.wav")
    for output_key, output_state in state["outputs"].items():
        if output_state.get("status") != "succeeded" or not output_state.get("path"):
            continue
        case_id, provider = output_key.rsplit(":", 1)
        convert_audio(run_root / output_state["path"], wave_root / f"{case_id}-{provider}.wav")


def convert_audio(source: Path, destination: Path) -> None:
    if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
        return
    temporary = destination.with_suffix(".tmp.wav")
    subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(source),
            "-ac",
            "1",
            "-ar",
            "16000",
            "-c:a",
            "pcm_s16le",
            str(temporary),
        ],
        check=True,
    )
    os.replace(temporary, destination)
    destination.chmod(0o600)


def load_speaker_model(model_root: Path) -> tuple[Any, str]:
    from huggingface_hub import HfApi, snapshot_download
    from speechbrain.inference.speaker import SpeakerRecognition

    revision = HfApi().model_info(SPEAKER_MODEL_ID).sha
    snapshot_path = snapshot_download(
        repo_id=SPEAKER_MODEL_ID,
        revision=revision,
        local_dir=model_root / f"speechbrain-ecapa-{revision}",
    )
    model = SpeakerRecognition.from_hparams(
        source=snapshot_path,
        savedir=str(model_root / "speechbrain-ecapa-runtime"),
        run_opts={"device": "cpu"},
    )
    return model, revision


def cached_speaker_revision(model_root: Path) -> str | None:
    prefix = "speechbrain-ecapa-"
    for path in sorted(model_root.glob(f"{prefix}*")):
        revision = path.name.removeprefix(prefix)
        if len(revision) == 40 and all(character in "0123456789abcdef" for character in revision):
            return revision
    return None


def load_reference_embeddings(
    plan: dict[str, Any], wave_root: Path, speaker_model: Any
) -> dict[str, Any]:
    return {
        participant["speakerId"]: encode_audio(
            speaker_model, wave_root / f"{participant['speakerId']}-reference.wav"
        )
        for participant in plan["participants"]
    }


def encode_audio(speaker_model: Any, audio_path: Path) -> Any:
    import soundfile
    import torch

    signal, sample_rate = soundfile.read(audio_path, dtype="float32")
    if sample_rate != 16000:
        raise RuntimeError(f"Unexpected analysis sample rate for {audio_path.name}.")
    waveform = torch.from_numpy(signal).unsqueeze(0)
    with torch.no_grad():
        return speaker_model.encode_batch(waveform).squeeze().cpu()


def speaker_similarity(speaker_model: Any, reference_embedding: Any, audio_path: Path) -> float:
    import torch.nn.functional as functional

    output_embedding = encode_audio(speaker_model, audio_path)
    return float(
        functional.cosine_similarity(
            reference_embedding.unsqueeze(0), output_embedding.unsqueeze(0)
        ).item()
    )


def load_whisper_model() -> Any:
    import whisper

    return whisper.load_model(
        WHISPER_MODEL_ID,
        device="cpu",
        download_root=str(CACHE_ROOT / "whisper"),
    )


def load_text_normalizer() -> Any:
    from whisper.normalizers import EnglishTextNormalizer

    return EnglishTextNormalizer()


def load_naturalness_model() -> Any:
    import utmosv2

    return utmosv2.create_model(
        pretrained=True,
        config=UTMOS_CONFIG,
        fold=UTMOS_FOLD,
        seed=UTMOS_SEED,
        device="cpu",
    )


def predict_naturalness(model: Any, audio_path: Path) -> float:
    return float(
        model.predict(
            input_path=audio_path,
            predict_dataset="sarulab",
            device="cpu",
            num_workers=0,
            batch_size=1,
            num_repetitions=1,
            remove_silent_section=True,
            verbose=False,
        )
    )


def error_rates(reference: str, hypothesis: str) -> tuple[float, float]:
    import jiwer

    if not reference:
        raise RuntimeError("Normalized reference prompt is empty.")
    return float(jiwer.wer(reference, hypothesis)), float(jiwer.cer(reference, hypothesis))


def aggregate_scores(
    run_id: str,
    plan: dict[str, Any],
    scores: dict[str, dict[str, Any]],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    successful = [score for score in scores.values() if score.get("status") == "succeeded"]
    providers: dict[str, Any] = {}
    for provider in ("cartesia", "elevenlabs"):
        provider_scores = [score for score in successful if score["provider"] == provider]
        providers[provider] = {
            "model": plan["models"][provider],
            "sampleCount": len(provider_scores),
            "speakerSimilarity": distribution(
                [score["speakerSimilarity"] for score in provider_scores]
            ),
            "wordErrorRate": distribution([score["wordErrorRate"] for score in provider_scores]),
            "characterErrorRate": distribution(
                [score["characterErrorRate"] for score in provider_scores]
            ),
            "predictedNaturalness": distribution(
                [score["predictedNaturalness"] for score in provider_scores]
            ),
            "generationLatencyMs": distribution(
                [float(score["generationLatencyMs"]) for score in provider_scores]
            ),
        }

    pairs: list[dict[str, Any]] = []
    case_ids = sorted({score["caseId"] for score in successful})
    for case_id in case_ids:
        by_provider = {
            score["provider"]: score for score in successful if score["caseId"] == case_id
        }
        if set(by_provider) != {"cartesia", "elevenlabs"}:
            continue
        cartesia = by_provider["cartesia"]
        elevenlabs = by_provider["elevenlabs"]
        pairs.append(
            {
                "caseId": case_id,
                "speakerSimilarityDeltaElevenLabsMinusCartesia": elevenlabs[
                    "speakerSimilarity"
                ]
                - cartesia["speakerSimilarity"],
                "wordErrorRateDeltaElevenLabsMinusCartesia": elevenlabs["wordErrorRate"]
                - cartesia["wordErrorRate"],
                "predictedNaturalnessDeltaElevenLabsMinusCartesia": elevenlabs[
                    "predictedNaturalness"
                ]
                - cartesia["predictedNaturalness"],
                "latencyMsDeltaElevenLabsMinusCartesia": elevenlabs["generationLatencyMs"]
                - cartesia["generationLatencyMs"],
            }
        )
    return {
        "schemaVersion": 1,
        "runId": run_id,
        "generatedAt": utc_now(),
        "promptSetVersion": plan["promptSetVersion"],
        "participantCount": len(plan["participants"]),
        "pairedCaseCount": len(pairs),
        "providers": providers,
        "pairedDeltas": {
            "speakerSimilarityElevenLabsMinusCartesia": distribution(
                [pair["speakerSimilarityDeltaElevenLabsMinusCartesia"] for pair in pairs]
            ),
            "wordErrorRateElevenLabsMinusCartesia": distribution(
                [pair["wordErrorRateDeltaElevenLabsMinusCartesia"] for pair in pairs]
            ),
            "predictedNaturalnessElevenLabsMinusCartesia": distribution(
                [
                    pair["predictedNaturalnessDeltaElevenLabsMinusCartesia"]
                    for pair in pairs
                ]
            ),
            "latencyMsElevenLabsMinusCartesia": distribution(
                [float(pair["latencyMsDeltaElevenLabsMinusCartesia"]) for pair in pairs]
            ),
        },
        "evaluatorVersions": metadata["evaluators"],
        "limitations": [
            "Four speakers are sufficient for an initial controlled evaluation, not a population-level claim.",
            "ECAPA cosine similarity and Whisper error rates are supporting metrics, not substitutes for blinded human ratings.",
            "UTMOSv2 is a predicted opinion score and does not replace blinded listener ratings.",
        ],
    }


def distribution(values: list[float]) -> dict[str, float | int | None]:
    clean = [value for value in values if math.isfinite(value)]
    if not clean:
        return {"count": 0, "median": None, "q1": None, "q3": None, "mean": None}
    ordered = sorted(clean)
    return {
        "count": len(ordered),
        "median": statistics.median(ordered),
        "q1": percentile(ordered, 0.25),
        "q3": percentile(ordered, 0.75),
        "mean": statistics.fmean(ordered),
    }


def percentile(ordered: list[float], quantile: float) -> float:
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * quantile
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return ordered[lower]
    weight = position - lower
    return ordered[lower] * (1 - weight) + ordered[upper] * weight


def write_private_csv(path: Path, scores: dict[str, dict[str, Any]]) -> None:
    successful = [score for score in scores.values() if score.get("status") == "succeeded"]
    fields = [
        "caseId",
        "speakerId",
        "promptKey",
        "provider",
        "model",
        "speakerSimilarity",
        "wordErrorRate",
        "characterErrorRate",
        "predictedNaturalness",
        "transcription",
        "generationLatencyMs",
        "outputBytes",
        "evaluationLatencyMs",
        "updatedAt",
    ]
    temporary = path.with_suffix(".tmp.csv")
    with temporary.open("w", encoding="utf8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for score in sorted(successful, key=lambda value: (value["caseId"], value["provider"])):
            writer.writerow({field: score.get(field) for field in fields})
    os.replace(temporary, path)
    path.chmod(0o600)


def write_private_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf8", dir=path.parent, delete=False
    ) as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write("\n")
        temporary = Path(handle.name)
    temporary.chmod(0o600)
    os.replace(temporary, path)
    path.chmod(0o600)


def read_json(path: Path) -> Any:
    with path.open(encoding="utf8") as handle:
        return json.load(handle)


def package_version(name: str) -> str:
    return importlib.metadata.version(name)


def utc_now() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def print_summary(summary: dict[str, Any]) -> None:
    print("\nAutomated evaluation completed.")
    for provider, values in summary["providers"].items():
        similarity = values["speakerSimilarity"]["median"]
        word_error_rate = values["wordErrorRate"]["median"]
        latency = values["generationLatencyMs"]["median"]
        naturalness = values["predictedNaturalness"]["median"]
        print(
            f"{provider}: median similarity={similarity:.4f}, "
            f"median WER={word_error_rate:.4f}, median UTMOS={naturalness:.3f}, "
            f"median latency={latency:.0f}ms"
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Evaluation stopped: {error}", file=sys.stderr)
        raise
