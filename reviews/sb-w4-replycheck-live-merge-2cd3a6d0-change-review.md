# Change review — sb-w4-replycheck pipeline repair 3: merge of the live build 2cd3a6d0 (plan #542)

Subject base: b72375c3e00d5d2f67368a68b29748a1834db83c
Review state: open
Reviewed content: none
Outcome: The live build 2cd3a6d0 (sb-w4-workmemory, carrying the rc-1 merge) went live after this unit started, so it was not inside the approved head b72375c3. It is now merged with an ordinary merge. Git merged every source, test, docs and review file cleanly; the only conflicts were the seven generated/ register files, which were taken from the live side and then re-emitted by scripts/build-register.mjs --replay for the merge commit. The desk rehash and repin chain found no pin to change (0 owner-reference pins, 0 inventory pins), because this branch and the live build touch disjoint support sources.
Affected rules: 90 (the register re-emitted by the script, never hand-edited), 74 (this record), 101 (plain commits, no hook bypass), 116 (an ordinary merge plus the scripted regeneration, nothing added), 37 (nothing quarantined), 113 (machine-local)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: both sides were already reviewed on their own branches (reviews/sb-w4-replycheck-change-review.md, reviews/sb-w4-replycheck-repair-change-review.md and reviews/sb-w4-replycheck-repair2-change-review.md here; reviews/sb-w4-workmemory-change-review.md and its merge and repair records on the live build); this merge reconciles two already-reviewed changes and adds no new logic.
Side effects: the branch now also carries the live build's journal work-packet change (tests/preview/journal.ts, journal-obligations, tool-turn, two-machine-runner tests), docs/defects/full-suite-load-timeouts.md and the preview owner reference; generated/ is re-emitted for the merge commit.
Undo and recovery: revert the merge a0adb081 and its register replay 65efe553; nothing is migrated and no stored state changes.
Multi-machine posture: machine-local, deliberately — a merge of reviewed preview code and its generated register; no runtime path changes here.
Layer below: scripts/build-register.mjs --replay (unchanged) and the desk rehash and repin chain (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: sbreplycheck-livemerge-generated | the conflicting generated/ files were taken from the live side and then re-emitted by the register replay for the merge commit, rather than hand-resolving JSON conflicts, because generated output is only ever written by the script | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-replycheck-repair-004346-PROGRESS.md
Prompt review: no system prompt, provider policy, model input or verdict parsing is changed by this merge beyond what the live build's own reviewed records cover.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts ("I have no active saved memory items"), unchanged by this merge (as dispositioned in reviews/cint-L49-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing memory-grounding prompt wording in tests/preview/journal.ts, unchanged by this merge (as dispositioned in reviews/rc-1-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing memory-grounding prompt wording in tests/preview/journal.ts, unchanged by this merge (as dispositioned in reviews/rc-1-change-review.md)
Deferral: generated/register.json:1 | not-a-deferral=generated register output re-emitted by the replay after the merge, never hand-authored

Subject (13 paths): docs/defects/full-suite-load-timeouts.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/tool-turn.test.ts, tests/preview/two-machine-runner.test.ts

## Closing block

simplestRobustRoute: an ordinary merge, generated files re-emitted by the existing replay script, and the desk chain run to confirm no pin moved.
80/20: journal-obligations, tool-turn and two-machine-runner 52/52; journal importers journal-memory-inventory, retrospective, summary-check and production-session-work 84/84. tsc --noEmit exit 0, npm run lint exit 0, npm run register:check true. The full suite is the gate host's.
VERDICT: author submission; no independent pass is recorded for this record
