# Change review — restore train-186 subscription startup after cache refresh

Subject base: fa960553940238a2dfad9bb28348fd63d3047799
Review state: open
Reviewed content: none
Outcome: Reuse owning repair 0c1d832a4816aeb21891e5a89242497d12c76fc1 so the existing admitted profile remains usable when Claude writes signed cache metadata, with policy and hook checks intact.
Affected rules: 26, 34, 36, 37, 42, 49, 69, 74, 101, 103, 105, 111, 112, 113, 116
Affected floors: secrets — unchanged custody and egress checks; spend cap — no retry or new calls; stop — existing checkpoints; no duplicate sends — no resend or journal mutation; durable intake — existing saved input retained
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Existing provider construction refused before any model launch; exact owned host inspection repair with captured cache and refusal controls.
Side effects: Known signature and issuance metadata are validated but excluded from effective policy digests. Pre-cache enrollment stays usable only after the existing restrictive cache schema passes. Cache-bound enrollment, changed managed settings, disabled hooks, malformed and unsafe files still refuse. The CLI verifies signatures; no metadata is used as Instar authority.
Undo and recovery: Revert this integration and regenerate publication. Retain input and unknown effects; do not resend or remove cache files to bypass inspection.
Multi-machine posture: Machine-local profile/cache inspection using each host's admission; shared source via git. No ownership, replication or authority changes.
Layer below: Actual retained copy and named profile, provider route constructor, subscriptionServerPolicy, pinned 2.1.280 CLI signed-cache schemas, owner tests and current native composition. No live root, profile, credential or grant edited.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/subscription-policy-signatures.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-deploy.log
Hook bypass: none
Convergence: none
Prompt review: No model prompt, output parser or semantic acceptance change. Failed update 840344311 has no model output; the real host-cache fixture from owner update 840344298 is replayed. Historical summary/Jev/review/reply evidence is unchanged, not newly certified.

Recorded evidence: forum-answer-copy-20261105-184724 update 840344311 was accepted, tools/egress prepared, then held model not started; zero model-call records and one accepted infrastructure notice. Current read-only inspection of its named room-three profile reproduces unexpected policy-limits.json.signature.json (file predates the failed probe). The original exception was discarded by the wrapper, so this is supporting reproduction rather than a claimed original error capture. After owner patch the unchanged actual profile reports identityMatches=true, policyMatches=true, hooksDisabled=false. No runner or provider was launched against that copy.

1.x comparison: Independently searched actual JKHeadley/instar main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 src/, docs/specs/ and history for policy-limits/remote-settings: no corresponding cache implementation. Read src/core/SessionManager.ts handleReadyAndInject, docs/specs/cli-login-expired-opens-repair.eli16.md; retain owner comparison cc11e45f92e2590dd1bbd3c3facb5b849532f0fc and 7da5a52ff. ONEX sections 1/3/4/6 distinguish actual startup, delivery and failed labels. Polling comparison src/lifeline/pollDecision.ts and docs/specs/lifeline-409-poll-deadlock.eli16.md, history 67f96999fcde01181533d954a165b5db2abc1856, did not fit this successfully ingested turn. Reuse the complete existing 2.0 bounded cache inspector repair; no 1.x code transplant fits.

Decision: train186-cache-owner | Reuse complete owner 0c1d832a patch; preserve this branch's additional narrowed-token provider cases. No competing repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-186-repair-PROGRESS.md

Subject: scripts/production-boot-io.mjs, tests/assembly/production-provider-subscription.test.ts, tests/assembly/subscription-policy-signatures.test.ts, tests/fixtures/claude-signed-cache-2026-11-05/README.md, tests/fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json, src/assembly/harness.declarations.json

Verification: TypeScript and build exit 0. The two affected test files pass 124/124 (142.66 seconds, nice 10, one worker): owner cache cases plus this branch’s two existing narrowed-token controls. Actual unchanged profile matches identity/policy with hooks enabled; no provider calls. Owner rehash/repin changed zero pins. New answer and full-suite acceptance remain pipeline-owned.

Native guarded renewal completed: before 9/10 with only stale certificate, after 10/10, exit 0. New composition sha256:2986969b9a14c2f103b4c3deccdf9d6d41e8d17766149737b43476bc29e20f7e. Rehash/repin after renewal changed zero pins. No hand-edited certificate.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the exact already-owned repair, existing profile checkpoint and guarded native/publication tooling. No retry, verifier, new grant or capability restriction. Actual-profile and captured-cache checks establish preflight repair; the pipeline supplies the new real answer and full-run acceptance.
80/20: TypeScript, two affected files and required cheap gates only, plus the narrow native contract required to renew the changed composition. Full suite and new answer check remain pipeline-owned; no independent convergence or live completion claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
