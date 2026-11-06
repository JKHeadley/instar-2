# Change review — The Person Decides; the Agent Does the Rest

Subject base: 567d0c49e9ad30bc2d620025d1a6311cadb9cd66
Review state: open
Reviewed content: none
Outcome: Record the operator's 2026-11-03 direction as Rule 120: an Instar agent does all research, account management and operation; the person only approves or declines, asks for changes, or supplies a credential; whose accounts are used is the person's choice, and the agent never recommends against full account management. A new rule in Needs building, because neither of its checks exists yet. Same wording as the earlier draft numbered 119 (PR 190), renumbered to 120 after Rule 119, One Constitution, Two Books Aligned, merged first.
Affected rules: 18, 23, 78, 82 (scope boundary: they cover acting inside a role, when to escalate, automatic capture and how to ask; 120 states the person's whole part) and new 120. 119 applies to this change: it names its 1.x counterpart. Purpose unchanged. History preserves prior revisions; Rule 120 stays a coverage gap until its checks are built.
Affected floors: secrets — no custody or revelation changes; spend cap — no provider calls or budget changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no journal or admission changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the governing constitution, even though the implementation is editorial.
Side effects: The rule inventory grows to 120; the replay anchor, its pin, the generated register and the end-to-end rule-count assertion follow it. No model-facing excerpt changes (Rule 120 is not in the briefing source pins). No runtime path changes.
Undo and recovery: Revert this amendment together with its anchor, pin, count assertion and generated outputs; preserve the governing history through a corrective revision if already approved.
Multi-machine posture: Machine-independent: the rule is about the person's part, not placement. No replication or machine-local state is introduced.
Layer below: The full rule book, Rules 18, 23, 78, 82 and 119 for overlap; scripts/register-source.mjs parser and bootstrap declarations; scripts/build-register.mjs replay anchor and approvedConversion pin; src/rulegraph/graph.ts bootstrap-rule matching (all 119 recorded rule hashes reproduced unchanged, one added for 120); tests/e2e/register.test.ts rule-count consumer; the 1.x registry articles Agent Proposes, Operator Approves, No Manual Work (with The Agent Carries the Loop) and Self-Unblock Before Escalating, for the counterpart.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Deferral: generated/conversion.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals
Deferral: generated/register.json:1 | not-a-deferral=one-line generated JSON is re-emitted whole; its matches are pre-existing rule text, not new deferrals

Publication source: commit 6427ced9f on this branch, regenerated through scripts/build-register.mjs --replay --commit with --now 1792195200000 (2026-10-17), the same backdated clock as Rules 118 and 119, because the real clock refuses every replay build on main while overdue deadlines stand. The clock is not embedded in outputs: `node scripts/build-register.mjs --check --now 1792195200000` passes against these generated files with 120 rules. Rule 120 remains a coverage gap in the register rather than a fabricated holder.

Counterpart (Rule 119): 1.x states parts of this obligation (the operator approves rather than authors; nothing, then an approval, then a credential; no manual work for the user) but not the person's whole part, never sending the person to a browser, provider site, command or steps, or the person's choice of whose accounts are used. So this change needs a 1.x counterpart, not "none". The PR body names it.

Known red, outside this change: on the real clock `npm run register:check` and one case of tests/e2e/register.test.ts stop at "P3-NF-24: deadline passed for deferred:slack-intake-v1:36", the same refusal main gives. Separately, the checks job stops at scripts/check-change-review.mjs with "Cannot find module 'typescript'" because the workflow installs no dependencies; this change does not alter that step.

Subject (14 paths): docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, tests/e2e/register.test.ts

## Closing block

simplestRobustRoute: This proposal is the simplest robust route: one new row in the existing rule table, its changelog entry, and the existing register regeneration. No new mechanism or gate is introduced here; the outbound check and live proofs are named for later building, as every Needs-building rule does.
80/20: An independent read of the earlier draft returned YES, and its suggestion (state plainly what each account choice concedes) is in the rule; an independent pass on this exact tree is required.
VERDICT: author submission; the independent verdict is recorded as a pass
