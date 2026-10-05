# Change review — cint-L50 repair 3: preview owner references re-pinned to the changed journal tests, register replayed

Subject base: bf76a6e95ad29e13e20c3d15f822313fdde69ae6
Review state: open
Reviewed content: none
Outcome: The Studio gate failed six tests in tests/e2e/register.test.ts, all from one cause: plan #510 (commit 6017cb5f) changed tests/preview/journal-obligations.test.ts but register-source/owner-references/preview.json still pinned its old bytes ("reference artifact hash differs"). The desk rehash refreshed the two preview pins to the bytes now in the tree, the desk chain re-ran, and the register was replayed at the repin commit. No source or test behaviour is authored here.
Affected rules: 7, 31, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: mechanical pin regeneration by the desk scripts plus a register replay; no new behaviour
Side effects: none beyond the refreshed pins and regenerated register outputs
Undo and recovery: revert the two commits; no durable format or record changes
Multi-machine posture: unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; plan #510 commit 6017cb5f
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json

## Closing block

simplestRobustRoute: regenerate the stale pin with the desk scripts; no code authored (Rule 116).
80/20: lint, register:check and the failing register e2e file pass locally; the full gate reruns in the pipeline.
VERDICT: author submission; the independent verdict is recorded as a pass
