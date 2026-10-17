# Change review — whole-job completion accounting

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: Work created during an obligation remains in its completion checklist across attempts, halt and restart; an unfinished checklist cannot become a final report or be closed by an incidental reply fulfillment.
Affected rules: Rules 4, 5, 8, 26, 34, 36, 42, 49, 60, 68, 74, 83, 84, 95, 97, 101, 102, 113, 116; purpose coherence and no false completion.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain in their existing doorways. Checklist entries grant no authority and dispatch nothing.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes worker result accounting and the existing observation prompt, using the journal's current durable obligation holder.
Side effects: New worker packets carry completion updates and the ordinary answer sees open checklists. Existing records without a checklist replay unchanged. A worker claiming report while known items remain open is recorded as continue. Invalid updates fail without erasing prior work. Evidence strings are worker claims, not independent proof. Operator closure/forgetting still controls the original obligation. Checklist contents remain retained and visible after a safety stop. Every checklist string, including its id, is redacted before reconciliation so repeated updates retain their identity after redaction. No notification or service is added. Desk-provided rehash/repin tools refresh only existing source hash references for src/rungraph/index.ts in owner-references and the grounding inventory, its checker digest, and replay-generated register publication; no holder population, authority or conformance declaration is changed.
Undo and recovery: Revert these source changes before activating a journal with new checklist records. Once activated, preserve the encrypted journal and use a forward repair: older binaries ignore the added checklist field and must not resume these obligations. No live installation is changed by this branch.
Multi-machine posture: Completion is part of existing encrypted obligation-result records and snapshot replay, not machine-local authority or another store. The same records produce the same checklist on another machine; ownership, stop and unknown-operation recovery stay with the existing runner. No remote action or replay permission is added.
Layer below: Read the constitution and D09 closure/halt requirements, D15 operator surfaces, D16 delivery evidence and D18 inherited-duty disposition. Inspected obligation scheduling, result admission, snapshot replay, report delivery/fulfillment, step evidence and worker recovery. Real worker-output recordings exercise the current answer reader before completion accounting.
Bug class: integration
Bug evidence: reproducer=tests/preview/run-completion.test.ts
Hook bypass: none
Convergence: none
Deferral: tests/preview/run-completion-consumer.test.ts:50 | not-a-deferral=This test comment states that closure is asserted before the observation runs; it does not postpone work or claim future evidence.
Prompt review: The worker is asked to account for its whole requested job and created work, using stable ids and evidence claims. No fixture wording or desired semantic verdict is embedded. The existing observe-only step review receives the actual request, obligations and halt state, including retained open checklists across turns when a later completion claim names no obligation; it does not gain send or blocking authority. Recorded worker outputs and uncertain/undecided/empty neighboring shapes are replayed; actual unattended model acceptance remains the desk proof-room check.
Prompt finding: 4106b49fff07 | protocol-literal | Existing tool-capability boundary wording asserts that an unattempted action is not evidence of an attempt; this change does not use the test phrase to judge completion.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response literal describes absence of saved memory; it is unrelated to completion verdicts and is unchanged.
Prompt finding: e8708c7fea24 | protocol-literal | Existing provenance instruction requires source labels and disclosure of unknown sources; it supplies no expected completion verdict.
Decision: run-complete-existing-holder | Keep an additive bounded checklist in the existing obligation result rather than adding a git sweep, service, store or model call; semantic evidence adequacy remains with the worker and existing review. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/run-complete-1016-PROGRESS.md
Decision: run-complete-legacy | Preserve legacy no-checklist results; omission can never erase a checklist already recorded, and current worker guidance asks for the original job and all created work. This is not proof of discovering unreported filesystem work. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/run-complete-1016-PROGRESS.md
Publication: Replay register rebuilt from 17e5ea0c with the final cross-turn observation consumer.
simplestRobustRoute: Extend the existing journal obligation holder with a pure rungraph reconciliation helper. Named failure: a report can finish one step while forgetting work created along the way; durable retained entries prevent omission from lowering that completion bar. Entry uses the existing owned obligation and bounded model call; the end state requires every recorded item accounted complete with an evidence claim before report admission, and delivery still requires its original receipt. Stop, expiry, spend, retry and unknown-effect guards are unchanged. No unattended shipped-path result is claimed; the Studio desk must verify real worker capture and one complete delivery in a proof room.
80/20: Targeted direct consumers plus typecheck, architecture, lint, register and pinned-text checks; the desk owns live macOS conformance and the full suite.
VERDICT: author submission; independent landing review pending
