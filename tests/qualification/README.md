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
remains unqualified; no prompt tuning or paid fallback is performed here.

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
