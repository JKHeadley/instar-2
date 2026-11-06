# Change review — keep reviewed subscription profiles usable after cache refresh

Subject base: fa960553940238a2dfad9bb28348fd63d3047799
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
Recorded failure: preview-deploy.log 2026-11-05 09:07:16 and preserved forum-answer-copy-20261105-090637, update 840344298: model-not-started notice, zero model calls. Read-only profile inspection reproduces unexpected policy-limits.json.signature.json; after repair login identity and managed policy both match the existing profile and hooks remain enabled. Targeted tests replay captured public cache bytes, exercise real synthetic CLI dispatch, and refuse neighboring policy changes.
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model output parser or model decision changes. The failed turn has no model output; this repair replays its real host-cache shape. Summary/Jev/reply-review parsing and delivered-answer logic are unchanged.

1.x comparison: Searched actual JKHeadley/instar origin/main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc src/ and docs/specs/ for launch/spawn failures, policy-limits, policyLimits and remote-settings.json; searched git history with -G for policy-limits|remote-settings.json. No matching cache implementation in those inspected paths. Related src/core/SessionManager.ts handleReadyAndInject retains a startup failure and retries stale resume once; docs/specs/cli-login-expired-opens-repair.eli16.md and commit 7da5a52ff corroborate real login failures instead of trusting labels. Read ONEX-LESSONS section 4. No 1.x code transplanted: the exact fit is existing 2.0 subscriptionServerPolicy, including its separation of cache freshness from effective policy. A model retry cannot repair this pre-dispatch failure.

Decision: train-175-cache | Reuse the existing bounded cache inspector; recognize only the pinned CLI's signature/issuance schemas. Keep cryptographic verification with that CLI and enforce Instar authority at the existing profile, hook and effect checkpoints. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md
Decision: train-175-enrollment | A digest enrolled before any cache already permits the baseline: arrival of a cache that only restricts it cannot widen authority. Preserve that digest only after every cache check succeeds. Preserve stricter cache-bound enrollment when it exists. No new grant or profile mutation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-repair-PROGRESS.md

Historical owner verification (not a new train-186 run): tsc and build pass. Both changed test files pass (122 tests); recorded host profile matches its existing identity and managed digest with hooks enabled. Architecture reports only the charter-exempt native macOS self-host composition certificate. Source pins and register are regenerated with the delegated desk tools. The automatic Studio answer/full-test gate remains outstanding.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing inspector for observed metadata and restrictive first-fetch compatibility. It prevents deterministic refusal before any model launch without a retry loop, new verifier or reauthorization ceremony. Existing malformed-policy, identity, hook, cap, stop, durable-intake and effect guards remain. The desk's new answer check supplies unattended shipped-path acceptance; this record claims no live answer yet.
80/20: Only tsc, the two changed test files and required cheap gates run here; the Studio pipeline owns the full test suite and new answer check.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
