# Change review — w4-sentinelwire pipeline repair: sentinel recoveries run inside the admitted ordinary job; the presence off-switch covers due notes

Subject base: f091ec071f39316955c85af539a437213f96e6fb
Review state: open
Reviewed content: none
Outcome: Unit review round 1 (Astra, VERDICT NO) on plan row #402. MUST-FIX 1: the live loop resubmitted every sentinel request to the busy ordinary lane, which declined it while the attempt stayed recorded, so the forced context-summary recovery never ran and the journal could report recovery exhaustion. The runner's ordinary lane is now one small factory (createOrdinaryLane in tests/preview/live-sentinels.ts, the same backoff, eight-failure breaker and peer-acknowledgement rule as the inline code it replaces) and sentinelCycle ticks only while that lane would admit work; the sentinel ports queue their steps and the steps run inside the same admitted cycle job after its drain. A busy, backing-off or peer-waiting lane defers the tick, so nothing is recorded as an attempted recovery or a failed self-heal. MUST-FIX 2: the worker receives the presence posture (PreviewPorts.presenceNotes; the runner passes whether presence is enabled) and a disabled presence family no longer sends a holding note marked due by an earlier launch; the saved decision stays for audit. Tests: tests/preview/live-sentinels.test.ts 14/14 (three new: recorded recoveries equal executed recoveries through the real lane with a busy neighbour; backoff and peer-wait defer the tick and a failed drain still runs the queued step; the off-switch on both sides with an already-due note on the recorded 2026-09-27 held turn, update 969389576); tests/preview/live-sentinels-launch.test.ts 3/3 (the real runner, offline endpoint); tsc -p tsconfig.build.json clean; lint and register:check pass.
Affected rules: 2 and 42 (nothing is recorded for a step that is not run), 15 and 55 (ordinary lane semantics unchanged: same backoff and breaker; the minimal path is unchanged), 26 (the recovery the journal records is the one that runs), 34 and 62 (both sides of each new decision tested; the launch test is integration evidence, not Justin-path live proof), 63 (ticks still run only in the owner's loop), 88 (a presence note follows a self-heal that actually ran), 116 (no new scheduler; the existing lane moved into one tested factory)
Affected floors: secrets — no new output path; spend cap — no model call added, queued steps run inside the existing caps and the one lane; stop — the stop, expiry and lease checks on the tick and the minimal path are unchanged, and a disabled presence family now also stops its pending note; no duplicate sends — the note stays one limited intent per message and an UNKNOWN is never repeated; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes when self-triggered recovery steps run in the live loop and when an infrastructure note reaches the operator's chat.
Side effects: tests/preview/live-sentinels.ts exports createOrdinaryLane, OrdinaryLane and sentinelCycle; PreviewPorts gains optional presenceNotes (absent means enabled, so existing callers are unchanged); the runner's inline drainJob/drainError/background code is replaced by the lane factory with the same rules; register replay at adc879fe.
Undo and recovery: a revert of these commits restores the previous wiring (and its two defects); no journal format changed, so no data repair is needed either way.
Multi-machine posture: unchanged: the lane still admits work only while the peer has acknowledged the journal (shared === null || shared.peerCurrent()), and the tick is now deferred, not recorded, while the peer is away.
Layer below: decideContext, decidePresence, decidePromises and createLiveSentinels' record-before-effect (unchanged); the worker's drain, summarizeIfNeeded, workObligations, sendRequested and minimal (unchanged apart from the presence posture in limitedReason).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: repair-sentinel-steps-ride-cycle-job | sentinel-requested steps are queued and run inside the cycle's admitted ordinary job after its drain, instead of being resubmitted to the busy lane or given a separate scheduler (Rule 116) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sentinelwire-PROGRESS.md
Decision: repair-defer-tick-when-lane-busy | while the lane would not admit work the whole tick is deferred, so no decision is recorded that cannot run; the busy-worker minimal answer still covers a blocked worker | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sentinelwire-PROGRESS.md
Decision: repair-presence-posture-port | the presence posture is a worker port read at the one eligibility decision that makes a due note sendable | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sentinelwire-PROGRESS.md
Prompt review: no model-facing text is added or changed. The three findings below are existing literals in journal.ts, which is in the subject for the presence posture.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit
Deferral: tests/preview/live-sentinels.test.ts:141 | not-a-deferral=a test comment naming the tick the busy lane defers
Deferral: tests/preview/live-sentinels.test.ts:179 | not-a-deferral=a test comment naming the cycle the backoff defers

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/w4-sentinelwire-pipeline-repair-change-review.md, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts

## Closing block

simplestRobustRoute: the required outcome is that every recovery a sentinel records actually runs, and that a disabled family emits nothing. The simplest robust route queues the requested steps into the cycle job the runner already submits, ticks only when that job will be admitted, and passes the presence posture to the one eligibility check. Added machinery: the lane factory (moved, not new, so the wiring is testable) and sentinelCycle (prevents a recorded-but-unrun recovery); the presence port (prevents a disabled family's pending note from sending).
80/20: 0 must-fix, 1 note — while the ordinary worker is busy the presence sentinel does not escalate; the existing busy-worker minimal answer covers that case.
VERDICT: author submission; the independent verdict is recorded as a pass
