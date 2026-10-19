# Change review — confirm already-retired hosts during allowance renewal

Subject base: 95747ae14b1dcb4361b44e453f69a306a401e093
Review state: open
Reviewed content: none
Outcome: A deadline-halted topic already retired by maintenance no longer vetoes renewal for healthy topics.
Affected rules: 1, 4, 15, 26, 34, 37, 42, 46, 49, 60, 61, 63, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — existing custody and outbound checks unchanged; spend cap — exhaustion-only renewal still reserves the same cap against the finite non-refunding outer journal; stop — existing stop and authority checks still gate renewal; no duplicate sends — halted outcomes and identities remain retained; durable intake — no custody or accepted input is discarded.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: Retirement confirmation gates installation allowance renewal on the answer path.
Side effects: Explicit retirement now confirms an already-closed host only when its close record exists and worker, claim and physical lease are absent. Concurrent draining or retirement still refuses, and pressure/idle cleanup cannot use this confirmation. Failed closure or release continues to veto renewal. The topic's deadline and uncertain outcomes survive.
Undo and recovery: Revert the source and regression change to restore the previous behavior; no schema, migration or new state is introduced. Reversion reintroduces the cross-topic renewal veto.
Multi-machine posture: Machine-local retirement confirmation deliberately describes the physical worker and lease owned here. Existing conversation ownership admission and durable shared accounting remain unchanged; no new writer or weaker replication demand.
Layer below: Read retire(), close(), recover(), lease release and the coordinator renewal loop. retire() clears worker and claim only after physical closure and resource release succeed; close() can record uncertainty even when they fail, so a close record alone cannot authorize renewal.
Bug class: integration
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains only sample hooks.
Convergence: none
Prompt review: No prompt or parser changes. The coordinator tests replay the existing recorded summary, uncertain summary, Jev undecided/unsure, reply review, delivered and empty reply context shapes across renewal. No live journal access or new live proof is claimed.
Decision: allowance-renew-1019-retired-confirmation | Confirm explicit retirement from the existing close record plus absent physical handles, without reopening the halted topic or retrying uncertain cleanup. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/allowance-renew-1019-repair-071006-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: recognize already-confirmed physical retirement in the existing lifecycle method. No new timer, cap, state or recovery mechanism. Busy and unconfirmed retirement refuse; the coordinator retains its exhaustion, stop, authority, parent deadline and finite outer budget guards. The lifecycle regression proves unrelated work completes after maintenance while the halted input remains uncertain, and negative cases prove worker/lease uncertainty still refuses. This is targeted builder evidence, not live acceptance.
80/20: Repair the single demonstrated lifecycle cause and prove its positive and negative neighbors; leave full combined-build and native macOS conformance to the Studio gate.
VERDICT: author submission; no independent convergence asserted
