# Change review — Repair review-layer canary notice assertion

Subject base: aba0fb6c32ce17d44728a49a5ae0ee3daf21dd6f
Review state: open
Reviewed content: none
Outcome: Restore the wrapped and reply-contradiction canaries after the model-route notice stopped asking the reader to fetch status details.
Affected rules: 34, 37, 49, 56, 70, 74, 101, 111, 112, 113, 116; purpose ability preservation
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — exact delivered reply count remains asserted; durable intake — encrypted journal evidence remains asserted
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertion only; no model prompt, model-output parser, verdict, tool, authority or runtime change.
Side effects: The canary accepts the current model-route notice and explicitly rejects the retired status instruction. Answer equality and every review, summary, usage and send assertion remain intact.
Undo and recovery: Revert this commit; no migration or persisted runtime state changes.
Multi-machine posture: Repository-shared test assertion; no machine ownership, replication or transport changes.
Layer below: Inspected doorwayNotices in credential-reminders.ts, the neighboring journal-agent.test.ts assertion, and doorway-notice-replay.test.ts with its retained update 715675469 provenance. The renderer intentionally emits a factual notice without a status request; changing runtime to satisfy the stale assertion would undo that repair.
Bug class: integration
Bug evidence: reproducer=tests/preview/review-layers-canary.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only
Convergence: none

Subject (1 paths): tests/preview/review-layers-canary.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: align the stale assertion with the existing notice contract and reject the removed instruction, preserving exact answer, review and delivery checks. No new machinery, guard, capability restriction or autonomous-completion claim.
80/20: Reproduced both failures before editing; all three canary cases pass afterward with nice -n 10 and one worker. Typecheck passes. Four direct assertion checks accept the current notice and reject the retired instruction, unrelated text and an extra line. Lint and register checks pass. All eleven contract checkers stop at the unchanged saved report's unsuccessful-suite prerequisite; its only failures are these two repaired tests. Fresh full-suite evidence belongs to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
