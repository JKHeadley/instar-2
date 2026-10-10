# Change review — Recurring receipt respects operator wording

Subject base: 49d94595aea4c31f30a62069949afa81944c4e7b
Review state: open
Reviewed content: none
Outcome: The recurring-request receipt calls the agent I and my, retaining the operator's standing directive and every schedule and limit disclosure.
Affected rules: 28, 34, 37, 49, 62, 74, 80, 93, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged outbound scrub; spend cap — unchanged admission and explicit limit disclosure; stop — unchanged checks and disclosure; no duplicate sends — unchanged occurrence identity and durable intent; durable intake — unchanged encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: local
Tier rationale: MF1 requests a single deterministic receipt wording correction; no prompt, parser, decision boundary, scheduling or authorization change.
Side effects: Only the recurring acceptance receipt's self-reference changes; schedule, zone, first due date, cancellation and recovery disclosure remain byte-identical.
Undo and recovery: Revert this wording-only commit; no stored state, migration or recurrence metadata changes. Reverting restores the rejected terminology and therefore requires resolving the standing directive.
Multi-machine posture: Same receipt on each machine running this version; existing single-owner journal and dispatch fencing remain unchanged. No state or replication change.
Layer below: Inspected the dated/remind/recurrence branch of the receipt construction and existing daily-series consumer test, which observes the sent acceptance and exercises due delivery, restart and withdrawal.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: w4-recurring-repair-mf1 | Apply the reviewer's exact replacement only; inspect the literal and run the existing receipt consumer test because scheduling was accepted and no new mechanism is justified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-recurring-repair-030741-PROGRESS.md
Prompt review: No model instructions or output parsing changed. This is the deterministic user-facing receipt appended after the dated request is verified.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal protocol literal unchanged by this receipt repair.
Prompt finding: bd01de21286a | protocol-literal | Existing journal protocol literal unchanged by this receipt repair.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing journal protocol literal unchanged by this receipt repair.

Subject (1 paths): tests/preview/journal.ts

## Closing block

simplestRobustRoute: Replace the one rejected clause with the exact requested self-reference in the existing receipt; this is the simplest robust route and adds no machinery. Existing intake, admission, cancellation, spend and stop guards continue to apply. Unattended live delivery is not claimed.
80/20: Limit the source repair to MF1, run the existing requested-action test file and required cheap checks, and leave independent acceptance and real-channel proof to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
