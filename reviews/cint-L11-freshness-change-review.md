# Change review — cint-L11 repair: judge settled-blocker freshness at review time

Subject base: 3ff1c561f224d940119ac269cf345e742280cbdd
Review state: open
Reviewed content: none
Outcome: Astra's round-1 MUST-FIX 1 is repaired at its source. declaredObligations() selected settled blockers by comparing each note's recheckAt with the turn's intake time, so a message queued before a blocker's recheck date and reviewed after it was reviewed against an overdue blocker the guide calls "not due for recheck". It now takes the review time as a required argument: the live runner passes its existing wall clock (wallNow()) when it builds the review, and the test world passes its fake clock. No new gate, clock service or recheck protocol. The existing restated-limit regression gains two neighbours: queued a minute before the recheck date and reviewed a minute before it (still sends against the settled record) and reviewed a minute after it (the overdue record is left out and the cannot-do claim is held). The due case was shown to fail with the old intake-time comparison and pass with the fix. The desk rehash refreshed one owner-reference pin (tests/preview/journal-obligations.test.ts) and the register was regenerated with --replay.
Affected rules: 74 (this record), 26 and 99 (a settled limit is current evidence only until its recheck date, judged when it is used), 20, 21, 23 (the restated-limit path itself is unchanged for fresh records), 37 (targeted file green, no quarantine), 69 (register regenerated from committed sources), 116
Affected floors: secrets — unchanged (settled records still pass the existing redactor); spend cap — unchanged (no model call added or removed); stop — unchanged; no duplicate sends — unchanged (only whether one reviewed candidate is held or sent); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes which settled evidence the live reply reviewer is shown, so what it holds or sends
Side effects: none; a reply reviewed after a settled blocker's recheck date is now judged without that blocker, as the guide already states
Undo and recovery: revert commit 1d2d1e1e with the pin refresh efd14ded, the register regeneration 8379f836 and this record
Multi-machine posture: machine-local, deliberately; the preview journal worker runs on the one preview machine
Layer below: reviews/cint-L11-change-review.md (the batch this repairs); the runner's preview clock (tests/preview/clock.ts) is the review-time source, unchanged
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-cint-L11-evidence/blocker-freshness.json
Hook bypass: none
Convergence: none
Decision: cint-L11-freshness-at-review | the review time is the runner's existing clock passed as an argument, not a new clock service, so the selection matches when the evidence is used | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L11-PROGRESS.md
Prompt review: no prompt text changes; only which settled records reach the unchanged reply-review guide.

Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: pass the review time the runner already has into the one selection that used intake time, and extend the existing regression; no new mechanism
80/20: 1 must-fix repaired, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
