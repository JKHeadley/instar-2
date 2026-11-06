# Change review — integrate the owned signed-cache repair on train-183

Subject base: 76461ffc1e666a765432814b56c98269ceb8278e
Review state: open
Reviewed content: none
Outcome: The already-admitted room3 subscription profile passes the existing pre-child cache inspection after signed metadata arrives, with its identity, policy and hook enforcement intact.
Affected rules: 26, 34, 36, 37, 42, 49, 70, 74, 101, 105, 111, 112, 113, 115, 116
Affected floors: Secrets remain in custody; spend caps and stop checks unchanged; no retries or duplicate sends added; accepted intake and retained failure evidence remain durable.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Reuses the exact owned production preflight repair, preserving the two completed source-repair obligations and all historical evidence.
Side effects: Signature and issuance sidecars are bounded metadata, never authority. Restrictive first-fetch cache arrival preserves pre-cache enrollment; enrolled cache bindings remain bound. Unknown/permissive policy, unsafe files, identity mismatch and disabled hooks still refuse. Only native composition evidence and generated publication may change beyond owner files and these reviews.
Undo and recovery: Revert this integration and regenerate source evidence; retain accepted turns and never resend unknown effects. The desk owns live qualification and installation.
Multi-machine posture: Machine-local installed profile/cache inspection; shared implementation travels through git. No ownership, authority or replication change.
Layer below: Desk actual-profile differential at pipeline/train183-desk-1633/profile-readonly.json and its source script; owning full patch, cache fixture, existing provider and managed-hook boundaries; source and native composition publication mechanisms.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/train183-desk-1633/profile-readonly.json
Hook bypass: none; hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: No model-facing prompt, output parsing or semantic decision changes. Update840344304 has no model call or output; tests replay real public host-cache bytes. The previous65 passes remain historical evidence for the two source repairs, not fresh acceptance of this integration. Captures, rubrics, digests and historical PASS/FAIL stay unchanged.
Decision: train183-cache-owner | Cherry-pick --no-commit exact0c1d832a4816aeb21891e5a89242497d12c76fc1; retain five source/test/fixture files byte-identical and adapt owner review ancestry only. No train175 ancestry or unrelated riders. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-PROGRESS.md
Decision: train183-cache-publication | Use existing owner repin, native renewal and register generation only as required by this source composition. Full/independent/answer/installed/two-runner/live acceptance remains desk-owned, row40 OPEN. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-PROGRESS.md

Recorded cause: Original room1 update367055149 is provider429 weekly quota, zero tokens. Already-admitted room3 update840344304 instead stops before the model. The exact same actual-profile read refuses unexpected policy-limits.json.signature.json on76461ffc but matches identity and managed digest with hooks enabled on669e02ab. This is the discriminating dependency evidence; no account/grant/profile/model mutation or provider call is needed.

1.x comparison: Inherit owner research at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc, src/core/SessionManager.ts, docs/specs/cli-login-expired-opens-repair.eli16.md, history7da5a52ff. Independently searched actual JKHeadley/instar origin/main36290662ca8ace97def8a08874d087f8050860b8 src/ and docs/specs/ for policy-limits|policyLimits|remote-settings.json and git history -G policy-limits|remote-settings.json: no matching cache inspector in those inspected paths. Read handleReadyAndInject startup preservation/single stale-resume retry and the corroborated account-failure spec; path history4e38b9fdaae43b62940a6a43e1e69094d1b91bd1/c579b08417ca8eb1e8b3cbde8a87c411af254974/e460a9be32d48e590b76f475db20fa20268fe370. ONEX-LESSONS section4 inspected. No 1.x transplant fits this pre-child cache defect; existing2.x subscriptionServerPolicy already separates metadata freshness from effective policy. Reuse the entire owned repair rather than adding session retries.

Owner byte comparison (SHA256, identical source/test/fixture bytes):
- scripts/production-boot-io.mjs: 016296cbc340812f2b9d686e656f949f26368e5f27626d6c128b660b76f70e73
- tests/assembly/production-provider-subscription.test.ts: 1e2fd750a2312decea1e9d1af8f2e7a0296ff15b1452cdbcaf18a367678d616b
- tests/assembly/subscription-policy-signatures.test.ts: beaf2dba5bd35fc3168942907e313e7f03579f947cba6b847a6d9ab8736a53f0
- tests/fixtures/claude-signed-cache-2026-11-05/README.md: 80239517bafb621407484ef0393eda970f30f8954579dd0fd7b569d9152e03bb
- tests/fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json: 31af3942d376da58080a3f11d9c43e79312b7aa99a70e0edc20d203511c41d3d

Validation: Both affected files passed122/122 (105 subscription-provider,17 signature-policy),exit0,106.47s. Build exited0. Actual profile read-only matched identity and managed digests, hooksDisabled=false. Native desk --renew on Darwin Node24.14.1 passed9/10 before (only stale certificate),10/10 after,exit0; resulting digest sha256:6efe6f69549488a25f9327c71388df30639ba870aa420366aaf972ad826b67fa. Owner rehash/repin exit0,zero changed pins. Actual completed commands and exact pushed head are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-PROGRESS.md. Only the two affected test files and normal native contract/publication checks are in scope; original199-file inventory,58 incomplete files, unresolved lifecycle/default-root and combined acceptance remain owed.

simplestRobustRoute: This is the simplest robust route: integrate the single existing repair unchanged, preserving bounded parser and profile/hook/effect checkpoints. Exact owner hash comparison guards entry, recorded-cache positive/refusal tests guard source handoff, and the desk's answer/install gates guard shipped acceptance. No new mechanism or autonomous live completion is claimed.
80/20: Serial nice10/maxWorkers1 affected tests and required publication checks; no full sweep or guard increases.
VERDICT: author submission; independent review remains with the desk
