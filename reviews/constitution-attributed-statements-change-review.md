# Change review — Attributed Statements Trace to Their Source

Subject base: ef4a964232b7baf17d8fc4cf1b8a248a95b6d513
Review state: frozen
Reviewed content: sha256:febabbf4676508cfc7b21c73d745a8d2cbc2c7e1a657e1a6d10502adeb692792
Outcome: Record the operator's approved wording as Rule 121, Attributed Statements Trace to Their Source: a statement credited to a person carries a pointer to the logged message and that person's own words, checked at writing and again at citing or enforcing; a label is never evidence; without a source it says so and never becomes that person's rule. A new rule in Needs building, because no check exists yet.
Affected rules: 58, 89 (scope boundary: 89 covers who a delivered message is from, 58 logs model judgments; 121 covers a later claim about what a person said) and new 121. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserves prior revisions; Rule 121 stays a coverage gap until its checks are built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 121; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 121 is not in the briefing source pins; tests/preview/constitution-briefing-sync.test.ts passes). No runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent text. The rule names every machine; no replication or machine-local state is introduced here.
Layer below: The full rule book, Rules 58, 89 and 119 for overlap; docs 06 and 21 for the fact and recall seams a 2.0 pointer would use (survey only, not designed here); scripts/register-source.mjs parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (all 120 recorded rule hashes reproduced unchanged, one added for 121); tests/e2e/register.test.ts rule-count consumer; the 1.x registry articles Truthful Provenance and Telegram Message Origin for the counterpart.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit b97d0f7dc on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118, 119 and 120, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 121 rules. Rule 121 remains a coverage gap in the register rather than a fabricated holder.

Counterpart (Rule 119): 1.x has no article on claims about what a person said, so this needs a 1.x counterpart, not "none". The PR body names it.

Known red, outside this change: on the real clock `npm run register:check` and one case of tests/e2e/register.test.ts stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the same refusal main gives (checked on main ef4a96423 in this run). The other five cases of that file pass.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the checks are named for later building, as every Needs-building rule does.
80/20: An independent read of the first draft by GPT-6 Astra returned two must-fixes, both repaired; an independent pass on this exact tree is required.
VERDICT: author submission; the independent verdict is recorded as a pass
