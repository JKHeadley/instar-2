# Change review — capability evidence assertion

Subject base: 38c2169e5258ef0dc62ad1560415551f2f3edd66
Review state: open
Reviewed content: none
Outcome: Repair the stale live-declarations prompt assertion while retaining real captured-output replay and the capability-key check.
Affected rules: 26, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; only a test expectation changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test literal aligns with the existing evidence field; no model input, parser, acceptance decision or runtime changes.
Side effects: The test now requires the evidence field to name packet.capabilities; dropping that reference still fails. Recorded capability membership and worker replay remain exercised.
Undo and recovery: Revert this test-only commit; no durable state or runtime migration is involved.
Multi-machine posture: Shared repository test only; no machine-local runtime state or ownership changes.
Layer below: OBLIGATION_DECISION in tests/preview/journal.ts, the captured fixture and the journal worker's declaration projection exercised by this suite.
Bug class: unit
Bug evidence: reproducer=tests/preview/live-declarations.test.ts
Hook bypass: none
Convergence: none
Decision: train50-evidence-field | Assert the existing evidence field instead of restoring obsolete prose in the model prompt; the actual capability binding is retained. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-50-repair-213548-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest route: align one stale assertion with the existing capability evidence schema and retain the real-output replay. No new mechanism or runtime behavior is needed.
80/20: Reproduce the one failure, run the six affected tests and portable cheap gates, and submit the pushed repair to the Studio full gate; no new live acceptance claim.
VERDICT: author submission; no independent verdict asserted
