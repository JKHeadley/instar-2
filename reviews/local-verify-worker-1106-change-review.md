# Change review — Local Verify worker connector

Subject base: 8258974660cadac50e9a4988c050cf14764e8dc3
Review state: open
Reviewed content: none
Outcome: Let a configured worker request the existing full verifier and read exact-head verification evidence without running the suite in its workspace.
Affected rules: 1, 26, 34, 36, 42, 60, 70, 74, 78, 84, 100, 111, 113, 116
Affected floors: secrets — existing SecretRef custody; spend cap and stop — existing MCP checkpoint; no duplicate sends — no send tool and existing effect preparation; durable intake — verifier queue unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: New external-tool surface; retains the installed effect boundary and verifier implementation.
Side effects: A request can start the existing verifier and its already-authorized follow-on behavior. This client grants no new merge or send authority. Status reads are bounded point-in-time observations.
Undo and recovery: Remove this connector from the installation's MCP configuration; existing verification jobs and their records remain with the verifier. A lost POST reply remains unknown and requires a read before retry.
Multi-machine posture: Configured verifier origin owns queue/execution; its peer machine is reported separately. GitHub status belongs to the exact head. The client adds no store or local scheduler.
Layer below: Read 1.x request eligibility, queue deduplication, head/base record identity, peer sending versus accepted states, and status projection. Reuse 2.0 readRootMcp, installMcp, prepareMcpLaunch and effect admission. The existing content-addressed hook installer copies the connector for the separate worker identity; launch rewrites only the shipped exact path.
1.x reference: JKHeadley/instar cedba8f3abb9e9619257394106952199f093702e; src/localVerify/localVerifyRoutes.ts, LocalVerifyService.ts, peer.ts, record.ts, statusProjection.ts and StatusReconciler.ts; docs/specs/local-verify-merge-authority.md section 2 and local-verify-capacity.md; history 8c2a16e67 and 2ae9dc186. Reuse POST {pr}, exact-head/base records, queue and instar/local-verify; the existing server retains the whole tuned runner and merge policy. ONEX-LESSONS section 6 informed bounds and consumer verification.
Bug class: live-path
Bug evidence: reproducer=tests/preview/local-verify-worker.test.ts; control=the same discovery test fails on the assigned base because the connector does not exist
Hook bypass: none
Convergence: none
Prompt review: Tool descriptions explain receipt/evidence distinctions without an intent classifier. Real recorded summary, Jev, review and reply shapes are replayed as untrusted expanded requests and refused without I/O.
Decision: LV-WORKER-1 | Reuse configured MCP and the 1.x HTTP service; do not copy its scheduler or widen grants. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/local-verify-worker-1106-PROGRESS.md
Decision: LV-WORKER-2 | Report peer acceptance separately from running, and recorded outcomes separately from GitHub status. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/local-verify-worker-1106-PROGRESS.md

## Closing block

simplestRobustRoute: A bounded MCP client through existing installation and authority mechanisms is the simplest robust route; preserve the already-tuned verifier remotely, with no new runner, poller, status writer or merge path.
80/20: Scope is requesting and observing an existing verifier; fixture and consumer tests do not claim a live installed conversation has passed.
VERDICT: author submission; no independent acceptance claimed.
