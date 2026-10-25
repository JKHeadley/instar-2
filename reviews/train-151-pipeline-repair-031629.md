# Change review — Recorded summary replay budgets

Subject base: 4d6811da914b50f63452113cd43ce042b365366c
Review state: open
Reviewed content: none
Outcome: Restore the recorded summary outcome tests after the format-5 change while proving historical failures remain retryable.
Affected rules: 1, 26, 34, 36, 37, 42, 49, 55, 70, 74, 101, 102, 111, 113, 116.
Affected floors: secrets — offline existing captured fixture only; spend cap — no provider calls and current-format budget assertions retained; stop — runtime unchanged; no duplicate sends — replay send port throws; durable intake — original fixture bytes and production journal unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of the historical replay setup; no product logic, prompt, limit or authority changes.
Side effects: Projecting only summary-failed format metadata deliberately models exhaustion under the current format. Recorded bodies, usage and refusal assertions remain intact; a separate unchanged-row test prevents this projection from hiding historical retry behavior.
Undo and recovery: Revert this test and review commit; no durable production state or migration changes.
Multi-machine posture: Machine-local isolated offline test journals, deleted after each test; no shared state or transport changes.
Layer below: Checked journal.ts SUMMARY_FORMAT=5, summary-failed projection into summaryFormatFailures, current-format candidate filtering and existing journal-reminder-idle.test.ts dual-format replay pattern.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-ack-walk.test.ts
Hook bypass: none
Convergence: none
Decision: train151-repair-format | Project historical failure format only in outcome replays that require an exhausted current budget, and separately assert unchanged historical rows remain retryable; preserve all recorded output strings and runtime behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-repair-031629-PROGRESS.md

Subject: tests/preview/summary-ack-walk.test.ts

## Evidence

The original test run reproduced 32 failures and 6 passes. After repair all 39 tests passed. The original recorded fixture is unchanged. Its writer bodies span updates 840342886–840342905; coverage retains malformed refusal, valid acceptance, uncertain reservation without duplicate dispatch, Jev undecided followed by review violation, full-history delivered replies, and bounded automatic compression. The projection is a current-budget test scenario, not a claim that the historical journal used format 5 or that a live model was invoked.

## Closing block

simplestRobustRoute: Adapt the existing offline replay setup at its format boundary and add the historical neighbor assertion; this is that route, with no new runtime machinery and all five floors unchanged.
80/20: The focused regression passes; the Studio retains full-suite and live acceptance responsibility. No independent convergence is claimed here.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
