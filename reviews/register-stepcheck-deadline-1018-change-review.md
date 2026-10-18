# Change review — extend the dark step-check graduation deadline

Subject base: 5838fb11f14de903224a75eb724118296738b33a
Review state: open
Reviewed content: none
Outcome: SECOND 72-hour extension of the dark step-check graduation deadline, from 2026-10-18T00:00:00Z to 2026-10-21T00:00:00Z. Graduation itself is the outstanding work; the desk owns opening a graduation item and recording ordered stage evidence or retiring the feature.
Affected rules: Rules 8, 26, 39, 49, 72, 73, 74, 90, 101, 102, 111, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this change adds no runtime authority, model calls or enabled features.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded declaration repair through the existing promotion record and register generator; no execution or judgment logic changes.
Side effects: The existing fail-closed graduation check allows builds until the new target and still refuses at or after it. Status and documentation show the same new deadline. The feature remains dark and protects nothing until graduation is actually evidenced.
Undo and recovery: Revert the declaration and appended promotion entry together and regenerate the register; the old expired deadline will again refuse builds. Keep prior promotion history intact.
Multi-machine posture: Shared repository declaration and generated publication; all machines use the same deadline and unchanged clock comparison. No new machine-local runtime state.
Layer below: Inspected Rules 72/73, docs/02-the-register.md, checkDeadlines in src/rulegraph/graph.ts, scripts/register-owner-references.mjs fixture mapping, and the append-only promotion record. The linked step-check unit suite passes with mocked Jev outputs, but the record has no reached graduation stages and the live procedure explicitly belongs to the desk. Unit metrics do not establish live graduation.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: The promotion record appends the owner’s deadline, reason and rollback as status metadata. These strings contain neither a fixture trigger nor an asserted dispatch answer; no model prompt or output interpretation is changed.
Decision: stepcheck-deadline-second-extension | step-check graduation not yet proven; deadline extended 72 h so dated gates do not block unrelated builds; this is the SECOND extension and the desk must open the outstanding graduation item. Keep dark status and append reason, owner and rollback to the existing promotion record. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-69-repair-121734-PROGRESS.md

Decision: stepcheck-review-coverage | Apply reviewed PR 167 metadata to assigned live base 70e262c9 (origin/train-67 is absent), preserve live subscription expiry and both earlier branch promotion decisions, and include generated publication. Merge ordinarily into assigned trains and regenerate their publications. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-69-repair-121734-PROGRESS.md

Verification: Typecheck and build passed; 21 targeted files / 222 tests passed. Register regenerated from 4b8954656b4fc935e1a59d92d732338e5558a9a4. Train-62 integration: ordinary merge of the deadline branch, with publication regenerated from merged source. Final gate and per-train outcomes are recorded in the stepcheck-live-1018 PROGRESS report.

Train-62 publication: rebuilt with the project generator after the ordinary merge; build-register --check, typecheck and the targeted suite passed.

Train-64 publication: rebuilt with the project generator after its ordinary merge; the live branch records build-register --check, typecheck and targeted-suite success. Its original review base is fc3698c13895696ec3835fc94a4fc63655f48472; train-69 retains its own earlier coverage base and both histories through the merge.

Train-69 publication: rebuilt with the project generator after the ordinary merge; build-register --check, typecheck and the targeted suite passed.

Integration scope: The ordinary live merge also preserves the retrospective prompt correction and captured replay fixtures. Their deferral-like text below is recorded evidence, not deferred work. The inherited deadline edit itself changes no prompt or parser.

Deferral: tests/preview/fixtures/requested-report-proofroom4-2026-10-17.json:13 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:30 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:34 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:38 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:42 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:46 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:50 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:54 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:58 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:62 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:66 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:319 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:323 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:327 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:331 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:335 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:339 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:343 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:347 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:351 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:355 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:359 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation
Deferral: tests/preview/requested-report-live.test.ts:17 | not-a-deferral=recorded fixture or regression description of already-owned work, not deferred implementation

Prompt finding: 4106b49fff07 | protocol-literal | Existing protocol or fixed output wording imported unchanged; no semantic classifier copied from a fixture — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol or fixed output wording imported unchanged; no semantic classifier copied from a fixture — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol or fixed output wording imported unchanged; no semantic classifier copied from a fixture — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

## Closing block

simplestRobustRoute: This is the simplest robust route: change the source deadline and append its owned decision using existing mechanisms, update consuming assertions and documentation, then regenerate dependent pins and publication with the project tools. No new machinery. The existing stage-evidence requirement guards graduation; the existing strict deadline check guards the new end date. No autonomous completion or live protection is claimed.
80/20: Verify the linked step-check tests, promotion and inventory consumers, register/rulegraph tests, typecheck, architecture, lint, register replay and the desk's pinned ready tests; leave the actual graduation procedure with its recorded desk owner.
VERDICT: author submission; no independent convergence claim — the review desk records its judgment
