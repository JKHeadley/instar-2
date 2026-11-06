# Change review — deadline-directed promised-result work

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Outcome: Carryover row 01 in lanes/carryover-1028.md: a coalesced work wake selects the earliest eligible durable deadline instead of declaration order, so an older declaration with a later deadline cannot consume the next bounded step ahead of an earlier-due promised result. The full finish-and-deliver row remains OPEN pending an unattended exact-head live trial.
Affected rules: 1, 4, 8, 26, 34, 36, 46, 49, 52, 55, 60, 63, 68, 70, 74, 83, 87, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing outbound scrub and check; spend cap — unchanged bounded one-step work and send admission; stop — unchanged journal and host checks; no duplicate sends — unchanged slot identity, intent binding and receipt settlement; durable intake — unchanged validated journal and withdrawal-aware delivery point.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the order in which existing promised work uses its bounded execution step; makes no new authority or model judgment.
Side effects: Overdue commitments and the existing blocker rechecks execute by deadline, with stable declaration order for equal deadlines. Later work remains owned and is eligible on the next step. No timer, cadence, retry, prompt, parser, state format or send grant changes.
Undo and recovery: Revert the ordering change and its regression test. Existing durable records and result identities remain readable by both versions; never repeat a bound UNKNOWN send.
Multi-machine posture: The owner journal supplies all deadlines. Existing host owner/peer admission remains required for work and delivery. No new local or shared state; ownership transfer and restart reconstruct the same order.
Layer below: Read the complete governing purpose and rule book, main's additional Rule 119 and Rule 72 wording, row 01 final cell, the journal work and requested-result path, nextObligationAt/createNextDueWake, and the pinned 1.x mechanisms. The existing wake already reads the earliest deadline; the worker previously picked the first declared eligible obligation instead.
1.x reuse: JKHeadley/instar at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, src/monitoring/PromiseBeacon.ts schedule/fire (lines 717-755): each timer retains the commitment identity belonging to its durable deadline and fire rereads that commitment. CommitmentTracker retains agent ownership separately from dependency and keeps an unverifiable one-time action pending until evidenced resolution (lines 1310-1325). The coalesced 2.0 adaptation preserves deadline-directed selection and uses its existing stronger UNKNOWN-never-replay rule rather than importing timers, filesystem state or legacy auto-expiry.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser, model acceptance or refusal change. The test replays recorded provider bytes through the existing conversation-session adapter; a constructed later-due declaration is prepended to exercise competing work.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged action-claim guidance requires evidence of an attempted avenue; the fixture verifies that instruction, not an expected model verdict.
Prompt finding: 85544c20941f | protocol-literal | Unchanged durable-intake status reply tells the user that retained messages need not be resent; no phrase-trigger decision is added.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged recall provenance instruction requires source labels and disclosure of unknown sources; ordering adds no model classification.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged deterministic empty-memory status text is asserted by its consumer test; no prompt answer is supplied by this change.
Decision: CARRYOVER-01-DUE-ORDER | Select eligible work by durable deadline, stable on ties, preserving the existing single-step worker and requested-result doorway; leave the whole carryover row OPEN for live proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-01-promised-result-delivery-1104-PROGRESS.md

simplestRobustRoute: Sort the existing eligible due-work list by its recorded slot. This is the simplest route; it preserves PromiseBeacon's deadline-directed dispatch without another queue, timer, store or notification. Existing admission, receipt and limit checks remain the start/end/floor guards. No unattended shipped-path completion is claimed.
80/20: Focused red/green regression, recorded-shape replay, targeted importers, build, typecheck, architecture/register checks and pinned READY tests; the desk owns full-suite and live acceptance.
VERDICT: author submission; no independent convergence or live-proof verdict asserted.
