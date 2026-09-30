# Change review — cint-L4 repair: an index write-off stays matched to its reservation after a later batch supersedes it

Subject base: c14e24c4bfb4dfd39d9fb0d2bb6684d0bb4c9358
Review state: open
Reviewed content: none
Outcome: Astra (c14e24c4) found unknownCallKeys named an open index reservation `index-open:<key>` but the same reservation `index:<position>:<key>` once the next index-reserve moved it into indexUnknown, so a recorded write-off stopped matching: a later authorized raise was falsely refused and one call could be written off twice. Both now use the reservation's own key (`index:N`, unique because indexOffered only grows). UNKNOWN status, full charges, one-shot offering and exact pending-set validation are unchanged. No live journal has an index write-off (the live copy's nine are answers, summary, reviews and Jev), so no legacy label needs an alias. New test in tests/preview/journal-spend-cap.test.ts covers write-off, later successful batch, compaction and restart (no longer pending, a repeat write-off is refused, a plain raise is admitted) and a new unresolved batch that still needs its own write-off; it fails on the parent.
Affected rules: 13, 26, 37, 74, 116
Affected floors: secrets — unchanged; spend cap — unchanged, every index reservation stays charged and UNKNOWN; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the UNKNOWN-call accounting that gates a spend-cap raise
Side effects: none beyond the key label for index calls in pending/write-off lists
Undo and recovery: revert these commits and regenerate the register.
Multi-machine posture: machine-local; unchanged
Layer below: docs/00-the-purpose.md, docs/01-the-rules.md; tests/preview/journal.ts index-reserve reducer and checkCaps
Bug class: durability
Bug evidence: reproducer=tests/preview/journal-spend-cap.test.ts; restart=tests/preview/journal-spend-cap.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, system prompt or provider policy changed
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-spend-cap.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: name index calls by the reservation's existing unique key instead of its changing position; no new store, alias table or authority path (Rule 116).
80/20: tsc clean; journal-spend-cap and journal-meaning-backfill 13/13; the new test fails on the parent; lint, register:check, change-review check and git diff --check pass; the full gate reruns on the Mama PC.
VERDICT: author submission; the independent verdict is recorded as a pass
