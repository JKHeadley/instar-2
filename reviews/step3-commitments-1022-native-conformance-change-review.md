# Change review — Renew native conformance for bounded promise wake

Subject base: 170e000b228d3bd645432e09b0ef5b1814ed4d25
Review state: open
Reviewed content: none
Outcome: Renew the supported Darwin native self-host composition's conformance after its existing contract passes on the declared runtime. Correct the retry repair's Rule 115 trace and distinguish a remote-builder handoff exception from current evidence.
Affected rules: 26, 34, 37, 49, 70, 74, 90, 101, 111, 112, 113, 115, 116; architecture R105.
Affected floors: secrets — existing custody/redaction; spend cap — existing reservations and metering; stop — existing admission/latch; no duplicate sends — existing durable identities/receipts; durable intake — existing append-before-processing. No enforcement changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes a supported conformance assertion; executable behavior is unchanged.
Side effects: Native adapter can again report conformance for its actual composition. Generated register publication follows the renewed certificate. No ability, harness choice, model behavior, send authority or timer behavior changes.
Undo and recovery: Revert the certificate with its matching composition and replay the register; restoring the old certificate alone would correctly restore R105. Certify any replacement composition with this same contract.
Multi-machine posture: Shared declaration certifies only the exact Darwin runtime measured on the Studio. No durable state, ownership or peer-policy changes.
Layer below: Inspected compositionClosure/compositionDigest/currentRuntime, architecture R105 comparison, selfHostCompositionEvidence and adapter.describe admission, plus native-harness-contract.test.ts. Complete 270-file closure and runtime node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda produce sha256:3d1e8c4c477cc9666335765165af40266ce3bb2e8f94feacebec7f8d175571fe. The named native contract passed before renewal, exercising confined package build/install/probe, owner reservations, stop and refused/timed-out calls. Before renewal architecture refused only the stale certificate; after renewal all 10 tests in the native contract file passed, including exact certification, restart/no-duplicate delivery, captured route refusals and readiness/deadline boundaries. Architecture now passes. Final report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-native-after.json. Typecheck passed.
Bug class: none
Bug evidence: Evidence maintenance only; targeted native reports and composition measurement retained under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-native-before.json and step3-commitments-1022-native-composition.json; final results in step3-commitments-1022-repair-PROGRESS.md in that directory.
Hook bypass: none
Convergence: none
Decision: certify-current-native | reuse the existing native contract and digest functions on the declared runtime, then replay publication; the stale certificate is not accepted as current evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step3-commitments-1022-repair-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed register descriptions introduce no new deferred work

Scope: The accepted retry repair remains intact. The distinct Five-owned dated-reminder REGISTER/READ/CLOSE contract and holder activation remain disclosed D18 residue; neither is claimed or merged into the wake, and a date grants no send authority. No model-facing change is introduced in this repair.

simplestRobustRoute: Run the existing native contract, bind its successful evidence to the measured current runtime and complete composition, then use existing register publication. This is that route, with no new test framework or capability restriction. Start guards are successful contract and exact runtime/closure; end guards are matching adapter/architecture conformance and cheap gates; the five effect and admission floors remain unchanged. No new live acceptance claim.
80/20: Repair the sole evidence finding and its review trace. Targeted native positive/refusal/stop checks supply the evidence; the Studio pipeline owns the full suite and fresh live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
