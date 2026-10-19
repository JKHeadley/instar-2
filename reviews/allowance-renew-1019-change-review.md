# Change review — renew an exhausted idle conversation allowance

Subject base: ea75e3d5db8728f0e8ab8b57f306c0a90d36732b
Review state: open
Reviewed content: none
Outcome: The existing 128-call exhausted topic state loads and the next input renews an idle allowance, preserving topic custody and the outer journal budget.
Affected rules: 1, 4, 14, 15, 26, 32, 33, 34, 37, 42, 44, 46, 49, 60, 63, 70, 74, 75, 96, 101, 102, 111, 113, 114, 116.
Affected floors: secrets — encrypted custody and existing outbound checks remain; spend cap — each new same-size allowance is charged by the existing journal cap without refund; stop — renewal checks stop, authority and deadline before and after retirement; no duplicate sends — inputs, outcomes and worker epochs survive and old claims are retired; durable intake — the existing custody store retains every input through renewal.
Operator questions: none
Suggested tier: significant
Declared tier: critical
Tier rationale: This repairs durable admission accounting on the user answer path without increasing either cap.
Side effects: Exhaustion no longer ends a conversation for its full lifetime. Only an idle coordinator retires all prior workers, closes the exhausted reservation and clears allowance-local counters. Replacement workers lose warm process context but retain host history. Calls halted by this allowance can proceed in the next epoch; deadline halts remain. A journal reservation refused by the outer cap remains refused and cannot dispatch.
Undo and recovery: Revert the source change only before renewal has occurred. Older code does not interpret allowance epochs; a post-renewal downgrade requires the desk to reconcile custody and journal liability before admitting work. Interrupted close appends reconcile their exact record against the journal; unknown new reservation liability retains the existing refusal behavior.
Multi-machine posture: The existing conversation ownership fence remains the single writer. The shared journal and encrypted custody carry renewal across host restart; machine-local leases and exact old process identities must retire before counters reset. No additional cross-machine writer or replication downgrade.
Layer below: Inspected production-conversation-session retirement, dispatch charging and input deduplication, the real journal projectSessionWork reservation debit and non-refunding close, and the launcher's existing recoveryEdges wiring. Tests reopen the actual encrypted journal and custody store.
Bug class: durability
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts; restart=tests/assembly/conversation-topics.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No prompt or parser edits. Renewal replays the existing captured summary/uncertain, Jev undecided/unsure, reply-review, delivered reply and empty-reply shapes as preserved context, proving the new admission path fires. The incident counters are reconstructed from the desk's recorded updates 969390599 and 969390600, not claimed to be a raw live-root copy.
Decision: allowance-renew-1019-epoch | Renew only an exhausted idle allowance using the existing journal, same cap and retained custody; preserve the original deadline and worker epochs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/allowance-renew-1019-PROGRESS.md
Decision: allowance-renew-1019-crash | Persist the close intent and reconcile an interrupted append against existing journal records before resetting counters. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/allowance-renew-1019-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: renew the existing reservation at an idle exhaustion boundary, with no timer, extra budget, new store or scheduler. One close intent prevents a crash between journal append and custody reset from duplicating renewal evidence. Existing journal admission enforces the outer cap. Start guards require exhaustion, idle retirement, authority, deadline and stop; completion retains correlated input outcomes and limit failures stay refusals. This is a builder submission; live Studio acceptance is not claimed.
80/20: Targeted coordinator and direct-consumer tests prove renewal and its negative neighbors, crash recovery, preserved custody and the outer budget. The desk owns live-copy proof and full gate checks on the Studio.
VERDICT: author submission; no independent convergence asserted
