# Change review — train-192 signed-cache integration

Subject base: 5fc6ac04495c026ddb042a331c4b6185d6c43471
Review state: open
Reviewed content: none
Outcome: Integrate the existing signed-cache owner repair into train-192, retaining the main constitution and sole model-map member f13659070a873b2e157cead4a93cfa095966167e exactly. Source integration only; acceptance gates are outstanding.
Affected rules: 26, 34, 36, 37, 42, 49, 56, 70, 74, 101, 102, 107, 111, 112, 113, 116, 119
Affected floors: secrets — no credentials or grants changed; spend cap — no added provider calls or retries; stop — existing launch and dispatch checks; no duplicate sends — no replay or sends; durable intake — retained inputs unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing production preflight repair with exact owner bytes and targeted consumer verification.
Side effects: Signature metadata passes the owner's bounded checks and is excluded from effective policy digests. Pre-cache enrollment remains usable only with the existing restrictive schema; cache-bound profiles keep their policy/identity bindings. Unknown, malformed, permissive and unsafe cache files refuse. The CLI owns cryptographic verification. Generated pins/publication follow committed source; model evidence timestamps and expiry remain unchanged.
Undo and recovery: Revert the additive repair commits and regenerate existing pins/register. Original history is retained. Do not repeat uncertain effects.
Multi-machine posture: Machine-local cache inspection against each host's enrolled profile, deliberately; code and fixtures distribute through git. Native macOS validation belongs to Studio.
Layer below: Both constitutional documents, existing train-192 and owner records, subscriptionServerPolicy/createSubscriptionProviderIO, captured signature fixture and dispatch consumer inspected. Current read-only profile discriminator shows rejection on train-192/train-178 and acceptance on train-180 with matching identity/policy and enabled hooks. No profile or credentials accessed remotely.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/answer-desk-2134/profile-discriminator.json
Recorded failure: At 2026-11-06T05:35:15.492Z train-192/train-178 refuse policy-limits.json.signature.json as unexpected; train-180 accepts the same named profile. This is current evidence. The owner fixture separately attributes its captured shape to update 840344298.
Hook bypass: none
Convergence: none
Prompt review: Model prompts, output parsers and model judgments are unchanged. The targeted test replays the owner's real public cache capture. This local code record is not an operator specification approval request.

1.x comparison: Owner research at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc is supplemented by a fresh fetch of actual JKHeadley/instar main 13e4f75507520aa6c43c0aec006b7ec2fbd28332. Searched src/ and docs/specs/ with git grep policy-limits|policyLimits|remote-settings.json and their git history with -G policy-limits|remote-settings.json. These specific queries returned zero matches. Separately inspected src/core/SessionManager.ts handleReadyAndInject and docs/specs/cli-login-expired-opens-repair.eli16.md plus ONEX-LESSONS section 4: readiness retains failed input and login repair corroborates actual account failure. Those related mechanisms address different causes from this deterministic preflight refusal; reuse existing 2.0 subscriptionServerPolicy owner patch, without adding retry or a new parser. This is a bounded fit comparison across current source, history, design and lessons, not a general absence claim.

Decision: train-192-repair-owner | Cherry-pick only 0c1d832a4816aeb21891e5a89242497d12c76fc1. Preserve owner record as attributed history and verify all five named source/test/fixture files and owner review byte-identically. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-2136-PROGRESS.md
Decision: train-192-repair-checks | Run only signature tests and exact restrictive-cache dispatch case, serial nice 10 maxWorkers 1, build/typecheck and cheap checks. Preserve red output and leave native/full/install/live acceptance to Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-2136-PROGRESS.md
Decision: train-192-repair-replay | Apply existing desk rehash/repin tools with specified Linux sed adaptation; replay register from committed source. Constitution and model evidence remain exact. Native certificate renewal stays desk-owned. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-192-repair-2136-PROGRESS.md

Verification: Build/typecheck and 17 signature tests pass. The selected dispatch assertion remains red (expected complete, got uncertain at line 438); a traced rerun records /bin/sh rejecting ulimit -u and exiting 125 before the synthetic CLI. No source/test changed to hide it. Architecture reports only the native macOS composition certificate. Desk repin/rehash changed zero pins. Register replay from committed 4c439af634baeb9ad122ce8b826b002368b3e4b0 produced generation sha256:7336f35a327cdb89813a3b3c6b052f574354c4dcd7781c20a9a7558042accf04 (298 entries, 121 rules, 34 terms, 113 prerequisites). The launcher report retains all outputs and remaining checks; Studio synchronizes its local reports before its check.

## Closing block

simplestRobustRoute: Exact existing owner patch plus its consumer tests is the simplest route to repair the observed preflight rejection. No new machinery. Start guards are published base and owner; end guards are exact bytes, captured shape, dispatch and cheap checks. All five floors stay held; no live completion is claimed.
80/20: Finite 45-minute source repair with the specified narrow tests. Full/native/combined independent/reopened-round/install/live acceptance remains owed to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
