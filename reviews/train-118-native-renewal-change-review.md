# Change review — train-118 native conformance renewal

Subject base: 9e7d9733f611fce70796330aa95b78fd59345034
Review state: open
Reviewed content: none
Outcome: Repair the desk READY gate's R105 failure by certifying the current native macOS self-host composition after its declared contract passed on the Studio, and publish the declaration through the existing register replay.
Affected rules: 26, 37, 49, 69, 70, 74, 101, 105, 111, 112, 113, 115, 116
Affected floors: secrets — custody and disclosure unchanged; spend cap — existing charged-attempt and over-cap checks retained; stop — contract verifies refusal before dispatch; no duplicate sends — contract verifies journal restart without a second send; durable intake — existing owner records and causal admission are exercised unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This renews the evidence supporting an existing native harness tuple. Its authority, runtime, contract, capabilities and behavior remain unchanged; the existing real contract validates the exact composition before certification.
Side effects: Only the native Claude self-host conformance digest changes in the declaration. The seven generated register views now carry that declaration from source commit fc4efe16b8df3c1de2792fae2cf9758c409ac841. Replay is shape-only register publication; actual contract execution supplies native conformance evidence. Other tuples retain their declared posture.
Undo and recovery: Revert the certificate and replay the register from the intended source revision. An old certificate on the current composition will correctly fail R105; run the same contract before certifying any replacement composition. No stored-state migration is required.
Multi-machine posture: Evidence is specific to the declared native Darwin runtime and composition. No ownership, replication, peer dependency or durable-state behavior changes. Committed declaration and generated evidence travel with the branch.
Layer below: Inspected scripts/composition-digest.mjs, the R105 comparison in scripts/check-architecture.mjs, and tests/preview/native-harness-contract.test.ts including its real confined launches, owner admission, journal restart and injected slow-start deadline cases. Verified the actual Studio runtime matches the declaration and that the complete static closure and its digest were unchanged across contract execution.
Bug class: none
Bug evidence: none; this repairs stale conformance evidence, not runtime behavior. The desk's supplied R105 failure and the prior repair's lint logs provide the negative case.
Hook bypass: none; core.hooksPath checked unset and the common hooks directory contains only samples. Ordinary commits and push only.
Convergence: none
Verification: Production build and TypeScript pass. Before changing the declaration, the exact named native contract passed (1 selected test, 14.010 seconds). After renewal, the entire native-harness-contract.test.ts passed (10 tests, 24.653 seconds), including the exact certificate, success, refusal, timeout, over-cap, stop, journal restart and readiness/deadline branches. Standalone architecture passes. Final lint, register and change-review results are recorded in the desk repair report after publication.

The complete 269-file composition is sha256:6d4f61cb2a16c034576d44f32c3b138e41b1f03a94c4c104443cf36deafb8f47 on node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda. Captured provider frames replace only physical provider IO; the contract launches real confined tools, installs and probes a real local capability, and records real owner admission. This is the existing declared conformance bar, not a new live-login or model-facing completion claim.

Evidence retained under /Users/dabombstudio/.instar/agents/echo/.instar/lanes/: train-118-repair-native-before.json, train-118-repair-native-contract-before.log, train-118-repair-native-contract-after.log, train-118-repair-native-architecture.log and train-118-repair-native-register-replay.log. The certificate does not rely on an unexecuted hash replacement, and the earlier R105 exception is no longer claimed for this repair.

Subject (8 paths): src/assembly/harness.declarations.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing named native contract on its declared runtime, verify the same complete composition before and after execution, renew only its conformance value, and replay the existing register. Exact runtime and complete closure are start guards; the contract and architecture check are end guards; existing secrets, spend, stop, uniqueness and durability checkpoints remain the limit guards. No new machinery or autonomous-production claim.
80/20: One declaration value and its generated publication repair the failed gate. Only the targeted native contract file ran; no full suite or load generation. The existing injected slow path tests deadline independence without loading the Studio.
VERDICT: author submission; no independent convergence verdict is asserted.
