# Change review — restore train-182 subscription startup after cache refresh

Subject base: c9278c8748dc820c49c10d0429d8f6e656a221dd
Review state: open
Reviewed content: none
Outcome: Reuse owning repair 0c1d832a4816aeb21891e5a89242497d12c76fc1 so the authorized tool route accepts the pinned CLI's signed-cache metadata without changing effective policy or issuing another grant.
Affected rules: 26, 34, 36, 37, 42, 49, 60, 69, 70, 74, 90, 101, 102, 103, 105, 107, 111, 113, 116
Affected floors: secrets — custody and outbound checks retained; spend cap — no new calls or retries; stop — launch/dispatch checks retained; no duplicate sends — no replay or copied/live journal mutation; durable intake — failed turn remains recorded.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Reuse an existing bounded provider-preflight repair and verify it on the failing train.
Side effects: The exact known signature/issuance schemas are checked for shape, path and size, then excluded from the effective-policy digest. Restrictive first-fetch cache preserves pre-cache enrollment; cache-bound profiles retain their bindings. Unknown/permissive policy, unsafe paths, changed identity and disabled hooks remain refused. CLI cryptographic verification remains the CLI's responsibility; metadata never grants Instar authority. Native composition certification is renewed only through the existing actual before/after contract tool.
Undo and recovery: Revert this repair and regenerate the register/pins. The prior refusal returns; retained messages are intact. Never resend an uncertain effect.
Multi-machine posture: Machine-local cache/profile inspection; code and declarations travel through git. No ownership, peer, replication or authority changes.
Layer below: Read-only preserved-copy status and decoded tool trace; actual configured profile inspector; owning patch and captured-cache tests; provider constructor and managed hook checks; native composition derivation and desk renewal tool. No serving profile, grant or runner modified.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Recorded failure: 2026-11-05 20:58-20:59 check on c9278c87, copy forum-answer-copy-20261105-205808, update 367055169 (Telegram 2215 -> 2216). Zero model calls/resource admissions; empty consistent tool trace, then model-not-started hold. Current read-only actual profile reproduced unexpected policy-limits.json.signature.json. The old exception was discarded; this reproduction supports attribution, not a claim it was retained. After applying the owner, existing identity and policy digest match with hooksDisabled=false. No new delivered-answer claim.
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser or model judgment changes. Failed update has no model output; the tests replay real host-cache bytes captured for owner update 840344298. Summary, Jev, reply-review and delivered-output parsers are unchanged.

1.x comparison: Searched actual JKHeadley/instar origin/main 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34 src/ and docs/specs/ plus git history for policy-limits|policyLimits|remote-settings.json; no matching cache implementation in those inspected references. Inspected src/core/SessionManager.ts launch failures and history 4e38b9fda/c579b0841/e460a9be3, src/server/AgentServer.ts:7521-7545, src/scheduler/MentorOnboardingTick.ts:190-213, docs/specs/MENTOR-STAGE-A-ROBUSTNESS-SPEC.md and its history ab26b7ca3. Read ONEX-LESSONS areas 2 and 4. Reuse diagnostic discipline, not tmux/retry machinery: a deterministic constructor refusal cannot be repaired by a model retry. Inherit owner's cc11e45f92e2590dd1bbd3c3facb5b849532f0fc comparison in train-175-policy-cache-repair.md. Whole existing 2.0 owner patch fits; no 1.x source transplant.

Decision: train182-cache-owner | Reuse complete owner 0c1d832a source/tests/fixture, with historical review rebound to this ancestry. Acceptance: real captured cache and refusal neighbors, actual unchanged profile identity/policy match with hooks enabled, then pipeline answer check. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md
Decision: train182-native | Renew the changed composition only through the existing Studio tool and actual before/after contract. Derived pins and committed-source register replay follow; no manual pin or certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md

Verification: Current results are retained in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md and train-182-repair-*.log. Typecheck/build pass; both affected files pass 122/122 tests (72.95s); actual profile readiness is restored and its cache bytes equal the fixture. Desk native renewal passed before 9/10 (stale certificate only) and after 10/10, exit 0. Final cheap gates are required before publication. Full suites/new live answer remain the automatic pipeline's checks under this repair brief.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the complete existing owning repair at the cache inspector, preserving authority, effective-policy, hook, cap, stop and effect checkpoints. No additional retry, verifier or permission ceremony. Actual unattended delivered-answer acceptance belongs to the automatic pipeline, not this read-only reproduction.
80/20: Run the affected tests, TypeScript, required native certificate contract and cheap gates; do not run full suites or fetch a saved full report.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
