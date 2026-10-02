# Change review — w3-correctionstall: regenerate the register at the unit's head

Subject base: 4c2d439440b0a67aec9e3be089442e6f55279e62
Review state: open
Reviewed content: none
Outcome: The studio gate for w3-correctionstall passed every test but failed lint with "source wiring pin trails tests/preview/journal.ts": the register was last replayed at 0f092ce2, before 1d97a762 edited journal.ts. The desk chain was run (owner-reference rehash 0, inventory repin 0) and the register was replayed at 4c2d4394 with `node scripts/build-register.mjs --replay`; only the generated commit pins change. No source, test or rule text changes.
Affected rules: 66, 69, 74, 101 (66 and 69 — the register is regenerated with --replay, never hand-edited; 74 — this record; 101 — plain commit, no hook bypassed)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: generated register output only; the replay changes the recorded commit pins and nothing else.
Side effects: none beyond the generated files now naming 4c2d4394 as their source commit.
Undo and recovery: revert the regenerate commit; lint then reports the trailing pin again.
Multi-machine posture: not applicable; generated files only
Layer below: scripts/build-register.mjs and scripts/check-register-wiring.mjs are unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: the required outcome is a register whose source pins match the tree. The simplest robust route is the existing desk repin chain and register replay, which this change runs and nothing more.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
