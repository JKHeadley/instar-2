# Change review — cint-L16 repair: the rolling-summary pipeline declares its closed fail direction

Subject base: 5a2dfddef1a2d3efdf7824d9242f3aa315ca5090
Review state: open
Reviewed content: none
Outcome: Astra's cint-L16 round-1 MUST-FIX 1 (pre-existing Rule 95 declaration error). The 'rolling-summary' entry of CRITICAL_PIPELINES in tests/preview/proofs.ts declared failureDirection 'open' while its supervisor (LIVE_JUDGMENTS 'summary-review': default reject, authority mandatory) and the worker refuse to commit a summary unless the review passes. The row now declares 'closed' and its owner sentence says an unavailable or rejecting review preserves the candidate without committing it. The existing definite-unavailable summary test in tests/preview/summary-check.test.ts now also asserts the preserved candidate and that stepCoverage reports 'closed' for rolling-summary; with the old 'open' row this assertion fails (Astra's reproducer). No summary acceptance behaviour, reservation, UNKNOWN charge or retry changed. The register was regenerated with --replay at the fix commit; the owner-reference rehash and inventory repin refreshed nothing.
Affected rules: 95 (the summary consumer's declared direction matches what it enforces: committing derived memory is integrity and fails closed), 74 (this record), 69 and 90 (register regenerated from committed sources with --replay), 116 (one literal and one sentence; no new gate, roster split or registry)
Affected floors: secrets — unchanged; spend cap — unchanged (no new call); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a status declaration and its owner sentence change to agree with existing enforced behaviour, plus one test assertion; no decision logic, send, intake, approval or authority path changes
Side effects: status stepCoverage for rolling-summary reads 'closed' with the corrected owner sentence
Undo and recovery: revert the fix commit, the register regeneration and this record
Multi-machine posture: machine-local: the single preview runner
Layer below: reviews/cint-L16-change-review.md (the base, carried)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/proofs.ts, tests/preview/summary-check.test.ts

## Closing block

simplestRobustRoute: change the one declared literal and its sentence to match the existing closed enforcement, and pin it in the existing unavailable-summary test
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate runs elsewhere)
VERDICT: author submission; the independent verdict is recorded as a pass
