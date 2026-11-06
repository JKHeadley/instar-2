# Change review — settle cancelled claims and keep owner-fixture IPC responsive

Subject base: 7ef1ab43fe974d468c72c51dadbb1332993c5344
Review state: open
Reviewed content: none
Outcome: Settle a dispatch claim as refused when cancellation or stop occurs after admission but before physical dispatch; verify every claim against its outcome and physical sends. Remove repeated blocking Git reads from the intake owner manifest matrix.
Affected rules: 13, 26, 31, 37, 42, 49, 60, 61, 63, 70, 74, 87, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — still refuses before physical dispatch and now settles any acquired claim; no duplicate sends — claims remain consumed even when refused, tests reject duplicate or unknown outcomes; durable intake — replication and cursor requirements unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The shipped journal launcher consumes ownership claims at the send boundary; its cleanup is runtime behavior even though the path is under tests/preview.
Side effects: A post-claim refusal now calls the existing outcome recorder and may wait for its bounded authority request. Failed outcome delivery uses the existing retry queue; a stale fence stays refused. Authority claim totals can legitimately exceed physical sends, but only a journal-evidenced cancelled acknowledgement explains the extra in these tests. No claim is refunded or replayed. Async fixture setup preserves a real Git commit and all hash checks; failures still fail the test.
Undo and recovery: Revert this change and regenerate the ordinary source pins. No migration or durable history rewrite is needed. Existing historical unresolved claims are not relabeled or resent; the fix prevents new omissions.
Multi-machine posture: The fix settles the original claim through the shared authority even when an acknowledgement becomes obsolete while its response is in flight. Two real runner processes, a real authority process, replica HTTP and the original stale-owner restart proof remain exercised. Git fixture caching is local to one test and one immutable commit.
Layer below: Read journal-agent's send callback, createReplicatedDispatch admit/outcome/flush, authority claim/outcome replay, held-notice status, Telegram fixture reaction refusal and physical send log. Found the post-admit guards outside the outcome-finally block. Read loadOwnerReferences artifact validation and register-source readCommit's committed-blob cache/show port; caching bytes never caches validation results.
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none; core.hooksPath unset and shared hooks directory contains sample files only.
Convergence: none
Prompt review: No model instruction, model output parser, acceptance policy or provider choice changes. The fixture's bounded model barrier controls timing only; it returns exactly the existing bytes. No recorded model-shape replay is needed for this transport cleanup.
Decision: train-192-claim-finalization | Extend the existing try/finally over post-claim cancellation and stop guards, recording refused before returning; no new retry or authority mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-043150-PROGRESS.md
Decision: train-192-claim-accounting | Reconcile authority records, journal refusal evidence and physical sends instead of equating different quantities; retain exact claim uniqueness and no-unresolved/no-unknown checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-043150-PROGRESS.md
Decision: train-192-bounded-fixture | Use the existing bounded async child helper and loader show port to read each actual committed artifact once; preserve the 60-second deadline and every mutation assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-043150-PROGRESS.md
Decision: train-192-repin | Refresh derived source pins with the supplied desk tools and register replay; do not hand-edit hashes or claim a new native certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-043150-PROGRESS.md

## 1.X FIRST

Inspected JKHeadley/instar origin/main snapshot 028483097cb0a835a7d1264680a44dc4c2acb063: src/core/hostTestRunnerSemaphore.ts, docs/specs/test-runner-concurrency-bound.eli16.md, src/ and docs/specs/ searches for worker starvation and acknowledgement cancellation; history 1f90fa1a9, 618560b3e and e1a1b7218. The host semaphore bounds competing suites, but cannot repair repeated blocking reads inside one worker. Reuse bounded execution through 2.0's existing async child helper and committed-blob reader port, not another semaphore. The inspected 1.x sources do not provide this 2.0 authority-claim protocol. ONEX-LESSONS sections 1 and 6 (available desk-index copy in the builder evidence) require proving actual ownership effects, aggregate resource bounds and consumer wiring. Preserve the real failover proof and use its authority log, rather than an ownership label.

## Evidence and limits

The original supplied gate remains red: two failing tests and one unattributed worker RPC timeout. Both original files pass unchanged here (30 tests, 222.23 seconds); that rerun is not exoneration. A controlled real-process race then fails before the runtime repair with claims=2 and an unresolved held-notice claim despite the journal's cancellation and one physical answer. The same race passes after repair. The proxy delays only the successful acknowledgement claim response until the answer's claim starts, with a four-second ceiling; a bounded model barrier arranges the race without CPU load. Negative accounting cases reject missing, duplicate, unrelated and unknown outcomes. Full gate qualification remains with the pipeline; the runner defect stays OPEN.

simplestRobustRoute: This is the simplest robust route: widen an existing finally block, check existing durable outcome evidence, and remove redundant fixture subprocess reads through an existing port. Start guards, ownership fences, replication, stop and budget checks remain; terminal outcomes and physical sends are tested separately. No new runtime component, deadline increase, skip, quarantine, or autonomous completion claim.
80/20: Run the changed targeted files and required cheap gates at one worker; the pipeline owns full-suite qualification. The repair does not close the unrelated CB6-MF-A, CB7-R90 or CB1-MF5 acceptance gaps.
VERDICT: author submission; no independent verdict or live acceptance claim
