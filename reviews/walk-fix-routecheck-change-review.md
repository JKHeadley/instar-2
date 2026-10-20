# Change review — walk-fix-routecheck: a failing doorway check stays on status

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: ordinary owner answers no longer carry the 'Model route check: ... unverified/changed' line (walk-24 msgs 1 and 3, runs A and B); the failing standing doorway check stays on the status pull surface (doorways.fresh, doorways.standing).
Affected rules: 8, 56, 74, 87, 88, 89, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged, no model call added; stop — unchanged; no duplicate sends — fewer lines, no new send; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: removes one notice source from the reply path; no new effect, store or model call.
Side effects: the operator no longer hears of an unverified or changed model route in a reply; status still reports it and the standing check still runs. Recorded answers that carried a doorway: notice still validate on replay (key prefix kept).
Undo and recovery: revert the commit; the notice producer and its call return. No stored state changes.
Multi-machine posture: machine-local reply text only; no shared state, sender or ownership change.
Layer below: inspected doorwayFreshness/standingDoorwayCheck and the status doorways block (unchanged), validAnswerNotices replay of recorded doorway keys, and openReplyNotices ordering with the remaining notice sources.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent-resources.test.ts
Hook bypass: none
Convergence: none
Decision: routecheck-status-only | the doorway state is the agent's own maintenance (Rules 56, 87, 88), so it moves to the pull surface rather than being reworded | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md
Prompt review: not model-facing: the line was appended by the runner after the model answered. Shape replayed: run B frame 25 recorded candidate '17 times 23 is 391.\n\nModel route check: ...' and doorway-notice-held-2026-10-11 fixture.
Prompt finding: 4106b49fff07 | protocol-literal | existing tool-attempt honesty guidance in journal.ts, unchanged by this unit.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response contract in journal.ts, unchanged by this unit.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label and uncertainty guidance in journal.ts, unchanged by this unit.

Subject (6 paths): tests/preview/credential-reminders.test.ts, tests/preview/credential-reminders.ts, tests/preview/doorway-notice-replay.test.ts, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts

## Closing block

simplestRobustRoute: delete the producer call and the function; status already carries the state. This is that route: no new mechanism.
80/20: the line on every ordinary reply was the defect; status reporting is left as is.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
