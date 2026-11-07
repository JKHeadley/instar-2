# Change review — train-195 repair, keep the parent notice classified

Subject base: 87316ff5ddb8be52dc5ce753da86f226d6ffab70
Review state: open
Reviewed content: none
Outcome: A delivered uncertain-result notice written by the train parent e57d3ed79 is again described to the next model as a loss notice, not as a holding reply that never existed. Astra round 3 must-fix 1. New notices are unchanged.
Affected rules: 26, 37, 42, 49, 52, 70, 74, 77, 80, 89, 101, 102, 105, 110, 111, 113, 116, 121
Affected floors: secrets — the historical candidate quotes the same redacted request and is only compared, never sent; spend cap — no model call added; stop — no stop path touched; no duplicate sends — no dispatch, retry or intent change, the old turn is not resent on reopen; durable intake — no journal row or schema change
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Recognition-only change to a history label in the preview journal test worker; no dispatch, permission, schema, store or retry change.
Side effects: lostNotice compares two more candidates per history row. unknownAnswerNotice now passes its 700-character bound and reason to a shared renderer; its output bytes are unchanged, and the notice test files pin them.
Undo and recovery: Revert the commits before landing and replay the register. No journal is rewritten, so saved rows read correctly again once the fix returns.
Multi-machine posture: Pure comparison against the same durable turn on every host; no new local state.
Layer below: Read lostNotice, unsettledOutcome (safety-ceiling rows take their own branch first), replyBody disclosure stripping and every unknownAnswerNotice consumer, including the replyCandidate reservation check and the exact-report review bypass, which stay on the current rendering because they judge unsent text. git log -S shows the plain wording and 800 bound entered only at a2b39b69a, so one plain format exists. 1.x comparison is inherited, see below.
1.x comparison: Inherited, no new 1.x behavior: live notice member at JKHeadley/instar main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d (src/monitoring/CommitmentTracker.ts, src/monitoring/watchdog-notifications.ts); train notice member at main b718807caa98480faa173850787b3a6f57c0affb (src/messaging/plainNoticeCheck.ts, src/monitoring/watchdog-notifications.ts). Astra accepted this lineage in round 3. This repair restores 2.0 history recognition only and has no 1.x counterpart to reuse.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train195-r3-parent-notice | Recognize the e57d3ed79 plain notice through one constant and the shared renderer at its 800 bound, covering the bare form and tool-count suffix; recognition only, never sent anew. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-002913-PROGRESS.md
Decision: train195-r3-near-miss-control | Test both sides: a real holding reply and a parent-format notice quoting a different request both stay 'holding reply delivered in place of the loss notice', so recognition stays exact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-195-repair-002913-PROGRESS.md
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No prompt or parser wording changes. The history outcome label the model reads returns to the parent's correct value. The change was replayed through real base-writer bytes (Astra's reproducer, journal from e57d3ed79 writing, this head reading) and with the recorded request of update 969390680 from tests/preview/fixtures/plain-task-stop-2184-2026-11-06.json. No fresh live journal was read; those roots are not reachable from this host.
Prompt finding: 4106b49fff07 | quoted-evidence | phrase is unchanged existing text; this repair authors no prompt wording — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | quoted-evidence | phrase is unchanged existing text; this repair authors no prompt wording — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | quoted-evidence | phrase is unchanged existing text; this repair authors no prompt wording — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | quoted-evidence | literal bytes of the parent notice, quoted in the test as historical evidence; nothing is asked of a model — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | quoted-evidence | literal bytes of the parent notice, quoted in the test as historical evidence; nothing is asked of a model — fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | quoted-evidence | phrase is unchanged existing text; this repair authors no prompt wording — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=regenerated register text from already reviewed inputs; this repair defers nothing

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/plain-task-stop.test.ts

## Closing block

simplestRobustRoute: Keep one exact recognized-only constant and reuse the existing renderer with the old bound. No classifier, store, protocol or restriction added, as the review asked.
80/20: One must-fix closed with both-sides tests, Astra's reproducer, tsc and the cheap gates; the Studio full run and installed qualification stay with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
