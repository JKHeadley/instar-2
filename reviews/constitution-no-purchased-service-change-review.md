# Change review — No Feature May Require a Purchased Service

Subject base: c20b68d1d9b5744a72c243c4dc8a4b69114179d6
Review state: frozen
Reviewed content: sha256:49ffe7e1e36b0edfbc9c7f86b9d891a1a80f2fc3f12fbc91dbbb731a4c11bae9
Outcome: Record the operator's approved wording as Rule 122, No Feature May Require a Purchased Service: every feature works fully without the user buying anything from a third party, an outside paid service is at most an optional add-on, a design that blocks or degrades core function without it goes back, and the subscriptions a user already chose to run their agent are outside the rule. A new rule in Needs building, because no check exists yet.
Affected rules: 118 (scope boundary: 118 answers whether a second AI provider is needed; 122 answers whether any outside purchase is needed; neither replaces the other), 120 (who sets up a free outside account stays there), 121 (its source requirement applies to this change's quotes) and new 122. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserves prior revisions; Rule 122 stays a coverage gap until its check is built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes. The rule gives no permission to remove a floor to avoid a purchase.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 122; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 122 is not in the briefing source pins; tests/preview/constitution-briefing-sync.test.ts passes). No runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent text. No replication or machine-local state is introduced here.
Layer below: The full rule book, Rules 30, 118, 120 and 121 for overlap; scripts/register-source.mjs parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (all 121 recorded rule hashes reproduced unchanged, one added for 122); tests/e2e/register.test.ts rule-count consumer; the 1.x registry article Framework-Agnostic for the counterpart.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit 48a3aed54 on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118 to 121, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 122 rules. Rule 122 remains a coverage gap in the register rather than a fabricated holder.

Counterpart (Rule 119): 1.x has no article on purchased services, so this needs a 1.x counterpart, not "none". The PR body names it.

Known red, outside this change: on the real clock `node scripts/build-register.mjs --check` stops at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the refusal the Rule 121 record already names; the Slack declaration is unchanged here. The owned work is in docs/defects/rule-36-genuine-parser-captures.md.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the check is named for later building, as every Needs-building rule does.
80/20: An independent read by GPT-6 Astra of the source and generated changes on this branch returned YES with 0 must-fix and 2 notes (pending map bookkeeping for R121's 1.x pair; the unchanged real-clock refusal above). The first launch of that read was terminated by a signal partway and rerun; only the completed run counts.
VERDICT: author submission; the independent verdict is recorded as a pass
