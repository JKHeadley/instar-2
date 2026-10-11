# Change review — Media provenance audit repair

Subject base: 53a1149d4879511997edb239d7b52053a68fcfe1
Review state: open
Reviewed content: none
Outcome: Authenticated photo, voice and document history passes the shipped audit through compacted replay; tampered source envelopes and custody annotations remain findings.
Affected rules: 26, 28, 29, 37, 45, 49, 70, 74, 101, 111, 112, 113, 116.
Affected floors: secrets — no raw bodies added to diagnostic output; spend cap — no model or paid calls added; stop — unchanged admission checkpoints; no duplicate sends — audit remains read-only; durable intake — original envelopes and custody records unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing shipped provenance diagnostic consumer repair with exact-source checks and worker/CLI regression evidence; no new runtime effects.
Side effects: Media histories no longer produce false memory-operator-source-absent findings. Existing plain-text source equality and binding checks remain; media additionally replays the existing admittedUpdate derivation and checks writer binding and recorded custody text. No prompt or custody changes.
Undo and recovery: Revert the audit and regression change, then regenerate the register with the existing desk tools; original journal and media custody data are untouched and require no migration.
Multi-machine posture: Read-only machine-local audit of an authenticated journal on the machine where opened; no new state, synchronization, ownership or transport behavior.
Layer below: Inspected admittedUpdate, authenticateTelegramSender, writerBoundToRaw, telegramInboundMedia, mediaCustodyText, media-custody projection and compacted journal replay. Existing replay validates authenticated frames and retains the original raw envelope.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts
Hook bypass: none
Convergence: none
Decision: media-audit-replay | Reuse intake derivation and exact recorded custody text without changing media ability or its checkpoints. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-5-repair-PROGRESS.md
Prompt review: No model prompt, parser or decision changed. Audit reuses intake derivation only for a diagnostic comparison. Tests use existing synthetic Telegram envelopes with synthetic model/custody ports; no live-platform or captured model-output claim. Neutral worker inputs and literal provenance assertions contain no fixture-trigger prompt logic.

Subject (2 paths): tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse existing intake and custody rendering inside the existing auditor, retaining exact accepted/update/sender/chat/content checks and rejecting changed writer bindings. No new store, service, policy or gate. Worker-to-compaction-to-shipped-CLI tests complete unattended for all three media forms; positive stored and every failed-custody state remain auditable.
80/20: The focused audit file passes 19 tests, including three new media cases and all prior text/correction/summary controls. Each new case fails on the original auditor. Typecheck/build pass. Fresh full-run receipts belong to the authorized pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
