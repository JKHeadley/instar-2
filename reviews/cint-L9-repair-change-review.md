# Change review — cint-L9 repair: carry the L8 review and pipeline repairs into the memcorr combine

Subject base: 8880c26ef073098e448e9935147d3edf06f1edaa
Review state: open
Reviewed content: none
Outcome: Astra round 1 on cint-L9 returned NO with three must-fixes, all the same cause: L9 combined the original L8 with w3-memcorr and dropped L8's later accepted repairs. This change merges the L8 tip ae2ec747 into cint-L9, which carries exactly those repairs and nothing new: (1) 938147e4 — the jev-summary-faithfulness declaration and its summary-review neighbour describe the real escalation, refusal and UNKNOWN exposure (Rules 57/95); (2) 938147e4 — parseReplyReviewVerdict refuses the legacy combined line when `selected` is supplied, so a new live review keeps its per-rule results (Rules 41/58/108), legacy readers unchanged; (3) 8f4361c8 — the topic-answer launcher test uses an opt-in empty long poll and four cycles, preserving its two-send and UNKNOWN assertions, no production polling change (Rule 37). Only generated files conflicted; they were taken from cint-L9 and regenerated with build-register --replay. The resulting tree equals ae2ec747 plus memcorr's journal.ts change and its seven test/calibration files, verified by diff. Targeted runs: reply-check, model-call-boundary, journal-agent, journal-agent-resources, review-layers-canary (93 tests) pass; tsc, lint and register:check clean.
Affected rules: 41, 58, 108, 57, 95, 37 (fixed at source, nothing quarantined), 74 (this record), 116 (reuse of already-reviewed L8 commits; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged (existing single re-ask; UNKNOWN reservations untouched); stop — unchanged; no duplicate sends — unchanged (the launcher test still asserts exactly two sends); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: carries the live reply-review parser change that decides which review results are admissible before a reply is released
Side effects: as recorded in reviews/cint-L8-review-repair-change-review.md and reviews/cint-L8-pipeline-repair-change-review.md
Undo and recovery: revert the merge commit, the regenerate commit and this record
Multi-machine posture: machine-local preview runtime; no replicated state
Layer below: tests/preview/journal-agent.mjs format re-ask on REVIEW_MALFORMED (unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L9-merge-l8-tip | merge the already-reviewed L8 tip rather than re-derive its repairs, so the combine is exactly repaired L8 plus memcorr | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L9-PROGRESS.md
Prompt review: the review question already asks for exactly one line per listed rule; unchanged; memcorr's memory-item guidance unchanged
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (19 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-cutover-model.mjs, tests/preview/journal-poll-endpoint.mjs, tests/preview/model-call-boundary.test.ts, tests/preview/model-call-boundary.ts, tests/preview/reply-check.test.ts, tests/preview/reply-check.ts, tests/preview/review-layers-canary.test.ts, tests/preview/successive-fixture.ts

## Closing block

simplestRobustRoute: merge the reviewed L8 tip into the combine; regenerate only generated output
80/20: 3 must-fix repaired, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
