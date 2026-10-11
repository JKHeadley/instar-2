# Change review — Restore current-main ancestry for holding train proofs

Subject base: 41294d2f9728c4a5fe92135493ab8f39c92cb53d
Review state: open
Reviewed content: none
Outcome: Restore current-main ancestry so the holding train gate can evaluate its first-landing proofs. Merge the already approved fc0e3c20 main publication; regenerate its merged conversion pin and register. No runtime logic, first-landing guard, or test expectation is edited by this repair.
Affected rules: 24, 25, 37, 49, 70, 74, 90, 91, 101, 111, 112, 113, 116. Repair the ancestry condition; retain proof guards, approved text and history; record verification and merge side effects.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. No runtime path is changed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The mechanical merge imports previously approved governed documents. No new amendment or runtime authority is introduced.
Side effects: The branch now includes PR 154 approved purpose, rule, glossary, policy and quoting-test updates. The conversion anchor combines current branch shape with approved main documentation and rule hashes. Generated register stays shape-only; no deployed installation is changed.
Undo and recovery: Preserve history. If this merge is faulty, repair its merge resolution and regenerate from the corrected commit. Reverting the merge with its first parent restores the prior branch but also restores the stale-main proof failure; it is not a deployable fix.
Multi-machine posture: Git ancestry and generated publication travel together on every checkout. No distributed runtime state, ownership, leases or effects change; local test evidence remains bound to its own checkout.
Layer below: Read the complete purpose and rules including approved main amendments. Inspected firstLanding, p15AdditivityBaseline, the gate report including measurement collection failure, both git parents, merged bootstrap anchor and canonical hash, register generation and original main amendment review.
Bug class: none
Bug evidence: none
Verification evidence: gate 41294d2f saved report: all 14 failed assertions and measurement collection error name main fc0e3c20 absent from HEAD. After merge, all 14 pass; 28 additional focused tests pass, including the real stale-main refusal and both first-landing applicability neighbors. Typecheck and build pass. This is repository ancestry reconciliation with existing regression checks; no implementation bug or new reproducer is introduced.
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=existing generated declarations copied by merge and regenerated; no work is deferred by this repair
Deferral: generated/register.json:1 | not-a-deferral=existing generated declarations copied by merge and regenerated; no work is deferred by this repair

Subject (24 paths): docs/00-the-policy-register.changelog.json, docs/00-the-policy-register.changelog.md, docs/00-the-policy-register.md, docs/00-the-purpose.changelog.json, docs/00-the-purpose.changelog.md, docs/00-the-purpose.md, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, docs/03-the-glossary.changelog.json, docs/03-the-glossary.changelog.md, docs/03-the-glossary.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/terms/consequential.test.ts, tests/types/operations.test.ts

Decision: holding-train5-main-ancestry | Merge approved main; preserve all first-landing refusal checks instead of changing their semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-onto-train5-repair-PROGRESS.md
## Closing block

simplestRobustRoute: This is the simplest robust route: merge the baseline the existing proof requires and regenerate only its existing publication artifacts. No fallback, quarantine or extra runtime mechanism. Start guard is verified approved main; end guard is real ancestry plus targeted passing assertions; limits are unchanged safeguards and foreground single-worker tests. No autonomous product completion claim.
80/20: All reported failures share one ancestry cause and now pass targeted replay. The stale-baseline negative controls still refuse. Full suite is reserved for the pipeline; all eleven saved-report contract checkers were inspected and reject the unchanged failed report. Final lint, register and review checks run after this record is committed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
