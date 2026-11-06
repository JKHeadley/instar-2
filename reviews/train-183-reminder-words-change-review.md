# Change review — Repair compact reminder capability assertions

Subject base: 998dec84c53a54ab54173a4d910624a008b497c0
Review state: frozen
Reviewed content: sha256:f9e05972f246eb434ed6bcfd8b80248b1e39eaf2800fd81194cfc933d60bc788
Outcome: Restore the three reminder-words gate checks against the current compact capability sentence, including every scheduling qualifier at all three existing consumers.
Affected rules: 37, 70 (regression repair), 36 (unchanged captured evidence), 78, 84 (actual briefing awareness), 49, 74, 111 (review), 101, 102, 113, 116 (process and scope).
Affected floors: secrets — unchanged; spend cap — unchanged, no provider calls; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only expectation repair; no runtime or model-facing text changes.
Side effects: Future briefing edits must retain all listed scheduling qualifiers or deliberately update this regression. Historical fixture bytes and their meaning are preserved. Existing denial, withdrawal and undated-request checks remain in force.
Undo and recovery: Revert this test and review commit; the former stale wording checks will fail again against the compact briefing.
Multi-machine posture: Machine-independent assertions. No state, ownership, replication or runtime changes.
Layer below: Current capabilityBriefing and sourcePacket consumers in tests/preview/briefing.ts, actual journal worker packets, and fixtures/reminderwords-live-2026-10-02.json. The embedded gate log isolates three stale wording expectations; other reminder semantics passed.
Bug class: none
Bug evidence: Test expectation drift, not a new product behavior claim. The assigned gate log at 998dec84 reports the three exact failed assertions; the targeted reminder-words test exercises their replacements.
Hook bypass: none
Convergence: none
Decision: train183-reminder-assertion | Assert the complete compact reminder sentence at every existing consumer; retain negative-denial and cancellation checks without changing production wording or real captures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-032038-PROGRESS.md

1.x FIRST: JKHeadley/instar origin/main c79dd645fbd5c0e99d4cc4e988155b600c6f19b7, src/scaffold/templates.ts dated-reminder awareness, src/monitoring/CheckInReminderReconciler.ts bounded due scan, docs/specs/CAPABILITY-ADVISOR-SPEC.md actual-capability awareness; history 47c0edf1d94749154671fed4fb0cc50f3aedc577. Reuse truthful awareness, not 1.x scheduler implementation: the mismatch here is a 2.0 assertion after compact briefing wording. No matching ONEX-LESSONS.md found in local lanes or tracked trees searched.

Subject (1 paths): tests/preview/reminder-words.test.ts

## Closing block

simplestRobustRoute: Update the three existing consumer assertions to one complete expected sentence, preserving every qualifier and negative check. This is the simplest route; no added runtime machinery, changed start/end guards, or autonomous-completion claim.
80/20: The targeted test covers the named three failures and retains the historical contradiction and cancellation boundaries. This submission claims no new real-model or live deployment proof; the desk owns full-gate acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
