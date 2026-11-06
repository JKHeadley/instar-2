# Change review — train-193 isolated volume composition

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Compose the exact live b5806d1e base with reviewed main c20b68d1 and isolated-volume 0ca33415, plus only the five exact signed-cache prerequisite files from 0c1d832a. No other train ancestry, model changes or serving-root operations.
Affected rules: 4, 7, 26, 32, 34, 36, 44, 56, 60, 61, 63, 70, 74, 90, 101, 102, 109, 111, 112, 113, 116, 119, 120, 121
Affected floors: secrets — existing custody and outbound guards; spend cap — no new model calls or budgets; stop — existing checkpoints and non-forced detach; no duplicate sends — no replay or send changes; durable intake — existing journal and image bytes retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition includes physical session storage growth and provider startup inspection; inherits critical member tier.
Side effects: Full quiescent images grow at the existing mount boundary within the reviewed maximum and host reserve. Accepted bounded signed-cache metadata no longer prevents unchanged authorized profiles from launching. Main constitutional text and pairing checks enter intact. Generated register reflects exact composition. No timestamps or freshness windows changed beyond the reviewed member evidence. Replay conversion pin is sha256:5c4f6ec00fff897d806c46112f957e2a9c8fb8b314795942a2fa5ad14d2d0503 for the merged anchor; the old main-only pin correctly refused the live schema.
Undo and recovery: Revert this candidate composition and regenerate source/register artifacts. Preserve already-grown images and retained work. Never replay an uncertain effect. No installed root was modified.
Multi-machine posture: Volume and signed-cache inspection are deliberately machine-local at the existing owning boundary. Registers and source distribute through git; ownership and replication are unchanged.
Layer below: Exact base and member parents; verified member and cint-L37 report snapshots; original 0c1d832a review and all five source blobs; production constructor/cache policy and volume mount wiring; actual 1.x source and history comparison below. Native macOS composition certificate and new volume/live proof remain desk-owned.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No new model prompt or output parsing. Main constitution excerpts are checked by default-context-floor, guidance, default-root-conversation and summary-cascade-stall. Signed-cache tests replay owner-captured CLI 2.1.280 cache bytes, not model responses. No remote calls or live journals are used.
Deferral: generated/conversion.json:1 | not-a-deferral=generated historical rule text, not a new deferred commitment
Deferral: generated/register.json:1 | not-a-deferral=generated historical rule text, not a new deferred commitment

Subject (31 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, docs/defects/codex-model-map-refresh-2026-11-05.md, docs/release-evidence/codex-model-map-refresh-1105.json, docs/release-evidence/session-volume-isolated-1105-report.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/check-constitution-pairing.d.mts, scripts/check-constitution-pairing.mjs, scripts/production-boot-io.mjs, src/assembly/production-codex-provider.declarations.json, tests/assembly/production-provider-subscription.test.ts, tests/assembly/subscription-policy-signatures.test.ts, tests/e2e/register.test.ts, tests/fixtures/claude-signed-cache-2026-11-05/README.md, tests/fixtures/claude-signed-cache-2026-11-05/policy-limits.json.signature.json, tests/preview/journal-agent.mjs, tests/preview/session-volume.test.ts, tests/preview/tool-turn.declarations.json, tests/preview/tool-turn.mjs, tests/register/constitution-pairing.test.ts

1.x comparison: Searched actual JKHeadley/instar main 13e4f75507520aa6c43c0aec006b7ec2fbd28332 src/core/InstarWorktreeManager.ts, src/monitoring/HealthChecker.ts, docs/specs/worktree-reaper-untracked-blindspot.md and history b227aed93, c20f2f07c, 6fb1db837; host cleanup/shared dependencies differ from bounded image resize. ONEX-LESSONS section 6 read. Inherit member comparison in docs/release-evidence/session-volume-isolated-1105-report.md and cache owner's comparison at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc (SessionManager.ts, cli-login-expired-opens-repair.eli16.md, 7da5a52ff): startup retry cannot repair a cache preflight. No 1.x code is imported.

Owner attribution: 0c1d832a4816aeb21891e5a89242497d12c76fc1 by Echo <echo@sagemindai.io>, five runtime/test/fixture files preserved byte-for-byte. The original review is inspected as historical attribution, not imported as acceptance of this composition. Volume implementation retains Adriana 037040d7 and Echo 3a2048fe attribution. Reports cited by the decisions are existing Studio records; their verified snapshots were read through the authorized read-only API.

Decision: train-193-main | Merge exactly c20b68d1d9b5744a72c243c4dc8a4b69114179d6; main constitutional text retained; conversion pin recomputed for main rules plus the live schema, generated artifacts regenerated. Main review records travel with its merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-volume | Merge exactly 0ca33415257f14d5ccfbd2045e8d713431e6891b; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-volume-isolated-1105-PROGRESS.md defines complete member behavior and evidence limits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-A | Preserve both live behavior and member behavior; generated conflicts use temporary parent outputs only until the normal generator replaces them; no hand-merged generated output is submitted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-B | Keep exact b5806d1e ancestry and isolate this volume candidate from train192 and other train tips. No Studio deskAfterLive callback is modified; none is defined in this repository base. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-C | No product-conflicting member omitted; left out: none. No abort required. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-D | Report unrun native/macOS and unchanged host-dependent failures honestly; independent/full/installed/live tests remain required at the Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-cache | Reuse only the five exact files from 0c1d832a as common startup prerequisite; no signed-profile, custody, account, model or timestamp changes and no owner branch ancestry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md
Decision: train-193-desk | Run the cint-L37 desk chain using read-only downloaded repin/rehash tools, build and exact source-commit register replay. Preserve all historical versions; no native certificate fabrication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-193-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: two ordinary exact-head merges, the five byte-identical owner prerequisite files, and existing desk generators. No alternate cache parser, resize algorithm, watcher or pipeline is introduced. Start guard is exact membership, end guard is targeted checks plus desk independent/full/native/installed/live qualification, limits remain the five floors. No autonomous shipped-path completion is claimed.
80/20: Run changed tests and directly affected consumers, required register lifecycle and prompt floor, then cheap checks. Do not run the full suite or remote model calls. Native volume and full installed/live checks remain at the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
