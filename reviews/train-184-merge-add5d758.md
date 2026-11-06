# Change review — train-184 reconcile live build add5d758

Subject base: a032fd32d4f1a4a16c6d3d5f65e8b3a2f82d42ba
Review state: open
Reviewed content: none
Outcome: Merge the live build while retaining observed-response crash checks and using the shared async child helper.
Affected rules: Rules 34, 37, 42, 60, 70, 74, 95, 101, 102, 113, 116.
Affected floors: secrets — no credential path change; spend cap — no calls or allowance changes; stop — unchanged; no duplicate sends — unchanged effect identities and dispatch; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test fixture uses the existing query port; no product behavior, timeout, resource ceiling, or persistent format changes.
Side effects: The fixture no longer relies on real ps succeeding for invented absent PIDs or a complete ambient host census. Real-host recovery tests remain intact. No new runtime mechanism or capability restriction.
Undo and recovery: Revert this test and review commit to restore ambient observations; no runtime migration or journal repair.
Multi-machine posture: Deliberately machine-local test observations; the real Six journal is reopened with distinct incarnations. No change to replication, ownership, or deployment behavior.
Layer below: scripts/resource-owner.mjs startEvidence/recover/settle, scripts/process-inventory.mjs census, tests/preview/six-host-resources.ts and the existing real-host orphan recovery test. Production retains a row whenever absence is unproven and resumes partial returns using their original settlement.
Bug class: unit
Bug evidence: reproducer=tests/integration/resource-owner.test.ts
Hook bypass: none
Convergence: none
Decision: train184-live-merge | Keep the shared live async child helper; retain train-184 observed-response crash controls and its invocationTimeoutMs fixture API. Rebind the live integration consumer to that API. Preserve newer evidenced catalog timestamps and existing review provenance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-065047-PROGRESS.md

1.x FIRST: Inspected actual JKHeadley/instar origin/main 97dbe39e68471c9295072665e83b0801fb32cc60, src/core/SessionLivenessOracle.ts, docs/specs/test-runner-concurrency-bound.md and git history (5129779c3, f26468ed2); read ONEX-LESSONS section 6. Reuse bounded asynchronous waiting and indeterminate evidence principles through existing 2.0 helpers; no product code transplant is required for this merge conflict.
Prompt review: No new prompt or parser behavior; existing live changes retain their owner review records.

## Closing block

simplestRobustRoute: Reconcile equivalent overlapping test repairs, retaining the stronger observed HTTP response control and one shared async helper. No new runtime machinery or authority. Preserve both histories with a merge commit and regenerate pins through the delegated tools.
80/20: Target conflict files and cheap gates; Studio owns full-run acceptance. No claim of live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
