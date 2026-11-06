# Change review — retain subscription startup after signed-cache refresh

Subject base: 11ffd8a087ee9ee874169af20e8896bf0f75eabd
Review state: open
Reviewed content: none
Outcome: The existing subscription route accepts the pinned CLI's signed policy-cache metadata without changing the enrolled profile or weakening effective-policy checks. The retained failed message is not replayed by this change.
Affected rules: 18, 26, 34, 36, 37, 42, 49, 56, 63, 69, 74, 100, 101, 103, 105, 111, 112, 113, 116
Affected floors: secrets — existing custody and outbound checks; spend cap — no additional calls or retries; stop — existing admission and dispatch checks; no duplicate sends — no replay or journal mutation; durable intake — failed input remains recorded.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Integrates the existing owning repair for a deterministic provider startup refusal, with captured-cache replay and the native composition contract.
Side effects: The bounded inspector recognizes signature and accepted-issuance sidecars, checks their shape/path/size and excludes verification metadata from the effective-policy digest. A pre-cache enrollment remains valid only for the existing restrictive cache schema; cache-bound enrollments retain their bindings. Unknown or permissive policy, disabled hooks, identity changes and unsafe files still refuse. The pinned CLI verifies signatures; this host never treats a signature as Instar authority. No capability is removed.
Undo and recovery: Revert this integration and regenerate source/register evidence. That restores the old startup refusal. Retain the journal and never resend an uncertain effect.
Multi-machine posture: Deliberately machine-local inspection of each host's recorded profile and cache; ownership, replication and authority are unchanged.
Layer below: Read-only failed copy status, prepared tool/egress state, actual named test-profile inspection, existing provider constructor and policy inspector, and complete owning patch 0c1d832a4816aeb21891e5a89242497d12c76fc1. Exact current cache bytes match the owner's public recorded fixture. Profile identity/policy match and hooks remain enabled after integration, without invoking a model.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
Prompt review: No prompt, output parser or model judgment change. Failed update 367055163 has zero model calls and only an infrastructure reply (message 2204). The relevant real shape replay is the owner's signed-cache capture from update 840344298, byte-identical to the named test profile. No new summary/Jev/reply-review replay or fresh live answer is claimed.

Recorded failure: 2026-11-05 19:57:17 answer check, copy forum-answer-copy-20261105-195624, intake 367055163/message 2203, model-not-started notice 2204. Current read-only inspection reproduced policy-limits.json.signature.json unexpected-file refusal. This is corroboration of the pre-dispatch failure, not a claim that the old journal retained its discarded exception. The copy remains read-only.

1.x comparison: Searched actual JKHeadley/instar origin/main bc4355b8075dad89e8667ab082c526c0460b0455 src/, docs/specs/ and history. Read src/core/CliLoginStatus.ts, docs/specs/subscription-account-email-invariant.md and docs/specs/skill-driven-signin-repair.md; history 17f1c6444, 8e3c2df09, ab26b7ca3; ONEX-LESSONS section 4. Preserve unknown evidence versus confirmed login refusal. Searches for policy-limits, signature.json and remote-settings found no matching cache inspector in those paths; history matches 71d6acdf1, 8ceda68b0 and 69ab54c72 concern A2A signatures. Inherit owner's cc11e45f92e2590dd1bbd3c3facb5b849532f0fc comparison of SessionManager.ts handleReadyAndInject, docs/specs/cli-login-expired-opens-repair.eli16.md and 7da5a52ff. No 1.x source transplant fits this pre-dispatch cache check. Reuse the whole existing 2.0 owning patch unchanged, not a replacement login mechanism. Existing train browser lineage remains 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/core/PlainChromeReloginBrowser.ts, history 56fce63eb/ebb3393ab/2aaac4288.

Decision: train190-cache-owner | Reuse complete owning patch 0c1d832a4816aeb21891e5a89242497d12c76fc1 for the same known cause, with its captured-cache and refusal tests; keep profile, grants and all capabilities intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-PROGRESS.md
Decision: train190-native | Use the existing guarded Studio native-contract renewal, which requires the ten-case contract before and after any certificate update and restores the declaration on failure; never hand-edit a certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-PROGRESS.md
Decision: train190-publish | Use the delegated desk rehash/repin and register generator to publish the exact source composition; run the cheap gates after the final commit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-PROGRESS.md

Verification: Typecheck and build exit 0; both affected test files pass 122/122 in 96.50 seconds. Actual unchanged test profile matches identity and managed-policy digests with hooks enabled. Guarded native renewal passes 9/10 before (only stale certificate), 10/10 after; composition sha256:6efe6f69549488a25f9327c71388df30639ba870aa420366aaf972ad826b67fa. Delegated owner rehash/repin changes zero owner/inventory pins. Final generated publication and cheap-gate results are recorded in the repair progress file.

Additional gate repair: Register replay exposed expired preview-subscription-codex metadata. Reuse exact declaration and catalog evidence from owner 5eefd6fd921cb93fb3f241a152bd71b76302b9a2 (docs/release-evidence/train-187-codex-catalog-2026-11-05.json). Observation 2026-11-06T03:40:55.257112Z proves catalog presence only; model, subscription-only guards, estimated subsidy and 2885119381ms freshness intervals stay unchanged. Seven emitted freshness-check controls prove stale/future refusals, acceptance now/at observation, and the exact expiry boundary. No unrelated E2E orchestration patch is imported. Undo restores the expired declaration and regenerates the register.

1.x catalog comparison: owner inspected 79d83ec93a399c0cd5896871e3e8e29d83d3fc5c src/core/DoorwayRegistryReader.ts and docs/specs/doorway-scan-real-run.md; directly re-read those paths at bc4355b8075dad89e8667ab082c526c0460b0455 and history 35b02553b/ab26b7ca3; ONEX section 6. Preserve reviewed model knowledge versus observed reachability; the CLI-version scan cannot verify model IDs and is not transplanted.

Decision: train190-catalog | Reuse owner 5eefd6fd9 catalog evidence and declaration timestamps to fix the observed stale-map failure; keep freshness duration, model choice and spend guards unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: integrate the existing owner repair and its tests verbatim. It prevents known cache metadata from stopping the model before invocation while retaining policy, identity, hook, cap, stop, durable-intake and effect checks. No retry loop, new verifier or reauthorization mechanism is added. The pipeline's new answer check supplies unattended shipped-path evidence; this submission does not claim that result.
80/20: TypeScript, the two affected test files, required changed-composition contract and cheap gates; no full suite or broad pinned-test sweep under the repair's explicit instruction. The Studio pipeline owns new answer/full-run acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
