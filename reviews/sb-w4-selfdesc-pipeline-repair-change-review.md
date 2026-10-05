# Change review — sb-w4-selfdesc pipeline repair: keep the recorded-question rewording inside its expectation

Subject base: a8aa6d1d940bdaf8572bf476c38163719d427d15
Review state: open
Reviewed content: none
Outcome: Plan row #542 pipeline repair. The answer-check FAIL at 2026-10-05 01:00:22 on a8aa6d1d was not caused by this branch: its reply line "Node.js v24.14.1" is the last line of a Node crash, because the desk's probe sender send-one.mjs is missing from its /private/tmp scratchpad (the same cause sb-w4-workmemory and sb-w4-dashro recorded); that is desk tooling and has no source fix here. The cheap gate check node scripts/check-change-review.mjs check did fail on this branch (33 records: prompt finding 36f3b9ffcddc, fixture-phrase, tests/preview/reply-check.ts <- tests/preview/selfdesc-limits.test.ts). Its source: the sb-w4-selfdesc merge moved the recorded-question rewording (.replace chain) out of an expect(...) call into a const, so the prompt scan read its replacement text as a fixture input that copies the reply-review prompt. This commit restores the cint-L50 shape: the rewording sits inside the review-r2 equality expectation, and the other branch checks the recorded content directly (the rewording never touched 'in no broader terms', so that assertion is unchanged in meaning). change-review check is OK afterwards; selfdesc-limits is 6/6.
Affected rules: 12 and 27 (no copied fixture phrase reaches the prompt scan as an input), 36 and 106 (the recorded real shapes still replay with the same assertions), 37 (source fix, no quarantine), 74 (this record), 101 (no hook bypass), 116 (one test restructured, no new machinery).
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: a test-only restructuring of one assertion with identical meaning; no source, prompt or fixture changes.
Side effects: none outside tests/preview/selfdesc-limits.test.ts.
Undo and recovery: revert this commit; the only effect is the change-review prompt finding returning.
Multi-machine posture: none; a test file.
Layer below: reviews/sb-w4-selfdesc-change-review.md (the merge that introduced the const), and cint-L50's own selfdesc-limits assertion shape.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit; core.hooksPath is unset in this clone)
Convergence: none

Subject (1 paths): tests/preview/selfdesc-limits.test.ts

## Closing block

simplestRobustRoute: restore the assertion shape cint-L50 already used (the rewording inside the expectation) rather than dispositioning the finding on 33 historical records or changing the scanner.
80/20: 0 must-fix, 1 note — the answer check itself still needs the desk to restore send-one.mjs before it can pass; this branch cannot fix that.
VERDICT: author submission; the independent verdict is recorded as a pass
