# Change review — Retain a pending question while session readiness recovers

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Outcome: Carryover row 08, smallest complete slice: a prepared session delivery that has never begun sending remains durable while the surviving session is not ready. A subsequent recovery can submit the original question once when the exact original prompt returns. The whole restart/handoff-to-final-result row stays OPEN pending live proof.
Affected rules: 1, 14, 26, 28, 29, 34, 42, 43, 46, 49, 60, 62, 63, 68, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — no new content or credential surface; spend cap — existing model and host admission unchanged; stop — existing checkStop before recovery and sendText still holds; no duplicate sends — sending, accepted and uncertain records never enter the new branch, and exact process and original pane checks still precede dispatch; durable intake — the existing prepared record retains the original identity, input, digest and text without a new store. Time and host floors remain at the existing caller and armTurn admission.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Recovery of accepted input affects the durable intake and unique delivery floors. This submission proves the driver slice, not a live conversation or complete grouped carryover outcome.
Side effects: A temporarily non-ready prepared record remains prepared instead of becoming permanently uncertain. The existing caller owns any subsequent bounded recovery attempt; there is no timer, loop, new retry budget or background worker. A changed ready pane still becomes uncertain. No readiness menu is answered automatically. Existing generated register outputs are repinned to source commit 07512b75a8c77f4e9f76f3434d0f3445c72fd014; this remains shape-only replay authority.
Undo and recovery: Revert this source change. No schema migration is needed: prepared records keep their existing format and are readable by the previous driver. Preserve all delivery records; never manually reset a sending or uncertain record to prepared.
Multi-machine posture: Session injection remains local to its recorded exact tmux process identity. The harness adapter and conversation ownership gates still own handoff and admission. No remote owner gains authority from the pending state, and this change does not claim cross-machine final-result proof.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md from origin/main. Inspected row 08 final cell, createIntakePort.receive/recover, preview journal intake/drain/replay, session adapter pending-attempt recovery, driver bootSweep/recoverDelivery and its injected SessionIO. Compared both requested 1.x files at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9: PendingInjectStore.sweepPendingInjects retains failed redelivery for recovery; MessageProcessingLedger preserves input/sender and refuses acted-on replay. Adapted that pending-retention behavior to existing 2.0 journal states, retaining the stricter 2.0 rule against replay after sending begins. No 1.x file or SQLite store is transplanted.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model prompt, output parser, meaning judgment or model verdict changes. The change reads the existing session readiness classification; it does not change that parser. Both new prepared and sending boundaries also replay all seven otherShapes from retrospective-duty-followup-train-1-2026-10-08.json: summary writer 715672480, uncertain summary 715672483, undecided Jev 715672482, unsure Jev 969389570, reply review 969389923, delivered reply 715672479 and empty candidate 715672550. The new pending branch fires on those captured bytes; this is build replay, not a new live run.
Decision: C08-PENDING-READINESS | Reuse the 1.x pending-inject retention behavior only for never-started prepared deliveries; keep the original process, pane and no-duplicate checks before recovery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1104-PROGRESS.md
Decision: C08-SLICE-LIMIT | Keep grouped row 08 OPEN: driver restart and duplicate-injection assertions are build evidence, not proof of a live accepted question returning one final result after restart and handoff. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1104-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: retain the existing prepared delivery when readiness is temporarily unavailable. It prevents permanent loss of replay eligibility before any send began. Existing durable capture is the start guard; accepted injection evidence is the slice's end guard; caller admission, exact process and original pane, stop, host and deadline checks remain the limit guards. No new state format or autonomous loop is added. No unattended shipped-path completion is claimed.
80/20: The new regression failed before the port with uncertain instead of awaiting-readiness; the opposite sending-state boundary already passed. The report records final targeted checks and limits. Independent review and the live grouped outcome remain with the desk.
VERDICT: author submission; this record asserts no independent verdict.
