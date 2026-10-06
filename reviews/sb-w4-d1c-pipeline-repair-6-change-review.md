# Change review — sb-w4-d1c pipeline repair 6: merge of the live build e4cf7104 (plan #542)

Subject base: 06bbf93be3de69aaf66c7a9fccf6a7bad00765da
Review state: open
Reviewed content: none
Outcome: The live build e4cf7104 (sb-w4-replycheck, carrying its live-build 2cd3a6d0 merge record) went live after this unit started, so it was not inside the approved head 06bbf93b. It is now merged with an ordinary merge. Git merged every source, test and review file cleanly; the only conflicts were the seven generated/ register files, which were taken from the live side and then re-emitted by scripts/build-register.mjs --replay. The desk rehash and repin chain found no pin to change (0 owner-reference pins, 0 inventory pins).
Affected rules: 90 (the register re-emitted by the script, never hand-edited), 74 (this record), 101 (plain commits, no hook bypass), 116 (an ordinary merge plus the scripted regeneration, nothing added), 37 (nothing quarantined), 113 (machine-local)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: both sides were already reviewed on their own branches (reviews/sb-w4-d1c-*-change-review.md and reviews/w4-d1c-*-change-review.md here; reviews/sb-w4-replycheck-*-change-review.md and reviews/w4-replycheck-change-review.md on the live build); this merge reconciles two already-reviewed changes and adds no new logic.
Side effects: the branch now also carries the live build's reply-check budget work (tests/preview/reply-check.ts, reply-check-budget.test.ts, reply-check.declarations.json) and its harness, journal-agent, live-sentinels and review-yes-wiring test changes; generated/ is re-emitted for the merge commit.
Undo and recovery: revert the merge d651ed89 and its register replay 7eb988fc; nothing is migrated and no stored state changes.
Multi-machine posture: machine-local, deliberately — a merge of reviewed preview code and its generated register; no runtime path changes here.
Layer below: scripts/build-register.mjs --replay (unchanged) and the desk rehash and repin chain (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: sbd1c-livemerge-e4cf7104-generated | the conflicting generated/ files were taken from the live side and then re-emitted by the register replay for the merge commit, rather than hand-resolving JSON conflicts, because generated output is only ever written by the script | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-d1c-repair-025600-PROGRESS.md
Prompt review: no system prompt, provider policy, model input or verdict parsing is changed by this merge beyond what the live build's own reviewed records cover.
Prompt finding: 0c0c2c5478e2 | protocol-literal | a refusal detail of the admission, matched by its own test; not prompt text; unchanged by this merge (as dispositioned in reviews/w3-yeswire-change-review.md)
Deferral: generated/register.json:1 | not-a-deferral=generated register output re-emitted by the replay after the merge, never hand-authored
Deferral: tests/preview/reply-check.declarations.json:13 | not-a-deferral=the declaration describes a held turn staying held, an existing outcome carried unchanged from the live build, not a commitment by this merge

Subject (16 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/harness-user.mjs, tests/preview/harness-user.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-due-loop.test.ts, tests/preview/live-sentinels.ts, tests/preview/reply-check-budget.test.ts, tests/preview/reply-check.declarations.json, tests/preview/reply-check.ts, tests/preview/review-yes-wiring.test.ts

## Closing block

simplestRobustRoute: an ordinary merge, generated files re-emitted by the existing replay script, and the desk chain run to confirm no pin moved.
80/20: targeted tests of the merged test files run in the foreground; tsc --noEmit exit 0, npm run lint exit 0, npm run register:check true. The full suite is the gate host's.
VERDICT: author submission; no independent pass is recorded for this record
