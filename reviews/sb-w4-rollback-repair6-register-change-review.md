# Change review — sb-w4-rollback repair 6: owner reference repinned and register replayed

Subject base: f718b07a08a1029ee68b4378de97d2f911d6538e
Review state: open
Reviewed content: none
Outcome: Repair 6 changed tests/preview/journal.ts and tests/preview/journal-obligations.test.ts, so `npm run lint` reported "owner reference source pin trails tests/preview/journal-obligations.test.ts" and `npm run register:check` reported "P3-NF-01: source pin trails tests/preview/journal.ts". The delegated desk repin (`desk-rehash-owner-manifests.mjs` then `desk-repin-chain.sh`) refreshed exactly one pin, in register-source/owner-references/preview.json, with no hand edit. `node scripts/build-register.mjs --replay --commit 3b3f1484df8a070909e6cc48feccd0c1a95cdfda` then regenerated generated/ (generation sha256:23261611b4403764d5df307bdd910ebd0469f89f4e3864db8204267f6befcfae, 281 entries, 116 rules, 34 terms, 108 prerequisites — unchanged counts). The whole diff is 14 lines of pins and stamps over eight files.
Affected rules: 48, 69, 74, 90, 101, 105, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Pins and generated output only.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a tool-produced pin refresh and regenerated output with no hand edit; the generator and the desk repin are the single paths that produce them.
Side effects: none beyond the pins matching the committed source.
Undo and recovery: revert the two commits and this record, then re-run the repin and replay at the restored source commit.
Multi-machine posture: unchanged; generated/ is byte-identical on every machine for the same commit.
Layer below: reviews/sb-w4-rollback-repair6-change-review.md, whose subject these pins follow.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing change.
Deferral: generated/register.json:1 | not-a-deferral=generated register content, regenerated after the fix

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json

## Closing block

simplestRobustRoute: required outcome — pins match the committed source. Route: the delegated desk repin and the standard replay; no added mechanism.
80/20: `npm run lint` exits 0 (architecture checks passed; register wiring issues: []); `npm run register:check` reports check: true.
VERDICT: author submission; the independent verdict is recorded as a pass
