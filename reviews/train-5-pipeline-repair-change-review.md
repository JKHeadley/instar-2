# Change review — train-5 historical review budget replay repair

Subject base: 4e808bf858213964be9f3bb954d46b66871f4d10
Review state: open
Reviewed content: none
Outcome: Restore the historical self-description packet replay after the October 10 reply-review budget change. Translate the exact recorded 300-character legacy response instruction to the current 160-character reason and 400/4000-character output instructions while retaining whole-question equality.
Affected rules: 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116; purpose ability constraint
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test assertion and its explanatory comment change; runtime prompts, parsers, capability scope and recorded fixture bytes are unchanged.
Side effects: The exact-string translation covers only the recorded response format and known brevity evolution. Rules, obligation guide and tool-route packet fields remain checked against current code. Historical broad-claim violations, precise-limit passes and asked-work refusals remain replayed.
Undo and recovery: Revert this test-only commit to restore the previous assertion; no persistent state or installation changes require recovery.
Multi-machine posture: Machine-local test evidence only; the assertion is portable and introduces no distributed state or peer dependency.
Layer below: Inspected replyReviewQuestion and the October 10 reply-review-budget test, including its exact prepared-input hash, actual over-cap uncertain result, real successful replacement, unchanged parser acceptance of reasons longer than the requested length, and send-once restart cases. Historical October 4 packet bytes remain immutable.
Bug class: none
Bug evidence: Test-only stale expectation: saved gate report has one failure in selfdesc-limits; the repaired six-case file and four-case reply-review-budget file pass under locked Vitest 3.2.7, nice -n 10, --maxWorkers 1. Typecheck, build, architecture, lint and register checks pass after installing this worktree's locked dependencies. The copied saved full report still records that one old failure; all eleven contract checkers refuse its global success=false before mapping. No fresh full suite was run, per operator direction.
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains only sample hooks
Convergence: none
Decision: train-5-replay-budget | Translate only the exact historical output-format and brevity instruction, retaining whole-question equality and immutable captured evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-5-repair-PROGRESS.md

Subject (1 paths): tests/preview/selfdesc-limits.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing explicit historical protocol translation to include the shipped brevity instructions, without changing runtime behavior or weakening semantic assertions. No machinery or new guards are added. Existing fixture provenance, exact packet equality and both verdict sides remain the test's start/end checks. No autonomous live-completion claim is made.
80/20: The sole reported failure is fixed at its source. Ten related recorded-replay tests and the cheap checks verify the change; the pipeline supplies the authorized full-run evidence after push. No quarantine or source pin edits are needed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
