# Change review — An Instar Agent Always Serves a Team

Subject base: 7912b0d079c41675c069de2752a74aaddbb753ac
Review state: open
Reviewed content: none
Outcome: Record the operator's approved wording as Rule 123, An Instar Agent Always Serves a Team: every feature treats an agent as serving several people with roles (owner, member, guest) by default; anything a person creates or is given has an owner, is private to that owner by default, and can be shared with chosen people or the whole team; access comes only through the owner's signed team record, and the agent can narrow but never widen it; a one-person feature is an exception that states its reason; a one-person agent is a team of one. A new rule in Needs building, because no check exists yet.
Affected rules: 31 and 113 (extended from machines to people; neither is changed), 18 (sovereignty: the agent narrows access but never widens it, consistent with acting only inside recorded grants), 120 and 121 (its source requirement applies to this change's quotes), the purpose's least-revelation rule (Rule 123 names the owner and share that decide what a recipient may see; it does not change that rule), and new 123. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserves prior revisions; Rule 123 stays a coverage gap until its check is built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes. The rule gives the agent no power to grant access.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 123; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 123 is not in the briefing source pins; tests/preview/constitution-briefing-sync.test.ts passes). No runtime path changes. Existing features have not been checked against the rule.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent text. No replication or machine-local state is introduced here.
Layer below: The full rule book, Rules 18, 31, 113, 120 and 121 for overlap; scripts/register-source.mjs parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (all 122 recorded rule hashes reproduced unchanged, Rule 122's recomputed to its recorded value, one added for 123); tests/e2e/register.test.ts rule-count consumer; the 1.x registry article An Instar Agent Is Always a Multi-Machine Entity for the counterpart.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit 2526322a05869e80fc7d5e09f93d6faed2d613fc on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118 to 122, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 123 rules. Rule 123 remains a coverage gap in the register rather than a fabricated holder.

Counterpart (Rule 119): 1.x has no article on serving several people, so this needs a 1.x counterpart, not "none". The PR body names it.

Known red, outside this change: on the real clock `node scripts/build-register.mjs --check` and one tests/e2e/register.test.ts case stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the refusal the Rule 121 and 122 records already name; the Slack declaration is unchanged here. `node scripts/check-architecture.mjs` reports one R105 finding: the self-host harness is certified on node 24.14.1 and this machine runs node 24.15.0; no harness file changes here.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its rationale and source note, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the check is named for later building, as every Needs-building rule does.
80/20: An independent read by codex-cli (gpt-6.1-sol, a different model family) of the source changes in both books on 2026-11-10 returned NO with 2 must-fix. One was in the 1.x counterpart (a device requirement the operator did not approve), fixed there and confirmed by a narrow re-read returning YES. The other was this record: it read as open while claiming a pass; this record is now completed and frozen. The read confirmed the 2.0 rule body matches the approved wording exactly, every cited quote matches including the curly apostrophe, the counts are consistent (22 + 9 + 79 + 13 = 123), and no contradiction with the rules examined. Its notes: the generated outputs were not in the diff it read (they are reproduced by the --check run above), and the backdated replay check does not establish a current-clock build (named under Known red).
VERDICT: author submission; the independent verdict is recorded as a pass
