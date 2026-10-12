# Change review — Prove replicated acknowledgement and final reply separately

Subject base: 2b3ea7d73793716cfce53b76a2e0190aacad0d8f
Review state: open
Reviewed content: none
Outcome: Restore the peer-loss proof by observing the final answer and asserting one acknowledgement plus one answer, both owned and settled, after replication resumes.
Affected rules: Purpose durable cause and replicated(1); Rules 26, 31, 37, 49, 63, 70, 74, 101, 111, 112, 113, 116.
Affected floors: secrets — existing outbound guard unchanged; spend cap — existing model and reply allowances unchanged; stop — existing stopped-peer proof retained; no duplicate sends — exact counts for each send kind and total; durable intake — existing journal and replicated reservations unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only the named process-level regression test changes; no runtime, model-facing or installed-source change.
Side effects: A reviewed slow acknowledgement no longer masquerades as final completion. The test still rejects any send or subsequent provider call while the peer is absent, a duplicate acknowledgement or answer, any third send, a non-owner send, or unresolved authority claims.
Undo and recovery: Revert this test and review commit; no durable state, policy, migration or generated publication changes.
Multi-machine posture: Two runner processes and one authority use real HTTP and journal replication. The test's model and Telegram ports remain file-backed physical fixtures; production two-machine ownership and durability are unchanged.
Layer below: Inspected journal.ts acknowledgeReply and its separately reserved review and held-notice intent; journal-agent.mjs peerHolds, callSubscription and acknowledgement operation selection; journal-cutover-model.mjs injected four-second delay and journal-cutover-ports.mjs send records. The old count-of-one predicate could observe the acknowledgement or miss both sends between polls.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, containing sample files only.
Convergence: none
Decision: replicated-send-kinds | Observe the final answer and separately count both required sends instead of changing runtime recovery or disabling acknowledgement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack-1011-repair-PROGRESS.md

Subject (1 paths): tests/preview/two-machine-floors.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the obsolete completion predicate and exact settlement assertions in the named test. The injected slow path already covers acknowledgement without host load. Start guard is enrolled ownership; end guard is one actual answer plus one acknowledgement with two resolved claims; limits remain the existing replication, stop and resource checks. No runtime machinery or autonomous-completion claim is added.
80/20: The isolated baseline reproduced two sends against the obsolete one-send assertion. Targeted process tests and required cheap gates verify the correction; the pipeline provides the full-suite result. Existing passing history is preserved.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
