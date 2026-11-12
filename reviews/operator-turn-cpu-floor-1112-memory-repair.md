# Change review — preserve the last operator worker on unknown memory

Subject base: 30aae0a3a85f00435d6cb0c450aed701a858b530
Review state: open
Reviewed content: none
Outcome: An unavailable memory observation cannot strand the only verified operator worker after physical admission. Measured pressure and additional-worker holds remain.
Affected rules: Rules 14, 15, 28, 46, 60, 61, 70, 74, 77, 95, 101, 102, 111, 113, 116, 123.
Affected floors: secrets — existing custody and outbound checks unchanged; spend cap — existing reservation and per-call charge unchanged; stop — existing admission and dispatch checks unchanged; no duplicate sends — existing durable dispatch and outcome reconciliation unchanged; durable intake — same stored input and FIFO drain.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Tiny reversible predicate repair at a worker admission decision; no new authority or resource owner.
Side effects: One verified operator worker can use its already-granted physical lease when the sampler reports unknown measurement and no measured pressure. Additional workers and background work still wait; measured pressure still holds and can reclaim idle workers. The sampler remains observational; existing resource, authority, stop, spend and lifetime checkpoints remain authoritative. Over-block: unrecognized refusal reasons and thrown custom capacity callbacks retain their prior behavior; the production sampler converts unavailable telemetry to the tested unknown result. Under-block: unknown telemetry permits one bounded worker, deliberately restoring Rules 15/95 rather than mistaking missing evidence for measured pressure. No notification or new timer. Accepted N1 stale diagnostic residue is unchanged.
Undo and recovery: Revert this repair through the normal install path; no stored schema or migration. Durable requests and outcome reconciliation retain their original identity.
Multi-machine posture: Deliberately machine-local capacity and active workers; existing conversation ownership, physical resource custody and authorization govern placement. No replicated state or extra cross-machine authority.
Team posture: Existing verified operator provenance earns the exception; members, guests and background work receive no new priority or access. No audience, sharing or privacy changes; team of one works identically.
Layer below: Inspected serialized acquire, physical resources.admit/release, active worker count, measured-memory reclaim, pending input provenance, existing host allowance and dispatch checks, and production sampler NaN/exception results. No reserve service added.
Bug class: integration
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts
Hook bypass: none; core.hooksPath=.husky/_ and that directory is absent; no configuration changed.
Convergence: none
Prompt review: No model prompt, parser or semantic verdict changes; host capacity decision only.
Decision: operator-turn-cpu-floor-1112-memory-repair | Preserve exactly the first verified operator worker for the existing unknown-measurement result, without relaxing measured pressure or physical admission. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/operator-turn-cpu-floor-1112-repair-140925-PROGRESS.md

1.x FIRST: Inherits the comparison in operator-turn-cpu-floor-1112-change-review.md. Rechecked JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987: src/core/SessionManager.ts, src/core/SpawnCapIntelligenceProvider.ts and src/core/hostSpawnSemaphore.ts bounded human/interactive capacity; docs/specs/robust-load-assessment-fleet.md and docs/specs/forkbomb-prevention-simple.md; history c667d0cb5 and 09a3a2f7d. Reuse interactive reachability inside actual physical ceilings through the existing 2.0 lease; no transplant of separate recovery-slot machinery. Prior ONEX Sessions and recovery comparison retained.

M1 supersedes the earlier review's intentional unknown-memory hold for the first operator worker; that behavior violated Rules 15/95. Real sampler NaN and throwing-memory cases fail before this predicate and complete afterward. Tests also retain additional-worker, background, measured-pressure, unavailable physical lease, revoked grant and stop boundaries. These are admission fixtures, not a claim of live Studio acceptance.

simplestRobustRoute: This is the simplest route: one predicate at existing serialized admission, after physical lease acquisition, admits only the last verified operator worker on unavailable telemetry. No new service, scheduler, reserve, state or semantic judgment. Existing durable intake, authority, spend, stop, lifetime and resource checkpoints continue to enforce the floors.
80/20: One source predicate and targeted regression tests; portable static gates here, full gate and native acceptance on Studio.
VERDICT: author submission; independent gate remains with the desk

Independent second pass: review_m1 concurred after static review of the predicate, sampler and adjacent host guard; no blocking concern. The sampler reports a refusal recommendation; the coordinator owns the bounded first-operator exception. Assembly documentation now states this distinction. No live acceptance claimed.
