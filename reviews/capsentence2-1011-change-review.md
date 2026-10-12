# Change review — Keep capability limits in record quotations

Subject base: 12688b891e80d94d12afec45f588ee00e998e111
Review state: open
Reviewed content: none
Outcome: Capability answers quote the rendered tools/outbound record and keep every limit out of free-text descriptions.
Affected rules: Purpose self-knowledge and sourced limits; 10, 12, 18, 36, 47, 49, 58, 70, 74, 78, 84, 101, 103, 104, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Model-facing instruction correction; generated provenance raises the suggested tier, but no capability or admission behavior changes.
Side effects: Capability descriptions suppress paraphrased limits including unavailable-information asides; exact record quotations retain real limits. Context budget is checked without changing its bound. Historical outputs remain immutable.
Undo and recovery: Revert this change and regenerate register pins. No schema or installation migration.
Multi-machine posture: Shared deterministic instructions on every machine; no new product state, ownership or replication change. Desk evidence remains machine-local.
Layer below: Rendered capability record and provenance, instruction injection, recorded turn 840342414 including missing desk report, context byte floor and unchanged effect admission.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory inspected, samples only
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: The instruction constrains presentation against the actual record rather than deciding meaning by keywords. K11 remains unchanged and judges the free prose. Recorded old outputs are preserved with explicit translation of the superseded instruction.
Prompt finding: 034c5250da92 | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "run without another yes. the operator can tighten or revoke trust through setup-"
Prompt finding: 45e37ea2e9e9 | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"
Prompt finding: 4b98dc2a1b9f | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 6af48f94b789 | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "sends remain outside the one-machine closed set. the effect doorway reports any "
Prompt finding: 95e349aaf4ac | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: b00ed403060a | protocol-literal | Historical capture retains the existing capability protocol; no meaning classifier — fixture-phrase src/assembly/production-provider.ts <- tests/preview/selfdesc-abilities.test.ts: "checked when made. workspace work and public reads are already allowed. register"

Evidence: tests/preview/fixtures/capsentence2-2026-10-11.json and tests/preview/selfdesc-abilities.test.ts bind the actual model outputs to this checkout. Verification artifacts are recorded in the absolute lanes/capsentence2-1011-PROGRESS.md. The first exploratory answer retained a missing-status aside. Clarified that missing information also stays out of free text, and compressed the instruction after a context-floor failure; all six floor tests then passed at unchanged bounds. Exploratory replay 2 still added a missing-status limit; replay 3 obeyed the explicit no-asides rule. Removed redundant identity wording to fit that rule within the unchanged budget; 26 context and instruction-boundary tests pass. Ten final foreground replays (runs 4–13, instruction head 0ea0236b) of real update 840342414 all PASS the unchanged K11 v3 judge. Each answer quotes the rendered paragraph exactly once; the builder read each free-text remainder and found no limits or missing-status asides. The immutable capture and its digest-bound assertions preserve all ten results plus the original K11 FAIL. Final-head checks confirm these instructions and record bytes still match.

Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:28 | not-a-deferral=Immutable recorded model output describes the capabilities question as a follow-up to its preceding identity question; no builder work is deferred.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:323 | not-a-deferral=Immutable recorded model output describes the capabilities question as a follow-up to its preceding identity question; no builder work is deferred.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:382 | not-a-deferral=Immutable recorded model output describes the capabilities question as a follow-up to its preceding identity question; no builder work is deferred.
Deferral: tests/preview/fixtures/capsentence2-2026-10-11.json:559 | not-a-deferral=Immutable recorded model output describes the capabilities question as a follow-up to its preceding identity question; no builder work is deferred.

Register: Regenerated from exact source commit a5a5510fc03835633e3586580e01263f10bad792 in replay mode; seven generated provenance files change, with no capability text or authority change. Owner manifests required no refresh.

## Closing block

simplestRobustRoute: This is the simplest robust route: clarify the existing instruction, reuse the current rendered record and K11, add no runtime checker or authority path. Start at assigned train-11; end with ten fresh recorded-context replays, pinned tests and gates. No deployment claim.
80/20: Targeted foreground tests, nice 10, one worker; full suite and independent landing review belong to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
