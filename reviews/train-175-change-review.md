# Change review — train-175 reviewed main and mobile operator

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Integrate reviewed main constitution pairing and Rule 120 with the reviewed mobile dashboard carryover, preserving the live browser worker behavior.
Affected rules: 26, 34, 37, 42, 49, 60, 74, 79, 80, 81, 90, 101, 102, 111, 112, 113, 116, 119, 120
Affected floors: Secrets: PIN remains read-only and approval authority separate; spend cap: no extra calls; stop, no duplicate sends and durable intake unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combines reviewed constitution amendments with operator-facing dashboard behavior; independent desk acceptance remains required.
Side effects: The register now contains 120 rules. Dashboard adds working sessions and health, with truthful check-versus-delivery outcomes and retained active message links. Browser worker code stays unchanged.
Undo and recovery: Revert this train through review and replay the register, preserving governing changelog history and journal records; never resend uncertain effects.
Multi-machine posture: Existing journal ownership and replication unchanged. Session rows retain machine attribution; PIN-file access remains deliberately local to the dashboard host.
Layer below: Full purpose and rules, exact member report and reviewed changes, 1.x source/spec/history comparison below, inherited tests and cint-L37 desk chain.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No new model prompt, parser or acceptance decision. Main adds Rules 119/120 without changing the selected briefing excerpts; constitution briefing and context tests verify that. Member dashboard recorded shapes remain tests/fixtures/dashboard-recorded-shapes.json; no live model claim.
Deferral: generated/conversion.json:1 | not-a-deferral=Regenerated full-line JSON carries existing rule wording; no new postponed implementation.
Deferral: generated/register.json:1 | not-a-deferral=Regenerated full-line JSON carries existing rule wording; no new postponed implementation.

Subject (26 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/build-register.mjs, scripts/check-constitution-pairing.d.mts, scripts/check-constitution-pairing.mjs, scripts/check-dashboard-floors.mjs, scripts/operator-dashboard-readonly.mjs, scripts/operator-dashboard.mjs, tests/e2e/register.test.ts, tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/operator-dashboard-mobile.test.ts, tests/preview/operator-dashboard.test.ts, tests/preview/operator-dashboard.ts, tests/register/constitution-pairing.test.ts

Decision: train-175-main | Merge exact ef4a964232b7baf17d8fc4cf1b8a248a95b6d513; cite committed reviews/constitution-one-constitution-change-review.md and reviews/constitution-person-decides-change-review.md. Main supplies constitution text; combined anchor retains the live base shape, so the conversion hash is mechanically recomputed from that merged anchor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-mobile | Merge exact 5cddf861f2091fa5190899bc021b6cd3a35dc001; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-89-mobile-operator-1104-PROGRESS.md verified from authenticated snapshot cda2f060c7bd239e3b022b7284ef5d00ed279ba49e4299bfedda4f2102b24c76; committed reviews/carryover-89-mobile-operator-1104-repair.md retained. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-A | Preserve both member and live-base behavior; take reviewed main constitution text, preserve changelog versions from both sides, regenerate conflicting generated artifacts rather than hand-merging them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-B | New worktree and branch created directly at b5806d1e015dc650cdc1dee2e0accab05a849d4b; no branch reset or movement; do not touch train-170 or live runner. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-C | No genuine product conflict; neither pinned head is omitted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-D | Run WSL-compatible targeted checks; disclose macOS-bound unchanged-test failures without weakening checks. Studio owns native certificate and installed phone proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md
Decision: train-175-desk | Use cint-L37-PROGRESS.md authenticated snapshot 81a0412343bb17cff152cea467990b7966115a25fe4c25b583ff8b58346ba963: repin, build, rehash, replay. Linux sed syntax adaptation only; guard constants unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-175-PROGRESS.md

1.x comparison: inherited member research at f3f94826ae7c0ae6203c2651698c02b95b89ccfa, src/server/AgentServer.ts PIN SHA256/timingSafeEqual; src/server/routes.ts active-only sessions/machine names; dashboard/process-health.js sanitizer; docs/specs/PROCESS-HEALTH-DASHBOARD-TAB-SPEC.md informational health. Independently searched actual JKHeadley/instar origin/main at 7710c90278864a3a6d04820d5dce2df1a8c9decd in cross-topic-onex-reference: same source paths and docs/specs plus git history (a8af8bff7, e06d4df98, 7e8fde8e8). Newer main has additional global PIN throttling and secure-transport checks; this train preserves the reviewed member's bounded local file PIN contract and adds no new auth implementation. Read ONEX-LESSONS section 6: bound aggregate test concurrency; test real assembly; never contaminate production with test identities. The original SPA and PIN approval authority are not copied: 2.0 uses eleven dashboard floors and independent approval surface. Member report gives both-side tests.

Register replay: b75031cd26ed1330f7abbd81aa1bd0630db68319 regenerates all seven register outputs from combined source 688c6294aa4635a0876dc49829080ca14b5a1cbd: 297 entries and 120 rules. This record includes that generated commit in its coverage. No deadline override or live-authority claim.
Verification so far: build, typecheck, lint (architecture passed; issues []), register check, mobile dashboard/reply-parts/constitution-pairing 62 tests and default-context-floor 6 tests pass. Remaining journal and pinned checks are reported by the desk handoff. History-wide review has only unavailable Studio report/evidence paths after closing this generated-commit coverage gap; their contents and paths are not fabricated locally.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merges of exactly reviewed heads and regeneration with the existing desk tools. No new machinery; five safety floors and independent gate remain. No unattended product-completion claim.
80/20: Only changed/direct-importer tests and explicitly required journal/pinned/constitution checks; no full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
