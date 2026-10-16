# Change review — bounded commitment-history reconciliation

Subject base: 76f817b8708b89828a303e1890f7ca7a10aeb083
Review state: open
Reviewed content: none
Outcome: retained commitment history no longer prevents delivered-answer outcome review; actionable candidates traverse bounded duplicate-evidence pages before becoming schedulable.
Affected rules: 4, 8, 9, 10, 12, 36, 44, 46, 49, 57, 58, 60, 68, 70, 74, 83, 101, 102, 111, 113, 116
Affected floors: secrets — existing redaction and quote validation retained; spend cap — existing retrospective reservation, cadence and reply reserve unchanged; stop — existing worker admission unchanged; no duplicate sends — candidates remain unscheduled until complete duplicate coverage and use the existing executor/send doorway; durable intake — existing journal intake unchanged and page progress rides durable review grades.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: repair to existing model-facing reconciliation and its durable grade; no new effect, authority, worker or store.
Side effects: a large conversation requires several already-budgeted review passes before candidate work is admitted. Outcome grades remain available on each pass. The packet explicitly discloses incomplete coverage; subsequent pages may only narrow candidates. An omitted or failed case never advances coverage. New commitments arriving during a call require another page.
Undo and recovery: revert the repair to restore prior planning; retained commitments and completed work remain intact. Older readers ignore optional promiseReview and revisit grades lacking promises, so unfinished reconciliation is not marked complete, though the old history-size defect returns. Failed calls retain the last durable cursor. No live root is changed.
Multi-machine posture: existing conversation-owned journal, replay and snapshot posture; progress follows its grades across restart or transport. No machine-local side store, new sender or ownership bypass.
Layer below: inspected retrospective plan/validation, retro journal projection, reconcilePromises exact identity/closure checks, and workObligations admission. Only grade.promises enters the existing commitment executor; pending candidates have no executable field. Existing delivered receipt, quote, dated-work, declared-wait and closure safeguards remain in their owners.
Bug class: unit
Bug evidence: reproducer=tests/preview/retrospective-promises.test.ts
Hook bypass: none
Convergence: none
Decision: reconcile-history-pages | reuse durable grades for an exact commitment cursor and shrinking candidates; complete outcome review while history checks continue, without deleting history or increasing the packet ceiling | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-reconcile-1015-repair-183343-PROGRESS.md
Decision: reconcile-history-snapshot | bind validation to the page actually planned; omitted/failed reviews cannot advance and newly appended commitments require another page | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-reconcile-1015-repair-183343-PROGRESS.md
Prompt review: model-facing. Replay summary-ack-walk-2026-10-15.json through delivered update 840342898 and neighboring 840342917; promise-fulfilment-a5b-2026-10-03.json for the existing undated promise; retrospective-duty-followup-train-1-2026-10-08.json for recorded uncertain summary, Jev uncertain/undecided, reply-review and empty-bubble shapes. Additional explicit test judgments cover 60 closed commitments, last-page semantic duplicates, restart and failed or widening pages. These are offline captured-input replays, not live-model acceptance; the combined desk retains its assigned live check.

## Closing block

simplestRobustRoute: use the existing bounded retrospective consumer and durable grades to check one history page per pass, keeping candidates out of schedulable promises until coverage completes. This is that route: no new worker, model-call path, store, retrieval service or permission. The cursor prevents the named lifetime-history admission barrier; shrinking candidates prevent unseen pages from being mistaken for proof of absence. Existing start/cap/stop/effect guards remain. Live autonomous acceptance is not asserted by this unit submission.
80/20: repair the demonstrated history-size barrier and preserve duplicate/closed-work neighbors; leave the desk's live conversation and full-suite acceptance with their existing owner.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
