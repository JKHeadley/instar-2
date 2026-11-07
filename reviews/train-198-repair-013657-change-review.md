# Change review — train-198 repair: test clock boundaries, stop-safe closing order and the rollback barrier

Subject base: 83cb9d93daf8c0beac6d7bf49ed46d11b5fbfd69
Review state: open
Reviewed content: none
Outcome: Clear the 22 failures of the train-198 full run and the review must-fix without changing the renewal. The stop confirmation is sent once again; tests that cross the shifted test clock compare like with like; the recovery advice names the true rollback barrier.
Affected rules: 4/15/77 minimal path and stop reachability; 25/34/37 test clock and zero-failure; 56 register model-map freshness stays on the real clock; 74/102/111/113/116 review, decisions, layer below, posture and simplest route. Purpose: an irreversible act follows its durable cause, and Rule 2 of the purpose (nothing silently lost) for retained intent and uncertain send evidence.
Affected floors: secrets — unchanged, no credential handling; spend cap — no model call added; stop — stop confirmation regains its single send because the limited pass claims before any yield; no duplicate sends — that same ordering removes a real duplicate, and recovery advice forbids resending UNKNOWN; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Reorders a step on the minimal path that carries the stop confirmation, and corrects recovery advice for a live activation renewal.
Side effects: In one minimal pass the closing notice now follows the limited pass rather than preceding it. A limited pass waits on no ordinary model, so the warning still goes out while an answer is pending; closing-notice.test.ts proves that case. Test-only: realNow reads the host clock, register children run unshifted, preview launcher preloads keep the inherited clock, and three fixtures end ten minutes out rather than inside the five-minute notice window.
Undo and recovery: The ordering line and test edits revert cleanly and write no durable state. Reverting the ordering restores the duplicate stop confirmation, which dispatch-now.test.ts then reports. The train-198 record and README now state the rollback barrier: plain rollback is safe only before both the first closing intent and renewal; afterwards keep a compatible reader and repair forward.
Multi-machine posture: Machine-local test infrastructure plus one ordering change inside the owner's existing minimal path; ownership and disclosure admission are unchanged and no store or poller is added.
Layer below: Read createJournalWorker minimal/drain/answerLimited and limitedRunning, sendClosingNotice, scripts/production-session-io.mjs armDeadline (scrubbed env) and session-deadline-watchdog.mjs, awareness sentinel timing against tmux session_created, modelEntryFresh (refuses a verifiedAt ahead of now) and build-register --replay. 1.x comparison inherited from the train-198 record: main 6d3b9a23, 8dfc8728, docs/specs/fix-expiring-throughput-fixture.eli16.md; no separate 1.x search was run for this repair, and it reuses that preserve-the-measured-interval principle. ONEX-LESSONS not reread.
Bug class: integration
Bug evidence: reproducer=tests/preview/dispatch-now.test.ts; detail=restoring noticeClosing before answerLimited fails this test with 2 sends on this host and the reordered source passes. The other failures reproduce on the Studio gate log named in the brief: an unshifted child or OS clock against a shifted test clock, or a fixture ending inside the notice window.
Hook bypass: none
Convergence: none
Decision: train-198-repair-closing-order | Run the limited pass before the closing notice in the minimal step, so the one-pass claim is taken before anything yields; this is the simplest fix for the duplicate stop confirmation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-013657-PROGRESS.md
Decision: train-198-repair-real-clock | Compare against the host clock where the other side cannot be shifted (tmux, shell, scrubbed children), through one realNow helper, instead of widening the preload into production env handling. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-013657-PROGRESS.md
Decision: train-198-repair-register-clock | Run register CLI children unshifted, because model verification times are real and must be judged at real time. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-013657-PROGRESS.md
Decision: train-198-repair-fixture-window | Move three replay fixtures outside the five-minute window rather than exempting the notice, since a notice inside that window is correct behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-013657-PROGRESS.md
Decision: train-198-repair-rollback-wording | Correct the undo entry and README to the barrier the reviewer reproduced; no runtime gate or migration added. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-198-repair-013657-PROGRESS.md
Prompt review: No model prompt, output parser or judgment criterion changed. The journal.ts edit moves one await and adds a comment; no recorded-shape replay is claimed beyond the existing tests run here.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol wording; this repair adds no model instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol wording; this repair adds no model instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol wording; this repair adds no model instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol wording; this repair adds no model instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=generated register text, not a promise made by this change

Subject (19 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/e2e/awareness-continuity.test.ts, tests/e2e/register.test.ts, tests/integration/awareness-grounding-hook.test.ts, tests/integration/session-driver-deadline.test.ts, tests/preview/README.md, tests/preview/doorway-notice-replay.test.ts, tests/preview/journal-clock-jump.test.ts, tests/preview/journal.ts, tests/preview/preview.test.ts, tests/preview/sched-tool-replay.test.ts, tests/setup/test-clock-env.ts, tests/unit/test-clock.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: move one await, keep each test on the clock its counterpart really uses through one small helper, widen three fixture windows, and correct the wording. No added runtime machinery. Start guard is the existing limited-pass claim; end guard is the existing durable once-per-end intent; stop, expiry, ownership and disclosure stay enforced.
80/20: Author submission. Targeted tests and cheap checks are in the builder report; the full suite and native checks stay with the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
