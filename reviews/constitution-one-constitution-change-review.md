# Change review — One Constitution, Two Books Aligned

Subject base: 2f46478df4fd512e74d612ac494dc88441aa3bd6
Review state: open
Reviewed content: none
Outcome: Record the operator's 2026-11-03 direction as Rule 119, One Constitution, Two Books Aligned: every change to either book names its counterpart in the other or says why it has none, a map names the differences, and the master governs. Match Rule 72 to the Maturation Path wording the operator approved for 1.x. Wording approved in topic 137053.
Affected rules: 1 and 69 (a checked rule, naming its enforcement), 72 (reworded), 74 and 109 (the review holds meaning), 91 (no history in the governed body), 116 (simplest robust route).
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls; stop — no cancellation changes; no duplicate sends — no messaging changes; durable intake — no intake changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is a small script and text.
Side effects: The rule inventory grows to 119; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. document-checks fires on PR body edits, and gains a separate counterpart job. That job shows red and does not block merging, because the ruleset requires no status checks. No model-facing excerpt changes and no runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent: repository text and CI, with GitHub as the only state.
Layer below: The full rule book, Rules 72 and 119's neighbours for overlap; scripts/register-source.mjs four-column parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (117 of 118 recorded rule hashes reproduced unchanged, only Rule 72 differs); tests/e2e/register.test.ts rule-count consumer.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Subject (16 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/check-constitution-pairing.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one row in the existing rule table, one reworded row, one line in each pull request body, and one small script with no state of its own. A rule-by-rule hash ledger was tried in review and rejected: it left clauses uncovered, needed a state machine for the merge window, and read as certifying meaning.
80/20: Five review rounds on the 1.x spec with an outside model; independent pass required here on the exact tree.
VERDICT: author submission; the independent verdict is recorded as a pass
