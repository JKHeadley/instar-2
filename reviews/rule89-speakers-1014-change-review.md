# Change review — Rule 89 speaker proof

Subject base: 324d40539a76ce148ccfd6d74b0278e72571ae32
Review state: open
Reviewed content: none
Outcome: Reconcile the two recorded B8 windows, verify signed speaker counts with and without text acknowledgement, and hand the desk an exact tested proof expression.
Affected rules: Rules 13, 26, 34, 36, 49, 70, 74, 87, 89, 101, 102, 111, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement. Tests and recorded proof evidence only; no runtime or authority change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: The recorded failure is a stale proof expectation plus a proof harness dependency failure; runtime speaker assignment is correct.
Side effects: The proposed desk expression requires exact accounting of every message in each window, including a receipted acknowledgement. A reaction contributes no text-message receipt and no message count. Missing turn receipts or scheduler interference remain UNTESTED. Extra, missing or misclassified messages fail. Python 3 is required by the oracle test, as by the existing desk check.
Undo and recovery: Revert these test artifacts and the desk expression together if the oracle is rejected. No journal migration, state mutation or resend is needed.
Multi-machine posture: Read-only recorded Studio evidence is exercised on WSL. Existing conversation ownership and durable send authority remain unchanged. The desk alone applies the Studio tooling repair; the builder makes no Studio writes.
Layer below: Inspected journal speaker projection, infrastructure signing in acknowledgeReply, status classification, holding substitution, final signed intents, sendOutcomeCounts, compact/reopen and the deployed B.sh X4 relocation. Reproduced a second X4 harness failure after dependency resolution: relocated tests lack their fixtures directory. A fixtures symlink to the same frozen runtime tree restores collection.
Bug class: none
Bug evidence: tests/preview/fixtures/rule89-speakers-2026-10-14.json records delivered turns 6233227 and 6233228 with exact counter windows; this change repairs proof tooling, not product behavior.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing change. Recorded delivered reply and status counts are replayed with synthetic verified intake and injected timing; original model judgments are not claimed. Existing acknowledgement and holding tests additionally exercise captured uncertain and unavailable outputs unchanged.
Decision: rule89-counts | Keep runtime provenance unchanged; count one agent answer, one infrastructure status and each actual text acknowledgement independently. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule89-speakers-1014-PROGRESS.md
Decision: rule89-oracle | Test the exact desk Python expression against both recorded windows, no-message acknowledgement neighbors, missing evidence, scheduler interference and twenty incorrect-count cases. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule89-speakers-1014-PROGRESS.md
Decision: rule89-x4 | Keep X4 assertions; report the frozen dependency failure and the reproduced missing-fixture relocation repair separately from any claim about product behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule89-speakers-1014-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: preserve correct runtime code, correct the desk's one-message assumption using existing receipts, and test both counters and replay. No new product machinery. Start guards are verified durable intake and existing send admission; end guards are signed message provenance and durable receipts; unknown sends remain non-repeatable. Recorded evidence and offline replay establish accounting, not a new unattended live acceptance.
80/20: Targeted speaker, acknowledgement and holding tests; exact oracle and relocated X4 reproduction; typecheck, architecture, lint, register, change-review and pinned READY tests. No full suite or live walk.
VERDICT: author submission for desk review; no independent convergence claimed
