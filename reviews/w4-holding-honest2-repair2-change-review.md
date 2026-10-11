# Change review — renew native macOS harness conformance

Subject base: 7e1cce7bf3670f9f8da9a65554179ce79b771fae
Review state: open
Reviewed content: none
Outcome: Renew the supported preview-self-host-native / claude-code-subscription / darwin / self-hosting conformance for the unchanged unit behavior and complete Astra's affected-rule trace.
Affected rules: 26, 34, 37, 49, 63, 70, 74, 83, 89, 101, 105, 111, 112, 113, 115, 116
Affected floors: secrets — no content or credential changes; spend cap — existing owner admission and charged-unknown non-repetition exercised; stop — unchanged native stop latch exercised; no duplicate sends — no sender changes; durable intake — no intake changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: exact-composition evidence for an existing supported harness capability
Side effects: only the conformance declaration, review records and generated register/pins change. The desk rehash also refreshes the existing reply-check test artifact pin left stale by the prior unit. No capability is removed or broadened.
Undo and recovery: revert the declaration and generated metadata together; the architecture checker will again refuse the stale conformance for these composition bytes. There are no production state changes to undo.
Multi-machine posture: deliberately macOS runtime-specific evidence; the active journal owner's sending fence and peer acknowledgements remain unchanged. Other tuples retain their existing status.
Layer below: inspected compositionClosure/compositionDigest/currentRuntime, selfHostCompositionEvidence and the named native contract. Its 253-file closure is complete, its runtime exactly matches the declared executable, and its positive native launch/install plus stop/refused/timeout checks run through existing owners.
Bug class: none
Bug evidence: none
Classification: conformance metadata renewal only; no runtime bug fix or changed reproducer. The existing unchanged contract and its red-before/green-after results are recorded below.
Hook bypass: none
Convergence: none
Decision: honest2-renew-conformance | retain the computed candidate only after the unchanged named contract passes on its exact macOS runtime | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-repair2-PROGRESS.md
Rule trace: Rule 83 replaces an unowned promise with an honest final notice; Rule 89 preserves the infrastructure notice's signed provenance; Rule 63 preserves owner-gated sending. These behaviors are unchanged; the original record now names these rules. Rules 26/105/115 bind support to actual runtime/composition evidence.

Evidence: On 2026-10-10, nice -n 10 node node_modules/vitest/vitest.mjs run tests/preview/native-harness-contract.test.ts --maxWorkers 1 --configLoader runner -t 'native composition honours the harness contract through doorway claude-code-subscription' first exited 1 at the stale digest assertion (7.89s), then exited 0 (13.56s, one selected test passed, eight excluded by the explicit title filter). The test file and runtime code were not modified. Physical provider I/O uses the contract's captured-frame fixture; the sandboxed launches, build, install and probe are real. This is not a live paid-provider or Telegram delivery claim.

Runtime: node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda, darwin arm64.
Declared composition: sha256:c77e8cde6c1f0b1b8d7de11869cdacc37630f05bc9df4d582db5bd7ced43f689.
Logs: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-honest2-repair2-native-before.log and w4-holding-honest2-repair2-native-after.log.

Validation: architecture checks passed after renewal. The desk repin found no inventory changes; build passed; the owner-manifest rehash refreshed the existing reply-check.test.ts pin; build-register --replay --commit 12849546c72f5a6e7e82ac1a5548aee90036f127 regenerated the seven existing register/capability/coverage/glossary/rules/source artifacts.

## Closing block

simplestRobustRoute: renew the existing declaration using its unchanged named contract on the declared runtime, then regenerate existing register metadata. This is the simplest robust route; no new mechanism is introduced. Start guard is the exact runtime and complete closure; end-state is the passing named contract and current declaration; existing owner, stop and resource limits remain intact.
80/20: narrowly scoped repair of Astra MUST-FIX 1 and NOTE 2, retaining the red-before/green-after evidence. Combined-build and independent landing review remain with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
