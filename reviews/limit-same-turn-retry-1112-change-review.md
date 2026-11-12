# Change review — answer a quota-rejected turn on another admitted login

Subject base: df88638c2b5ae94361efd77524e4146880cea2c2
Review state: open
Reviewed content: none
Outcome: A typed, effect-free quota rejection on login A continues the same accepted answer turn on another admitted login. A successful successor produces one answer and no usage-limit/resend notice. Exhaustion uses the pool's earliest known reset.
Affected rules: 4, 26, 34, 36, 41, 42, 49, 55, 57, 58, 60, 61, 63, 65, 70, 74, 75, 76, 77, 87, 88, 95, 100, 101, 102, 111, 112, 113, 116, 123.
Affected floors: secrets — unchanged installed custody and outbound checks; spend cap — every rejected call remains charged and each successor reserves anew; stop — checked around selection and dispatch and before send; no duplicate sends — original intake and existing unique send/UNKNOWN rules; durable intake — the existing journal retains the failure, selection decision and answer.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the decision to replay a paid model attempt and must exclude uncertain output/effects while preserving restart and send safety.
Side effects: The ordinary answer worker may make up to five bounded redispatches across distinct pool members. Reactive selection retains hard quota holds and normal admission without the proactive optimization's extra headroom requirement. A pending retry decision inhibits the minimal limit notice. A consistent empty tool/child trace and one native model call are required for tool-route replay. Format repairs, lookups and uncertain-answer replacements do not gain quota replay. The non-additive capacity-retry frame raises the journal generation to 7; old readers refuse roots containing it. Capacity holds are retained as per-call evidence during compaction. Pool status retains switch records; no new push notice or sender is added.
Undo and recovery: Deploy a compatible reader with retry selection disabled to stop new retries; retain journal and pool records. Do not roll a used root back to a reader that cannot project capacity-retry, and never delete those records to force rollback. Existing holds, unknown calls, sends and accepted input remain authoritative.
Multi-machine posture: Pool membership/holds remain deliberately machine-local under existing owner fencing. Journal retry evidence follows the existing journal replication path, and peer custody is checked before each provider dispatch. No credential transfer or new peer dependency.
Team posture: Original verified private conversation audience and existing disclosure/standing checks; no membership, ownership, sharing or cross-person access changes.
Layer below: Read the production subscription adapter's typed 429/zero-token rejection, tool-turn trace closure and native-loop model count, journal reservation/token settlement/compaction/minimal responder, pool admission/holds/attempt brake and host ownership/stop checkpoints. Reused each instead of creating a retrying provider wrapper or sender.
Bug class: integration
Bug evidence: reproducer=tests/preview/limit-same-turn-retry.test.ts
Hook bypass: none; core.hooksPath unset; common Git hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt or semantic answer grammar changed. The model-facing change is the decision to redispatch after exact provider evidence. Replayed recorded 429 text, zero-token usage and empty trace for update 367056327; recorded answer/review from 367056328; summary, uncertain/undecided Jev, reply-review and delivered/empty-context shapes from existing proof fixtures. No fresh live deployment or independent convergence claimed.
Prompt finding: 105c1569b6bb | protocol-literal | Existing fixed stop/renewal boundary statement, unchanged by this diff; not a model meaning test.
Prompt finding: 4106b49fff07 | protocol-literal | Existing evidence constraint on claiming an attempted avenue, unchanged by this diff.
Prompt finding: 7ef11b68103f | protocol-literal | Existing activation-expiry disclosure, unchanged by this diff.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory rendering contract, unchanged by this diff.
Prompt finding: 85544c20941f | protocol-literal | Existing queued-session outage notice, unchanged by this diff.
Prompt finding: 9f0106c66027 | protocol-literal | Existing unknown-work outcome notice, unchanged by this diff.
Prompt finding: bac6ce7485d9 | protocol-literal | Existing stopped-work outcome notice, unchanged by this diff.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label provenance instruction, unchanged by this diff.

1.x FIRST: Actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, confirmed against GitHub and local origin/main. Searched src/, docs/specs/ and Git path history; read src/core/SubscriptionPool.ts eligibleSiblingAccounts, src/core/QuotaAwareScheduler.ts onQuotaPressure, src/core/QuotaPoller.ts pollOne, src/monitoring/AccountSwitcher.ts serialized credential write, src/monitoring/SessionMigrator.ts executeMigration, src/monitoring/QuotaManager.ts postCollectionChecks, src/monitoring/RateLimitSentinel.ts bounded recovery, and docs/specs/live-credential-repointing-rebalancer.md premise/legacy comparison. Inspected history d57f19c12, b78618707, 3c7d439e8 and 0e5b534b2; read ONEX-LESSONS.md section 4. Carried the reactive decision to continue pending work on a different eligible account, failed-account exclusion, durable holds and bounded attempts. Shared credential rewriting and session killing/migration do not fit 2.0's per-call installed admission: tests/preview/harness-login-pool.mjs already chooses config homes. The new path reuses that selector, journal reservations and unique reply delivery; tests exercise both missing and measured spare capacity.

Decision: retry-at-journal | Keep the failed attempt and the next selection in the existing journal, reusing ordinary reservation/send paths; this covers restart without retrying an uncertain dispatch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-same-turn-retry-1112-build-report.md
Decision: reactive-capacity | Reuse the pool's hard holds and admission with the five-attempt brake, but not proactive extra headroom; an optimization must not strand an answer after a typed quota wall. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-same-turn-retry-1112-build-report.md
Decision: pending-notice | The minimal responder waits for the recorded retry decision, including after restart; terminal no-successor records release the existing notice. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-same-turn-retry-1112-build-report.md
Decision: nonadditive-recovery | Mark the new journal frame non-additive by withholding forward-skip permission; an old reader must refuse changed reservation semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/limit-same-turn-retry-1112-build-report.md

simplestRobustRoute: This is the simplest robust route: use the existing typed failure, durable capacity hold, installed selector, spend reservation and sender. The only new journal decision is necessary to distinguish a replay-safe rejection from UNKNOWN across restart and to keep the minimal notice from racing recovery. Start guards are exact zero-token rejection and no effects; end guards are an answer or recorded no-successor decision; limits are distinct members, five pool attempts, ordinary admission, spend and stop.
80/20: Product changes measure 110 added-plus-deleted lines across the three runtime files, plus 19 documentation lines. Recorded-shape regressions and targeted integration tests cover success, all-limited/earliest reset, uncertainty, effects, restart boundaries, stop, admission, spend and attempt bounds. Pipeline owns full-suite and independent Astra review; no deployed acceptance claim is made here.
VERDICT: author submission; no independent convergence or serving deployment claimed
