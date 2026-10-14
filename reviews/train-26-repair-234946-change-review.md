# Change review — train-26 conformance test repair

Subject base: 0d848a118151e4d4ae34125ba7070a2a7ea2f74e
Review state: open
Reviewed content: none
Outcome: Repair the three failing conformance assertions when the committed native composition is explicitly unproven, while retaining all exact-byte and runtime checks for a supported claim.
Affected rules: Rules 26, 37, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116; Purpose constraint 3.
Affected floors: secrets — no credential or runtime path changes; spend cap — no model calls or allowance changes; stop — existing contract unchanged; no duplicate sends — existing contract unchanged; durable intake — existing contract unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only source repair plus its review record; no product implementation, constitution, certificate or generated declaration changes.
Side effects: Supported-state linter mutations now use an explicit in-memory fixture over the actual composition closure. The real declarations are independently linted and the real adapter must describe an unproven declaration honestly. A future supported declaration still has to satisfy the original exact artifact, runtime, conformance and platform assertions. The fixture is never persisted as certification evidence.
Undo and recovery: Revert this test-only commit to restore the previous assertions; no durable product state, declaration or live installation needs recovery.
Multi-machine posture: The fixture uses the executing host runtime. Runtime mismatch is evaluated on the declared platform, while byte mismatch is checked everywhere. Native process lifecycle and confinement execution remain Studio checks; no host certificate is claimed by this WSL run.
Layer below: Read parityMatrix, lintParityRegister, compositionClosure, compositionDigest, selfHostCompositionEvidence and createSelfHostHarness describe; confirmed commit 669ec5b6 deliberately replaced the stale certificate with an unproven declaration. The contract execution cases and actual declaration are unchanged.
Bug class: integration
Bug evidence: reproducer=tests/types/shipped-clients.test.ts; the supplied Studio excerpt also reproduces tests/preview/native-harness-contract.test.ts; local pre-edit run reproduced both portable assertion failures.
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample files only.
Convergence: none
Prompt review: No model prompt, parser, accept/escalate/refuse decision or delivered reply changes; model journal replay is not applicable to these assertion repairs.
Decision: train-26-repair-234946-fixture | Test the supported linter state using an in-memory exact-composition fixture, independently of the committed certification status; never persist it as a certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-repair-234946-PROGRESS.md
Decision: train-26-repair-234946-honesty | The real adapter must report an explicitly unproven declaration as unproven; retain the original exact certification assertions for any supported declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-repair-234946-PROGRESS.md

Subject (2 paths): tests/types/shipped-clients.test.ts, tests/preview/native-harness-contract.test.ts

## Closing block

simplestRobustRoute: Correct the test assumptions using the existing declaration reader, digest and admission checks; no new production machinery. Begin with a complete fixture closure, finish with the existing linter and adapter assertions, and retain bounded test timeouts. No autonomous product completion is claimed.
80/20: Three failures share one cause: the tests treated an explicitly unproven declaration as certified. The repair preserves the certified negative controls, adds the unproven neighbor and leaves certification to its actual platform owner.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
