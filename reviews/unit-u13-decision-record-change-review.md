# Change review — U13 decision record in the change-review record (Rule 102)

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: Rule 102 gap (synthesis b4 "mid-run engineering decisions recorded and reported"): the change-review record now takes repeated 'Decision: <id> | <what was decided, and why> | reported=<locator>' rows. validateRecord refuses a malformed or repeated row and an unreported decision (no reported=, a report that does not exist, or one that does not name the id as a whole token). The locator resolves like the existing live=/restart= evidence (a repository file at the record's commit, or an existing absolute file); the CLI supplies readEvidence. Because landing runs check first, a landing whose record has an unreported decision is refused. draft prints a one-line comment naming the row form. Mid-run decisions of this unit, reported in its PROGRESS record: D-u13-optional-rows (an optional repeated row, not a new required field, so no current record owned by another unit is invalidated) and D-u13-report-names-id (reported means the named report exists and names the id; whether the decision was right stays with the reviewer).
Affected rules: 102, 74, 84, 116, 71
Affected floors: secrets — untouched, the report text is only searched for the id and never printed; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched, landing tooling only
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: landing tooling in scripts/; adds one refusal to the change-review check and landing, no runtime path
Side effects: a record that adds Decision rows must name a report that carries each id, or check and landing refuse; records without Decision rows are unaffected
Undo and recovery: revert this commit; no ledger, record or durable format changes
Multi-machine posture: machine-local, deliberately; an absolute-path report resolves only on the machine that holds it, as with the existing live=/restart= evidence
Layer below: docs/01-the-rules.md rows 102, 22, 74, 116; docs/00-the-purpose.md; scripts/change-review.mjs validateRecord and landingVerdict; scripts/check-change-review.mjs check and landing
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: tests/register/change-review.test.ts:134 | not-a-deferral=the word is the placeholder decision text the test proves is refused, not postponed work

Subject (6 paths): reviews/unit-u13-decision-record-change-review.md, scripts/change-review.d.mts, scripts/change-review.mjs, scripts/check-change-review.mjs, tests/register/change-review-git.test.ts, tests/register/change-review.test.ts

## Closing block

simplestRobustRoute: one optional repeated row in the existing review record, validated by the existing check that landing already runs; no journal, service or new required field (Rule 116).
80/20: an unreported decision refuses check and landing, a reported one lands (unit and real-CLI landing tests); tsc, lint, register:check and change-review check pass.
VERDICT: author submission; the independent verdict is recorded as a pass
