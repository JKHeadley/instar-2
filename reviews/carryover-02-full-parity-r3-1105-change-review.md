# Change review — original work custody survives optional triage and host restart

Subject base: d375c3dec5e6b24c7c2a8901b0dd8ba2698b3f67
Review state: open
Reviewed content: none
Outcome: The existing one-shot owner always consults original work custody and binds request bytes, even without optional triage. Reconstructed owners retain their parent's spent step allowance. Whole02 remains incomplete and out of release.
Affected rules: 26, 42, 46, 55, 60, 61, 63, 68, 70, 74, 101, 102, 107, 113, 114, 116.
Affected floors: stop and original call/resource limits unchanged; durable intake and no duplicate effects preserved independently of optional diagnosis; no secret or spend authority added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Reconstructed execution must not repeat an uncertain effect or replenish its allowance.
Side effects: Every new top-level work edge now binds request bytes. A repeated operation returns its original outcome instead of clearing its result and launching a new worker. Legacy edges without request digests refuse replay. A new genuinely distinct operation remains subject to the original parent ceiling.
Undo and recovery: Revert source through normal update; retain all original work records and result files. Never replay unknown operations. Reversion removes the new protection for owners without triage.
Multi-machine posture: Existing shared work journal remains authoritative. Physical child work remains local; a changed parent/owner/placement/scope does not establish permission to repeat original work. Host incarnation alone cannot authorize replay.
Layer below: SessionWorkEdge is durable before launch; collect verifies original owner, result destination, closure, cleanup and result digest. The recovery check was wrongly conditional on workRecovery. The launcher already supplies recoveryEdges for one-shot scheduled work.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-session-work.test.ts
Hook bypass: none
Convergence: none
Decision: carry02-unconditional-custody | Original operation custody and step accounting are owner invariants, independent of the optional triage supplier. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r3-1105-PROGRESS.md
1.x comparison: Current JKHeadley/instar main d7788fa3348ce079ae5590002d807fc59d12ac50; all seven monitoring modules and sentinelWiring.ts match preserved b947c171f834f5e0e22d5087e090b2a9031189f9 byte-for-byte. Inspected src/monitoring/{ActiveWorkSilenceSentinel,SessionMonitor,SessionWatchdog,StaleSessionBackstop,DegradedTmuxGuard,StallTriageNurse,TriageOrchestrator}.ts, src/commands/server.ts callers and docs/specs/{silently-stopped-trio,tmux-event-loop-resilience,watchdog-test-runner-floor}.md. History e0dfce86f/5eea91f15 preserves live test-runner exclusions. Adapt durable recovery/dedup into existing2.0 custody; legacy numeric-PID kill and heuristic action authority are mismatches, not copied. No ONEX-LESSONS file found in searched current1.x/local2.0 docs. The inherited seven-module matrix remains open.
simplestRobustRoute: Move the existing custody check out of the optional supervisor branch and reconstruct spent steps from its existing journal. No new store, scheduler, signer, grant or sender. This prevents duplicate effects and allowance replenishment on host replacement. Start guards, original exit test and original limits remain in force; unattended whole-feature evidence is absent.
80/20: This is an independently testable repair in the assigned whole-feature continuation; it is not whole02 readiness.
VERDICT: Unreviewed; whole02 remains open.
