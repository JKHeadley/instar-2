# Change review — One Constitution, Two Books Aligned

Subject base: 2f46478df4fd512e74d612ac494dc88441aa3bd6
Review state: open
Reviewed content: none
Outcome: Record the operator's 2026-11-03 direction as Rule 119, One Constitution, Two Books Aligned: every change to either book names its counterpart in the other or says why it has none, a map names the differences, and the master governs. Bring the main obligations of the Maturation Path wording the operator approved for 1.x into Rule 72, whose wording the operator also approved; 1.x keeps more operating detail, and the alignment map names that difference. Wording approved in topic 137053.
Affected rules: new 119; 72 (reworded), 73 (shares its machinery) and 76 (its existing exemption from the ladder, unchanged, stated in 1.x and not in Rule 72's sentence); 34 (the check carries its own tests); 1 and 69 (a checked rule, naming its enforcement); 74 and 109 (the review holds meaning); 90 and 91 (the changelog carries the history, none in the governed body); 116 (simplest robust route).
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls; stop — no cancellation changes; no duplicate sends — no messaging changes; durable intake — no intake changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is a small script and text.
Side effects: The rule inventory grows to 119; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. document-checks fires on PR body edits, and gains a separate counterpart job. That job shows red and does not block merging, because the ruleset requires no status checks; it reads red today because the named 1.x counterpart, JKHeadley/instar#2687, is stacked on a feature branch rather than targeting main. No model-facing excerpt changes and no runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent: repository text and CI, with GitHub as the only state.
Layer below: The full rule book, Rules 72 and 119's neighbours for overlap; scripts/register-source.mjs four-column parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (117 of 118 recorded rule hashes reproduced unchanged, only Rule 72 differs); tests/e2e/register.test.ts rule-count consumer; the 1.x copy of scripts/check-constitution-pairing.mjs at JKHeadley/instar#2689, which differs from this one only in the header reference and the rename handling added here, and needs the same two edits. Rule 119's mechanisms: this repository's scripts/check-constitution-pairing.mjs and the constitution-counterpart job; in 1.x, scripts/safe-merge.mjs and a daily job on Echo.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Residue: daily-baseline-timestamp | low | The daily read turns its baseline commit into a date and lists later commits by committer date, so a commit landing on main with an older committer date would be missed; merges through a pull request are dated when they land, and the pull request check is the primary hold.
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit 231cc3d01 on this branch, regenerated through scripts/build-register.mjs --replay. Following the Rule 118 amendment, --now 1792195200000 (2026-10-17) was used, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 119 rules. Rule 119 remains a coverage gap in the register rather than a fabricated holder.

Landing prerequisites, none of which this repository can supply: Rule 119's check column and its place in Checkable now become true only when JKHeadley/instar#2689 has landed the merge refusal and the daily job. The alignment map there lists Maturation Path as aligned and has no Rule 119 row; both need correcting. JKHeadley/instar#2687 must target main and gain the Rule 119 article before it is a real counterpart; until then the constitution-counterpart job is correctly red. This change must not merge before those, which is the landing order in the 1.x design.

Known red, outside this change: on the real clock `npm run register:check` and one case of tests/e2e/register.test.ts stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the same refusal main gives. Nothing in this change touches that declaration, and it is not edited here. PR 188 moves the overdue ceilings; its own head passes register:check on the real clock. Separately, the checks job stops at scripts/check-change-review.mjs with "Cannot find module 'typescript'" because the workflow installs no dependencies; this change does not alter that step.

Subject (18 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/check-constitution-pairing.d.mts, scripts/check-constitution-pairing.mjs, tests/e2e/register.test.ts, tests/register/constitution-pairing.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one row in the existing rule table, one reworded row, one line in each pull request body, and one small tested script with no state of its own. A rule-by-rule hash ledger was tried in review and rejected: it left clauses uncovered, needed a state machine for the merge window, and read as certifying meaning.
80/20: Five review rounds on the 1.x spec with an outside model; independent pass required here on the exact tree.
VERDICT: author submission; the independent verdict is recorded as a pass
