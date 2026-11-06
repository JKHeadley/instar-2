# Change review — give the provider-timeout test real room against an event-loop stall

Subject base: add5d75879174874e15bf1552ae37c82e00c6358
Review state: open
Reviewed content: none
Outcome: The provider-timeout integration test stops failing when a stalled shared event loop lets the 90ms client abort fire before the call reaches the local provider. Every assertion stays, and the driver timeout still sits under the admitted bound.
Affected rules: 37, 49, 70, 74, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — the same reservation and unknown-charge assertions remain; stop — unchanged; no duplicate sends — the one-request assertion remains; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test file's timing values and comment; no source, prompt or fixture change.
Side effects: The test takes about 1.4s longer. A stall above about 1.5s can still fail it; a measured 2000ms stall does.
Undo and recovery: Revert this commit. No migration or stored state.
Multi-machine posture: Test-only timing on one local process; no machine behavior changes.
Layer below: Read providerFixture route.invoke, admittedTimeout propagation, AbortSignal.timeout and localProvider request recording, plus commit 14827e670, which measured the same mechanism and widened the margin to 90/450.
Bug class: integration
Bug evidence: reproducer=tests/integration/model-provider-refusals.test.ts
Hook bypass: none; core.hooksPath unset.
Convergence: none
Prompt review: No model prompt, output parser, judgment policy or provider choice changes.
Decision: provider-timeout-margin | Use the existing admittedTimeout option with 1500ms driver timeout and 3000ms delay, measured against a real stall on old and new timing, instead of changing the fixture or weakening an assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/provider-timeout-margin-1106/progress.md

Subject (2 paths): reviews/provider-timeout-margin-1106-change-review.md, tests/integration/model-provider-refusals.test.ts

## Verification

Stall matrix, 5 runs per cell, real thread stall straight after fetch dispatch. Old timing: 5/5 at no stall, 0/5 at 150, 500, 1000 and 2000ms, with the gate's empty-requests assertion. New timing: 5/5 at 0, 150, 500 and 1000ms, 0/5 at 2000ms. The test file passes all 18 cases. The pipeline owns the full suite and independent review.

## Closing block

simplestRobustRoute: This is the simplest robust route: three existing timing values change through an option the fixture already has. No added mechanism, quarantine, retry or weakened assertion.
80/20: A 2-in-65 flake gets about 16 times the stall margin for 1.4s of test time; a deterministic rewrite of the timer is not worth it at this rate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
