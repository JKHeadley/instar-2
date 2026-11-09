# Change review — Preserve ordinary refusal custody during recovery

Subject base: 02be99f3e4a5a649ac4522d0f5bf304c188c7260
Review state: open
Reviewed content: none
Outcome: Ordinary model exceptions without tool-work or verified cleanup evidence retain their reserved UNKNOWN custody, without a recovery notice. Actual interrupted tool work and verified ended workers retain bounded row03/08 accounting.
Affected rules: 4, 26, 34, 36, 37, 42, 46, 49, 52, 55, 60, 68, 70, 74, 75, 101, 102, 111, 113, 116
Affected floors: secrets — existing redaction and outbound checks; spend cap — preserve charged unknown attempts and bounded replacement; stop — existing dispatch/send checks; no duplicate sends — original identity and no automatic replay; durable intake — preserve reservation and request across restart.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small regression repair at the durable answer-to-send boundary.
Side effects: Exceptions without execution evidence no longer produce unknown-answer notices. Explicit uncertain outcomes and recovery with tool/cleanup evidence retain their behavior. Restore adjacent pre-recovery assertions where train-230 had adopted the same overly broad notice assumption. The two reported failing test files are unchanged.
Undo and recovery: Revert this repair to restore the prior behavior; no schema, durable format, prompt or authority change. Retain existing journal records and send identities.
Multi-machine posture: Machine-local deliberately; same owned journal and host evidence, no remote liveness inference or new store.
Layer below: attempt() exception handling, ModelPending/ModelNotStarted/disclosure holds, charged reservations, model-uncertain projection, recovery eligibility, original final-send identity, direct-importer no-repeat assertions.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-summary-crash.test.ts
Hook bypass: none
Convergence: none
Decision: train-230-exception-evidence | A generic exception does not establish ended execution. Require existing tool-work or verified cleanup evidence before converting it into model-uncertain; otherwise preserve the ordinary reservation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-230-fix-1109-PROGRESS.md
Prompt review: No prompt or parser changes. Recorded replay uses row-recovery.test.ts and fixtures/work-recovery-2026-10-15.json: summary complete/uncertain 840342889, Jev undecided 969390298 and unsure 969389570, review complete 840343048 and uncertain 840343079, send-unknown reply 46040043, empty reply field messageId:4. Rowproof updates367056086/88/89 retain their recorded recovery shapes. No new live quality claim.
Prompt finding: 105c1569b6bb | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | Existing production wording tested verbatim; not a new semantic classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

1.x comparison: Inherits row-recovery-1109's comparison at 6cbe44c819cd97aec1d9c7f470b04148fbca708d (src/monitoring/ResumeQueue.ts, src/core/PendingInjectStore.ts, src/monitoring/CommitmentTracker.ts). Rechecked actual JKHeadley/instar origin/main e7a2630e20f4eff1ed52db8797e1af6d3754a7c2: searched src/, docs/specs/ and git history; read ResumeQueue.ts eligibility/reconciliation, docs/specs/restart-reply-order-and-loss.eli16.md and docs/specs/false-ratelimit-recovery-completed-sessions.md; history aceb6aedc6/fdd91944d7/5129779c36/92a21075da/ab26b7ca36 and ONEX-LESSONS sections2/3/5. Reuse evidence-gated bounded recovery and durable identity. Copying an at-least-once queue mismatches 2.0's stronger unique-send journal; no new queue is needed.

Verification: Exact initial reproduction: 2 failed / 49 passed. After the source repair the original two unchanged files pass 51/51. 247 unique targeted tests pass across 12 files, including all 28 row-recovery cases and restored ordinary-exception neighbors; typecheck and architecture pass. Source register replay binds e72eb66a334bb8dab83a0bc1d3d7cafc3d3ec796. Final pushed-head pinned tests and mechanical checks are recorded in the Studio progress report.

## Closing block

simplestRobustRoute: This is the simplest robust route: constrain one catch branch with already available execution evidence. No new state or retry machinery. Start guard is existing tool/cleanup evidence; end guard preserves the existing single send; stop and call limits remain enforced. Recorded replay proves routing behavior, not a new unattended live acceptance claim.
80/20: A six-line product repair with focused regression and boundary evidence; full suite remains the desk gate.
VERDICT: author submission; independent gate verdict remains with the desk
