# Change review — Rule 72 deadline scope on main

Subject base: 7912b0d079c41675c069de2752a74aaddbb753ac
Review state: open
Correction: The initial port omitted a66fe6161 and its tests; the earlier completeness and ownership claims were wrong. See rule72-to-main-fix-1109-change-review.md for the final repair and verification limitations.
Outcome: Port the already-approved Rule 72 wording and deadline-scope implementation from c7603b400 and its ownership/notice repair a66fe61615157b2072d226c74096a6e425b12417, with the replay-anchor refresh of 338eb8674, onto main. An unrelated build keeps moving and reports overdue items; a build changing the owning feature still fails.
Affected rules: 4, 26, 49, 56, 70, 72, 74, 90, 91, 95, 101, 102, 111, 113, 116, 119.
Affected floors: Secrets custody, spend cap, emergency stop, no duplicate sends and durable intake are unchanged. No runtime approval authority is added.
Operator questions: none; Justin approved the sentence in topic 102965, message 140776, 2026-11-08 12:00 PST, replying to proposal 140750. Final-head review remains with the desk; no merge is authorized here.
Suggested tier: critical
Declared tier: critical
Tier rationale: Constitutional wording and release-integrity deadline enforcement, even though this is a narrow port of an approved change.
Side effects: Every file in the declaring code module keeps the overdue refusal; documents own their exact path. Overdue items reach the existing Studio reader through REGISTER-DEADLINE stderr lines on success and refusal. Unknown change scope still fails closed; unknown/landed parts and stale model/subsidy checks remain refusals. No feature is enabled or deadline extended. The prerequisite model-map record from a28df32c6 carries its original November1 measured verification time, without extending freshness or changing the model or subsidy estimate. The document hashes, Rule72 declaration hash and conversion pin must be derived together. Replay is shape-only and grants no runtime authority.
Undo and recovery: Revert source and regenerate outputs from a corrective committed source; preserve approved governing history through a corrective revision if already landed. No runtime data migration.
Multi-machine posture: Machine independent, derived from the same git source and change file list; clock is supplied at the build adapter, pure core receives it. No new state store, message sender or deployment change.
Layer below: src/rulegraph/graph.ts, src/register/workflow.ts, scripts/build-register.mjs, scripts/register-source.mjs and bootstrapDeclarations, canonical hashing, declaration provenance and the existing changeScope git boundary; 1.x comparison below.
Bug class: unit
Bug evidence: reproducer=tests/rulegraph/graph.test.ts
Hook bypass: none; core.hooksPath is .husky/_ but that directory is absent in this worktree; no bypass flags used.
Convergence: none
Prompt review: src/register/workflow.ts changes deterministic deadline result plumbing only; no model prompts or dispatch instructions change, no fixture trigger is embedded and neutral dispatch is unaffected.
Deferral: tests/rulegraph/graph.test.ts:53 | not-a-deferral=Fixture data and assertions for existing deferred-part deadline enforcement; no implementation is deferred.
Deferral: tests/rulegraph/graph.test.ts:54 | not-a-deferral=Fixture data and assertions for existing deferred-part deadline enforcement; no implementation is deferred.
Deferral: tests/rulegraph/graph.test.ts:57 | not-a-deferral=Fixture data and assertions for existing deferred-part deadline enforcement; no implementation is deferred.
Deferral: tests/rulegraph/graph.test.ts:60 | not-a-deferral=Fixture data and assertions for existing deferred-part deadline enforcement; no implementation is deferred.
Deferral: tests/rulegraph/graph.test.ts:65 | not-a-deferral=Fixture data and assertions for existing deferred-part deadline enforcement; no implementation is deferred.
Decision: R72-HISTORY | Preserve main Rule39 revision22 and append Rule72 revision23; the live target reverses these and replacing main history would violate Rule90. Retain old JSON bytes and regenerate Markdown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-1109-PROGRESS.md
Decision: R72-TEST-PORT | Main lacks the live branch's renewed rungraph deadline test setup; transplant the Rule72 test with required imports against main's actual declaration, without changing that declaration or its deadline. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-1109-PROGRESS.md

