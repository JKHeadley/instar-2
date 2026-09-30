# Change review — w3-crheads: pass --submitted all reads the heads landing judges

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: live-proof group L (pipeline/live-proof/results/L-trial2/lte-landing2.out) refused a valid two-record landing with "Rule 107: red evidence ... not submitted": changeHeads() gave pass only the record's own range, while landing judges each current record over its range plus the candidate HEAD. A record whose last edit precedes HEAD therefore got an "all" without the runs made at HEAD, so its pass withheld the red run at HEAD and no classification could discharge that. changeHeads now returns the record's range plus HEAD (deduplicated), the same heads landing uses; this fixes both the CLI `pass --submitted all` and the desk flow's pass inside landing. Explicit `--submitted id,id` is unchanged and still refused when it omits a red run; a red run stays red until classified.
Affected rules: 107, 37, 74, 116
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched, landing tooling only
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: landing tooling in scripts/; widens the population "all" submits to exactly the heads landing already judges, no runtime path
Side effects: a pass with --submitted all now also lists runs recorded at the candidate HEAD for a record whose last edit precedes HEAD
Undo and recovery: revert this commit; no ledger or record format changes
Multi-machine posture: machine-local, deliberately; the evidence ledger lives in the repository's .git
Layer below: scripts/change-review.mjs landingVerdict (withheld/red); scripts/check-change-review.mjs landing heads [...r.range, head]
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none
Convergence: none
Deferral: tests/register/change-review-git.test.ts:316 | not-a-deferral=no deferral is introduced; the new tests only prove the fixed and still-refused sides

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: one line in changeHeads so pass and landing read the same heads; no new flag, record kind or auto-classification (Rule 116; Rule 37 fixed at the source).
80/20: the new two-record test fails on the base build (the older record's pass submits []) and passes with the fix, landing then still requires the red run's classification; the explicit-omission neighbour stays refused; the existing 17 tests in the file pass; tsc, lint, register:check and architecture checks pass.
VERDICT: author submission; the independent verdict is recorded as a pass
