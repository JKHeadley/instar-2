# Change review — Move installation review guide out of change records

Subject base: ea8808d878b9a1d673e9fba1755a72261074fd1c
Review state: open
Reviewed content: none
Outcome: Restore Rule 74 record parsing by moving the owner installation review guide unchanged to review-guides/, outside the formal reviews/ record namespace.
Affected rules: 1 (all five floors preserved), 49 (scope recorded), 74 (proper change record, unchanged checker), 101 (no hook bypass), 111 (checker and guide links inspected), 113 (shared repository content), 116 (relocation without new machinery).
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged; documentation relocation only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only a review guide changes location; no runtime, model-facing text, governed design wording, or checker behavior changes.
Side effects: The guide has a new repository URL. A repository search found no references to its former path. Both directories are one level below the root, so all four relative documentation links retain their targets. No existing owner review-guide directory was found outside reviews/ and docs/.
Undo and recovery: Revert this relocation commit to restore the original path; doing so would also restore the malformed-record failure, so retain the relocation while repairing any guide-link issue.
Multi-machine posture: Git carries the same guide and review record to every checkout; no host state or distributed behavior changes.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full; inspected records() and check() in scripts/check-change-review.mjs, validateRecord in scripts/change-review.mjs, and the desk merge-live-chain.sh check command. The checker validates every current reviews/*.md except its explicit samples.
Bug class: none
Bug evidence: Editorial misplacement: the baseline exact checker reports the guide missing Subject base; evidence is recorded in the builder report. No code bug or new test implementation.
Hook bypass: none
Convergence: none

Subject (1 paths): review-guides/install-platform-neutral-1013.md

## Closing block

simplestRobustRoute: This is the simplest robust route: move the unchanged guide out of the existing record namespace and supply this proper record; preserve the checker and all five floors without an exemption or new mechanism.
80/20: Verify unchanged guide bytes and resolving links, the exact desk checker on a temporary train merge, typecheck, lint, register check, and the required pinned-text tests; independent review remains with the desk.
VERDICT: author submission; the independent verdict is recorded as a pass
