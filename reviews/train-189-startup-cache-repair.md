# Change review — train-189 copied-preview startup repair

Subject base: 4aacf683b7012366461b8a720cea4d1b0881eb0e
Review state: open
Reviewed content: none
Outcome: The ordinary tool route can construct its subscription provider after Claude Code writes signed policy-cache metadata or first populates its restrictive cache. The saved turn remains available; no effect is replayed by this repair.
Affected rules: 26, 34, 36, 37, 42, 49, 74, 101, 103, 111, 113, 116
Affected floors: secrets — custody and outbound checks unchanged, public signed-policy metadata is not a credential; spend cap — no new calls or retries; stop — existing launch and dispatch checks; no duplicate sends — no replay or journal mutation; durable intake — retained failed input and existing journal unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repair a deterministic host preflight on an already authorized provider route, preserving managed-policy and hook enforcement.
Side effects: Known signature and accepted-issuance cache sidecars are shape/path/size checked, then excluded from the policy digest. A profile enrolled before cache creation preserves its original digest only while all newly populated cache files pass the existing restrictive schema. Profiles enrolled with cache bindings retain them. Managed settings still change the digest; unknown settings, permissive restrictions and unsafe paths still refuse. The CLI remains responsible for cryptographic signature verification; Instar does not treat the sidecar as authorization.
Undo and recovery: Revert the repair and regenerate source pins/register. This restores the old preflight refusal; retained messages remain intact. Do not resend an uncertain effect.
Multi-machine posture: Machine-local provider cache inspection, using each host's recorded profile; no shared ownership, replication or authority change.
Layer below: Inspected production provider constructor, effective managed-policy and hooks checks, live profile/cache bytes, exact failed turn status, and installed pinned Claude Code 2.1.280 signed-cache helper schemas. Its signature and accepted-issuance files carry cache verification metadata, not effective settings. No serving profile or grant was edited.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Recorded failure: preview-deploy.log 2026-11-05 17:57–18:04 and preserved forum-answer-copy-20261105-175710, update 840344306: model-not-started notice, zero model calls. Read-only profile inspection reproduces unexpected policy-limits.json.signature.json; after repair login identity and managed policy both match the existing profile and hooks remain enabled. Targeted tests replay captured public cache bytes, exercise real synthetic CLI dispatch, and refuse neighboring policy changes.
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model output parser or model decision changes. The failed turn has no model output; this repair replays its real host-cache shape. Summary/Jev/reply-review parsing and delivered-answer logic are unchanged.

Owner provenance: Complete source/tests/fixture reused from 0c1d832a4816aeb21891e5a89242497d12c76fc1; original review base 428b6287201846c206e76be32f066a6b538333e3. This integration binds the review to train-189 without claiming a new independent verdict.

1.x comparison: Searched actual JKHeadley/instar origin/main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc src/ and docs/specs/ for launch/spawn failures, policy-limits, policyLimits and remote-settings.json; searched git history with -G for policy-limits|remote-settings.json. No matching cache implementation in those inspected paths. Related src/core/SessionManager.ts handleReadyAndInject retains a startup failure and retries stale resume once; docs/specs/cli-login-expired-opens-repair.eli16.md and commit 7da5a52ff corroborate real login failures instead of trusting labels. Read ONEX-LESSONS section 4. No 1.x code transplanted: the exact fit is existing 2.0 subscriptionServerPolicy, including its separation of cache freshness from effective policy. A model retry cannot repair this pre-dispatch failure.

Decision: TRAIN189-CACHE-OWNER | Reuse complete owner 0c1d832a source/tests/public fixture for the independently reproduced identical cache refusal; no competing implementation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-189-repair-PROGRESS.md

Independent 1.x comparison: Actual main 67f96999fcde01181533d954a165b5db2abc1856 src/ and docs/specs/ plus git history searched for policy-limits/remote-settings, no matches. Read SessionManager.ts ensurePinnedHomeInteractiveReady, docs/specs/cli-login-expired-opens-repair.eli16.md, history 4e38b9fda/c579b0841/e460a9be3 and ONEX sections 2/4/5/6. Readiness for the actual launch profile fits; 1.x has no fitting signed-cache inspector in the searched paths. Reuse the existing 2.0 owner repair and its checkpoint protections.

Verification: tsc/build exit 0; the two affected files pass 122/122 tests in 221.90 seconds; actual profile identity and policy match with hooksDisabled=false. Existing desk --renew runs the native contract before (9/10, only stale certificate) and after (10/10); renewal exits 0. Owner rehash/repin exit 0. Required final cheap-check results are appended to the cited progress record. The automatic Studio answer/full-test gate remains outstanding; no fresh full-run report is claimed.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing inspector for observed metadata and restrictive first-fetch compatibility. It prevents deterministic refusal before any model launch without a retry loop, new verifier or reauthorization ceremony. Existing malformed-policy, identity, hook, cap, stop, durable-intake and effect guards remain. The desk's new answer check supplies unattended shipped-path acceptance; this record claims no live answer yet.
80/20: Only tsc, the two changed test files and required cheap gates run here; the Studio pipeline owns the full test suite and new answer check.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
