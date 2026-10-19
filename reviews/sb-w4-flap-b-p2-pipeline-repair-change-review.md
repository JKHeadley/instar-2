# Change review — flap-b pipeline evidence repair

Subject base: ded8fece13c9f5151cab9068c59adc687c1e5a37
Review state: open
Reviewed content: none
Outcome: Restore Rule 102 decision reports and stop renewal compatibility tests from changing the checkout while grounding evidence hashes it. Historical provider and journal modules now live in a temporary directory with relative imports rebound to their existing current dependencies. The saved gate has a transient source digest on V93/V94; both grounding cases pass in the targeted rerun after the source fix.
Affected rules: 26 (actual evidence), 37 (source fix without quarantine), 49 (constraints), 70 (red/green reproducer), 74 (side effects and undo), 101 (no hook bypass), 102 (reported decisions), 111 (evidence collector below the test), 112 (preserve red saved evidence), 113 (machine posture), 116 (reuse temporary-directory fixture pattern)
Affected floors: secrets — no secret reads or output; spend cap — no provider calls; stop — unchanged; no duplicate sends — no live sends; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test isolation and review report repair only; neither production behavior nor acceptance criteria change.
Side effects: Historical modules resolve their relative imports against the same source locations as before, but the temporary module itself is outside the source tree. Failed git reads now fail explicitly. Two digest assertions ensure files held open for the compatibility checks never contaminate grounding evidence. The old policy acceptance/refusal and old journal compatibility assertions remain intact.
Undo and recovery: Revert this commit to restore the original test placement and report references; no runtime state or migration. The transient evidence mismatch would return.
Multi-machine posture: Tests use each machine's existing temporary directory. No shared fixture names or checkout mutation; the same behavior works on one or multiple test hosts. Desk reports remain in the operator-specified absolute lanes directory.
Layer below: productionGroundingSourceDigest and checkProductionGroundingAssemblyEvidence in scripts/check-assembly-contracts.mjs; tests/assembly/production-grounding-evidence.mjs captures the digest on import; saved assertion ledger shows only V93/V94 differ from the process-exit digest. All 127 saved obligations audited read-only. The Rule 102 resolver requires a real report containing each decision ID.
Bug class: integration
Bug evidence: reproducer=tests/preview/renew-activation.test.ts
Hook bypass: none
Convergence: none
Decision: sbflapbp2-isolate-history | Move git-captured historical modules into test scratch space and rebind relative imports; preserve the source-digest check rather than accepting mismatched evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-b-p2-repair-PROGRESS.md
Decision: sbflapbp2-saved-evidence | Run saved contract checks in their original gate checkout because rooted process and assertion evidence cannot be transplanted. Keep old V93/V94 evidence red, and report their source repair and targeted passing rerun separately. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-flap-b-p2-repair-PROGRESS.md

Subject (1 paths): tests/preview/renew-activation.test.ts

## Closing block

simplestRobustRoute: Keep historical compatibility behavior and every evidence guard; put temporary modules outside the checkout, using the existing temporary-directory pattern with import rebinding. This prevents a demonstrated transient source-digest mismatch without locks, serialized suites, retries, weaker checks, or new production machinery. Git-read success guards the start, unchanged source digest and existing acceptance/refusal assertions guard the result, and existing test deadlines bound execution. No autonomous production completion is claimed.
80/20: A new digest assertion fails deterministically on the old source-tree placement. With the fix, all 11 renewal tests plus V93/V94 pass, and six writer recovery regressions pass. No full suite on Studio. Nine saved-result contract checkers pass; the remaining two refuse only the old V93/V94 evidence, which is preserved for the new Mama gate to replace with a fresh run.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
