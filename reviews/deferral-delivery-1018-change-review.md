# Change review — Prepare deferred answers independently of delivery

Subject base: 0227b3815d1b0a07b225e2a0957f8be394468aae
Review state: open
Reviewed content: none
Outcome: scheduled work distinguishes preparation from the original operator-facing reply and from the earlier waitsOn classification; completed results use the existing retained-report delivery path.
Affected rules: 8, 10, 12, 22, 26, 34, 36, 41, 46, 58, 64, 70, 74, 83, 92, 101, 111, 113, 116
Affected floors: secrets — existing provider and outbound checks; spend cap — existing reservations and limits, no added runtime call; stop — existing work/send gates; no duplicate sends — existing report binding and receipt settlement; durable intake — existing encrypted journal. All unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-facing scheduled work instruction affects whether an owed answer completes; no parser, authority, scheduling, storage or delivery behavior changes.
Side effects: both tools and no-tools work routes receive the clarification. Genuine unfinished work and missing input still return continue/waiting. Existing open completion-checklist entries still prevent completion. No new semantic classifier, retry or send permission.
Undo and recovery: revert the instruction, documentation and tests and regenerate the register; persisted records retain their existing shape and meaning.
Multi-machine posture: existing owner journal governs work and delivery across machines; no new product state or machine-local coordination. Replay roots are isolated and disposable.
Layer below: compare the train-74 and train-76 D proof artifacts and decrypt their journals read-only. Work scheduling ran before the failed measurement; report storage, inhibition formatting and follow-up receipt settlement are unchanged between those builds. The recorded train-76 outputs explicitly equate returning report with delivery and wait for another operator message. Their earlier waitsOn=operator is a classification, not evidence of a current missing preparation input.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/deferral-delivery.test.ts; live=tests/preview/fixtures/deferral-delivery-2026-10-18.json
Hook bypass: none
Convergence: none
Decision: behavior-not-check-timing | retain D waits: two scheduled calls had already completed with continue, so neither a pending call nor a stale delivery count explains the failed check | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-delivery-1018-PROGRESS.md
Decision: attribution | no train-76 member changed the work question, inhibition formatter or report-delivery implementation; claim-evidence e83bdde9 changed shared instructions, but a fresh unchanged-envelope rerun reports successfully, so causal attribution to that member is not established | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-delivery-1018-PROGRESS.md
Decision: existing-work-instruction | clarify the scheduled call and historical classification without converting continue to report or widening send authority | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deferral-delivery-1018-PROGRESS.md
Prompt review: explanation of application protocol by meaning, not matching a user's wording. Original operator constraints still govern delivery; the runner continues to enforce grants. Real train-76 frames 268/281 (updates 46040305/46040306) reproduce no finished result; fresh provider replays of both complete envelopes with only the work question changed return substantive reports. One unchanged-envelope rerun also reports, retained as contrary evidence against deterministic regression attribution. These are fresh bounded calls and offline shipped-worker replay, not a new live Telegram acceptance claim.
Verification: 130 targeted tests pass in eight files, including nine new tests. The instruction test failed before the change. Real failing outputs remain continue; new actual reports yield exact inhibition, a Follow-up on delivery on hi, zero remaining delivery, and no duplicate after reopen. Existing replay includes summary-writer 715672480, summary-uncertain 715672483, Jev undecided 715672482 and unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty reply 715672550. Architecture and typecheck pass. Final pushed-head checks are recorded in PROGRESS.

Register publication: existing replay generator consumed source 11d9130153ddeacfa804de9c6ce8a161ec48bf66 and produced generation sha256:fa235b4f6ff47a69d33aadfb58ce48d9a83ce63bbc8f1f74fc2a3a967a533d25. Seven generated files refresh source/generation metadata only. The preparation documentation lives in Details, outside the capability briefing; no unrelated answer-prompt growth. No declarations or certificates changed.

## Closing block

simplestRobustRoute: clarify the existing work instruction and keep the scheduler, model-owned outcomes and delivery machinery. This is the simplest robust route: no new retry, detector, state or send path. The named failure is the model treating a scheduled preparation call as the reply the operator asked to postpone, reinforced by a historical waitsOn label. Durable intake starts the work; substantive completed reports and delivery receipts close it; genuine dependencies, stop, caps and existing send guards remain enforced. Both recorded cases produce reports in fresh unattended provider calls and drain in isolated shipped-worker replay.
80/20: targeted consumers plus the mandatory pinned gate; the pipeline owns the full suite and deployment acceptance.
VERDICT: author submission; no independent convergence claimed. The desk reviews this evidence.
