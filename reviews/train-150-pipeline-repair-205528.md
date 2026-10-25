# Change review — Align Codex recall replay with preserved answers

Subject base: b1098e8b729322df2607bd4fbbf85e7a08c6683c
Review state: open
Reviewed content: none
Outcome: Repair the two stale delivery assertions after the accepted recall answer precedence change, preserving captured historical deliveries unchanged.
Affected rules: 11, 36, 37, 49, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets — no outbound code changed; spend cap — no model calls added; stop — unchanged admission; no duplicate sends — repeated drain assertion retained; durable intake — restart replay and supersession assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only expectation repair; no model prompt, parser, runtime decision or production state changes.
Side effects: The recorded-update and explicit-now replays now require the exact captured answer and source line instead of the historical inventory overwrite. Unrelated and quoted cases retain historical expectations. Capture files remain byte-identical.
Undo and recovery: Revert this test-only change; no state migration or runtime recovery needed.
Multi-machine posture: Portable offline replay on each host, with temporary encrypted journals; no shared production state changes.
Layer below: Inspected captured model outputs for update 367052737 in both failing scenarios, their delivered inventories, the journal memoryList empty-answer boundary, and recall-meaning positive/empty-answer inventory tests. The accepted runtime implementation already preserves the correct answer.
Bug class: unit
Bug evidence: reproducer=tests/preview/codex-recall.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompts or model behavior changed. The literal expected reply is captured evidence, not an instruction to a model.
Decision: train150-preserve-capture | Keep the historical capture immutable and assert the exact current reply separately, so the test detects inventory replacement without rewriting history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-150-repair-205528-PROGRESS.md

Subject: tests/preview/codex-recall.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: correct two stale test expectations while retaining historical evidence and existing durable restart/no-resend checks. No runtime machinery, authority or resource bounds change. Offline replay is not live acceptance.
80/20: Target the only failed file and verify the existing answer/inventory neighbors; Studio owns the full gate and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
