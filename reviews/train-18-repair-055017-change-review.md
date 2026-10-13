# Change review — train-18 recorded memory attribution assertion

Subject base: 5831ab197ea1943820f05c51ab12117161dd92be
Review state: open
Reviewed content: none
Outcome: Repair the stale attribution assertion in the real recorded memory replay without changing the shipped prompt or captured evidence.
Affected rules: Rules 36, 37, 49, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — no runtime change; spend cap — no runtime change; stop — no runtime change; no duplicate sends — restart replay retains the once-only assertion; durable intake — replay still reopens encrypted intake before the model call.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test assertion follows the already shipped equivalent attribution wording and additionally checks that quotes/imports are data.
Side effects: The assertion intentionally binds the current instruction, so another wording change requires review. Historical raw model outputs and behavioral assertions remain intact. The literal-copy failure from the brief is already repaired by ancestor 25524c68 and passes unchanged.
Undo and recovery: Revert this test-only commit; no stored state, schema, prompt or capability changes.
Multi-machine posture: Portable recorded replay only; no runtime or replication changes. Studio retains the full-suite acceptance role.
Layer below: Inspected journal.ts memoryDecision and ancestor 25524c68's packet-budget repair. The current prompt still preserves attribution and treats quotes/imports as data; the test expected an obsolete synonym. Confirmed the existing literal-copy historical-prompt binding repair retains the original capture bytes.
Bug class: integration
Bug evidence: reproducer=tests/preview/inrole-memory-live.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample hooks only.
Convergence: none
Decision: train-18-repair-055017-attribution | Bind the existing replay assertion to the full current attribution clause rather than enlarge the bounded runtime prompt to restore an obsolete synonym. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-18-repair-055017-PROGRESS.md

Subject (1 paths): tests/preview/inrole-memory-live.test.ts

## Closing block

simplestRobustRoute: Update the stale assertion at its source and rerun the recorded intake/answer/restart cases; this is the simplest robust route and adds no machinery or runtime change.
80/20: Scope is the two reproduced assertion failures; retain the ancestor repair and all existing recorded-output, persistence, authority and duplicate-send checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
