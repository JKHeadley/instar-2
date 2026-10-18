# Change review — Merge approved main into train-5b

Subject base: 5e999e5c00579ee6b438729a0a28aa383ea7cc1c
Review state: open
Reviewed content: none
Outcome: Merge approved origin/main 6c63ef84 into train-5b without rewriting history. Preserve approved documents exactly, adopt the finite October 25 rungraph deadline, retain the operator-emergency-stop basis, and require both in the historical additivity assertion.
Affected rules: 37, 49, 69, 70, 72, 73, 74, 90, 91, 101, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain existing enforcement; this integration adds no runtime capability restriction or effect path
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The merge includes operator-approved constitutional documents and their generated publication; the repair itself reconciles metadata and test expectations.
Side effects: The dark rungraph feature retains main's finite deadline and existing live-proof requirement. Register artifacts must be regenerated after the merge is committed so they bind its complete ancestry.
Undo and recovery: Revert the integration with an ordinary reviewed commit and regenerate the register. Do not move main or rewrite the branch history.
Multi-machine posture: Shared repository changes and generated artifacts travel together; validation logs are deliberately machine-local and grant no runtime authority.
Layer below: Approved main reviews docs-amend-1010 and repo-checks-1010; src/register/declarations.ts live-proof enforcement; src/rulegraph/graph.ts deadline enforcement; scripts/first-landing.mjs ancestry checks; desk pin generators.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: main-deadline | Keep main's October 25 deadline and the branch's explicit stop basis, requiring both in the additivity proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-5-repair-PROGRESS.md

Subject (20 paths): docs/00-the-policy-register.changelog.json, docs/00-the-policy-register.changelog.md, docs/00-the-policy-register.md, docs/00-the-purpose.changelog.json, docs/00-the-purpose.changelog.md, docs/00-the-purpose.md, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, docs/03-the-glossary.changelog.json, docs/03-the-glossary.changelog.md, docs/03-the-glossary.md, generated/conversion.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, src/rungraph/rungraph.declarations.json, tests/rungraph/closure-registration-additivity.test.ts, tests/rungraph/scope.test.ts, tests/terms/consequential.test.ts, tests/types/operations.test.ts

## Closing block

simplestRobustRoute: This is the simplest route: ordinary merge plus existing pin and register regeneration. No new machinery or broadened exception is introduced; the historical comparison enumerates only known governance metadata changes.
80/20: Typecheck and build are run before publication; foreground baseline and document checks plus the final cheap gates are recorded in the external train-5 repair progress. No full-suite or release-readiness claim is made by this author record.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
