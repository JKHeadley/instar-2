# Change review — drain accepted turns from every admitted runner work cycle

Subject base: afa6be392876eb17c2789651090fa90b83a81f92
Review state: open
Reviewed content: none
Outcome: A post-poll job drains ordinary intake before requested reminders, and uses the same sentinel and obligation cycle as the pre-poll job. An operator turn accepted while the lane is busy is answered by the next admitted job even when every subsequent poll is empty. Session activation retains its obligation-only routing.
Affected rules: 14, 15, 34, 41, 46, 49, 52, 55, 60, 63, 70, 74, 77, 93, 95, 101, 111, 113, 114, 116.
Affected floors: secrets — unchanged held-secret and disclosure checks; spend cap — unchanged worker and session reservations; stop — unchanged worker gates and minimal path; no duplicate sends — unchanged durable intents and settlement; durable intake — the same journal now drains from either admitted cycle.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Scheduling on the operator reply path affects reachability and scheduled work; deterministic interleaving and process-level regression evidence are required.
Side effects: Sentinels and due obligations can now run when only the post-poll slot is available. Their existing cadence, reservation and lane bounds remain in force. Requested reminders remain restricted to successful empty polls, after ordinary intake drains, so a received cancellation is processed first. Test-only transport controls inject a delayed audience read without creating CPU load.
Undo and recovery: Revert the runner work-cycle change to restore the prior scheduler. No journal schema or state migration is introduced. Pending turns retain their original durable intake and resume under either version; already prepared sends retain the same non-retry semantics.
Multi-machine posture: The same ordinary lane requires a current replica before admission; worker and dispatch ownership checks remain unchanged. No new shared or local product state. Test markers exist only in isolated fixture directories.
Layer below: createOrdinaryLane and sentinelCycle admission in tests/preview/live-sentinels.ts; drainTurnsOnce ordinary-versus-requested filtering and workObligations in tests/preview/journal.ts; the pre-dispatch group audience check; Six allocation ordering relative to the journal's answer reservation.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-session-work-launch.test.ts
Hook bypass: none
Convergence: Author submission to the independent desk; no independent verdict asserted.
Decision: one-cycle | Reuse workCycle for both admission points instead of adding another lane, retries, or a special session-enabled answer path. | reported=w4-sessionwork-stall-PROGRESS.md
Prompt review: No model-facing prompt, output parser, acceptance, escalation or refusal rule changed. Only scheduling changes. The session-route test substitutes session execution to inspect routing; existing session execution remains unchanged. Recorded proof-room summary/review shapes are replayed by the targeted group-carry regression.

Subject: tests/preview/journal-agent.mjs, tests/preview/journal-cutover-loader.mjs, tests/preview/journal-cutover-ports.mjs, tests/preview/journal-session-work-launch.test.ts; derived owner pins and register replay.

Validation: 128 targeted foreground tests passed with one worker, including session activation on/off under the forced audience/poll interleaving, due session obligations, bounded same-topic holding, recorded group-carry outputs, runner cutover, overlap, native harnesses and two-machine floors. Typecheck, build, architecture, register wiring and register replay checks passed. The register is replayed against source commit de1295d2eb7b239304c656bceccf6b2dfd782a6b; this follow-up carries its derived outputs.

## Closing block

simplestRobustRoute: This is the simplest robust route: every admitted job uses the existing work cycle and drains accepted ordinary intake first. The pre-poll and post-poll jobs no longer compete with different obligations. Existing admission, spend, stop, disclosure and durable-send guards are retained. No autonomous live-completion claim is made: the deterministic runner reproducer fails before and passes after; the desk owns the real preview switch and gate.
80/20: Targeted foreground tests cover the forced poll/audience interleaving with session activation on and off, ordinary replies, due obligation routing, same-topic holding and result delivery, poll outages, sentinels, and recorded group-carry shapes. Architecture and type checks accompany the derived pin/register chain. The full suite and independent landing review belong to the desk pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
