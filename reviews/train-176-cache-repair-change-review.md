# Change review — restore train-176 subscription startup after signed-cache refresh

Subject base: b8170121555ada94a5be46e78f21dc09fa050e74
Review state: open
Reviewed content: none
Outcome: Reuse the existing signed-cache repair so the authorized model route can start with the proof-room profile, preserving all policy and effect checkpoints.
Affected rules: 24, 26, 34, 36, 37, 42, 49, 69, 70, 74, 101, 102, 103, 111, 113, 116
Affected floors: secrets — custody and outbound checks unchanged; spend cap — no new calls or retries; stop — existing admission remains; no duplicate sends — no replay or journal writes; durable intake — failed input stays retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Native conformance renewal accompanies integration of the complete owning prelaunch repair, with captured-cache regression evidence and unchanged production authority.
Side effects: Known signature/issuance metadata is validated and excluded from effective policy digests. Restrictive first-fetch caches preserve pre-cache enrollment only after schema validation. Existing cache-bound enrollment, identity, managed policy and hooks remain checked. The CLI verifies signatures; metadata grants no Instar authority.
Undo and recovery: Revert this repair and regenerate publication. This restores the prior startup refusal; never replay uncertain effects. No live profile, grant or runner is changed.
Multi-machine posture: Machine-local profile inspection and foreground tests, using each machine's existing profile; no ownership or replication changes.
Layer below: Read-only status of forum-answer-copy-20261105-183312 identifies update 840344310, model-not-started, no model-call rows, and an API-accepted infrastructure notice. The actual profile inspector reproduces unexpected policy-limits.json.signature.json before dispatch. Complete owner 0c1d832a4816aeb21891e5a89242497d12c76fc1 supplies the source, tests and public captured bytes. Its positive and malformed/policy/hook negative neighbors remain intact.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
Prompt review: No model prompt, output parser or semantic accept/escalate/refuse change. Update 840344310 produced no model output; replay is of its actual host-cache shape, including the owner's capture from update 840344298. Summary/Jev/reply-review/delivered-answer logic is unchanged.

1.x comparison: Inherit owner comparison at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc and independently search actual JKHeadley/instar main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/ and docs/specs/ plus git history for policy-limits, policyLimits and remote-settings.json. No matching signed-cache implementation in those searched paths. Inspected src/core/SessionManager.ts startup/actual-directory readiness, docs/specs/cli-login-expired-opens-repair.eli16.md and history 4e38b9fda/c579b0841/e460a9be3/7da5a52ff; read ONEX-LESSONS section 4. Fit: inspect the actual launch profile and preserve failed startup. No 1.x transplant fits the cache parser; reuse the complete existing 2.0 owner. The inherited register comparison uses 22463d0b6a372aedb33f5f1b756e13bae89ab807 src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md, rechecked at 9b5790e8 with history 1f90fa1a9/618560b3e/c91b8780e/681f86543 and ONEX-LESSONS section 6. Bounded foreground execution fits; no register fixture change is needed.

Decision: T176-CACHE | Reuse the complete owning repair for the identical prelaunch cache refusal; no competing implementation, retry, new credential or ability restriction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-176-repair-PROGRESS.md

Verification: The supplied register bridge case passes unchanged with every positive and negative control (46.615 seconds). After owner adoption, read-only inspection of the unchanged real profile reports identityMatches=true, policyMatches=true, hooksDisabled=false. Runtime, both test files and both captured-fixture files match owner 0c1d832a4816aeb21891e5a89242497d12c76fc1 byte for byte. Serial nice-10 runs pass all 17 portable signed-cache cases and the three directly changed provider cases (102 unrelated cases deliberately filtered), under original limits. Build and typecheck pass. Exact /Users/Shared/instar-harness/profile-sagemind-justin.json remains sha256:3a0fbd48e1f23762b20d4f379e51756dd6543c577652f1660c018c499c30c54f; identityMatches=true, policyMatches=true, hooksDisabled=false, zero provider calls. Native renewal on Darwin/node24.14.1 ran the actual contract: before 9/10 with only stale composition certificate, after 10/10; existing desk tool renewed only that conformance field. Architecture exits 0. Prior partial test output is retained as incomplete, never a pass. Desk rehash/repin found zero artifact changes. Register replay binds source 151ff597978ded6df93ff77a4019c76ac226fd4a, generation sha256:34f2611d803cfcb041e15dc7b8ef5dc2c3aaf7d10491b498b084577be2af0e3e; its 298 entries and 121 rules retain shape-only authority. Final lint/register/review and pinned gate results are recorded in PROGRESS. A new live answer and full test report belong to the automatic Studio pipeline; none is claimed here.

## Closing block

simplestRobustRoute: Reuse the one existing bounded inspector repair and captured regression suite. This prevents a demonstrated prelaunch refusal while retaining policy, identity, hook, secret, cap, stop, durable-intake and effect safeguards. No additional runtime machinery or model retry is introduced. The normal desk answer check still owes the new unattended shipped-path result; no release or live-answer claim is made.
80/20: Build, typecheck, captured-cache and directly changed provider cases, native contract and mandatory pinned gate files supply local evidence; the prior exact register-case result is retained. Final lint/register/change-review checks qualify publication. No full suite or unrelated media/generic fixture run occurs. Browser observation faults and missing capacity are separate desk diagnoses, not repaired or excused by this source change. Normal full/native/independent/installed/live gates remain owed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
