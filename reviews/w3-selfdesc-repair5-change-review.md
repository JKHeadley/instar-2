# Change review — w3-selfdesc repair round 5: compaction keeps an earlier attempt's exact model input until the answer call settles

Subject base: 4bc8693017328ddfcf9acd4d8c317c16269df854
Review state: open
Reviewed content: none
Outcome: Repairs the w3-selfdesc round-5 unit review (Astra, VERDICT NO, one must-fix). retainedEvidence dropped a reserve, lookup, format-retry or answer-replace row's prompt whenever the snapshot turn held the same value. Round 4 made a format re-ask or timeout replacement overwrite that projection, so reserve -> compact -> re-ask -> compact left neither the reserve row nor the turn with the first attempt's exact input (the model-call record holds only a reference and digest). A row's prompt is now deduplicated only against a settled turn (answer, model state or intent recorded); every branch that can replace turn.prompt (lookup, format-retry, answer-replace) refuses once any of those is set, so the projection is final when the duplicate is dropped. The compaction test covers compaction between attempts and again after settlement, with reopen, on both orderings; the compact-before-re-ask case fails on the prior head and the other passes on both (positive neighbour).
Affected rules: 58 (earlier judgment evidence survives compaction), 45 (review and revision still read the projected final prompt), 34 and 36 (both orderings through the real encrypted journal, compactor and reopen), 37 (source fix, no quarantine), 74 and 111 (this record), 101 (no hook bypass), 116 (one predicate on the existing dedup; no new store, record kind or archive)
Affected floors: secrets — unchanged (the retained prompt is the same prepared envelope already recorded); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes which judgment evidence a compacted journal retains for an in-flight answer call.
Side effects: an unsettled turn's compacted snapshot keeps its reservation prompt as well as the turn's projected prompt (bounded by the packet limit, at most four rows per turn) until the answer settles.
Undo and recovery: git revert the repair commit, then replay the register; snapshots written with the extra prompt replay identically under either reducer.
Multi-machine posture: unchanged; journal rows and snapshots replicate as before.
Layer below: retainedEvidence and the new settledPrompt helper in journal.ts, and the lookup, format-retry and answer-replace reducer guards they rely on, exercised by journal-compaction.test.ts.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: selfdesc-repair5-settled-dedup | dedupe a row prompt only against a settled turn rather than never deduping, so settled journals stay as small as before | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-selfdesc-PROGRESS.md
Prompt review: no prompt wording changed.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-compaction.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: gate the existing prompt dedup on a settled turn. Not chosen: a per-attempt prompt list, a new record kind, or dropping the dedup entirely.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
