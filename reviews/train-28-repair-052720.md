# Change review — Test native parity without assuming a deployed certificate

Subject base: 943602ba37b0eb17ce5fb6216fa825f9c6573b97
Review state: open
Reviewed content: none
Outcome: Repair the three pipeline assertions caused by tests assuming the native self-host tuple is always certified, while retaining the honest unproven declaration and every certificate refusal check.
Affected rules: 26, 37, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116.
Affected floors: secrets — unchanged, no runtime edits; spend cap — unchanged; stop — existing route refusal remains tested; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test files only; no production behavior, declaration, prompt or certificate is changed.
Side effects: Checker tests use an in-memory supported declaration; this must never be confused with a deployed certificate. The shipped declarations are still checked separately. Native contract assertions accept only a reasoned unproven tuple with no certificate and an adapter that also reports unproven, or the existing exact supported certificate checks. The physical contract cases remain unchanged.
Undo and recovery: Revert this repair commit to restore the old assertions; no durable state or installed file changes require migration.
Multi-machine posture: Checker fixtures bind the current runtime and exercise both matching and other platforms. Physical native contract verification and certification remain on macOS; WSL runs portable assertions only.
Layer below: Inspected parityMatrix, lintParityRegister, compositionClosure/compositionDigest and selfHostCompositionEvidence. The committed declaration explicitly withdrew certification after step1b-host-1013 changed composition bytes; the checker correctly accepts that reasoned unproven state.
Bug class: unit
Bug evidence: reproducer — supplied Studio fast log on 943602ba shows two supported-versus-unproven assertions and undefined runtime.replace; repaired checker tests pass all five cases and seven portable native-contract cases pass, including unproven adapter reporting.
Hook bypass: none
Convergence: none
Decision: train28-repair-cert-fixture | Exercise certified checker behavior using an in-memory positive fixture; keep deployed certification unchanged and verify the adapter reports its actual unproven state. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-052720-PROGRESS.md

Subject (2 paths): tests/types/shipped-clients.test.ts, tests/preview/native-harness-contract.test.ts

## Closing block

simplestRobustRoute: Reuse the existing digest and checker APIs in tests and branch the native assertion on the declared state; this is the simplest robust route, adds no production machinery, and preserves byte/runtime drift refusal without inventing a macOS certificate. Start: reproduce supplied assertion mismatch; end: targeted portable tests and gate checks pass; limit: no physical macOS certification claim on WSL.
80/20: The three failures share one stale test premise. Repair that premise and retain positive and negative certificate coverage; leave the existing Studio contract run to the gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
