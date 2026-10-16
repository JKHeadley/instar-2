# Change review — durable active-work progress floor

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: active commitment steps and blocker rechecks without a recorded result past the existing 30-minute bound become visibly stalled on the existing status surface, with item identities and replay-stable age.
Affected rules: 8, 13, 26, 34, 36, 46, 49, 64, 68, 74, 76, 80, 83, 87, 92, 97, 101, 102, 111, 113, 116
Affected floors: secrets — no new text or credential reader; spend cap — no new calls or admission; stop — no runner changes; no duplicate sends — observation only, no effects or retry authority; durable intake — existing journal unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: deterministic pull projection and rendering only; no model parsing, prompt, dispatch, admission or durable schema change.
Side effects: a started step's progress age now begins at its actual durable start, rather than its original scheduling slot or a future retry slot. Slow workers are labelled stalled without claiming death or triggering recovery. The status adds at most one line and three internal obligation identities; the existing status byte cap still applies. Aggregate last-progress time remains explicitly separate from per-item stalled evidence.
Undo and recovery: revert this change to restore prior status projection; no migration or stored data needs undo. Work ownership, result delivery and uncertain-effect handling are unchanged. Restart derives the same observation from journal replay or a snapshot.
Multi-machine posture: computed from the existing conversation-owned replicated journal and caller clock; no machine-local store, new owner or cross-machine effect. A reader's lagging journal can report absence of a recorded result, never prove worker death or grant takeover.
Layer below: inspected obligationSchedule and projectObligationWork in journal.ts. inFlight is a scheduling identity, while last is the durable start timestamp until a result clears inFlight; same-slot format repair does not refresh last. Blocker schedules use a future retry time even while active. Real c1 checkpoint rows alone do not clear inFlight. Existing statusReply/statusAnswer and dashboard consume loopStatusLines with the existing byte bound.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none
Convergence: none
Decision: progress-floor-start-evidence | age active steps from their durable start, not the schedule slot; use the existing 30-minute bound and retain all work as non-terminal | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-floor-1016-PROGRESS.md
Decision: progress-floor-pull-signal | expose exact stalled item count and at most three identities through the existing status renderer, with no new service or automatic action | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-floor-1016-PROGRESS.md
Prompt review: no model prompt, parsing, routing or accept/escalate/refuse decision changes. Replayed work-recovery-2026-10-15.json c1 obligation start, checkpoint rows and result; its recorded slot is 1792042495116. Injected elapsed time separates start from schedule and tests both sides of the bound. Existing captured summary/review/empty-output rejection tests remain in the targeted obligations suite. No live execution is claimed.

simplestRobustRoute: this is the simplest route: extend the existing pure journal health projection and its status line. The durable start already exists; no schema, timer, observer, store, worker or model call is needed. Start guard is a scheduled open obligation with inFlight; end-state is its recorded result or existing closure; limits and stop remain in their current owners. The desk must run the bounded slow-step proof-room status check before calling this live; no unattended shipped-path completion is claimed.
Register regeneration: desk-provided rehash updated only the obligations test artifact pin; the inventory chain needed no changes. Generated outputs are regenerated from the committed source.

80/20: close the demonstrated false-negative and false-positive age errors, keep the result/wait/restart neighbors, and submit targeted evidence to the desk's existing independent review and live gate.
VERDICT: author submission; no independent convergence claimed
