# Change review — carried 1.x commitment and beacon modules on the owner journal

Subject base: 56e8efa844a78ca24895cec9d939735ec632ca5a
Review state: open
Reviewed content: none
Outcome: Row 01, lanes/carryover-1028.md: carry 1.x PromiseBeacon and CommitmentTracker into 2.0 as adapted source with their tests, persisted in the owner journal and advanced on the runner's admitted tick. Parity of the modules and their journal behaviour is proved here. Production send binding, typed producers, Threadline custody wiring and the revive callback are not done, so the row stays open and no live acceptance is claimed.
Affected rules: 1, 5, 8, 9, 10, 26, 32, 33, 34, 41, 42, 44, 49, 52, 55, 60, 61, 63, 68, 70, 74, 83, 84, 87, 92, 93, 111, 112, 113, 116
Affected floors: secrets — guard and redaction carried, no new credential path; spend cap — carried per-day queue, and no model call is bound in the runner; stop — a stop, lost ownership or expiry holds every step by not ticking; no duplicate sends — a started check-in is settled by its receipt and an unknown send is never repeated; durable intake — unchanged, the commitment frames are additive and refused rows leave nothing applied.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Adds durable state beside the promise owner and a new runner tick step; it holds no live send authority.
Side effects: Every admitted reply promise now also writes a one-way mirror row and, while open, bounded internal cadence frames (at most about two per item per cadence, newest 20 items). Journal generation moves to 7; an older build reads the frames as additive and skips them. Status gains a commitments block once the store exists. Nothing is sent: the runner binds no send, and beacon output stays off.
Undo and recovery: Remove the tick call in the runner and the frames become inert: the additive declaration lets either build skip them and the journal's own promise path is unchanged. Rows are retained for a later rebuild.
Multi-machine posture: The rows are journal frames, so they replicate with the journal and follow its owner. Only the owner's admitted cycle ticks. A host that stood by rebuilds from the journal when another owner advanced it.
Layer below: Read the complete rule book on main, both complete 1.x modules and their helpers (LlmQueue, ProxyCoordinator, OriginAutomationAuthor, the PresenceProxy guards, deliverToConversation's outcome type), the journal's frame admission, snapshot, forward-frame and compaction paths, the sentinel record and tick, and the reminder and outbound intent rows. The check-in module's send-before-stamp seam and the delivery backfill were the unsound parts of the source.
1.x reuse: Raw baseline commit af938a95e57ae916f78ba47f082380333445acdf and helper commit 239ef174d copy the source and 25 test files byte for byte from 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9; the diff from there is the adaptation.
Bug class: integration
Bug evidence: reproducer=tests/commitments/commitment-host.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, parser or verdict changed. The carried status and rung texts are fixed templates; no status-line model is bound in the runner.
Decision: CARRYOVER-01-R2-JOURNAL-STORE | Commitment rows live in additive journal frames rather than a second file store, and the projection is the only store. | reported=/home/echo/.instar/agents/echo/.instar/state/carryover-01-full-parity-r2-1104.md
Decision: CARRYOVER-01-R2-MIRROR | Reply promises stay the journal's; the tracker mirrors open notes one way, so its rows never close a promise. | reported=/home/echo/.instar/agents/echo/.instar/state/carryover-01-full-parity-r2-1104.md
Decision: CARRYOVER-01-R2-DIRECTIVES | Behavioural rules and setting watches never expire on a timer, including a caller-set expiry; both still close by withdrawal or delivery. | reported=/home/echo/.instar/agents/echo/.instar/state/carryover-01-full-parity-r2-1104.md
Decision: CARRYOVER-01-R2-CHECKIN-SETTLE | A check-in's start is durable before its send and an unknown result waits for its receipt, replacing 1.x's reliance on relay dedup. | reported=/home/echo/.instar/agents/echo/.instar/state/carryover-01-full-parity-r2-1104.md
Decision: CARRYOVER-01-R2-NO-SEND-BOUND | The runner binds no send in this change: each attempt is a recorded definite refusal, until a grant-bound send lands as its own critical unit. | reported=/home/echo/.instar/agents/echo/.instar/state/carryover-01-full-parity-r2-1104.md

simplestRobustRoute: Copy the proven 1.x modules and bind them to the journal through narrow ports. That is the simplest route to the promised behaviour: rewriting would lose tuned thresholds and the failure history in their tests. The added machinery is one additive frame kind and one adapter, which prevent a credible failure a second file store would cause (state outside journal replication, stop and compaction). Start guard: the admitted tick. End guard: journal closure and recorded receipts. Limits: 32 due steps per tick, 32 rows per frame, 65,536 bytes per frame, the carried cadence and revival caps. No unattended shipped-path completion is claimed; the runner tick could not execute on this host.
80/20: The module logic and journal behaviour are proved by 299+ tests; the remaining items are named wiring units, not refinements of this design.
VERDICT: author submission; no independent convergence or live-proof verdict asserted.
