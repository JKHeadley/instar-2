# Change review — cint-L50 repair 4c: owner reference pins re-pinned to the two changed rungraph tests, register replayed

Subject base: ebbe5ebcae6fa59e0a76bf8cd3dd7e878a04ed72
Review state: open
Reviewed content: none
Outcome: Repair 4b changed tests/rungraph/closure-registration-additivity.test.ts and tests/rungraph/scope.test.ts, so register-source/owner-references.json still pinned their old bytes and register:check reported "P3-NF-01: source pin trails". The delegated desk rehash refreshed exactly those three pins (the additivity test once, the scope test twice) to the bytes now in the tree, the desk chain re-ran (inventory unchanged: neither file is a reviewedSupportSource, so 0 pins moved and the check-assembly-contracts digest is unchanged), and the register was replayed at the repin commit. No pin was hand-edited and no source or test behaviour is authored here.
Affected rules: 7, 31, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: mechanical pin regeneration by the desk scripts plus a register replay; no new behaviour
Side effects: none beyond the refreshed pins and regenerated register outputs
Undo and recovery: revert the two commits; no durable format or record changes
Multi-machine posture: unchanged
Layer below: reviews/cint-L50-repair4b-change-review.md; the desk scripts desk-rehash-owner-manifests.mjs and desk-repin-chain.sh
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references.json

## Closing block

simplestRobustRoute: run the delegated desk repin and replay the register; no code authored (Rule 116).
80/20: register:check passes (check true), lint passes apart from this host's node-version parity row, and the two re-pinned tests pass.
VERDICT: author submission; the independent verdict is recorded as a pass
