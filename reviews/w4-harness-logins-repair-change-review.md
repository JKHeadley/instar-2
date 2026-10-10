# Change review — Restore harness account availability

Subject base: 814e8b34ec7d7d2e184251434585560a398da01b
Review state: open
Reviewed content: none
Outcome: Unknown session-limit holds recover durably from newer complete account-matched capacity observations under the existing configuration. Malformed optional quota rows are unavailable evidence instead of throwing before admission.
Affected rules: 1, 4, 26, 32, 37, 41, 42, 44, 45, 49, 52, 53, 57, 58, 60, 61, 70, 74, 75, 77, 95, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing owner-only custody; spend cap — unchanged shared reservations; stop — existing per-call/member validation; no duplicate sends — no failed-call or uncertain-step replay and existing notice deduplication; durable intake — unchanged journal and fsynced selection writes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs account admission and its persistent capacity evidence; declaration update documents the new recovery path.
Side effects: Holds retain observation timestamps. Pre-repair holds acquire a durable timestamp once on reopen and require a subsequent capacity reading. Newer complete below-threshold evidence can release an unknown hold; known active reset horizons, incomplete evidence and authority refusal remain enforced.
Undo and recovery: Revert the repair commits with ordinary reviewed git history. Preserve runner state and journals; old readers tolerate the additional timestamp. Such rollback restores the old unknown-hold defect, so prefer a source correction over rollback. Failed recovery writes propagate and leave the in-memory hold intact.
Multi-machine posture: Deliberately runner-local evidence under the existing root writer lease. Every host retains its own account identity, profile, quota snapshot, custody and admission grants. No new replication or account sharing.
Layer below: Inspected durablePreviewWrite atomic rename/file and directory fsync; selector validates each chosen member after capacity reconciliation; harnessQuotaReading retains exact account/home or reviewed account-id binding and unique matching; observeHarnessSessionLimit continues preserving the original pause observation. Existing shared cap, stop and effect doorway are unchanged.
Bug class: durability
Bug evidence: reproducer=tests/preview/harness-login-pool.test.ts exhausts both session accounts and proves recovery after eight days plus stale/incomplete/mismatched negatives and malformed-row neighbors; restart=the same file proves reopen recovery, durable hold removal, legacy timestamp migration and failed-write preservation
Hook bypass: none
Convergence: none
Decision: HL-R1 | Reuse quota observation and the existing durable sidecar; timestamp holds to refuse older capacity evidence and migrate legacy holds once. Both windows must establish capacity, and known active horizons remain held. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-harness-logins-repair-PROGRESS.md
Decision: HL-R2 | Validate optional quota row/date shapes at observation decoding; preserve authority and persistence failures. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-harness-logins-repair-PROGRESS.md
Prompt review: No prompt or model-output parser changes. Real recorded summary, uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty recorded-context bytes traverse the repaired recovery path unchanged; provenance/update IDs are in PROGRESS. Captured provider-limit bytes still drive the initial exhaustion. The empty candidate is not claimed as an actually delivered empty bubble.

## Closing block

simplestRobustRoute: Extend the existing selector and fsynced sidecar with a freshness timestamp and complete capacity release predicate, plus null-safe optional quota decoding. The timestamp prevents old low quota readings from releasing newer provider limits. Existing identity, activation, stop, caps and effect checks remain the admission boundary; no new retry machinery or configuration ceremony.
80/20: 33 focused tests, typecheck, build and architecture pass. Cases include live-object/reopened recovery, legacy migration, all evidence-negative neighbors, known weekly holds, malformed snapshots, persistent write failure and recorded-output preservation. Full suite belongs to the automatic pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
