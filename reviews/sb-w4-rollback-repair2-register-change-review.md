# Change review — sb-w4-rollback repair 2: register replayed at the re-declared conformance pin

Subject base: 311a128939dd534af907a449a3479ce7a1bb6466
Review state: open
Reviewed content: none
Outcome: The register's source pin trailed src/assembly/harness.declarations.json after repair 2 (`node scripts/build-register.mjs --check`: "P3-NF-01: source pin trails src/assembly/harness.declarations.json; commit source changes and regenerate", and `node scripts/check-register-wiring.mjs`: "source wiring pin trails src/assembly/harness.declarations.json"). No owner reference moved — the repair changed one declared metric value, not a pinned owner reference — so the desk rehash and repin chain had nothing to do and were not run; `node scripts/build-register.mjs --replay --commit 311a128939dd534af907a449a3479ce7a1bb6466` regenerated generated/ and `--check` is now true (generation sha256:aecd123fe261d822a43c04283610c22a3db1ddb9b0abb240dcdd797e55f94bb0, 281 entries, 116 rules, 34 terms), and check-register-wiring reports issues: []. The whole diff across the seven files is 14 lines: the source-commit and generation stamps, plus the one `harness.preview-self-host-native.claude-code-subscription.darwin.self-hosting.conformance=` metric carried into generated/capabilities.md — the intended change. No rule, capability, term, prerequisite or coverage entry moved (281/116/34/108 unchanged either side).
Affected rules: 48, 69, 74, 90, 101, 105, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Generated output only.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: regenerated output with no hand edit. The only differences are the stamps and the one metric value its committed source already carries, and the generator is the single path that produces them.
Side effects: none beyond the pin now matching the committed source, which is what clears the P3-NF-01 and source-wiring-pin findings.
Undo and recovery: revert this commit, the generated commit and this record, then re-run the replay at the restored source commit.
Multi-machine posture: unchanged; generated/ is byte-identical on every machine for the same commit, which is why the replay could be run from this Linux host for a declaration certified on darwin.
Layer below: scripts/build-register.mjs --replay (unchanged, not edited to accept the value); reviews/sb-w4-rollback-repair2-change-review.md, whose subject this replay pins.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sb-w4-rollback-r2-no-desk-repin | the desk owner-manifest rehash and repin chain were not run: the finding was a source pin trailing a changed declaration, not an owner reference source pin, and the delegated repin exists for the latter. Running it would have rewritten nothing and is not a substitute for the standard replay | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-rollback-repair-080608-PROGRESS.md
Prompt review: no model-facing change.

Subject (8 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/sb-w4-rollback-repair2-register-change-review.md

## Closing block

simplestRobustRoute: required outcome — the register pin matches the committed source. Route: the standard `--replay --commit <HEAD>`, with no hand edit and no added mechanism; that is this proposal.
80/20: `node scripts/build-register.mjs --check` exits 0 with check: true; `node scripts/check-register-wiring.mjs` exits 0 with issues: []; the generated diff is 14 stamp-and-metric lines over seven files, with the entry, rule, term and prerequisite counts unchanged.
VERDICT: author submission; the independent verdict is recorded as a pass
