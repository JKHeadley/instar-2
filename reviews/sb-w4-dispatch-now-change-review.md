# Change review — sb-w4-dispatch-now: reviewed unit on live pickup base

Subject base: 4683b8520c4a211fb7dd56a02f4425e073432420
Review state: open
Reviewed content: none
Outcome: Plan #542. Ordinary merge fast-forwarded from 4683b852 to 15c4712c with no conflicts. Preserve both carried unit review records unchanged, including the repair that revalidates minimal recipients around intervening awaits. Offer ordinary work immediately after durable intake and the existing stop/read-ahead and peer-sync checks, after starting the minimal path's synchronous stop handling and before awaiting its longer operations. When the single ordinary lane is busy, retain one coalesced wake and consume it at job completion instead of waiting for a poll or work tick. Answer, reply check and send already execute in one drain; keep that path and prove it has no idle tick. Expose intakeAt, turnStartAt, answerAt, checkDoneAt and sentAt in replyTimings from existing durable frames.
Affected rules: 1, 4, 15, 37, 69, 70, 112, 13, 14, 26, 32, 34, 39, 42, 46, 49, 55, 60, 63, 74, 77, 95, 101, 102, 111, 113, 116
Affected floors: secrets — the same outbound and disclosure checks run before the same send doorway; spend cap — the same durable reservations and allowance checks precede every call; stop — queued admission rechecks signal, stop file, journal stop, ownership and activation, and the worker gates every effect; no duplicate sends — one worker, existing durable intents and UNKNOWN fences, journal deduplication unchanged; durable intake — wake follows successful intake, read-ahead stop protection and peer sync, never precedes them
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: integration submission retains the suggested critical tier for the reply-path scheduling and minimal responder race repair
Side effects: a busy ordinary job is not preempted; one follow-on drain can run immediately at completion. Repeated intake coalesces to one wake, and ordinary non-intake submissions still do not queue. Background summaries start after the pending drain instead of ahead of it. A failed job or stale peer can defer the wake to a later existing cycle under the unchanged admission/backoff rules. Reminders remain after the successful empty poll and minimal step, with an ordinary drain first as in the pickup fix.
Undo and recovery: revert the source change. The wake is process-local scheduling state, not accepted work; restart uses the durable journal queue and existing pre-poll drain. No migration or new frame is needed. Older compacted snapshots lacking the new derived timestamps report null rather than inventing evidence.
Multi-machine posture: the wake is machine-local deliberately; intake, reservations, checks and sends remain journal-owned. With a peer, intake is synced before admission and a retained wake rechecks peer currency and ownership. No second worker or cross-machine dispatch path is added.
Layer below: createOrdinaryLane serialization and failure backoff; sentinelCycle ordinary-drain-first ordering; worker intake durability and read-ahead stop handling; drainTurnsOnce answer/check/intent/send sequencing; durable reserve, answer, reply-check, revision-review and sent frame replay; measuredTimings preserves the perReply projection
Bug class: integration
Bug evidence: reproducer=tests/preview/dispatch-now.test.ts
Hook bypass: none
Convergence: none
Decision: sb-w4-dispatch-now-merge | ordinary merge of reviewed unit 15c4712c90d993de072c9c4a2d239c77aba7eb2c onto live 4683b8520c4a211fb7dd56a02f4425e073432420 fast-forwarded without conflicts; unit evidence is lanes/w4-dispatch-now-PROGRESS.md and lanes/w4-dispatch-now-repair-PROGRESS.md on the Studio | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dispatch-now-PROGRESS.md
Decision: sb-w4-dispatch-now-desk | run the cint-L37 desk chain: inventory repin, TypeScript build, owner-manifest rehash, register replay at merged unit head; preserve source bytes and all guard constants | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dispatch-now-PROGRESS.md
Prompt review: no prompt text, parser, acceptance, escalation or refusal decision changed; this change controls when the existing worker is offered work and projects its existing evidence

Prompt finding: 849db3a6296a | protocol-literal | unchanged fixed empty-memory status text, not an instruction to judge a fixture phrase
Prompt finding: bd01de21286a | protocol-literal | unchanged sourceLabel output-field instruction for grounded recall; this scheduling change edits no prompt
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged recall-grounding instruction, not a new fixture-specific judge or expected answer
Deferral: tests/preview/dispatch-now.test.ts:12 | not-a-deferral=defer constructs a manually resolved promise to inject a slow job in a test
Deferral: tests/preview/dispatch-now.test.ts:18 | not-a-deferral=test fixture creates its manually resolved slow-job and start promises
Deferral: tests/preview/dispatch-now.test.ts:65 | not-a-deferral=test fixture creates its manually resolved slow job for admission checks
Deferral: tests/preview/dispatch-now.test.ts:78 | not-a-deferral=test fixture creates its manually resolved slow job for coalescing checks

Carried source subject: tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/live-sentinels.ts, tests/preview/reply-check.test.ts, tests/preview/dispatch-now.test.ts

## Closing block

simplestRobustRoute: this build takes the simplest robust route: merge the reviewed unit unchanged and regenerate the register with the established desk tools. The carried implementation takes the simplest robust route: reuse the durable journal and its one worker, offer that worker immediately at intake, and keep one wake only when a busy job would otherwise discard the offer. The named failure is intake arriving during an ordinary job and then waiting for another poll. No new timer, event stream, worker or retry policy is introduced. Start guards are the current stop, activation, ownership, peer currency and backoff checks; end-state is the existing durable send receipt or honestly unknown attempt; resource limits and effect reservations are unchanged. Real Telegram latency must be measured by the desk after landing; the author claims only controlled offline evidence here.
80/20: the targeted tests prove immediate idle dispatch, coalescing under an injected slow job, no tick between check and send, durable input visible at the model consumer, identical timing after restart, duplicate suppression, and both admitted and refused peer/stop/backoff neighbors. The stop-order regression reproduced two confirmations before the repair and verifies one afterward. The existing timing test exercises the escalation path and all five timestamps on replay. No deliberate machine load or live provider call is used.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
