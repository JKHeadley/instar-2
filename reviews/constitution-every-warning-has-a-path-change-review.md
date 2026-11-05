# Change review — Every Warning Has a Path

Subject base: c20b68d1d9b5744a72c243c4dc8a4b69114179d6
Review state: frozen
Reviewed content: sha256:5faad3d63a22bf40ca1ddbea8e77a189fdd0cf65092289c69d6191104bfa8b4c
Outcome: Record the operator's approved wording as Rule 122, Every Warning Has a Path: anything shown to a person that says something is wrong or needs them carries an immediate path to act; a status word appears only when true for that person; an unknown state never reads as healthy.
Affected rules: 23, 82, 120 (scope boundary: 23 and 82 cover when and how to ask, 120 covers the person's whole part; 122 covers what a warning owes them) and new 122. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserved: all 121 earlier rule hashes are unchanged.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 122; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 122 is not in the briefing source pins; tests/preview/constitution-briefing-sync.test.ts passes).
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent text. The rule names every person-facing surface; no replication or machine-local state is introduced here.
Layer below: The full rule book, Rules 23, 82, 119 and 120 for overlap; scripts/register-source.mjs parser and bootstrap declarations; scripts/build-register.mjs replay anchor; the 1.x checks named in the how-checked cell.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit ba890209a on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118 to 121, because the real clock refuses every replay build on main for an unrelated overdue deadline.

Counterpart (Rule 119): the obligation applies to both versions, so this needs a 1.x counterpart, not "none". The PR body names it.

Known red, outside this change: on the real clock npm run register:check and one case of tests/e2e/register.test.ts stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the same refusal main gives.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the 2.0 check is named for later building, as every Needs-building rule does.
80/20: An independent pass on this exact tree is required.
VERDICT: author submission; the independent verdict is recorded as a pass
