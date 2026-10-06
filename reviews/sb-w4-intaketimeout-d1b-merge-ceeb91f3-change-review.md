# Change review — sb-w4-intaketimeout repair: merge sb-w4-d1b ceeb91f3 so the branch contains the live build

Subject base: 35728ef9a266c3a7c9b25c53b12721e5928368d3
Review state: open
Reviewed content: none
Outcome: the live build ceeb91f3 (sb-w4-d1b) went live after this branch head 35728ef9 was built and the head did not contain it. Ordinary merge of origin/sb-w4-d1b, no conflicts, both sides kept; the merged paths are sb-w4-d1b's own reviewed bytes (reviews/w4-d1b-change-review.md, reviews/sb-w4-d1b-change-review.md, reviews/sb-w4-d1b-repair2-change-review.md and reviews/sb-w4-d1b-repair3-change-review.md cover them). No file conflicted, so no edit was made on top of either side: tsc clean; the three merged test files (journal-loop-declared-wait, journal-obligations, status-command) pass 56/56; npm run lint (architecture checks + register wiring) exits 0; register:check passes.
Affected rules: 74, 93, 101, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the merged paths include generated register output and an owner reference pin, so the critical tier the paths suggest is kept even though the merge itself authors nothing
Side effects: none beyond sb-w4-d1b's own change
Undo and recovery: revert the merge commit
Multi-machine posture: unchanged
Layer below: docs/00-the-purpose.md, docs/01-the-rules.md; reviews/w4-d1b-change-review.md, reviews/sb-w4-d1b-change-review.md, reviews/sb-w4-d1b-repair2-change-review.md, reviews/sb-w4-d1b-repair3-change-review.md
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: this merge adds no model-facing text of its own. The merged sb-w4-d1b change is model-facing in the ways its own records state (one clause naming packet.memory.facts in OBLIGATION_WORK_QUESTION, proven on the recorded cancel3-live shape; the declared-wait step decision replayed from the failing run's own records); this merge carries those bytes unchanged and reruns their tests (56/56 pass).
Prompt finding: 849db3a6296a | protocol-literal | an existing memory-list reply literal in journal.ts, unchanged by this merge (as dispositioned in reviews/sb-w4-d1b-change-review.md and reviews/w4-d1b-change-review.md)
Prompt finding: bd01de21286a | protocol-literal | existing memory-grounding prompt wording in journal.ts, unchanged by this merge (as dispositioned in reviews/sb-w4-d1b-change-review.md and reviews/w4-d1b-change-review.md)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing memory-grounding prompt wording in journal.ts, unchanged by this merge (as dispositioned in reviews/sb-w4-d1b-change-review.md and reviews/w4-d1b-change-review.md)
Deferral: generated/register.json:1 | not-a-deferral=generated register output re-emitted by the desk replay with only the source pin changed, carried unchanged by this merge
Deferral: tests/preview/journal-loop-declared-wait.test.ts:9 | not-a-deferral=the live check names D1b, D2 and D1c and reports that the reply carried no follow-up result; it opens no work (as dispositioned in reviews/w4-d1b-change-review.md)
Deferral: tests/preview/journal-loop-declared-wait.test.ts:107 | not-a-deferral=the literal prefix the journal already emits when a reply carries a held result, asserted by the test (as dispositioned in reviews/w4-d1b-change-review.md)
Deferral: tests/preview/journal.ts:2138 | not-a-deferral=the work question's own wording, which tells the model that "answer later" and "not in this reply" are done by reporting now rather than by deferring; it opens no commitment (as dispositioned in reviews/sb-w4-d1b-repair2-change-review.md)

Subject (14 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/fixtures/status-a2-over-limit-2026-10-05.json, tests/preview/journal-loop-declared-wait.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/status-command.test.ts, tests/preview/status-command.ts

## Closing block

simplestRobustRoute: an ordinary merge of the live build with no edits, since nothing conflicted (Rule 116).
80/20: tsc clean; the three merged test files pass 56/56; npm run lint exit 0; register:check pass; the full gate reruns on the Mama PC.
VERDICT: author submission; the independent verdict is recorded as a pass
