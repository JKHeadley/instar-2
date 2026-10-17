# Change review — helper results return to their parent

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: nested delegation edges no longer hide a parent's completed result during recovery; failed or stalled helpers return their recorded diagnosis and child identity; new and received graph edges bind their destination to their accountable parent.
Affected rules: 4, 26, 31, 34, 36, 42, 49, 60, 68, 74, 83, 101, 102, 111, 113, 114, 116
Affected floors: secrets — no new outbound surface and existing result confinement unchanged; spend cap — reservation and post-stop accounting retained; stop — existing stop and cleanup unchanged; no duplicate sends — launched failed work remains uncertain, not eligible for replay; durable intake — edge-before-launch and close-before-return unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: bounded repair of delegation collection and exact destination accounting; no new watcher, service, store, model call or authority.
Side effects: malformed graph destinations now refuse at creation and receipt while preserving the submitted input. Nested edges are excluded only from top-level attempt selection, not deleted. Failure detail becomes visible to the existing parent collector. Missing, ambiguous, foreign or invalid closure remains uncertain. Complete denotes result-byte transport, not semantic acceptance of a model verdict.
Undo and recovery: revert the source changes to restore prior selection and diagnosis behavior; durable schemas and records are unchanged. No deployed state or Studio files are modified. Existing no-child evidence remains the only failed recovery that admits a new bounded attempt.
Multi-machine posture: delegation checks are protocol-independent and run at sender and recipient; local and Threadline contract tests exercise nested return, loss, duplicate delivery and cancellation. Session result files remain machine-local and exact-owner checked; this change introduces no cross-host replay or ownership takeover.
Layer below: inspected durable delegation ledger, transport receipt/collection semantics, session-work close and admission ownership, bounded result reads, and journal obligation recovery. The journal treats recovered failed as retryable, so a launched failure must retain uncertain recovery status despite preserving its diagnosis.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-session-work.test.ts
Hook bypass: none
Convergence: none
Decision: helper-parent-destination | require graph return endpoints to name the accountable parent run and edge at both creation and receipt, preserving Rule 114 ownership | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-result-1016-PROGRESS.md
Decision: helper-collection-accounting | select the exact top-level operation attempt, excluding nested edges and prefix neighbors; preserve helper diagnosis and identity without permitting uncertain work replay | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-result-1016-PROGRESS.md
Prompt review: no prompt or model-output semantic parser changed. Recorded work-recovery-2026-10-15.json outputs replay through run and collect: summary complete/uncertain, Jev undecided/unsure, reply review complete/unavailable, ordinary reply and empty reply. The recorded work output also exercises nested-helper collection. Nonempty transport bytes stay opaque; empty or missing results are never completed. The existing real terminal stall fixture exercises bounded uncertainty. No live-model or deployed proof is claimed.

## Closing block

simplestRobustRoute: extend the existing durable edge and result collector. This is that route: exact parent destination checks prevent orphaned returns; exact attempt selection prevents nested edges from hiding results; retained diagnoses prevent worker failures becoming generic unknowns. No additional watcher, schema, callback, retry loop or model call. Start admission, stop, resource ceilings, exact cleanup, bounded reads and uncertain-effect no-replay remain held. Unattended shipped-path acceptance belongs to the desk proof-room run and is not claimed here.
80/20: close the reproduced collection and destination gaps with positive and negative tests; retain the desk's live check and host gate rather than create parallel infrastructure.
VERDICT: author submission; no independent convergence claim
