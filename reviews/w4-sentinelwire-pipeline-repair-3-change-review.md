# Change review — w4-sentinelwire pipeline repair 3: a due reminder waits for the post-poll job

Subject base: 39dd5d5a1ddb0a2568b5e4e4044b33e404493198
Review state: open
Reviewed content: none
Outcome: Unit review round 3 (Astra, VERDICT NO) on plan row #402. MUST-FIX 1: a `request:` promise queued worker.sendRequested() into the cycle's pre-poll ordinary job, so a due reminder could go out before getUpdates and throughout an intake outage, ahead of a waiting withdrawal. The established path sends requested reminders only from the post-poll job after a successful empty poll. The promise sentinel's `request:` work now queues nothing pre-poll: that post-poll job already sends every requested reminder under its admission condition. Obligation work (`workObligations`) still rides the pre-poll job unchanged; promise observation, pull reporting and reminder delivery are kept. Tests: tests/preview/live-sentinels-launch.test.ts 5/5, including two new real-launcher cases (getUpdates answers 503 with a dated request past due): with --sentinels none and promise, zero reminder intents, zero sendMessage, and the first call after getMe is getUpdates. The promise case fails on the previous runner (one reminder sent before any poll) and passes now; the existing dated-promise launch case (work-requested, the request answered, closed) still passes. Also live-sentinels.test.ts 15/15; tsc -p tsconfig.build.json clean; architecture check, lint and register:check pass.
Affected rules: 93 (a waiting withdrawal is read and settled before a reminder is sent), 15 and 55 (lane semantics unchanged), 26 and 42 (the recorded work request is carried by the existing reminder path), 34 and 62 (both sides shown with the real launcher: old fails, new passes), 116 (a removal; no new scheduler or flag)
Affected floors: secrets — no new output path; spend cap — no model call added; stop — unchanged; no duplicate sends — unchanged, the one existing reminder path sends; durable intake — strengthened: no reminder precedes intake
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes when a user-visible reminder may be sent in the live loop.
Side effects: none beyond the pre-poll step list; register replay at 147a22bf.
Undo and recovery: a revert restores the pre-poll reminder route (and its ordering defect); no journal format changed.
Multi-machine posture: unchanged: the post-poll job keeps the lane's peer-acknowledgement admission; dispatch-time replication waits are unchanged.
Layer below: createOrdinaryLane, sentinelCycle, worker.sendRequested and its post-poll admission (all unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: repair3-reminder-post-poll-only | a request: promise adds no pre-poll step; the existing post-poll job (successful empty poll) already sends every requested reminder, so no new flag or scheduler is needed (Rule 116) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sentinelwire-PROGRESS.md
Prompt review: no model-facing text is added or changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent.mjs, tests/preview/live-sentinels-launch.test.ts

## Closing block

simplestRobustRoute: the required outcome is that no reminder precedes intake. Removing the pre-poll reminder route leaves the one proven post-poll path, with no added machinery.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
