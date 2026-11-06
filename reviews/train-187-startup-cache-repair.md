# Change review — train-187 signed-cache startup repair

Subject base: 75b3d2a67d5deeb45d18c3921da0856052bfecbb
Review state: open
Reviewed content: none
Outcome: Restore construction of the existing subscription route after the pinned CLI refreshes signed cache metadata, by reusing owning repair 0c1d832a4816aeb21891e5a89242497d12c76fc1 in full. The saved input and all checkpoint protections remain.
Affected rules: 26, 34, 36, 37, 42, 49, 60, 70, 74, 101, 103, 111, 113, 116
Affected floors: secrets — custody and outbound checks retained; spend cap — no new calls or retries; stop — existing launch and dispatch checks retained; no duplicate sends — no effect replay; durable intake — existing saved turn retained.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repair the actual prelaunch failure on the authorized model route using the already owned source repair.
Side effects: Known signed-cache sidecars pass bounded schema/path/size checks without changing effective policy. Restrictive cache arrival preserves pre-cache enrollment; cache-bound profiles retain their existing stricter bindings. Managed hook disablement, unknown settings and unsafe files still refuse. No capability is removed. Native conformance is renewed only through the existing desk tool and its real before/after contract.
Undo and recovery: Revert the imported source repair, regenerate pins/register and renew native conformance through its contract. This restores prelaunch refusal. Do not replay uncertain effects or mutate the preserved copy.
Multi-machine posture: Machine-local profile/cache inspection on each host; source distributed through git. No new store, ownership or peer dependency.
Layer below: Read full constitution, preserved copy status, actual profile inspection, subscription constructor, host inspector and exact owner patch/review. The copy records update 367055158 held before any model call or resource launch; current unchanged profile inspection reproduces unexpected policy-limits.json.signature.json before repair and identityMatches=true, policyMatches=true, hooksDisabled=false afterward. The original exception is not retained; this is supporting reproduction, not a claim of a captured exception.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Subject (6 paths): src/assembly/harness.declarations.json, scripts/production-boot-io.mjs, tests/assembly/production-provider-subscription.test.ts, tests/assembly/subscription-policy-signatures.test.ts, tests/fixtures/claude-signed-cache-2026-11-05/README.md, tests/fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json

1.x comparison: Independently searched actual JKHeadley/instar main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/, docs/specs/ and git history for policy-limits|policyLimits|remote-settings.json; no matching cache implementation in those inspected paths. Read src/core/SessionManager.ts startup handling and history 4e38b9fda/c579b0841/e460a9be3, docs/specs/cli-login-expired-opens-repair.eli16.md, forkbomb-prevention-simple.md and ONEX-LESSONS sections 4/6. Inherit owner's cc11e45f92e2590dd1bbd3c3facb5b849532f0fc comparison and 7da5a52ff. Actual host readiness fits; the tmux and account recovery implementations do not repair this pre-child cache schema. Reuse whole 2.0 owner 0c1d832a source/tests/recorded cache, not a competing implementation.

Prompt review: No model prompt, output parser or model decision changes. Failed update 367055158 has no model output. Tests replay the owning public host-cache capture from proof-room update 840344298; summary/Jev/reply-review parsing and delivered-answer handling are unchanged.

Decision: train187-cache-owner | Reuse the full existing owning source repair for the reproduced profile-cache refusal, retaining policy/hook checks and machine-local state. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

Verification: typecheck/build exit 0; two affected test files pass 122/122 in 138.25s (nice 10, one worker). Actual unchanged profile identity/policy match, hooks enabled. Imported source/tests/fixtures are byte-identical to owner 0c1d832a. Native desk renewal passed: before 9/10 (stale certificate only), after 10/10; evidence at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-native/{before,after}.json. Native declaration changed only through that successful contract.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the entire existing owner repair in the current bounded inspector. No competing parser, retry, reauthorization or capability restriction. Start guard is exact profile and activation validation; end guard is admitted provider construction with unchanged identity/policy and hooks enabled; limits remain existing resource, stop, spend, durability and effect checkpoints. Automatic pipeline supplies the new unattended answer check; this submission claims no new live answer.
80/20: Run tsc/build, the two affected test files, required native renewal contract and cheap gates. The specific repair instruction leaves full suites and new live answer to the automatic Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
