# Change review — cint-L14 review repair: P5 grounding reads the local half; split-report-checks refuses absolute paths

Subject base: 8893f7accb4a1e565a82f3c465658773972706d2
Review state: open
Reviewed content: none
Outcome: Astra's cint-L14 review returned NO with two must-fixes, both fixed at source. (1) scripts/check-p5-contract-map.mjs handed the merged split report to checkProductionGroundingAssemblyEvidence, whose process-receipt predicate needs the exact digest of a report one real Vitest process wrote; a merge matches no half's receipt, so test:split-checks could never pass P5. P5 now passes localHalfReport(report, root).report to the grounding arm, exactly as check-assembly-contracts and check-p11 already do; the seam-evidence and P5 coverage rows still read the whole report, and an unsplit report is returned unchanged. (2) src/assembly/tool-inventory.ts admitted a leading slash in split-report-checks parameters, so an absolute path outside the checkout was admitted with no scoped run path; the pattern's first character can no longer be "/" (traversal and leading-option refusals unchanged). tests/assembly/tool-inventory.test.ts proves a relative pair admits and an absolute pair, a mixed pair and a ../ path refuse; tests/platform/gate-split-merge.test.ts proves the local half's digest matches a real half receipt while the merge matches none, and that P5 routes grounding through localHalfReport. Astra's own tool-scope reproducer now fails its "absolute is Success" assertion, as intended. Because tool-inventory.ts is executed by the self-host composition, the native harness contract was re-run 9/9 twice and the conformance digest re-declared (sha256:3907a124…). The desk chain refreshed no pins; the register was regenerated with --replay at ae8eade0.
Affected rules: 2 and 115 (the tool takes repository-relative scoped parameters only), 45 (the missed report consumer now reads the report shape it can verify), 37 (source fixes, no quarantine), 105 (contract re-run before re-declaring), 74 (this record), 69 and 90 (register regenerated with --replay, never hand-edited), 116 (reuse the existing localHalfReport and one pattern character, no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a gate checker reads the local half for its single-process arm, and one inventory pattern is narrowed; no runtime, approval, intake or send path changes
Side effects: split-report-checks refuses absolute report paths; P5 under a split verifies grounding against the local half's real process receipt
Undo and recovery: revert the four commits of this repair
Multi-machine posture: unchanged; the split merge runs on one host over both halves
Layer below: reviews/cint-L14-pipeline-repair-change-review.md; reviews/w3-splitmerge-change-review.md
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/check-p5-contract-map.mjs, src/assembly/harness.declarations.json, src/assembly/tool-inventory.ts, tests/assembly/tool-inventory.test.ts, tests/platform/gate-split-merge.test.ts

## Closing block

simplestRobustRoute: reuse the existing localHalfReport in P5 as assembly/P11 do, and forbid a leading slash in the one tool pattern
80/20: 2 must-fixes fixed, 0 notes (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass
