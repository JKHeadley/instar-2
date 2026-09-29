# Change review — cint-L5: merge U11, U12, U13, unit-a-findings and unit-due-reminder onto the live build

Subject base: 422570a017df7f587d6b31193c53c829d3735a71
Review state: open
Reviewed content: none
Outcome: cint-L5 is the live build cint-L4 422570a0 plus unit-u11 42defa5f, unit-u12 f8a2b3ed, unit-u13 edb26326 and unit-a-findings 8b3afb95, then unit-due-reminder a618dc58, merged in that order. Each unit's own record (reviews/unit-u11-credential-reminders-change-review.md, reviews/unit-u12-jev-capture-change-review.md, reviews/unit-u13-decision-record-change-review.md, reviews/unit-a-findings-change-review.md, reviews/unit-due-reminder-change-review.md) covers its code. This record covers the merge commits, the one source conflict, the register regeneration and one test repair. Generated conflicts were resolved by regeneration (desk repin; build-register --replay). unit-due-reminder merged with generated-only conflicts; its source (tests/preview/journal.ts, tests/preview/obligations.ts, tests/preview/journal-correction-wedge.test.ts) auto-merged, and a second desk repin refreshed the one preview pin the launcher test repair left trailing. The only source conflict, tests/preview/journal-audit.mjs, took unit-a-findings' groundingHistory selection, which keeps the live build's desk-probe exclusion (groundingHistory filters probeTurn) and adds the edited-original exclusion. The test repair: U11 never ran tests/preview/journal-agent.test.ts, and 7 of its launcher tests failed on U11 alone because U11's reminder and route-check lines now ride answers. They now assert the answer exactly and allow only those two notice shapes after it. The fixture expiry is fixed while the launcher runs on the real clock, so whether a reminder appears depends on the date.
Affected rules: 8, 10, 29, 36, 37, 56, 57, 68, 74, 93, 96, 100, 102, 116 (each unit's rules are reviewed in its own record; 37: a source fix of stale assertions, no quarantine)
Affected floors: secrets — unchanged (reminders name a credential and its expiry, never its value); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (notices ride an existing answer, once per key); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: merges of already-reviewed units, generated output, a one-hunk conflict resolved to the reviewed unit's selection, and test assertions updated to reviewed behavior; no system-prompt, provider-policy or invocationPolicyDigest change
Side effects: an undecided correction holds only the requests made before it, so a due turn no longer waits on an unrelated correction (unit-due-reminder); answers may carry one credential-reminder or model-route-check line (U11); the Jev reader is proved against a genuine capture (U12); a change-review record carries mid-run decisions (U13); the packet audit expects exactly the grounding history the packet used (unit-a-findings)
Undo and recovery: revert the five merge commits, the two regeneration commits, the repin commit, the test repair and this record; each unit record describes its own compatibility
Multi-machine posture: single-machine preview runner and repository tooling only; no shared state changed
Layer below: tests/preview/journal.ts groundingHistory and probeTurn; tests/preview/credential-reminders.ts credentialNotices and doorwayNotices; tests/preview/successive-fixture.ts SUBSCRIPTION_PREVIEW_EXPIRY
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L5-audit-conflict | journal-audit.mjs takes unit-a-findings' groundingHistory, because it is the same selection the packet uses and already excludes desk probes | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L5-PROGRESS.md
Decision: cint-L5-launcher-notices | the launcher tests assert the answer exactly and allow only U11's two notice shapes after it, instead of pinning a date-dependent reminder | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L5-PROGRESS.md
Prompt review: no prompt text changed by the merge beyond what the unit records review; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: docs/defects/rule-36-genuine-parser-captures.md:3 | commitment=docs/defects/rule-36-genuine-parser-captures.md
Deferral: generated/coverage.md:14 | not-a-deferral=generated register count of existing owned deferred loops, not a commitment by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/register/change-review.test.ts:134 | not-a-deferral=the word is the placeholder decision text the test proves is refused, not postponed work

Subject (30 paths): docs/defects/rule-36-genuine-parser-captures.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, scripts/change-review.d.mts, scripts/change-review.mjs, scripts/check-change-review.mjs, scripts/register-owner-references.mjs, tests/fixtures/captures/README.md, tests/fixtures/captures/jev-response.json, tests/preview/credential-reminders.test.ts, tests/preview/credential-reminders.ts, tests/preview/fixtures/jev-response-synthetic.json, tests/preview/jev-response-capture.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts, tests/preview/journal-commitments.test.ts, tests/preview/journal-correction-wedge.test.ts, tests/preview/journal.ts, tests/preview/obligations.ts, tests/preview/reply-check.declarations.json, tests/register/change-review-git.test.ts, tests/register/change-review.test.ts

## Closing block

simplestRobustRoute: merge the reviewed units, regenerate, take the reviewed unit's selection for the one conflict, and update the stale assertions to the reviewed behavior; nothing else
80/20: 0 must-fix, 0 notes — merges, generated output and test assertions only
VERDICT: author submission; the independent verdict is recorded as a pass
