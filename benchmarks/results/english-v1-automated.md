# English voice-cloning benchmark: final initial evaluation

Status: automated and provider-blinded listener evaluations complete.

## Experiment

- Four consenting adult speakers
- One enrollment recording and one held-out reference recording per speaker
- Six fixed English prompts per speaker
- 24 paired cases and 48 generated clips
- Identical enrollment bytes and prompt text supplied to both providers
- Cartesia `sonic-3.6-2026-08-27` compared with ElevenLabs `eleven_v4`
- Provider order alternated by case; failed generations: 0

Source recordings, generated clips, transcriptions, consent records, provider voice IDs, and participant identity mappings remain private and are excluded from Git.

## Results

| Metric | Cartesia median (IQR) | ElevenLabs median (IQR) | Paired result |
| --- | ---: | ---: | --- |
| Speaker similarity, ECAPA cosine | 0.821 (0.776–0.860) | 0.783 (0.741–0.816) | Cartesia won 18 of 24 pairs; median ElevenLabs-minus-Cartesia delta −0.045 |
| Predicted naturalness, UTMOSv2 MOS | 3.150 (2.944–3.277) | 3.214 (3.078–3.313) | ElevenLabs won 15 of 24 pairs; median delta +0.113 |
| Word error rate | 0.000 (0.000–0.000) | 0.000 (0.000–0.000) | Median paired delta 0.000 |
| Generation latency | 1,126 ms (992–1,424) | 1,730 ms (1,536–2,157) | Cartesia was faster in all 24 pairs; median delta +634 ms |

The automated signals show a tradeoff rather than a universal winner. Cartesia preserved the held-out speaker representation more closely and generated every paired sample faster. ElevenLabs received a modestly higher predicted-naturalness score. Both providers had a median word error rate of zero, so intelligibility did not meaningfully separate them in this English slice.

## Provider-blinded human results

Three independent reviewers evaluated all 24 paired cases through private, independently randomized survey links. For each pair, reviewers selected Cartesia, ElevenLabs, or “about the same” for speaker similarity, naturalness, and pronunciation. This produced 72 judgments per metric and 216 focused listening decisions overall.

| Metric | Cartesia | ElevenLabs | Tie |
| --- | ---: | ---: | ---: |
| Speaker similarity | 48 (66.7%) | 5 (6.9%) | 19 (26.4%) |
| Naturalness | 38 (52.8%) | 2 (2.8%) | 32 (44.4%) |
| Pronunciation | 6 (8.3%) | 16 (22.2%) | 50 (69.4%) |

Cartesia received 90.6% of non-tied similarity preferences and 95.0% of non-tied naturalness preferences. All three reviewers independently favored Cartesia for speaker similarity. Pronunciation did not yield a stable provider-level conclusion: two reviewers overwhelmingly selected ties, while one reviewer favored ElevenLabs. The disagreement is retained as a limitation rather than collapsed into a universal pronunciation claim.

Together, the automated and human signals support Cartesia for the current MVP. Recognizable speaker identity is WithYou's primary quality gate, and Cartesia led that measure in both evaluation modes while also reducing median generation latency by 604 ms. ElevenLabs' modest UTMOS advantage demonstrates why a model proxy alone should not determine the product decision.

## Evaluators and reproducibility

- Speaker similarity: SpeechBrain `spkrec-ecapa-voxceleb`, cosine similarity against the held-out reference
- Intelligibility: OpenAI Whisper `base.en` and JiWER 4.0.0 after English text normalization
- Predicted naturalness: official UTMOSv2 1.3.0 `fusion_stage3`, fold 0, seed 42
- Analysis audio: mono, 16-bit PCM, 16 kHz
- Package versions, the resolved SpeechBrain model revision, per-clip checkpoints, and the prompt-set digest are retained with the private run metadata

The implementation and complete protocol are documented in [`docs/BENCHMARKING.md`](../../docs/BENCHMARKING.md). The public prompt set is versioned at [`benchmarks/prompts/v1.json`](../prompts/v1.json).

## Limitations and next gate

This is a controlled product experiment with four speakers and three reviewers, not a population-level study or a statistical-significance claim. ECAPA similarity, Whisper error rates, and UTMOSv2 remain proxy metrics, and the human sample is intentionally small. The next gate is a smaller multilingual study with native-language reviewers, consistent recording conditions, and per-language reporting rather than one blended score.
