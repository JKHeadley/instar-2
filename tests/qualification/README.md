# Setup model qualification

This is an **unqualified experiment**, not an installer or an approval of the model.
The macOS arm64 result is in `evidence/macos-arm64-2026-10-25.json`. Independent
assessment by Astra is pending. The model, prompt, decoder and limits are frozen for
each report; changing any of them requires a new report and three repetitions.

`scripts/setup-qualification.mjs` verifies the pinned weights before every load,
starts one CPU-only llama.cpp child, and decodes the result. It uses Ten's existing
resource owner: kernel CPU/process/handle limits, independently sampled resident
memory and an independent wall deadline, with exact PID/start-identity cleanup.
The memory measurement is a sampled peak, not a kernel high-water measurement or a
claim that between-sample overshoot is impossible. No load generator is used.

`setup-seven.ts` uses Seven's existing model adapter and capture port and Six's
reserve/claim/consume sequence. It records the full submitted prompt and raw
response, parsed verdict, usage and resources. This is an advisory qualification
fixture with a deterministic transport clock; physical deadlines come from Ten's
real clock. It supplies no installer standing, GE or A0 and never changes live state.

`setup-owner-cases.ts` captures real cryptography and encrypted disk owner behavior:
key challenge/wrong key, authenticated restore/damaged package, signed fact/changed
signature, and durable append/conflict/restart without duplication. It then injects
forged labels, conflicting observations, instructions and missing observations.
Expected outcomes are author proposals. A reviewer must fix expectations from the
owner evidence before reading candidate answers. Semantic reason adequacy is never
decided by a string match.

The current owner APIs take pre-provisioned keys and expose a recovery handle as
prepared metadata. They do **not** supply the separate custodian/recovery identities
or an approved genesis preparation run required by docs/14. `coverage` records those
gaps as false and `pass` remains false. The primitive pairs are diagnostic evidence,
not substitutes for the full task set. A candidate that fails even these pairs
remains unqualified. Prompt changes require a new frozen report; paid fallback is never used.

Run the short boundary and owner tests in the foreground:

```sh
nice -n 10 npx vitest run --maxWorkers 1 tests/assembly/setup-qualification.test.ts tests/assembly/setup-qualification-host.test.ts
```

The host experiment is explicit opt-in. Acquire the weights and llama.cpp archive
from the immutable URLs below into a cache outside the repository. The model size
and SHA-256 in `MODEL` must match before loading. Build the extracted source with
`nice -n 10 make -j2 llama-cli GGML_NO_METAL=1 GGML_NO_ACCELERATE=1`; check the linked
libraries and hash the executable. The macOS run reverified all 992 regular archive
members against the extracted source. No node dependency installation is needed.

