# Change review — cint-L40 pipeline repair: two packet pins follow w3-retrocluster's pushback sentence

Subject base: 5a41f47c5c81473865abc91d1289ffc2686c01f4
Review state: open
Reviewed content: none
Outcome: The Studio full run of cint-L40 5a41f47c failed two tests: tests/preview/recall-latency.test.ts "profiles full turns at 2000 turns with every memory source" (packet hash pin) and tests/preview/journal-people.test.ts "links an introductory claim even when its source ends in a question" (no merge candidates offered at maxBytes 7100). Cause: w3-retrocluster d3692b4c added one conditional sentence to the reply packet's capability note ("A message disputing an answer in history, with no new argument, is pushback: say where you stand before asking what it corrects.", Rule 19). It rides whenever an answer of the agent's is shown in history, which both fixtures have. Removing just that sentence makes both tests pass and reproduces both prior recall pins exactly (73561b15…410374 and 33ce2cbb…8489fa). Recall latency: the packet was diffed field by field against the prior one; only `capability` changed, 3471 to 3600 bytes, by exactly that sentence, so the two hashes are re-pinned with that note. People merge: the merge candidates are again the block that yields under the fixture's byte budget; re-measured in 10-byte steps, fit 7110 and fail 7100, so the budget is 7180, keeping the same 70 bytes of headroom it had. The sentence and product code are unchanged. Both files pass in full in a targeted run (21/21).
Affected rules: 37 (each failure fixed at its source, a pin that trailed an intended prompt change, with no quarantine), 19 (the pushback sentence is kept, not trimmed to fit a test), 11 (the re-pin records exactly what changed), 116, 74 (this record)
Affected floors: secrets — unchanged, test only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test-only re-pin and re-measure; no product code, prompt or register entry changes.
Side effects: none
Undo and recovery: revert the repair commit.
Multi-machine posture: none; test only.
Layer below: tests/preview/journal.ts capability note (the w3-retrocluster hunk, carried unchanged) and reviews/w3-retrocluster-change-review.md.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit; no bypass flag)
Convergence: none
Decision: cint-L40-repin-pushback | re-pinned the recall packet hashes and raised the people-merge fixture budget from 7100 to 7180 (measured fit 7110) rather than drop or gate the Rule 19 sentence, because the sentence is the reviewed fix and both failures are pins that trailed it, proven by removing only the sentence to reproduce the old pins | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L40-PROGRESS.md
Prompt review: none; no model-facing text changed. The tests only follow the carried sentence.
Prompt finding: 450c79237a95 | protocol-literal | an existing fixture phrase in journal-people.test.ts matching existing provider wording, unchanged by this change

Subject (3 paths): reviews/cint-L40-pipeline-repair-change-review.md, tests/preview/journal-people.test.ts, tests/preview/recall-latency.test.ts

## Closing block

simplestRobustRoute: re-pin the two values that trailed the reviewed sentence, each proven by removing only that sentence; product code untouched.
80/20: two failing tests fixed at their source; targeted runs only, the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
