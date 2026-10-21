# Change review — train-95 step-check deadline repair

Subject base: 29a780c4dc7eebb0917adb374e9907c5949189a3
Review state: open
Reviewed content: none
Outcome: Record the unresolved step-check graduation with an October 24 00:00 UTC deadline; preserve the actual-clock build check and dark status.
Affected rules: 24, 37, 49, 70, 72, 73, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched. This deadline record changes no effect, authority or runtime admission.
Operator questions: none
Suggested tier: critical
Declared tier: standard
Tier rationale: Finite promotion metadata and its assertions/documentation; no executable decision logic, model behavior or safeguard changes.
Side effects: The register and status surface report October 24 instead of October 21. Step-check remains dark and all stages remain missing. The new deadline will fail the build when reached unless the desk records graduation, retirement or another reviewed decision. Repeated extensions reflect missing graduation work, not test flakiness.
Undo and recovery: Keep step-check off. Append a correcting decision and synchronize the declaration and consumers if necessary; retain every existing promotion entry and journal. Rebuild derived publication through the normal register workflow.
Multi-machine posture: The committed promotion record and generated register are shared identically by all machines; checks use each host clock. No machine-local state or new coordination is introduced.
Layer below: Checked promotionRecordFindings chronological and future-deadline validation, promotionOf latest-entry selection, capabilityFindings deadline equality and overdue comparison, capabilityRows dark status, and proofStatusLines graduation text. Existing negative tests remain, with an added one-millisecond-before boundary assertion.
Bug class: none
Bug evidence: Before repair: capabilities.test.ts reproduced precisely the supplied real-clock failure (16 pass, 1 fail). After repair with locked dependencies: capabilities.test.ts and promotion-record.test.ts pass all 22 tests; tsc --noEmit and build pass. Studio owns the new exact-head full suite.
Hook bypass: none
Convergence: none
Decision: step-check-oct24 | Append a finite 72-hour deadline from the expired target; the desk must resolve the missing graduation evidence, and the real-clock guard remains. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-95-repair-PROGRESS.md
Prompt review: No model-facing text, prompt construction, output parser or verdict changes. Only the promotion deadline metadata and human status expectations change.

Subject (5 paths): tests/preview/README.md, tests/preview/capabilities.declarations.json, tests/preview/capabilities.test.ts, tests/preview/promotion-record.test.ts, tests/preview/promotion-record.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing append-only new-deadline mechanism with a finite deadline, reason, owner and rollback, keep the dark feature visibly ungraduated, and synchronize existing consumers. The start guard requires a future timestamp and complete record; the limit guard still fails at the deadline. No autonomous completion or live graduation is claimed.
80/20: The supplied failure is reproduced and repaired at its declaration/record source. No new machinery, false promotion or test quarantine; actual graduation remains desk-owned and due October 24.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
