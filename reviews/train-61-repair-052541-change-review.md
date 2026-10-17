# Change review — Preserve deferred preparation and completion accounting in train-61

Subject base: 5f31a9f2724a50093e5e45128b30030d20d333a7
Review state: open
Reviewed content: none
Outcome: Merge live 5f31a9f2 into train-61, retaining deferred-answer preparation and the complete retained-work checklist without changing either captured history.
Affected rules: 8, 10, 12, 36, 37, 49, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing redaction and custody; spend cap — existing bounded reservations; stop — existing gates; no duplicate sends — existing report binding and receipts; durable intake — existing encrypted journal. No floor changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The conflict touches the existing model-facing obligation question, so both recorded-output replay suites verify the composition.
Side effects: Deferred reports remain stored until authorized delivery; retained unfinished work still prevents final completion. Both original histories and fixture bytes survive. No new model calls, authority, parser, delivery policy or persistent format.
Undo and recovery: Revert the merge with its first-parent baseline and regenerate register metadata. Existing journal records remain readable. Do not rewrite either parent history.
Multi-machine posture: Existing shared owner journal retains work and delivery accounting; no new machine-local product state. Verification is isolated on WSL; Studio owns its native conformance run.
Layer below: Checked obligationDecision, reconcileRunCompletion, report projection and report delivery binding. Both prompt clauses compose at the existing question; recorded worker results remain independently consumable.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train61-preserve-both | keep both compatible parent instructions and merge histories | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-repair-052541-PROGRESS.md
Decision: train61-recorded-provenance | retain exact captured prompt bytes and verify the single inserted completion paragraph separately | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-61-repair-052541-PROGRESS.md
Prompt review: Preserve both existing instructions verbatim. The recording predates the completion paragraph: assert the exact captured prefix and suffix plus the exact inserted paragraph digest, without rewriting the recording or claiming a fresh provider run.
Prompt finding: 4106b49fff07 | protocol-literal | Existing protocol instruction; no semantic classifier based on a fixture phrase — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol instruction; no semantic classifier based on a fixture phrase — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 8859262c8901 | protocol-literal | Existing protocol instruction; no semantic classifier based on a fixture phrase — fixture-phrase tests/preview/answer-reading.ts <- tests/preview/deferral-finish.test.ts: "this is a runner task, not a message from the operator."
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol instruction; no semantic classifier based on a fixture phrase — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/deferral-finish.test.ts:102 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:18 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:23 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:29 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:31 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:33 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:48 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:54 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:56 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:58 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/fixtures/deferral-finish-2026-10-17.json:82 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work
Deferral: tests/preview/journal.ts:2597 | not-a-deferral=Recorded deferral behavior under test, not unfinished builder work

Subject (3 paths): tests/preview/deferral-finish.test.ts, tests/preview/fixtures/deferral-finish-2026-10-17.json, tests/preview/journal.ts

Register publication: replay generator consumed merge 90b3d73dd19937c3e04aa4ad2c35f9cdfe8e1ee8 and generated sha256:971573392d19667976c5d6d83c8ca68fd7d8ff9123d541706adaff18caaf58b5. Seven generated files refresh source metadata; owner-manifest and grounding repin tools changed zero pins.

## Closing block

simplestRobustRoute: This is the simplest robust route: concatenate the two compatible parent clauses at the single conflict and adjust the historical prompt assertion. Existing intake, work accounting, stop/cap and delivery guards remain the start, limit and end-state guards. No added runtime machinery or claim of fresh unattended live acceptance.
80/20: Run typecheck, the deferral and completion recorded-output consumers, and required cheap and pinned gates; leave full-suite execution to the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
