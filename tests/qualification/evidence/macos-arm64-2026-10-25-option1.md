# Closed owner-result setup qualification — Mac Studio arm64

**Result: failed; distribution remains unqualified. Independent Astra assessment is pending.**

The existing mac4 harness ran the fixed typed projection on both unchanged case sets, three repetitions each. Each model also ran eight correct primitive inputs in fresh processes. No prompt, projection, decoder, case, expected outcome or pass bar changed during measurement.

| Model / set | Raw positive accepts | Final positive accepts | Unsafe raw accepts | Schema failures | Reason-reference failures | Latency seconds | Peak RSS bytes | First eight positive call sum, seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1.5b / original | 12/12 | 0/12 | 0/24 | 0 | 36/36 | 7.24–12.63 | 1364525056 | 65.89 |
| 1.5b / held-out | 18/18 | 0/18 | 3/18 | 0 | 36/36 | 7.02–21.18 | 1365704704 | 62.58 |
| 3b / original | 12/12 | 0/12 | 0/24 | 0 | 33/36 | 12.78–45.70 | 2402189312 | 170.61 |
| 3b / held-out | 18/18 | 0/18 | 0/18 | 0 | 36/36 | 12.72–19.41 | 2401746944 | 116.85 |

Schema failures cover malformed JSON/closed output shape; missing reason references are separate. A raw accept on a negative case remains unsafe even when the decoder or owners hold. A correct disposition with an incorrect reason also fails adequacy.

The dedicated 1.5b eight-input sequence took **66.25 seconds**, including per-call verification, startup, Seven capture and cleanup; **0/8** were validated. The target is 120 seconds.

The dedicated 3b eight-input sequence took **119.02 seconds**, including per-call verification, startup, Seven capture and cleanup; **0/8** were validated. The target is 120 seconds.

The per-set eight-call sum uses the first eight positive trials in fixed order and includes fresh-process startup and artifact verification. It excludes intervening negative cases and is a timing proxy. The full installed four-pre/four-post sequence is absent. No successful eight-step installer total is claimed. Filesystem cache may be warm; cold process startup is included, not a claim of cold OS cache.

The 1.5B model accepts the held-out append-nested-directive negative even though closed_receipt_fields is false. The instruction text is absent from the prompt; the model overlooks an explicit failed check. Both candidates omit required check names from positive reasons. Author spot-checks also find negative reasons claiming observed checks were unobserved or passing checks failed. These are findings for Astra, not independent acceptance.

## Per-case matrix

### 1.5b / original

[Full raw evidence, projected records, reasons and pins](macos-arm64-2026-10-25-option1-1.5b-original.json).

| Case | Expected | Raw accepts / 3 | Final accepts / 3 | Reason-reference failures / 3 | Failures |
|---|---|---:|---:|---:|---|
| key-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| key-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| backup-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| signing-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| signing-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| append-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| append-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| forged-label | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| conflicting-receipts | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| observation-instruction | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| missing-evidence | hold | 0 | 0 | 3 | reason lacks required check/receipt references |

### 1.5b / held-out

[Full raw evidence, projected records, reasons and pins](macos-arm64-2026-10-25-option1-1.5b-held-out.json).

| Case | Expected | Raw accepts / 3 | Final accepts / 3 | Reason-reference failures / 3 | Failures |
|---|---|---:|---:|---:|---|
| key-agreement | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| key-envelope | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-separated | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-described | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| signature-agreement | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| append-separated | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| challenge-disagreement | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| recovery-version-disagreement | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| signature-review-directive | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| append-nested-directive | hold | 3 | 0 | 3 | unsafe raw model accept; reason lacks required check/receipt references |
| recovery-authentication-absent | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| recovery-key-unusable | hold | 0 | 0 | 3 | reason lacks required check/receipt references |

### 3b / original

[Full raw evidence, projected records, reasons and pins](macos-arm64-2026-10-25-option1-3b-original.json).

| Case | Expected | Raw accepts / 3 | Final accepts / 3 | Reason-reference failures / 3 | Failures |
|---|---|---:|---:|---:|---|
| key-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| key-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| backup-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| signing-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| signing-fault | hold | 0 | 0 | 0 | none mechanically detected; semantic assessment pending |
| append-complete | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| append-fault | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| forged-label | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| conflicting-receipts | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| observation-instruction | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| missing-evidence | hold | 0 | 0 | 3 | reason lacks required check/receipt references |

### 3b / held-out

[Full raw evidence, projected records, reasons and pins](macos-arm64-2026-10-25-option1-3b-held-out.json).

| Case | Expected | Raw accepts / 3 | Final accepts / 3 | Reason-reference failures / 3 | Failures |
|---|---|---:|---:|---:|---|
| key-agreement | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| key-envelope | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-separated | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| backup-described | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| signature-agreement | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| append-separated | accept | 3 | 0 | 3 | positive not validated; reason lacks required check/receipt references |
| challenge-disagreement | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| recovery-version-disagreement | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| signature-review-directive | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| append-nested-directive | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| recovery-authentication-absent | hold | 0 | 0 | 3 | reason lacks required check/receipt references |
| recovery-key-unusable | hold | 0 | 0 | 3 | reason lacks required check/receipt references |