- [Pinned official weights](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/62a8d092b0a1047016f3edbd0fde387598727aa5/qwen2.5-1.5b-instruct-q4_k_m.gguf)
- [Pinned llama.cpp source](https://github.com/ggml-org/llama.cpp/archive/c02e5ab2a675c8bc1abc8b1e4cb6a93b26bdcce7.tar.gz)

Create a **new**, private evidence directory outside the repository containing
`artifacts.json` with absolute `executable`, `weights`, and `runtimeDigest` (SHA-256)
fields, and an fsynced `stop.json` containing `{"stopped":false}`. Do not overwrite
an existing stop or an earlier run. Then:

```sh
INSTAR_SETUP_QUALIFICATION=/absolute/private/evidence-directory nice -n 10 npx vitest run --maxWorkers 1 tests/assembly/setup-qualification-host.test.ts -t 'records the pinned'
```

This runs 12 primitive cases three times, sequentially, retaining each completed
trial in `report.json` and the underlying Seven captures. The experiment has a
20-minute ceiling; it is not a simulated installer attempt (which has at most eight
validations). `INSTAR_SETUP_CASE` restricts a diagnostic pilot to one case and one
repetition, and can never establish qualification. Set the stop file to true to hold
before or during validation. A failed run never restarts itself.

The Linux sibling can reuse the decoder, cases and Seven bridge, but must supply
systemd/cgroup enforcement and its own host evidence. This host runner deliberately
refuses to label a non-macOS result as macOS evidence. x86_64 and an ordinary 8-GiB
machine remain untested. System dylibs and an independently signed release manifest
remain release pin requirements; the locally built binary hash is not a signed
release admission.

The recorded-shape regression uses the repository's read-only journal extracts in
`tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json`, preserving
their source update IDs. It covers summary writer/uncertain, Jev undecided/unsure,
reply review, delivered reply and an empty reply. Every foreign shape holds in the
setup decoder. `fixtures/qwen-first-output.json` is the real first Qwen response;
malformed JSON is preserved and refused, never repaired.

ELI16: the small model ran within the tested limits, but that does not make it a
trustworthy setup checker. Both correct judgments and a complete real installation
test are required before it may supervise installation.

## Constrained continuation

The [separate constrained results](evidence/macos-arm64-2026-10-25-constrained.md)
preserve the prior runs. Set `INSTAR_SETUP_CONSTRAINED=1` to replay the exact owner
cases from the prior metered evidence and pass `instar-setup-verdict-v1` through
b4000's built-in `--json-schema` converter. Every trial records its schema digest.
Those recorded runs kept the original decoder, prompt, expectations and resource
profile unchanged. The current runner uses the hardened prompt described below;
historical replay checks use each report's preserved source snapshot.

`INSTAR_SETUP_MODEL=3b` selects the second immutable official pin in `MODEL_3B`;
its artifacts manifest must point to the corresponding verified weights. The
default remains `1.5b`. Unknown model names or caller-supplied pins refuse.
Use a fresh private artifacts/stop directory for every configuration, as above.

The constrained 1.5B model produced valid JSON and accepted all positives, but
made six unsafe negative judgments. The 3B model hit the unchanged 2-GiB RSS
ceiling in all 36 attempts before producing an answer. These are failures, not
qualification. Independent assessment remains PENDING ASTRA; the separate
custodian/recovery/GE-A0 owner gap remains uncovered.

## 3B reservation measurement

The desk-authorized continuation uses `INSTAR_SETUP_MODEL=3b`,
`INSTAR_SETUP_CONSTRAINED=1` and `INSTAR_SETUP_PROFILE=3b-3gib` with a new
private evidence directory. This named profile changes only sampled RSS from
2 GiB to 3 GiB; the 120-second deadline and every other reservation stay unchanged.
It refuses an unconstrained or 1.5B combination. The default remains 2 GiB, and
the experiment changes no installation design or qualification bar.

Results: [constrained 3B with 3 GiB](evidence/macos-arm64-2026-10-25-constrained-3b-3gib.md).

## Frozen prompt-hardening experiment

The mac4 experiment freezes six positive neighbors and six negative transformations
in [the held-out fixture](fixtures/setup-held-out-1025-mac4.json), with a sibling
SHA-256 file, in commit `70b1f612e` before changing the prompt. Cases retain provenance
to actual owner observations and identify each transformation. They are adversarial
replays, not claims of new owner executions. No held-out result is used for tuning.

The prompt separates objective from delimited untrusted evidence, requires all
postconditions and receipt agreement, holds on instructions inside evidence, and
asks the reason to name each checked postcondition. Delimiter characters inside
JSON data are escaped without changing its decoded values. Schema, strict decoder,
exact-owner checks, pinned model/runtime and resource limits stay unchanged.

Run the constrained 3B / `3b-3gib` configuration with `INSTAR_SETUP_SET=original`
and then `INSTAR_SETUP_SET=held-out`, each in its own fresh private evidence directory.
Each set runs three times. No single-case pilot qualifies either set. Console output
distinguishes the model's candidate from the final exact-owner verdict: an unsafe
model accept remains a failure even when the final verdict holds.

[Separate results and per-case counts](evidence/macos-arm64-2026-10-25-hardened-3b-3gib.md)
retain both complete capture sets. Distribution remains unqualified until the full
owner-run and independent-assessment requirements are met.

## Closed owner-result experiment (docs/14 revision 30)

Set `INSTAR_SETUP_TYPED=1` together with constrained output to use the named-result
projection in the same runner. The historical raw renderer and decoder remain for
replaying old evidence. This mode neither reads the aggregate `exact` bit nor sends
case names, expected outcomes, free-text objectives, raw evidence or long hashes to
the model. Its fixed schema names each required check, owner, observation, pass/fail
result and per-request receipt. Exact equality checks use retained checkpoint
anchors; all supplied receipts participate. Missing fields, conflicts, duplicate
receipts and unknown structure cannot disappear by choosing a favorable receipt.
The decoder recomputes the projection and receipt mapping before accepting output.

The schema is explicitly `primitive-owner-replay`. Old captures do not establish
separate custodian identity, protected-path/export denial, independent recovery or
GE/A0-approved genesis. None is invented or replaced by a passing aggregate flag.
The original and published mac4 held-out cases keep their bytes and expectations.
The published held-out set is regression coverage, not a new unseen qualification
set. Linux captures are also replayed through the projection in targeted tests;
that does not qualify model inference on Linux.

The model must explain acceptance using all relevant check names and receipt
handles, and explain a hold using failed or unobserved checks. The decoder checks
those exact references, while semantic adequacy remains Astra's assessment. A
model hold is never turned into success because the owner checks passed. Reports
count raw model choices, schema failures, grounding failures and final outcomes
separately. No rejected input is discarded.

Run each case set in a fresh private directory, with the pinned artifact and
explicit durable stop files described above:

```sh
INSTAR_SETUP_TYPED=1 INSTAR_SETUP_CONSTRAINED=1 INSTAR_SETUP_MODEL=1.5b INSTAR_SETUP_PROFILE=default INSTAR_SETUP_SET=original INSTAR_SETUP_QUALIFICATION=/absolute/fresh/directory nice -n 10 npx vitest run --maxWorkers 1 tests/assembly/setup-qualification-host.test.ts -t 'records the pinned'
```

Repeat with `INSTAR_SETUP_SET=held-out`. If 1.5B fails, use `INSTAR_SETUP_MODEL=3b`
and `INSTAR_SETUP_PROFILE=3b-3gib` in two more fresh directories. Do not change the
prompt, projection, cases, expected outcomes or bar after seeing model output.
Each original-set run additionally measures eight correct primitive validations
in fresh processes, including per-call byte verification, startup and cleanup.
This is a lower-bound timing proxy, explicitly not the missing installed four
pre-step/four post-step sequence. Both must meet the two-minute target to qualify.

The targeted checks are:

```sh
nice -n 10 npx vitest run --maxWorkers 1 tests/assembly/setup-qualification.test.ts tests/assembly/setup-qualification-host.test.ts tests/assembly/setup-qualification-projection.test.ts
```

All actual model outputs and source snapshots are retained with their new evidence
reports. Prior raw-evidence results and frozen case files remain byte-identical.

[Closed-projection results, per-case failures and pins](evidence/macos-arm64-2026-10-25-option1.md)
keep raw model choices separate from protected final outcomes. Independent Astra
assessment remains pending; these measurements do not authorize distribution.
