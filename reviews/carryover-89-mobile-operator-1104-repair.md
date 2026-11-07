# Change review — truthful reply outcomes and usable active conversation links

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Process Health reports check events without inferring holds, revisions or resolution; actual withheld drafts use heldReview records. All selected active conversation links resolve bounded details outside the latest ten messages.
Affected rules: 26, 42, 60, 74, 79, 80, 81, 101, 106, 113, 116; Purpose least revelation and preserved ability.
Affected floors: secrets — existing redaction, closed validation, escaped rendering and authentication retained; spend cap — no model or resource allowance changes; stop — existing routes and runner unchanged; no duplicate sends — projection only, no send-path changes; durable intake — read-only projection from the existing durable journal.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Two operator-visible regressions spanning the real journal projection and both dashboard renderers; targeted integration checks and existing HTTP/floors checks exercise the changed behavior.
Side effects: The disposable snapshot adds sessionTurns, bounded by the sixteen selected sessions; older snapshot bytes are unreadable until the runner republishes on its existing cycle. Check-event statuses no longer claim resolution. A withheld draft's delivered holding notice is distinguished from an answered message. No authority, model prompt, parser, admission or release decision changes.
Undo and recovery: Revert the source repair and regenerate the register with the existing tooling; the runner republishes its disposable snapshot. No durable data migration or recovery replay is required.
Multi-machine posture: Machine-local disposable projection of the serving runner's journal, deliberately; selected session machine attribution is unchanged. No new replicated state or ownership decision.
Layer below: journal.ts reply-check advisory release (ordinary objections and outages), heldReview records and send receipts; replyOutcomeOf and heldReplies; sessionsNow active selection; authenticated read-only message routing and closed snapshot validation.
Bug class: integration
Bug evidence: reproducer=tests/preview/operator-dashboard-mobile.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser or dispatch changes. The added model/reviewer stand-ins only exercise the existing worker's recorded outcomes, and the production send/advisory-release implementation remains unchanged.

## Covered carryover and repair

The inherited carryover commits 08c35fab6 and 2df7402a4 had no committed change-review record. This record covers their mobile operator surface and the repair together: a native PIN-file verifier, active-only session listing with machine attribution, Process Health from journal records, runner publication, documentation and floor fixtures. The PIN grants viewing only; existing independent approval custody remains intact. The two source defects identified by the independent review are repaired here. The generated register is replayed from source commit 24114ce066a8d052bba1e621ecc30978e341e32d; no pins are hand-edited.

## 1.x FIRST comparison

Inherited accepted source: JKHeadley/instar f3f94826ae7c0ae6203c2651698c02b95b89ccfa. Rechecked src/server/AgentServer.ts (hashed constant-time PIN comparison), src/server/routes.ts (active-only session listing, CMT-1936, machine attribution), dashboard/process-health.js (sanitizer), and docs/specs/PROCESS-HEALTH-DASHBOARD-TAB-SPEC.md (informational display). The original carry retains those behaviors. Searches of actual local origin/main 7710c90278864a3a6d04820d5dce2df1a8c9decd src/server/routes.ts and the Process Health spec plus git history (09a3a2f7d and ab26b7ca3) confirm the applicable lineage. This repair adapts the existing 2.0 journal outcomes and detail route; the 1.x separate failure ledger/SPA is not a fit for these projection errors.

ONEX-LESSONS sections 1/2 and their source incidents were read: docs/specs/session-respawn-thrash-elimination.md at abd2c22e9281063e1e29ddabce4f64ec7bc71fa1 separates kill attempts/vetoes from actual kills; docs/specs/CODEX-SESSION-WEDGE-SELF-RECOVERY.md at that revision shows why healthy server and delivery labels cannot establish session progress. Here check-event counters likewise cannot establish delivery or holding.

## Verification and evidence boundary

- Foreground nice -n 10 typecheck and build passed.
- Foreground vitest --maxWorkers 1 on operator-dashboard-mobile.test.ts and operator-dashboard.test.ts: 21 passed, no skips. Includes real journal worker advisory violation and unavailable-review delivery, credential draft withholding with a delivered notice, pending turn holds, eleven active conversations outside the recent-ten window, sixteen-detail bound, escaped/redacted detail text, closed validation, real local HTTP/PIN path, and all eleven dashboard floors with negative controls.
- Can-fail controls: restoring the old health wording fails all three outcome tests, including the false outage hold assertion; removing the sessionTurns detail lookup fails the advertised message-1 destination assertion. Both controls were restored. Desk logs: carryover-89-repair-health-control.log and carryover-89-repair-link-control.log.
- No full suite or fresh full-run report produced, per the repair instruction. No live installed phone proof; row 89 stays OPEN for that desk-owned proof. No model-facing change requires an observer-106 recorded-model replay.
- Architecture passed; the required desk rehash/repin scripts changed no owner manifests or inventory pins. The register is regenerated from the source commit and final cheap checks are recorded in the desk repair PROGRESS.

The first final-head change-review check found two Rule 109 stale freezes in inherited browser records whose subjects include the regenerated register. The checker’s `open` command voided those stale rounds in browser-bridge-on-resource-1104-change-review.md and browser-mcp-worker-read-1104-change-review.md. No browser implementation or independent verdict was changed or invented; the desk reviews the resulting candidate normally.

## Closing block

simplestRobustRoute: Reuse turnOutcome for clipped/redacted details, retain at most sixteen selected active conversation details beside recent messages, and resolve them through the existing route. Describe check counters as check events and derive actual holds from turn records. This is the simplest robust route: no store, endpoint, polling process or capability restriction. Existing authentication, snapshot bounds, stop, spend and send checkpoints remain the guards.
80/20: Both must-fix regressions have source repairs and can-fail evidence; installed phone acceptance remains the explicitly recorded desk boundary.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
