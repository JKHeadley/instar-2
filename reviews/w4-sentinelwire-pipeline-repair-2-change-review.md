# Change review — w4-sentinelwire pipeline repair 2: the sentinel tick runs inside the admitted ordinary job

Subject base: 4a8cf432eb1c43d17fb00eb6ce23a50d37ad7780
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) on plan row #402. MUST-FIX 1: sentinelCycle checked lane admission, ran the tick (which appends a sentinel frame), removed the requested steps from their queue, and only then called lane.submit, which re-checks admission. With two machines the peer is current only while it holds the journal's whole length, so the tick's own append made the second check false: the job was declined, the removed steps were lost, and the attempt stayed recorded. The tick and the removal of its requested steps now run first inside the job lane.submit has already admitted, so admission precedes the tick's writes; the drain, the steps after it and the job's failure semantics are unchanged. Tests: tests/preview/live-sentinels.test.ts 15/15, one new test using the real shipper and replica store (the peer acknowledges the whole journal before each cycle; a held recorded live turn, update 969389576, records one self-heal, which executes in the same admitted job, before the holding note falls due); the new test fails on the previous sentinelCycle (admission declined) and passes on this one. Also passing: journal-replication, live-sentinels-launch, sentinels/presence, sentinels/promise; tsc -p tsconfig.build.json clean; lint and register:check pass.
Affected rules: 26 and 42 (the recovery the journal records is the one that runs, now also with two machines), 88 (a presence note follows a self-heal that actually ran), 15 and 55 (lane semantics unchanged), 34 and 62 (both sides shown: old code fails, new code passes, with the real append/acknowledgement interaction), 116 (no new scheduler or queue; the existing admitted job carries the tick)
Affected floors: secrets — no new output path; spend cap — no model call added, steps run in the one lane; stop — the tick's own stop/expiry/lease checks and dispatch-time checks unchanged; no duplicate sends — unchanged, one limited intent per message; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes when self-triggered recovery steps are recorded relative to admission in the live loop.
Side effects: none beyond sentinelCycle's ordering; register replay at 688681e5.
Undo and recovery: a revert restores the previous ordering (and its two-machine defect); no journal format changed.
Multi-machine posture: fixed: the lane's peer-acknowledgement check is evaluated once, before the tick appends, so a sentinel frame can no longer decline its own job; dispatch-time replication waits are unchanged.
Layer below: createOrdinaryLane (unchanged), createLiveSentinels' record-before-effect (unchanged), createJournalShipper.status (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: repair2-tick-inside-admitted-job | the tick and its step removal run inside the callback lane.submit admits, rather than before it, so the tick's append cannot revoke the admission (Rule 116: no new mechanism) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-sentinelwire-PROGRESS.md
Prompt review: no model-facing text is added or changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts

## Closing block

simplestRobustRoute: the required outcome is that a recorded sentinel step runs on two machines. Moving the tick inside the already-admitted job delivers it with no added machinery.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
