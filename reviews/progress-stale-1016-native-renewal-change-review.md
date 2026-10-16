# Change review — renew native conformance after failed-activity repair

Subject base: 2123d42fdbb58faacc6b0221346f783cc962f84d
Review state: open
Reviewed content: none
Outcome: The native macOS self-host certificate binds the repaired composition that passed its named contract on the Studio, clearing the READY gate's R105 mismatch.
Affected rules: 26, 34, 49, 69, 70, 74, 90, 101, 105, 111, 113, 115, 116
Affected floors: secrets — existing confinement and outbound checks; spend cap — captured provider frames and unchanged allowances; stop — exercised by the contract; no duplicate sends — unchanged delivery and restart rules; durable intake — unchanged owner and journal paths.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Evidence renewal after a composition change; no runtime behavior, capability or authority changes.
Side effects: One conformance declaration changes from the old composition digest to sha256:2765fd3c8eb26cba6e3c02790289da8fa8d1e8df50d6c617db4c67886705a724. Its platform, runtime, supported status, entry points and contract evidence reference remain unchanged. Generated register outputs bind the committed declaration through the existing replay generator.
Undo and recovery: Revert the declaration and generated refresh together with the corresponding source repair, or run the named contract on another intended composition before renewing its declaration. A digest is never updated merely to silence lint.
Multi-machine posture: This certificate is explicitly for the existing darwin tuple and resolved Node runtime. Other platforms and doorway declarations remain unchanged; no new store or replication behavior.
Layer below: Existing compositionClosure/compositionDigest/currentRuntime implementation; all 267 resolved composition files and their before/after digest; native full-port contract through the actual owners, confined launches and installed capability; architecture's R105 recomputation; register replay generator.
Bug class: integration
Bug evidence: reproducer=tests/preview/native-harness-contract.test.ts
Hook bypass: none
Convergence: none
Decision: progress-stale-native-renewal | The desk's explicit READY-gate repair request assigns this formerly desk-owned renewal here. Run the named contract first and verify unchanged composition/runtime before changing the certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-stale-1016-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording is reproduced by the generator without adding a deferred repair.
Prompt review: No prompt, parser or model decision changes. The provider's physical frames in the existing contract are captured fixtures; native owner admission, tools and installed capability execute locally. No live model or operator-surface acceptance is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: run the existing contract against the changed composition, verify its complete closure and runtime remain unchanged, and renew the existing declaration. The start guard is the exact declared macOS runtime and complete closure; the end guard is the passing named contract with identical before/after digest; all existing safety floors remain. No new checker, exception or weakened assertion.
80/20: The named native contract passed before renewal on the 267-file closure and declared Node 24.14.1 runtime. Architecture passes after renewal. Full native-contract and final pushed-head READY checks are retained in the unit PROGRESS report. Full host-suite acceptance remains with the pipeline.
VERDICT: author submission; independent review pending
