# Change review — Frontier Models Design and Review; Efficient Models Build

Subject base: e575f8232881dbb8f22cb65321413f154203ec91
Review state: open
Reviewed content: none
Outcome: Record the operator-approved constitution article as Rule 124, Frontier Models Design and Review; Efficient Models Build: plans, designs and specs are reviewed on the strongest model the agent can reach, named in the doorway/model map, and drafted on it where the work can be routed there; building runs on the efficient default; before the person is asked to approve a design, review has read it as it stands, with another provider the agent already works through where reachable, and the request states from system-written records which models wrote it, which reviewed it, what each concluded and how many times; an unreachable model never stops work and is named first; a request with no readable record is held until the agent runs the review; when nothing can review, the request says so. A new rule in Needs building, because no check exists in 2.0 yet. Approval: "approved" [source: telegram 144319/144458 2026-11-17T23:32:37Z], answering 144319/144392 for the 1.x spec docs/specs/frontier-design-review-standard.md, whose decision 7 makes that approval cover the article in both books, this book first.
Affected rules: 56 and 65 (extended from keeping the model map current and auditing to convergence, to which model designs and reviews; neither is changed), 10 (whether a text asks for approval and whether work is design are judged by meaning), 118 (an agent with one provider loses nothing), 120 (the person's part stays one approval), 121 (every quote cites its logged message), and new 124. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserves prior revisions; Rule 124 stays a coverage gap until its check is built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes. The rule gives the agent no new authority; the hold it names is cleared by the agent itself.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 124; the replay anchor (rule book document hash and one rule hash), its approvedConversion pin, the generated register and the end-to-end rule-count assertion follow it. The other 123 recorded rule hashes reproduce unchanged. The register derives term:reach for Rule 124 from the glossary. No model-facing excerpt changes (Rule 124 is not in the briefing source pins; tests/preview/constitution-briefing-sync.test.ts passes). No runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent text. No replication or machine-local state is introduced here.
Layer below: The approved 1.x spec's "Constitution wording" section (JKHeadley/instar docs/specs/frontier-design-review-standard.md, decision 7); the full rule book, Rules 10, 56, 65, 118, 120 and 121 for overlap; scripts/register-source.mjs bootstrap declarations and src/rulegraph/graph.ts rule-hash matching (all 124 declarations recomputed: 123 match the recorded hashes, one added for 124); scripts/build-register.mjs replay anchor and approvedConversion pin (the previous pin reproduced from the previous anchor before the new one was computed); tests/e2e/register.test.ts rule-count consumer; the source messages 141133/141213 and 144319/4578964629224360 read from the lease holder's topic history on 2026-11-17.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: book-form | The approved text is the 1.x article; this book receives the same obligation as one Needs-building row (its meaning and owed check), a rationale and a source sentence, in the form used for Rules 121 to 123; the row says "person" where 1.x says "operator" (Rule 120's term) and "doorway/model map (#56)" where 1.x says "model registry"; the title is kept identical so the alignment map pairs them by name | reported=reviews/constitution-frontier-design-review-change-review.md
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit b5d740b2db4400429ec783198ec8c8a719b063aa on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118 to 123, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 124 rules. Rule 124 remains a coverage gap in the register rather than a fabricated holder.

Counterpart (Rule 119): the 1.x Standards Registry article of the same title, placed under Structure beats Willpower, on branch echo/constitution-frontier-design-review of JKHeadley/instar. The PR body names it.

Known red, outside this change: on the real clock `node scripts/build-register.mjs --check` and one tests/e2e/register.test.ts case stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the refusal the Rule 121 to 123 records already name; the Slack declaration is unchanged here. `node scripts/check-architecture.mjs` reports one R105 finding: the self-host harness is certified on node 24.14.1 and this machine runs node 24.15.0; no harness file changes here.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: One new row in the existing rule table, its rationale and source sentence, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the check is named for later building, as every Needs-building rule does.
80/20: PENDING
VERDICT: author submission; the independent verdict is recorded as a pass
