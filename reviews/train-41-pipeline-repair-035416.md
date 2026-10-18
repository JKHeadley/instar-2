# Change review — Train 41 pipeline merge repair

Subject base: 58595119123050bce71d2dfb8d57e6cf78d3455b
Review state: open
Reviewed content: none
Outcome: Merge live fc140791 into train-41 without losing prepared-envelope summary coverage or exact Telegram receipt validation; current main is already an ancestor.
Affected rules: 26, 34, 36, 37, 49, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop and durable intake retain existing guards; no duplicate sends retains live exact receipt matching and conservative uncertain outcomes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge existing reviewed delivery behavior into the candidate; the sole manual test conflict must preserve both consumers.
Side effects: The fixture now exercises prepared envelopes together with encoded replies and classified Telegram receipts. Live receipt normalization and journal validation arrive unchanged from the live parent. No authority, prompt, parser or schema is redesigned.
Undo and recovery: Revert this merge through the desk release procedure; never replay uncertain sends. The original parent histories remain available.
Multi-machine posture: Existing conversation ownership and durable intake are unchanged; this is merge reconciliation and machine-local test setup only.
Layer below: Inspect both parent fixtures, prepareJournalEnvelope, classifyTelegramSend, wholeReplySent and register replay. Preserve the two upstream histories and verify their combined test consumer.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset; common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No new model-facing behavior in the resolution. Both reviewed parents retain their prompts; replay the committed real-shape suites for combined-path confidence.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response is unchanged; tests verify the same protocol response.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-citation instruction is unchanged; fixture exercises the source-label protocol.
Decision: train-41-repair-merge | Keep prepared envelope selection from train-41 and classified receipt handling from live in the same fixture; regenerate generated outputs rather than merge their bytes manually. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-035416-PROGRESS.md

## Closing block

simplestRobustRoute: Resolve the single test fixture conflict by retaining both independent behaviors, preserve both parent histories, and rebuild the register using its existing generator; no new mechanism is needed.
80/20: Focused consumer checks and cheap gates establish the repair; the Studio owns full-suite and native macOS acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
