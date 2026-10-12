# Change review — Reuse a successful pinned CLI version check

Subject base: 0ad24acde52ed92a98dbbb081afa708b3c24bc66
Review state: open
Reviewed content: none
Outcome: One runner reuses a successful CLI version check for the same complete pinned profile, including executable artifact and expected version. Each invocation still checks current executable bytes, authority, stop, login identity and auth status before the model command.
Affected rules: Purpose durable cause and least revelation; Rules 1/26/28/32/34/39/42/49/51/55/60/63/74/77/101/102/111/113/116.
Affected floors: Secrets — no credential output enters the cache or diagnostics; spend cap — no model route, budget or retry change; stop — current command admission still checks it; no duplicate sends — untouched; durable intake — untouched.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Reuses a physical preflight observation while retaining all current authorization and identity checks.
Side effects: A single process-local slot shares an in-flight or successful version check across per-operation routes. Different profile digests replace it; failed checks clear only their own slot. Auth status remains uncached and no model command is repeated. The route owns a private slot when the runner does not supply one. The runner's existing invocation and process ceilings bound concurrency. The part A review's abbreviated base is corrected to its full commit id.
Undo and recovery: Revert the cache and runner binding to launch version on every invocation again. Restart naturally discards this disposable observation. No migration, journal rewrite, authority grant or live-root access is involved.
Multi-machine posture: Deliberately runner-local: each machine must inspect and check its own executable and profile. The cache is never persisted, replicated or used as authority. Existing conversation ownership and journal replication remain unchanged.
Layer below: Inspected command admission, physical digest validation, frozen subscription profile custody, current activation validation and auth status parsing. Tests launch a real synthetic CLI on WSL through a bounded test IO; production launch/confinement proofs remain the Studio's platform-specific gate.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-provider-subscription.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: speedtrace-b-version-scope | One complete-profile-keyed slot per runner reuses successful version checks; no authority, identity, auth-status or model outcome is cached. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speedtrace-1012-PROGRESS.md
Decision: speedtrace-b-portable-proof | Exercise the new version behavior with a bounded real synthetic executable on WSL; keep Darwin resource-owner and conformance limitations explicit rather than changing those floors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/speedtrace-1012-PROGRESS.md
Prompt review: No model prompt, output parser, model selection or semantic acceptance path changes. Version and auth wire formats are unchanged. Existing captured-frame tests remain the model-facing regression evidence.

## Closing block

simplestRobustRoute: This is the simplest robust route: one in-memory checked-version slot supplied by the existing runner, with the complete profile digest as identity and no timer, persistence or worker. It prevents repeated identical version processes while current authority, digest, login, stop and deadline checks remain at command dispatch. No autonomous production completion is claimed.
80/20: New same-profile, changed-artifact/profile, revoked-authority, changed-login/auth and failed-version tests plus direct import and required machine checks. No full suite or real provider login is needed for the version-cache decision.
VERDICT: author submission; independent judgment belongs to the desk
