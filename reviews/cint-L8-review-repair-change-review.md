# Change review — cint-L8 review repair: live reply review needs per-rule results; faithfulness declares its escalation

Subject base: 49b45c2686ec905efa840fecc005e8bd2fadc345
Review state: open
Reviewed content: none
Outcome: Astra round 1 returned NO with two must-fixes, both repaired at source. (1) LIVE_JUDGMENTS['jev-summary-faithfulness'] still said "undecided: the summary is not recorded", but its consumer in journal.ts escalates an undecided, unavailable or over-bound Jev result to summary-review and records the summary on that review's pass. The entry now lists the escalate action and says exactly that: one escalation, only its pass accepts, no approval when the review cannot be admitted (no route, stopped, call cap) or does not pass, and an unanswered call keeps its reserved charge UNKNOWN. Its cascade neighbour summary-review says the same from its side. The existing declaration test asserts both rows. No runtime change. (2) parseReplyReviewVerdict accepted the legacy combined line before checking `selected`, so a new live review answering "VIOLATION:raw_path | shows a path" for [raw_path, defers_work] was accepted with no per-rule findings. With `selected` supplied (the live launcher always supplies it), a combined line is now a format miss, which the launcher's existing single format re-ask and fail direction already handle. Without `selected` (historical records, corpus, canary readers) the legacy form is still read, finding-free. The parser test proves the strict live input (combined VIOLATION and PASS refused) and the readable legacy input. Launcher test fakes that answered reviews with the legacy combined line now answer one line per selected rule through a shared PER_RULE_PASS fixture source (journal-agent, journal-agent-resources, review-layers-canary, cutover model). Targeted runs: reply-check, model-call-boundary, live-declarations, live-failure-catalog, offline-canary, journal-agent, review-layers-canary, journal-agent-resources, journal-overlap, journal-cutover all pass; tsc and lint clean. Register regenerated with the desk scripts (owner-manifest rehash: 2 preview pins; repin chain: 0 inventory pins; build-register --replay).
Affected rules: 41, 58, 108 (every selected rule keeps its own independent contextual result on a new live review), 57 and 95 (the faithfulness declaration now matches its consumer's real fail direction), 37 (fixed at source, nothing quarantined), 74 (this record), 116 (a guard clause and two declaration strings; no new gate or mechanism)
Affected floors: secrets — unchanged (a stricter parse can only hold or re-ask); spend cap — unchanged (the existing single re-ask; UNKNOWN reservations untouched); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the live reply-review parser decides which review results are admissible before a reply is released
Side effects: a live reviewer that still answers in the legacy combined form now spends its one format re-ask; if it repeats that form the review is unavailable and the existing fail direction applies (advisory-only released once with status recorded, mandatory floors held)
Undo and recovery: revert the repair commit, the repin and regenerate commits, and this record
Multi-machine posture: machine-local preview runtime; no replicated state
Layer below: tests/preview/journal-agent.mjs format re-ask on REVIEW_MALFORMED (unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L8-strict-live-review | strictness keys on `selected` being supplied, the existing signal that a call is a new live review, so historical readers keep the legacy reader without a new flag | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L8-PROGRESS.md
Prompt review: the review question already asks for exactly one line per listed rule; unchanged
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (18 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-cutover-model.mjs, tests/preview/model-call-boundary.test.ts, tests/preview/model-call-boundary.ts, tests/preview/reply-check.test.ts, tests/preview/reply-check.ts, tests/preview/review-layers-canary.test.ts, tests/preview/successive-fixture.ts

## Closing block

simplestRobustRoute: refuse the combined line only when rules are selected, reusing the existing re-ask; correct the two declaration strings in place
80/20: 2 must-fix repaired, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
