# Change review — cold-start timing quarantine

Subject base: 1d4991572fa621eb6e25b3c67c5685d41c13cacc
Review state: open
Reviewed content: none
Outcome: Preserve the independently red 20k timing measurement and quarantine only its unstable assertion while continuing semantic reconstruction and the small-corpus regression guard.
Affected rules: Rules 13, 37, 49, 70, 71, 74, 101, 102, 107, 111, 112, 113 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing owners; this changes only test reporting and the defect record, with no production path change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test assertion is quarantined with a tracked defect; source algorithms, authority and durable formats are unchanged.
Side effects: A green 20k semantic test no longer asserts a 15-second ceiling. A separately visible skipped test retains that exact assertion and the defect identifies the coverage gap. Other sizes retain the original scaled guard.
Undo and recovery: Revert this commit to restore the combined assertion. No persisted data or migration changes. Close the defect only with declared benchmark conditions and repeatable evidence, then restore the timing assertion.
Multi-machine posture: Timing samples belong to their host; the test and defect travel with git. Shared signed facts and disposable per-machine caches remain unchanged.
Layer below: Read purpose and rules in full and confirmed identical to origin/main; inspected recordedSource's signed in-memory corpus construction, FactStore readForProjection and the phase timing boundaries. Scheduling and intervening logging belong to elapsed time; the reviewed computation passed its semantic checks. No specific source defect establishes a robust ceiling under unspecified contention, so speculative admission changes would not repair the benchmark contract.
Bug class: unit
Bug evidence: reproducer=tests/recall/cold-start.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: No prompt, model output parser, verdict policy or briefing change; existing recorded intake fixtures remain unchanged.
Decision: cold-20k-timing-quarantine | Apply the review's Rule 37 timing-only quarantine with a tracked performance defect; retain semantic assertions, phase logs and the smaller-corpus timing guard. No source repair to uncontrolled wall-clock scheduling is established, and a passing retry cannot discharge the failure. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-repair-020339-PROGRESS.md
Skip: tests/recall/cold-start.test.ts:38 | quarantine=docs/defects/cold-start-20k-timing-flake.md

ELI16: Restart still has to rebuild every message correctly. The test now shows separately that its 15-second speed target is unresolved instead of letting one lucky fast run hide a slower one.

simplestRobustRoute: This is the review's narrow route: keep correctness checks, record the failed measurement, visibly isolate the flaky speed assertion and assign its closure. Entry is the unchanged signed corpus; end guards are ready state, complete entry count and zero conflicts; the small-corpus budget and finite test watchdog remain. No extra cache, service or production mechanism is added, and no autonomous completion or performance ceiling is claimed.
80/20: Verify the changed test at 200 and 20,000 messages, typecheck and required cheap gates; submit the performance defect still open and leave independent acceptance to the desk.
VERDICT: author submission; independent desk acceptance pending
