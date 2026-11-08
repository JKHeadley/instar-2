# Change review — train-213 repair: model-json launcher pin follows the attribution-check object answer

Subject base: b644d6969f944cb3cd6482399040eb7a8a26437e
Review state: open
Reviewed content: none
Outcome: The m5pro full run at b644d696 failed one assertion, tests/preview/model-json.test.ts "the shipped launcher parses with a per-consumer policy, and only the answer side may discard a wrapper": its text pin still expected the summary-only objectAnswerOf declaration, while the Rule 121 attribution cut (fad825fb1) had deliberately widened the shipped launcher to also mark ':attribution-check' answers as JSON objects (attribution.ts parses {claims}). The pin now carries the shipped declaration, and the launcher's doc comment names the attribution check beside the three summary-side calls so the comment no longer says every other answer is prose. No behaviour changes. The owner-reference pin for the test is refreshed with the desk rehash and the register replayed.
Affected rules: 37 (the one failure is fixed at its source, the stale pin; no quarantine); 4 (the launcher comment no longer asserts what stopped being true); 121 (the attribution check's object answer is kept as built, not narrowed to satisfy the pin); 74 (this record); 101 (plain git commit, no bypass flag, no stash; core.hooksPath is .husky/_, which does not exist in this clone, so no hook ran); 116 (see the closing block).
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The suggestion follows the generated register paths; the authored change is one test pin line and a two-line doc comment in the preview launcher, with no executable change, and the rest is the desk's mechanical repin and replay.
Side effects: The model-json pin now fails if the attribution check is dropped from objectAnswerOf; the preview owner-reference manifest carries the new test hash; generated/ is replayed at 50f7d31a1.
Undo and recovery: Revert f17987b0a, 50f7d31a1 and d2226b3e8 (and this record's commit) on top of b644d6969.
Multi-machine posture: Unchanged; test and comment text only, machine-independent.
Layer below: Read the failing assertion in the gate log, tests/preview/journal-agent.mjs objectAnswerOf/roleOf/judgmentOf and its readAnswer site, tests/preview/attribution.ts (JSON.parse of {claims}), tests/preview/model-call-boundary.ts (attribution-check judgment), commits fad825fb1 and 529d5488a. 1.x: JKHeadley/instar main d0d22f2d7, src/core/attribution/AttributionJudge.ts asks for and parses the same {"claims":[...]} JSON object (lines 54, 99, 136-138); the 2.0 launcher's per-consumer object declaration has no 1.x counterpart, so the comparison confirms the answer shape only.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: t213-pin-follows-source | Update the stale text pin to the shipped declaration rather than narrowing objectAnswerOf back, because the widening was deliberate (attribution.ts parses a {claims} object) and narrowing would reduce the attribution check's ability to satisfy a pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-213-repair-030700-PROGRESS.md
Decision: t213-comment-current | Also correct the launcher doc comment that listed only the summary-side calls as object answers, so the comment stays true (Rule 4); comment-only, no test pins that text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-213-repair-030700-PROGRESS.md
Prompt review: none; no model-facing prompt, parse or decision changes, the parse path for every id is byte-identical.
Deferral: generated/coverage.md:14 | not-a-deferral=generated register output replayed by the desk chain, not authored prose
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed by the desk chain, not authored prose

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, reviews/train-213-repair-030700-change-review.md, tests/preview/journal-agent.mjs, tests/preview/model-json.test.ts

Verification: tests/preview/model-json.test.ts 51/51; npm run lint exit 0; npm run register:check exit 0.

## Closing block

simplestRobustRoute: The required outcome is a green model-json test that still guards the shipped per-consumer declaration. The simplest robust route is to bring the pin to the shipped line and keep the doc comment true; that is this change. Nothing is added.
80/20: The single failed assertion passes with the guard intact; the desk's repin and replay keep lint and the register green.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
