# Change review — structured setup verdict grounding

Subject base: d7f96a7cbebec3a23e5b1e31bf79582221789370
Review state: open
Reviewed content: none
Outcome: Make the setup model cite named owner checks, their observed/passed values and receipt handles in its constrained output, then measure the unchanged 3B qualification cases and bar.
Affected rules: 1, 4, 12, 13, 26, 27, 32, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 74, 75, 95, 100, 101, 107, 108, 111, 112, 113, 116; purpose Rule 3.
Affected floors: secrets unchanged; spend cap unchanged; durable intake preserved; no duplicate sends;  public isolated owner observations only; no secret access or paid calls; durable stop before/during dispatch; no sends or duplicate effects; retained inputs and Seven captures.
Operator questions: none. The desk authorized the output-shape change and 3B-only experiment with a 3-GiB reservation.
Suggested tier: significant
Declared tier: significant
Tier rationale: The model output contract and decoder affect accept/hold; both recorded shapes and real inference are required.
Side effects: A longer structured output can increase inference latency or reach the unchanged 512-token ceiling. Per-call name/receipt enums restrict vocabulary but deliberately leave both dispositions and boolean values available. The decoder reports a wrong observed value, pass value or name-to-receipt mapping as a cited-check misstatement, even for a model hold. Omitted required citations are a separate adequacy failure. Historical evidence is preserved, and the current decoder rejects its obsolete prose-only contract.
Undo and recovery: Revert the output-schema change without deleting evidence. Fresh private run directories retain durable stop and captured outcomes. No automatic retries, model fallback, deployment or live-state change.
Multi-machine posture: Machine-local Mac Studio CPU measurement. Source and captures travel in git. No claim about another OS, architecture or an ordinary 8-GiB machine.
Layer below: Constitution, docs/14 r30, unchanged typed projection and exact owners, original Mac/Linux captures, frozen mac4 held-out fixture, pinned runtime/weights, Seven/Six admission and Ten resource bounds. Separate custodian identity, independent recovery, GE/A0-approved genesis and a full installed preparation run remain absent from this primitive corpus.
Bug class: none
Bug evidence: none
Hook bypass: none. core.hooksPath is unset; the resolved common hooks directory contains only samples.
Convergence: none


The prompt's decision intent, cases, expectations and bar remain unchanged. The output instructions alone explain the new shape. Both case sets run three times with no tuning during measurement. Docs/14 specifies one noninteractive child per validation; warm process reuse would be a separate desk design decision and is not implemented.

ELI16: The model now hands back a checklist showing which facts it used and where each fact came from. Code compares that checklist with the original receipts. A made-up fact cannot pass just because the model's final yes/no answer sounds right. The model still has to make the right decision, explain it honestly and finish fast enough.

Measured result: All 72 requested case trials completed. Original: 12/12 raw and final positives, 0/24 unsafe accepts, 0 schema failures, 9/36 cited-check misstatement trials and 3/36 missing-citation primary failures. Held-out: 18/18 raw and final positives, 0/18 unsafe, 0 schema failures, 12/36 cited-check misstatement trials and 3/36 missing-citation primary failures. Author factual-error review finds 24/36 original and 15/36 held-out prose reasons wrong; this is not independent Astra acceptance. Per-case outputs repeat identically across all three repetitions.

Timing: Complete fixed-order eight-positive call sums are 233.36 seconds (113.36 over target, 118.10 seconds loading) and 187.58 seconds (67.58 over, 107.24 seconds loading). The original experiment reached its unchanged 20-minute ceiling after all 36 cases and seven extra timing calls; those seven alone took 154.90 seconds. The eighth extra call has no completed response or owner-cleanup receipt and remains unknown. Its recorded exact PID was absent on readback after the timeout; stop was persisted. No limit increase or retry was used. Held-out capture completed in 806.57 seconds. There are 79 completed/captured calls with verified cleanup and one interrupted call with absent-PID readback only. This extra-call limitation is separate from the complete 72-case matrix.

Evidence: tests/qualification/evidence/macos-arm64-2026-10-25-option1b.md and its linked raw JSON/manifest. The original private report remains unchanged; its published copy labels and hashes post-timeout counter aggregation. The timed-out call's resource snapshot is preserved verbatim with a SHA-256 pin. No missing result becomes an accept, hold or verified-cleanup claim.


Verification: The failing schema/decoder test preceded implementation. Final targeted regression run: 24 passed, one explicit inference opt-in skipped. It replays all 79 completed new captures, the prior typed captures, Mac/Linux owner records, frozen cases, and actual summary/uncertain/Jev/reply/empty shapes. The interrupted 80th launch is separately preserved without a fabricated completion. Typecheck, architecture/lint and register:check exit 0; register wiring reports issues: []. Whitespace checks exit 0. The original opted-in experiment's overall timeout is retained as a failed measurement, not hidden by the green offline replay. The held-out opted-in experiment exits 0 for capture completion, not qualification.

simplestRobustRoute: Extend the existing verdict schema and decoder with a closed citation array instead of extracting references from free text. This is the simplest robust route: it prevents the measured missing-reference and false-reference failures with exact comparisons against current owner records, without another model, semantic keyword gate or runner. Start guards are verified artifact pins and durable stop; bounds remain one child, two CPU threads, 3 GiB, 512 output tokens and 120 seconds per call. Accept needs every required citation true and exact, plus the model's accept; a hold stays held. Semantic explanation adequacy remains independently judged. No unattended installed-completion claim is made.
80/20: Preserve the failed qualification evidence and explicit installer gaps; this record repairs coverage and makes no independent acceptance claim.
VERDICT: failed qualification. Independent assessment PENDING ASTRA. No route is promoted.
