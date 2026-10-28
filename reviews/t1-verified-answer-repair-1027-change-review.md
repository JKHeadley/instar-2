# Change review — Rework explicitly rejected reports and fit all pending evidence

Subject base: 236df8a74e795df8db685305c8b71869f2244df8
Review state: open
Reviewed content: none
Outcome: Explicitly rejected reports return to owned correction; complete candidate evidence uses the input envelope and every omitted item is counted.
Affected rules: 4, 8, 10, 22, 26, 36, 42, 46, 49, 70, 74, 83, 84, 101, 102, 111, 113, 116
Affected floors: secrets — existing redaction and outbound wall; spend cap — existing input and call caps, no new model call; stop — unchanged; no duplicate sends — current report identity, binding and receipt; durable intake — existing journal
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small model-facing repair using the existing report lifecycle, with no new scheduler or provider.
Side effects: Valid explicit rejection now makes the report unavailable for delivery until corrected; missing, malformed, conflicting, unoffered or overflowed decisions leave it unchanged. Candidate fitting tries complete reports in order inside the actual envelope. Old reports progress through rejection/rework, with no heuristic rejection or extra calls.
Undo and recovery: Old journals require no migration. To roll back after new rejection rows exist, retain their decoder/intent acceptance while reverting the emitting path; a blind downgrade to an older reader can reject those intents. Never rewrite evidence. Original reports and receipts remain durable, and rejection/intent replay is tested across reopen.
Multi-machine posture: No machine-local queue. The current owner reads shared journal state, checks exact offered/current text, and uses existing intent binding and send receipts. A stale or bound report cannot be reworked.
Layer below: Read 1.x CommitmentTracker.verifyOne: unverifiable commitments stay pending and surfaced. Reuse that invariant through the existing 2.0 withheldReports, dueObligationWork and receipt settlement; no filesystem verifier transplant. Inspected packet fitting and exact report bindings.
Bug class: integration
Bug evidence: reproducer=tests/preview/astra-t1-recovery-review.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only, inspected before commit
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: The same answering mind names an offered rejected report and its objection. Code checks exact evidence and shape, never semantic keywords. Captured T1 update 46040732 and seven recorded uncertain/undecided/review/delivered/empty shapes replayed; synthetic model decisions are labeled, not live-model proof.
Decision: t1-repair-explicit | Admit only explicit offered rejection with an objection into existing withheld rework; omission remains unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-repair-1027-PROGRESS.md
Decision: t1-repair-budget | Fit every report against the input envelope, count every omission, and advance through existing rework without a new scheduler. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-repair-1027-PROGRESS.md
Decision: t1-repair-replay | Extend the reviewer replays through corrected delivery, bounded-envelope backlog progress and recorded malformed neighbors; live acceptance stays with the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-repair-1027-PROGRESS.md

Decision: t1-repair-forum-fixture | The direct-import run exposed a delivery fixture still assuming blind append; use the existing explicit synthetic selection helper so its topic-isolation assertions remain meaningful. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/t1-verified-answer-repair-1027-PROGRESS.md

Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol guidance, not a semantic keyword trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol guidance, not a semantic keyword trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol guidance, not a semantic keyword trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol guidance, not a semantic keyword trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/astra-report-backlog-review.test.ts:65 | not-a-deferral=Regression assertion about pending delivery, not deferred builder work
Deferral: tests/preview/astra-t1-recovery-review.test.ts:92 | not-a-deferral=Regression assertion about pending delivery, not deferred builder work

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/astra-report-backlog-review.test.ts, tests/preview/astra-t1-recovery-review.test.ts, tests/preview/forum-routing.test.ts, tests/preview/journal.ts

Validation: Both reviewer reproductions failed before the repair. Extended recorded replay and delivery neighbors pass (52 tests); typecheck and architecture pass. Register regenerated in shape-only replay mode from fc16df44ea8bda1a3acfd8c04eb8c877c02de50f. Source edit is 71 changed lines (52 additions, 19 deletions). Final pinned checks and host-dependent results are listed in the builder report.

The direct-import run found the forum-routing delivery fixture still returning plain Noted while expecting automatic report attachment. It now uses the existing explicit-selection test helper, without changing topic-isolation or delivery assertions. This is test-only support beyond the two named reviewer replays.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing answer decision into withheld-report recovery and let existing input-envelope fitting carry all candidate evidence. Start: exact offered unbound report. End: corrected work and normal delivery receipt. Limits: secrets, spend, stop, durable intake, uniqueness and existing size bounds. No extra scheduler, cache or verifier. Studio review and unattended live-model acceptance remain desk-owned.
80/20: Two reviewer reproductions plus malformed/omitted neighbors and restart-to-receipt recovery cover both repairs; the production edit stays below 100 changed lines.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