Decision: R72-ANCHOR | Preserve main bootstrap shape pin; target live build has a different bootstrap-shape.json. Derive document/rule hashes and conversion pin with repository canonical/bootstrap tools; all other target anchor fields match. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-1109-PROGRESS.md
Decision: R72-TYPES | Independent reviewer identified missing typed API surface; add changed option, attention result and changedFiles declaration alongside implemented JavaScript. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-1109-PROGRESS.md

Decision: R72-MODEL-RECORD | Current-clock replay exposed main expired Rule56 record. Carry the exact two timestamp changes and provenance note from live ancestor a28df32c68f22e2acb872291d47af64ac6d8e868; preserve the existing freshness window and estimated subsidy, with no newly asserted verification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule72-to-main-1109-PROGRESS.md

## ELI16

A feature can miss its deadline without making every other improvement wait. This brings the already-approved rule and code onto main: changes to that overdue feature still fail, while unrelated changes continue and show an item for review. It does not turn a feature on, move its deadline, or claim it is ready. When the build cannot determine which files changed, it still refuses.

## 1.x comparison and alignment

inspected actual JKHeadley/instar origin/main f433576c5d0874c9ba64928858252ffaa45e23f2, src/core/FeatureMaturationPlanGate.mjs (structural WARN, not semantic authority), src/monitoring/DarkFlagMaturationRegistry.ts (owner/deadline/proof-of-life; expired-unproven signals without promotion), docs/specs/feature-maturation-discipline.md (dark-too-long from reviewed window; warning keeps work moving), history 7df9eeea6 and 8871005a1. Fit: preserve deadline visibility without unrelated blocking. Mismatch: 1.x runtime registry and spec parser do not implement 2.0 build ownership; reuse c7603b400, the initially omitted a66fe6161 repair, and anchor refresh 338eb8674. Read Studio ONEX-LESSONS.md sections 3 and 6: required delivery cannot depend on unrelated flags; verify production wiring and scope tests to bounded concurrency.

Counterpart: none newly authored here. This ports the already-approved 2.0-specific build-deadline behavior; 1.x's maturation review and coverage checks have different mechanics, and its current Maturation Path article at f433576c5 does not contain this build-scope sentence. This difference is explicit for Rule119 review, not a claim that a new 1.x amendment landed.

## Side-effects review

Over-block: missing git scope retains fail-closed behavior. Under-block: ownership covers the declaring module directory and exact document paths; it does not compute a transitive dependency closure. Layer: existing deadline owner and build adapter; no parallel authority. Signal/authority: deterministic enforcement of governed state under Rules4/95, unrelated deadlines emit attention. Interactions: workflow returns attention and the CLI emits notice lines as well as the build summary; unchanged loop, model freshness and subsidy checks still apply. External surfaces: build JSON gains attention and stderr carries stable deadline notices; the existing desk reader owns deduplication and delivery. Rollback is a revert and replay; all hosts consume the same git bytes.

Historical first review (superseded by the PR199 NO review and the repair record): review_rule72 found no behavioral regression in the port and agreed with the rungraph adaptation and preserved history. Its one medium concern, missing API declarations in scripts/build-register.d.mts, is addressed. The reviewer re-read the typed API, anchor and side-effects artifact and concurred with no remaining concern. This is a local review, not Astra final-head approval.

Mechanical pins: the desk-provided rehash-owner-manifests tool refreshed the two references to tests/rungraph/scope.test.ts. Its repin-chain tool refreshed the two changed source hashes in production-grounding-inventory.json and that inventory digest in check-assembly-contracts.mjs. No manifest population or runtime certificate was changed.

Validation: npm run build and npm run typecheck passed; 31 focused tests passed with41 existing skips. Current-clock repository replay from c97900bd1499fd846dc500c6701b2678e7fc6ba5 passed with273 entries,122 rules and10 overdue attention items. No historical clock override was used. Static reviewer concurred with the model-record prerequisite. Pinned WSL run:50 passed and5 untouched launcher failures retained for Studio; native darwin R105 certificate renewal belongs to desk. Final register checks and diff checks are reported in the builder handoff.

simplestRobustRoute: Reuse the approved implementation and existing derive/replay tools, preserving main's governing history; no new subsystem or parallel deadline authority.
80/20: One narrow port and focused boundary/replay tests; independent review examines the port before submission, final landing review belongs to the desk.
VERDICT: author submission; not a final-head approval or deployment claim
