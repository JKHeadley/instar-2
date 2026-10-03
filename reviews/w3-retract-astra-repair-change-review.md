# Change review — w3-retract Astra repair: an in-flight summary cannot restore retracted facts

Subject base: b5089215d8a49110d839d9b8c12ceb4edcc95e33
Review state: open
Reviewed content: none
Outcome: Astra's w3-retract round 1 MUST-FIX is repaired at its source (4cda078f). `applyRetract` retired only the rolling summaries already recorded, so a summary whose model call was out when the operator's yes applied the retraction could finish afterward and append at a new index absent from `retiredSummaries`; `liveSummaries` then served its text built from the retracted turns (Astra's reproducer: "Sam", "7734", "two sentences" active again through update 8). In tests/preview/journal.ts the summary pass now records the retraction state its packet was built under (the length of `view.retracted`, which only grows) and, at final admission after every awaited reviewer, settles a call that a retraction overtook through the existing `summary-failed` row with reason SUMMARY_RETRACTED_REASON: the reservation is released, the usage is settled as the accepted row would have settled it, `memoryPendingFor` is kept so a pending memory request stays pending, and no format is recorded, so the span spends none of its format retries. The next pass rebuilds from the turns that remain. tests/preview/retract-turns.test.ts gains Astra's overlap case (pause the old call, apply the yes, release) and asserts no active summary, the failure reason, no open reservation, an unchanged call count, then a clean rebuild that still carries the operator's own message, and an identical projection on replay. It fails with the check disabled and passes with it. Register replayed at 4cda078f (08f14a2b).
Affected rules: 35 (test traffic never returns to active memory, including through a call already out), 7 (nothing deleted; the stale answer is a recorded failure, not dropped), 11 and 96 (recall and summary readers see only live summaries), 26 and 42 (the call's outcome is settled by its own row, never left UNKNOWN), 55 (bounded summary work: the stale settlement spends no span retry and adds no call), 37 (fixed at the source, no quarantine), 69 and 90 (register replayed from committed sources, never hand-edited), 74 (this record), 116 (one captured number and one comparison at admission; no lock, epoch store or new row kind)
Affected floors: secrets — unchanged; spend cap — unchanged (the call stays counted; its usage is settled, nothing is refunded); stop — unchanged; no duplicate sends — unchanged (summaries send nothing); durable intake — unchanged (no row kind or field added; the existing `summary-failed` row carries a new reason string)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one admission check inside the existing summary pass, reusing the existing failure row and its projection, plus a test; no new store, call, prompt, gate or authority path.
Side effects: a summary pass that overlaps an approved retraction records one `summary-failed` (reason "summary built before a retraction") instead of a summary; the following pass rebuilds.
Undo and recovery: revert 4cda078f, its register replay 08f14a2b and this record to return to b5089215. A journal written meanwhile replays under either version (the row is an ordinary `summary-failed`).
Multi-machine posture: machine-local; the single preview journal worker and its journal.
Layer below: tests/preview/journal.ts runSummary (reservation, supervised review cascade, final admission), the `summary-failed` projection (reservation release, token settlement, span and format failure counts), `applyRetract` and `liveSummaries` (read, unchanged); reviews/w3-retract-change-review.md (the unit this repairs)
Bug class: integration
Bug evidence: reproducer=tests/preview/retract-turns.test.ts
Hook bypass: none
Convergence: none
Decision: w3-retract-repair-admission-check | compare the retraction count captured at reservation with the count at final admission and settle through the existing failure row; not chosen: retiring late summaries in the projection (their people, commitments and memory effects would still project) or a lock between intake and the summary pass (new machinery for a check one comparison makes) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-retract-PROGRESS.md
Prompt review: no prompt text changed; only whether a finished summary answer is admitted.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing answer-guidance wording in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/retract-turns.test.ts

## Closing block

simplestRobustRoute: this is that route: one captured count and one comparison at final admission, settled through the existing failure row; no lock, epoch store, row kind or review layer.
80/20: 0 must-fixes, 1 note (targeted tests only, no full suite on this machine, per the operator's rule tonight)
VERDICT: author submission; the independent verdict is recorded as a pass
