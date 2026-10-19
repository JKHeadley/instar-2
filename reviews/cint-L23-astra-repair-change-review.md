# Change review — cint-L23 Astra repair: continuity disclosure scoped to one run

Subject base: 28ed5d2a6163526f29d91adaaacccfaab40546b3
Review state: open
Reviewed content: none
Outcome: Astra's cint-L23 MUST-FIX 1 is repaired at its source (c63f48c2). w3-longchat made the Rule 110 continuity sentence quiet once it had been delivered for an answered message on the same seam, but it read "already delivered" from the whole persisted conversation, so a disclosure from an earlier run silenced the first reply after a later compaction, close, reopen and a day's pause (Astra's reproducer: update 32 sent only "PREVIEW — Noted." with summarizedThrough 31). In tests/preview/journal.ts the worker now keeps an in-memory set of the turns it sent with a spoken disclosure in this run. When the last delivered spoken account came from an earlier run and the current frontier is newer than the one it named, that account no longer counts as already said, so the first reply after the resume discloses; once this run has spoken, its later routine replies stay quiet as before. A resume whose frontier is not newer than the one already said stays quiet. The UNKNOWN-send carry-forward, the pending/superseded dispositions and the changed-seam rule are untouched (still decided by `continuitySpoken`). tests/preview/journal-longchat.test.ts gains the close/reopen/new-frontier case with its quiet neighbour in the same run and a no-newer-frontier resume; it fails with the episode check removed and passes with it, and Astra's own probe now prints the disclosure, matching accepted L22. Register replayed at c63f48c2 (3e2f14b0).
Affected rules: 110 (the first reply after a compaction discloses and accounts, including after a resume), 77 (routine replies in one run stay quiet), 2 (every turn still records its account), 37 (fixed at the source, no quarantine), 69 and 90 (register replayed from committed sources, never hand-edited), 74 (this record), 116 (one in-memory set; no ledger, model call, classifier or review layer)
Affected floors: secrets — unchanged; spend cap — unchanged (no model call added); stop — unchanged; no duplicate sends — unchanged (an UNKNOWN send is still never replayed; only the wording of the next reply changes); durable intake — unchanged (no row kind or field added; the episode set is derived, not persisted)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one condition on which prior account counts as already spoken, inside the existing continuity projection, plus a test; no new store, call, prompt, gate or authority path.
Side effects: after each worker start (a restart or resume) the first reply from a context whose frontier has moved past the last disclosed one opens with the disclosure once; routine replies after that stay quiet.
Undo and recovery: revert c63f48c2, its register replay 3e2f14b0 and this record to return to 28ed5d2a. Nothing persisted differs; a journal written meanwhile replays under either version.
Multi-machine posture: machine-local; the single preview journal worker. The episode is that worker process's run.
Layer below: tests/preview/journal.ts continuitySpoken, continuityFor and the reply composition that applies the disclosure (read; only continuityFor's input to the predicate changed); the journal replay check that a spoken account's reply opens with the disclosure and a silent one's does not (unchanged, still passes); reviews/w3-longchat-change-review.md (the unit this repairs)
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-longchat.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L23-repair-episode-by-run | the episode boundary is the worker's own run (an in-memory set of turns it sent with a spoken disclosure), combined with "the frontier is newer than the one last said"; not chosen: the 24-hour resumeGap alone (a restart into newly compacted history within a day would stay silent) or a persisted episode marker (a new row kind for a derived fact) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L23-PROGRESS.md
Prompt review: no prompt text changed; only whether the existing fixed disclosure sentence is prefixed to a reply.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing answer-guidance wording in journal.ts, unchanged by this repair (as dispositioned in the carried records)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-longchat.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: this is that route: one in-memory set and one condition in the existing continuity projection; no ledger, model call, classifier or review layer.
80/20: 0 must-fixes, 1 note (targeted tests only, no full suite on this machine, per the operator's rule tonight)
VERDICT: author submission; the independent verdict is recorded as a pass
