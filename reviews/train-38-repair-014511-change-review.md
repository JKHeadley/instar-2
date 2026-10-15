# Change review — train-38 historical capability replay repair

Subject base: 80a542595b17b82e4964898def73ca4e06ee10be
Review state: open
Reviewed content: none
Outcome: Replay the recorded capability outputs after the task-completion guidance addition without rewriting historical evidence or accepting unrelated prompt drift.
Affected rules: 26, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — no runtime changes; spend cap — offline replay only; stop — unchanged; no duplicate sends — sends remain local test doubles; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One historical test comparison repaired; no model-facing guidance, parsing, runtime policy or fixture changes.
Side effects: The replay permits only the known TOOL_TASK_COMPLETION addition when comparing historical prompts. An explicit once-only assertion rejects missing or duplicated current guidance; full equality still rejects other drift. All recorded positive and negative output assertions remain active.
Undo and recovery: Revert this test and review commit. No state migration or deployment recovery required.
Multi-machine posture: Repository test behavior is identical across hosts; replay journals are temporary machine-local fixtures, never replicated or delivered externally.
Layer below: Compared the historical system prompts with production-provider.ts and tool-answer-guidance.ts; the sole difference is TOOL_TASK_COMPLETION. Existing act-first and selfdesc-abilities comparisons already remove that exact addition. Replayed the real recorded outputs through readAnswer and the journal worker.
Bug class: integration
Bug evidence: reproducer=tests/preview/train-12-capability-replay.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train38-repair014511-history | Compare immutable historical prompts against current framing minus only the known completion addition, following existing replay tests; retain full equality and once-only current guidance checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-38-repair-014511-PROGRESS.md

Subject (1 paths): tests/preview/train-12-capability-replay.test.ts

## Closing block

simplestRobustRoute: Use the existing exact historical comparison pattern. This is the simplest robust route: no new production machinery, fixture rewriting or broad normalization. The start guard is the exact recorded fixture, the end guard is rendered output and provenance assertions, and the limit is exclusion of only one named guidance addition. This test-only repair claims no fresh model or unattended production result.
80/20: The original assertion fails locally and the repaired test passes with all recorded successful and failed outputs retained. Run the targeted replay, typecheck and required cheap gates; the Studio owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
