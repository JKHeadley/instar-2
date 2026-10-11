# Change review — Preserve historical reply-review budget evidence

Subject base: eac5483b70ca9973d91448cd89abb0dc1bce2aea
Review state: open
Reviewed content: none
Outcome: Repair historical replay provenance without changing current review prompts or provider limits.
Affected rules: 36, 37, 41, 49, 58, 70, 74, 101, 111, 113, 116.
Affected floors: secrets — unchanged; spend cap — same provider allowance; stop — unchanged; no duplicate sends — existing restart replay passes; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only provenance repair; runtime behavior and recorded fixture bytes are unchanged.
Side effects: Historical request reconstruction now uses its actual captured question. All current instructions following the per-rule definitions remain bound to that question; act-first replay separately pins current rule wording to real captures.
Undo and recovery: Revert this test repair and regenerate any derived register publication with the existing tools; this restores the known digest mismatch, not a runtime behavior change.
Multi-machine posture: Tests and captured fixtures are shared through git; no runtime state or ownership changes.
Layer below: Compared recorded original/replay questions, exact input digests, unchanged provider allowance, current prompt budget instructions, and fresh act-first current-prompt captures.
Bug class: unit
Bug evidence: reproducer=tests/preview/reply-review-budget.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->

Decision: train6-budget-history | Authenticate captured request bytes using their recorded question, keeping current budget instructions and real current-prompt evidence independently checked. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-6-repair-PROGRESS.md

Subject (1 paths): tests/preview/reply-review-budget.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: authenticate the historical request with its recorded question and retain an independent current-budget assertion plus existing real current-prompt replay. No new mechanism. Start guard is exact recorded request hashes; end guard is 11 passing replay tests; limit guard is the existing provider allowance.
80/20: Both historical hashes and current budget instructions pass; real current-prompt reviewer cases and complete/uncertain send-once restart cases pass. No independent convergence claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
