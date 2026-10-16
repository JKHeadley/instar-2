# Change review — renew sibling words native self-host conformance

Subject base: f846eec74b18cc919aa7bc35f01811a6c1523d21
Review state: open
Reviewed content: none
Outcome: Repair MF1 by renewing the supported Darwin native self-host certificate after its named contract passed on the sibling-words composition.
Affected rules: Rules 26, 34, 49, 69, 70, 74, 90, 101, 105, 111, 112, 113, 115, 116; D17 section 2.
Affected floors: secrets — custody and audience paths unchanged; spend cap — contract checks charged refused/timeout calls without retry; stop — contract verifies latched stop before dispatch; no duplicate sends — delivery and retry paths unchanged; durable intake — no journal or intake changes.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Renew an existing exact-composition support claim with the real native contract; no runtime behavior or authority changes.
Side effects: The supported native tuple now binds the tested 264-file composition. Capability, entry points, runtime, contract and architecture checker are preserved. Register replay from committed source 571222b0db6cd3661aabfe63d2616850e051eaef refreshes the seven existing generated outputs; replay itself is not conformance evidence.
Undo and recovery: Revert the certificate if the evidence is invalid and rerun the named native contract before replacement. Never substitute a measured digest for contract execution or narrow supported ability. Rebuild generated output using the existing replay workflow after a revert.
Multi-machine posture: This certificate is deliberately specific to Darwin and its exact Node runtime. Other machine/harness tuples and shared ownership remain unchanged. Physical confined launches are local to the contract test.
Layer below: Inspected compositionClosure/compositionDigest, currentRuntime, native-harness-contract, native self-host adapter and architecture parity validation. Closure complete=true, 264 files; measured before execution and checked unchanged before recording conformance. Actual Darwin Node 24.14.1 runtime matches its declared executable digest.
Bug class: none
Bug evidence: none; conformance evidence renewal from /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-words-1015-repair-native-contract.json and sibling-words-1015-repair-native-all.json, with closure in sibling-words-1015-repair-composition.json.
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains only sample files. Ordinary commits.
Convergence: none
Decision: sibling-words-native-renewal | Use the existing named captured-frame contract on Darwin, check its closure stayed unchanged, then renew the certificate and replay existing register outputs. Real confined launches and installation are exercised; no new live-model semantic claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-words-1015-repair-PROGRESS.md

Subject (8 paths): src/assembly/harness.declarations.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing native contract on the declared runtime, record the unchanged composition after success, and regenerate existing register evidence. Admission, caps, stop and durable custody remain the checkpoints; no new machinery or restricted ability. No autonomous production completion claim.
80/20: MF1 is repaired with measured evidence: the named contract and all 10 cases in its file pass, including certificate equality, stop, refused/timeout calls and bounded launch lifecycle. Typecheck and architecture pass. Final committed-head lint, register, review and pinned-text checks are recorded in the repair progress report; prior unit live-proof residue remains scoped to the desk proof rooms.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
