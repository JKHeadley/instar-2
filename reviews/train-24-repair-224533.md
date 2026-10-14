# Change review — train-24 certification-state test repair

Subject base: b9ebee0fbcf2ece3dd22d78f6422f54001565d6b
Review state: open
Reviewed content: none
Outcome: Repair three stale certification assertions while retaining train-24's honest unproven native-harness declaration and all certificate rejection coverage.
Affected rules: 26, 34, 37, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116.
Affected floors: secrets — no runtime or credential change; spend cap — no charging change; stop — existing native contract still exercises refusal before dispatch; no duplicate sends — existing journal restart contract remains; durable intake — no store or intake change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of assumptions contradicted by the deliberately unproven shipped declaration; no product behavior changes.
Side effects: Supported-certificate mutation tests now use an explicit in-memory declaration derived from actual local composition bytes and runtime. This is test input, never published certification. The native contract checks the adapter's reported posture against the shipped declaration, retaining exact conformance and runtime assertions for supported tuples and requiring explicit unproven provenance otherwise.
Undo and recovery: Revert these test changes and this record; no persistent product state changes or migration exist. Reversion restores the stale test failures but cannot change the shipped certification posture.
Multi-machine posture: Test fixtures use the local resolved runtime and composition; platform-neighbor tests still check on-host runtime refusal and off-host byte drift. No machine state or ownership behavior changes. The optional reason field is asserted through its optional length so the test remains type-safe without weakening its minimum-length check.
Layer below: Read parityMatrix, lintParityRegister, compositionClosure, compositionDigest, selfHostCompositionEvidence and the real adapter description; the shipped declaration explicitly withdraws the old certificate after the host composition changed.
Bug class: integration
Bug evidence: reproducer=tests/types/shipped-clients.test.ts; tests/preview/native-harness-contract.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train-24-repair-cert-fixture | Exercise supported-certificate validation through a test-only in-memory declaration, preserving positive and byte/runtime/route/artifact/entry-point rejection neighbors without publishing a certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-24-repair-224533-PROGRESS.md
Decision: train-24-repair-posture | Require the actual adapter to agree with the shipped certification posture; unproven must remain unproven, and any supported claim must still match exact bytes and runtime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-24-repair-224533-PROGRESS.md

simplestRobustRoute: Correct only the stale test setup and posture assertions using the existing declaration and digest APIs. This is the simplest robust route: no runtime machinery, declaration edits or certification bypass. The start guard is a complete real composition closure; positive and mutated certificate checks verify the limits; shipped posture agreement is the end-state guard. No unattended product completion or live certification is claimed.
80/20: Run the two affected test files, build, typecheck and required cheap gates; preserve the independent Studio full-suite and certification responsibilities.
VERDICT: author submission; no independent verdict or live certification claimed
