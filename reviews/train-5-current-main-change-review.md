# Change review — Integrate current main and replay train-5 register

Subject base: 0b404dc8ea68a9a7f56768ac2fe3cd62f59855c5
Review state: open
Reviewed content: none
Outcome: Merge approved origin/main 97d8b714 into train-5b and regenerate the register against the merged ancestry, retaining all existing runtime capabilities.
Affected rules: 37, 49, 69, 74, 90, 91, 101, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement; this integration changes review tooling and publication metadata only
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The integration includes governance review tooling and its regression tests; the generated register is publication metadata derived from the merged tree.
Side effects: The checker adopts main’s remote-tip scope handling. Generated publication now names the merged commit and generation digest; no registry entries or runtime grants change.
Undo and recovery: Revert this integration through a reviewed ordinary commit and regenerate publication; retain history and do not move main.
Multi-machine posture: Merged tooling and register travel with the repository; verification logs are deliberately machine-local and supply no runtime authority.
Layer below: Reviewed main’s review-scope-1010 records, changeScope ancestry computation, firstLanding stale-baseline enforcement, register replay generator and desk pin scripts.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=Replay retains existing declaration text and prerequisites; the only publication changes are commit and generation identifiers.

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of approved main and existing generated-register replay. No new mechanism, exception, capability restriction or evidence bypass is introduced.
80/20: Foreground first-landing and additivity baseline tests, changed review-tool tests, typecheck/build and document checks verify this integration. Final cheap checks and historical-report limitations are recorded in the external train-5 repair progress; no full-suite or independent-convergence claim is made.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
