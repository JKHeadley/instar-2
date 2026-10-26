# Change review — isolate restart history from evidence sampling

Subject base: 9a977d026fab073a876d432f906b0bf28f58b4ef
Review state: open
Reviewed content: none
Outcome: Keep the frozen14 restart fixture outside the current-source digest while preserving its historical journal behavior and dependency identities.
Affected rules: 1, 24, 26, 34, 35, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. Only test scratch placement changes; all journal restart and effect-fence assertions remain.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test-infrastructure source repair with no product, model prompt, parser or acceptance behavior change.
Side effects: Historical relative static imports resolve from a temporary module to the same current dependency paths. The exact source sampler runs during the restart test to detect recurrence. No pin, checker predicate or timing allowance is relaxed.
Undo and recovery: Revert this repair commit; no durable product state or deployment changes. Temporary modules remain under the existing fixture cleanup.
Multi-machine posture: Test code travels through git. Temporary historical modules are deliberately local to each runner and never enter another worker's checkout-source digest. No remote assertion ledger is accepted as local evidence.
Layer below: Inspected productionGroundingSourceDigest, its assertion ledger producer and consumer, the Vitest report clock fields and the split-report local-half binding. The unchanged checker correctly rejects a digest containing historical scratch source. The prior repair 876de0bbb6004059999921a1db454cf2a06d39fb already provides the helper, tests and restart relocation; reuse those exact helper files rather than designing another mechanism.
Bug class: integration
Bug evidence: reproducer=tests/preview/restart-handoff-program.test.ts
Evidence boundary: The added restart digest assertion fails on the original sibling placement and passes after relocation. Supplied gate log places the scratch-writing test immediately before the rejected assembly case. Attribution of that historical rejection to this race is an inference without its original assertion ledger; the deterministic source race itself is reproduced. Fresh full-gate acceptance remains with the desk.
Hook bypass: none
Convergence: none
Prompt review: No model-facing instruction or parser changes. Historical journal bytes and behavior are preserved; only static dependency paths change.
Decision: train-160-repair-reuse | Reuse the relevant repair from 876de0bbb: exact historical-module helper and tests, and its restart relocation. Preserve the newer renewal implementation already isolating its scratch files; do not merge unrelated branch history or duplicate its repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-160-repair-032340-PROGRESS.md
Decision: train-160-repair-evidence | Keep all evidence checks and pins unchanged; sample the real digest while historical scratch exists, with red-before/green-after evidence and source-change negative controls. No load test, fabricated full report or claim of exact original-ledger replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-160-repair-032340-PROGRESS.md
Validation: Targeted historical-module, restart-handoff and assembly-production tests; typecheck, architecture/lint, register freshness, change-review and required portable pinned tests. Results and any host-only limitations are recorded in the builder report.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing historical-module relocation repair so scratch never contaminates source identity, retaining the current evidence gate and every journal assertion. No product machinery, new gate or broader serialization is added. This is a test-infrastructure repair, not an unattended product-completion claim.
80/20: Deterministic overlap proves the race and its repair without a full suite or CPU load. The desk's fresh full gate decides acceptance; original-run attribution remains explicitly bounded.
VERDICT: author submission; no independent verdict asserted
