# Change review — cint-L8: merge w3-prstart, w3-sumaccept and w3-or1 onto the live build

Subject base: 661ab944b613338a6b604feffd02d7ba0518321f
Review state: open
Reviewed content: none
Outcome: cint-L8 is the live build cint-L7 661ab944 plus w3-prstart 9429d552, w3-sumaccept fbc49fbf and w3-or1 5ad912b8, merged in that order; origin/main had nothing new. All three merges were textually clean, including tests/preview/journal.ts and tests/preview/journal-agent.mjs, which w3-sumaccept and w3-or1 both edit; the combined files carry both the summary faithfulness cascade (undecided Jev faithfulness escalates to the full-context summaryReview; long chats compact past an UNKNOWN frontier; bounded undecidedEdits) and the per-objection decisions of the bounded reply review (explicit dispositions, held-candidate correction, shared 30 s deadline), plus w3-prstart's startup-refusal record. One test outside the units' lists was red on origin/w3-or1 alone and green on cint-L7: tests/preview/usable-links.test.ts asserted the bare-topic objection in the revise input's ruleIds, where w3-or1's reviewed contract now carries only typed reply rules and passes every objection in objections (the live revise port builds its question from objections). The assertion was moved to objections (and ruleIds asserted empty); the behaviour under test — the revision is told the bare-topic objection and the revised text is sent — is unchanged. The register was regenerated once with the desk scripts (repin chain: 0 inventory pins; owner-manifest rehash: 1 preview pin; build-register --replay). Each unit carries its own record (reviews/w3-prstart-change-review.md, reviews/w3-sumaccept-change-review.md, reviews/w3-or1-change-review.md).
Affected rules: 2, 4, 7, 11, 37, 41, 42, 47, 57, 58, 74, 86, 95, 102, 110, 116 (each unit's rules are reviewed in its own record; this combine: 37 — the red test is fixed at its source, nothing quarantined; 74 — this record; 102 — decision below)
Affected floors: secrets — unchanged (the credential wall still runs before any provider and on the send body); spend cap — unchanged (the cascade's escalation and the revision each reserve inside the existing call cap); stop — unchanged (every added call passes gate()); no duplicate sends — unchanged (reservations are journaled before each paid call and an UNKNOWN revision is never repeated); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: w3-or1 sits on the reply path to the operator's chat (an irreversible send); this combine adds no behaviour beyond the three reviewed units and one stale test assertion
Side effects: an undecided summary faithfulness verdict reaches the stronger summary review instead of refusing (w3-sumaccept); replies get a bounded two-stage review with per-objection agent decisions and a held-candidate correction (w3-or1); a launch refused before it launched now records its reason in the run log and status (w3-prstart)
Undo and recovery: revert the three merge commits, the repin and regeneration commits, the usable-links commit and this record; each unit record describes its own compatibility
Multi-machine posture: machine-local, deliberately: the preview journal worker and launcher are single-machine, as each unit records
Layer below: tests/preview/journal-agent.mjs revise port (reads objections for its question, ruleIds for review context); tests/preview/reply-check.ts validDispositions (unchanged by this combine)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L8-usable-links-objections | usable-links asserted w3-or1's superseded revise-input shape (bare-topic in ruleIds); the reviewed contract carries it in objections, so the assertion follows the contract rather than reverting the unit | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L8-PROGRESS.md
Prompt review: prompt text changed only as the units reviewed it: the summaryReview question also names faithfulness loss (w3-sumaccept); the reply-review and revision questions ask for one line per rule and one disposition per objection (w3-or1); the undecidedEdits instruction discloses the omitted count. No system prompt, provider policy or invocationPolicyDigest changed.
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=the rung describes the obligation floor on an untracked deferral in a reply; nothing is postponed

Subject (22 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/model-call-boundary.test.ts, tests/preview/model-call-boundary.ts, tests/preview/reply-check.actions.json, tests/preview/reply-check.declarations.json, tests/preview/reply-check.test.ts, tests/preview/reply-check.ts, tests/preview/self-state.ts, tests/preview/summary-accept-cascade.test.ts, tests/preview/usable-links.test.ts, tests/register/actions.test.ts

## Closing block

simplestRobustRoute: merge the three reviewed units, move one stale test assertion to the unit's reviewed contract, and regenerate the register with the desk scripts; nothing else
80/20: 0 must-fix, 0 notes — merges, generated output and one test assertion
VERDICT: author submission; the independent verdict is recorded as a pass
