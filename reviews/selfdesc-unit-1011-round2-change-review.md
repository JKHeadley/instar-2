# Change review — Repair delivered standing-grant assertions

Subject base: 73dbd572e572517a800025fa2902b89c82b2466e
Review state: open
Reviewed content: none
Outcome: Repair the two stale delivered-instructions assertions to check the reviewed standing-grant guidance.
Affected rules: 18, 37, 49, 70, 74, 84, 101, 103, 104, 111, 113, 116; Purpose role-granted-once and self-knowledge
Affected floors: secrets — unchanged custody/outbound enforcement; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged intent fence; durable intake — unchanged journal
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two assertion strings change; no runtime instructions, behavior, fixtures or authority change.
Side effects: The delivered-envelope test now checks in-role effects without another yes and outside-role grant naming. All existing envelope, trusted-role and constitutional-floor assertions remain.
Undo and recovery: Revert this repair commit; no state or migration requires recovery.
Multi-machine posture: Repository-shared test expectations; no runtime state, placement or ownership changes.
Layer below: Read SELF_DESCRIPTION and ANSWER_INSTRUCTIONS in tests/preview/briefing.ts and prepareJournalEnvelope delivery. The test compares the actual prepared instruction role and preserves quoted-context separation.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-boundaries.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only
Convergence: none

Subject (1 paths): tests/preview/journal-boundaries.test.ts

Verification limitation: The review's tool-turn.test.ts:134 sparse-image setup failed in hdiutil before storage assertions. That host-dependent coverage remains unverified here and belongs to the unrestricted combined-build gate. The specified saved gate results file is absent; post-test checkers will report missing input, not passing contracts.

## Closing block

simplestRobustRoute: Update the two stale assertions in the existing prepared-envelope test. This is that route; no new machinery, runtime decisions or narrowed abilities. Existing floors remain enforced at their checkpoints.
80/20: The stale assertion fails before the repair; all 20 tests in the same file pass afterward, foreground at nice 10 with one worker. TypeScript passes. No full suite or new live-use claim; the combined-build gate owns host-dependent storage and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