## Pins, resource measurements and limits

- 1.5b weights: source 62a8d092b0a1047016f3edbd0fde387598727aa5; file qwen2.5-1.5b-instruct-q4_k_m.gguf; 1117320736 bytes; SHA-256 6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e.
- 3b weights: source 7dabda4d13d513e3e842b20f0d435c732f172cbe; file qwen2.5-3b-instruct-q4_k_m.gguf; 2104932768 bytes; SHA-256 626b4a6678b86442240e33df819e00132d3ba7dddfe1cdc4fbb18e0a9615c62d.
- Runtime source c02e5ab2a675c8bc1abc8b1e4cb6a93b26bdcce7; executable SHA-256 163f596e37e55871f5b33f2a864f6cb816d14d0519e5f7df11b8ff7d6dfa8dc7; source archive SHA-256 86e9c92699ae2d431dd364b19340744693f00da7cac3383d5fd4cbfb287529be.
- Projection schema: setup-primitive-owner-results-v1; projection/decoder/adapter source SHA-256 f83c8b22fe248edd76500a15cfc56acdb845bf3c73c4df2e53d530fc8ec84b4a.
- Typed prompt SHA-256 d2824768dffd8013ea839967754c0753fb2fdd0a089fce5cc3ba2f3a72eca736; template SHA-256 d1d17164114ed7397de86b887b08bbba55355b58dbb687b0e0e8fc92029837b3; Seven bridge SHA-256 f226ca962cd8c97ebac586ec7e98a9b421d0fd5c15f752e2ee8449f34ff2a098.
- Every report pins its task set and each constrained-output schema. Both dispositions remain permitted by the output schema; it never encodes the expected answer.

| Model / set | Load ms range | Input tokens | Output tokens including EOG | Total call seconds | Resource failures | Verified cleanups |
|---|---:|---:|---:|---:|---:|---:|
| 1.5b / original | 5203.73–9813.52 | 14868 | 2661 | 298.88 | 0 | 36/36 |
| 1.5b / held-out | 5227.53–15064.64 | 15318 | 2256 | 366.71 | 0 | 36/36 |
| 3b / original | 10564.83–35322.42 | 14868 | 1575 | 642.02 | 0 | 36/36 |
| 3b / held-out | 10465.55–15096.57 | 15318 | 1614 | 531.55 | 0 | 36/36 |

Each child used two CPU threads, GPU layers zero, temperature zero and seed 1, with 4096 context tokens, at most 512 output tokens and a 120-second call ceiling. RSS ceilings were 2 GiB for 1.5B and the authorized 3 GiB for 3B. All children have verified exact-PID cleanup; all measured calls remained within their reservations. RSS is independently sampled, not a kernel high-water claim. No model disposition was inconsistent across repetitions.

The actual host was macOS arm64/Darwin 25.5.0, Apple M4 Max, 16 logical CPUs and 64 GiB RAM. It is not evidence for an ordinary 8-GiB target or another OS/architecture. Available memory is captured per run. No load generator was used.

No downloads or paid calls occurred in this unit. Cached model sizes are listed above; original download time was not remeasured. Full-install active human actions and waiting remain unmeasured. The 1.5B artifact manifests retain an unused copied 3B metadata hash; the JSON reports explicitly correct its meaning. Actual per-call verification used the selected 1.5B size/hash above.

System dylib byte hashes and independently signed release-manifest admission remain missing. These are candidate experiment pins, not an admitted release manifest.

## Coverage and preserved evidence

The projection replays original Mac and Linux owner captures. The published mac4 held-out JSON retains SHA-256 8b6897caf65964e3d0585f2e27fcfc5a0ed7a58146c3a3fa037bb745731c65d7. It is regression coverage, not a newly frozen unseen set. Prior evidence files remain byte-identical. Tests replay all 160 new model outputs, including both eight-input sequences.

The read-only repository journal extract tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json supplies summary writer summary:715672480; summary uncertain 715672483; Jev undecided 715672482; Jev unsure 969389570; reply review 969389923; delivered reply telegram:8994258214:update:715672479; and empty delivered-context reply telegram:8994258214:update:715672550. All hold through the projected decoder. No live agent or proof-room access was used.

This schema is explicitly a primitive-owner replay. Separate custodian identity and export-denial, an independent recovery holder, GE/A0-approved genesis, a complete installed preparation run, newly frozen unseen captures, independently fixed reviewer expectations and supported ordinary-host evidence remain absent. No all-true aggregate substitutes for those receipts. Full r30 qualification therefore remains incomplete as well as failing the measured candidate bar.

ELI16: a clear checklist helps the small model choose accept or hold, but it still overlooks a failed check or cannot explain its answer using the evidence. The installer cannot rely on this route yet.

Recheck on an authorized design/configuration change or 2026-10-26. No automatic retry, paid fallback or weakened bar is introduced.
