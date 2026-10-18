# Change review — Refresh group carry repair source bindings

Subject base: 7ea42a159d8294918488ff3c82e05bee0e0f9969
Review state: open
Reviewed content: none
Outcome: Register wiring resolves the already-committed journal repair and lint accepts the current source graph.
Affected rules: 1, 26, 37, 49, 69, 70, 74, 90, 101, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated register bindings participate in critical admission paths; this is a mechanical replay with no authority or runtime change.
Side effects: Seven generated artifacts now identify source commit 7ea42a159d8294918488ff3c82e05bee0e0f9969 and its replay generation. Their declarations, prerequisites and capability contents are unchanged. The authorized owner-manifest rehash and inventory repin produced no changes.
Undo and recovery: Revert the generated replay commit to restore its predecessor binding; doing so intentionally restores the stale-source lint failure. Regenerate from the desired committed source to recover a consistent register.
Multi-machine posture: Repository-wide generated artifacts are identical on every machine. No runtime state, lease, transport or replication behavior changes.
Layer below: Inspected check-register-wiring.mjs source comparisons, generated/source.json and register commit binding, desk rehash/repin tools, and saved gate report with its rooted companion assertion and process evidence. All eleven contract checkers pass in the original gate worktree; the copied report alone is insufficient for checks that require original absolute paths and companion files.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-group-carry2-pipeline-repin | Use the existing delegated desk chain and replay the repaired committed source; no handwritten pins or new runtime machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-group-carry2-repair-PROGRESS.md

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: regenerate the stale register through the existing tool after confirming source and owner hashes. Start guard is the committed repaired source; end guard is successful wiring and register checks; limits remain the existing authority prerequisites and unchanged runtime checkpoints. No autonomous runtime capability or fresh full-suite completion is claimed.
80/20: Build and typecheck pass. Targeted wiring and both carry files pass all 40 tests, including real recorded-shape replay. The saved gate has zero failed tests; all eleven contract checkers pass against that original evidence, including 19 counterfeit-evidence refusals. No new skip or quarantine. Final lint, register and review checks are required after this record's commit before push.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
