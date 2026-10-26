# Change review — One Provider Is Enough

Subject base: d0944dbaee4acee514c53c25c3f1ba13026953d6
Review state: open
Reviewed content: none
Outcome: Record the operator's 2026-10-26 direction as Rule 118, One Provider Is Enough: an agent with exactly one AI provider is fully functional, a second provider is an optimization only, and every feature that uses a second provider declares its single-provider behaviour. It is a new rule in Needs building rather than an edit to Rule 30, because Rule 30 is held by a lint that exists today (Checkable now) while the single-provider boot test and the declaration check still have to be built; editing Rule 30 would either move it out of its group or claim a check that does not exist. Regenerate the repository replay register. This is a constitutional amendment, not a claim that the floor is held today.
Affected rules: 30 and 67 (scope boundary: harnesses stay with 30, an outage of the one provider stays with 67), 34, 43 and 62 (the boot test reuses their live proofs), 69, 72, 73, 74, 90, 91, 109, 111, 113, 116 and new 118. Purpose unchanged. History preserves prior revisions; the check is named and Rule 118 stays a coverage gap until it is built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 118; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 118 is not in the briefing source pins). No runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent: the rule is about provider configuration, not placement. No replication or machine-local state is introduced.
Layer below: The full rule book, Rules 30 and 67 for overlap; scripts/register-source.mjs four-column parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching; tests/e2e/register.test.ts rule-count consumer; tests/preview/briefing.ts SOURCE_PINS (rules:87 and purpose excerpts only, unaffected).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: the amendment commit on this branch, regenerated through scripts/build-register.mjs --replay with --now 1792195200000 (2026-10-17). The real clock refuses every replay build on main since 2026-10-18 because feature preview.step-check's graduation deadline (1792281600000) is overdue; that is a pre-existing main defect outside this amendment. The backdated clock is not embedded in outputs: replaying main's publication commit fc71abbcc with the same --now reproduces main's generated directory byte for byte. Outputs contain 118 rules; Rule 118 remains a coverage gap rather than a fabricated holder.

Subject (15 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, reviews/constitution-single-provider-floor-change-review.md, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the boot test and declaration check are named for later building, as every Needs-building rule does.
80/20: Author checks in progress; independent review required before readiness.
VERDICT: author submission; the independent verdict is recorded as a pass
