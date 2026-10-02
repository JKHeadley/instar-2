# Change review — w3-summarybound pipeline repair: a snapshot restores only the current summary format's failures

Subject base: 4105dc10c2c3243b5a75126ca1685f1c655f16f4
Review state: open
Reviewed content: none
Outcome: Plan row #287, cint-L29 review MUST-FIX 1. A journal compacted by cint-L28 saved its format-2 summary failures in the snapshot as `{through, overCap}` with no format, and this build restored them unchanged, so the format-2 brake stayed in force after the upgrade; raw replay of the same rows dropped it because the reducer keeps only failures made under the current SUMMARY_FORMAT. Each saved failure now carries the format it was made under, and snapshot restore keeps only the current format's; an entry with no format is a cint-L28 entry and is read as format 2. Tests: summary-bound.test.ts 14/14 (two new). The upgrade pair opens two fixtures written by the real cint-L28 build (11eaaac5): the same history as raw rows and after that build's own compaction; under this build both show no brake, no restored failure, 8 calls / 6 replies / 6 turns, bytes unchanged by a read-only open, and the next forced pass makes 2 summary calls and reaches frontier 6. The current-format neighbor: two over-bound failures under format 3, compacted and reopened, still brake at frontier 1 and the next pass makes no call. With the restore filter removed the upgrade-pair test fails (compacted: stopped at 1, 0 calls) and the neighbor still passes.
Affected rules: 44 (an upgrade reads a journal an installed build wrote: raw rows and a snapshot give the same state), 96 (the rolling summary is not left stopped by a brake the current format does not have), 55 (failures under the current format keep their two-attempt budget and brake across compaction and restart), 36 (the fixtures are bytes the cint-L28 writer and compactor produced, not a hand-built snapshot), 45 (every reader of the saved list is the one restore path), 70 (regression test fails without the fix), 7 (nothing deleted: the raw rows and summaryFailures / summarySpanFailures totals are untouched), 37 (fixed at the source, no quarantine), 69 and 90 (register replayed from committed sources), 74 (this record), 111 (layer below named), 113 (posture below), 116 (one field and one filter; no new row kind, journal, retry layer or gate)
Affected floors: secrets — unchanged (the two fixtures are synthetic turns under the test file's fixed test key, no credential); spend cap — unchanged (a restored cint-L28 snapshot gets the same fresh attempts raw replay already gave, inside the per-frontier budget and the call cap; current-format failures stay spent); stop — unchanged; no duplicate sends — unchanged (no send path touched); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a snapshot-restore change in the summary path, one field and one filter, bounded by the unchanged brake, per-frontier budget and call cap.
Side effects: a snapshot this build writes carries `format` on each saved failure, which changes the projection digest of a view holding current-format failures (raw replay and snapshot agree, and the compaction verifier compares the two). An older build reading such a snapshot ignores the extra field. A snapshot this branch wrote before this commit with unstamped format-3 failures would lose that brake once; no such snapshot exists outside test scratch, since this branch has not landed.
Undo and recovery: revert 806d0c11, its register replay a58cfd9a and this record, and replay the register. No journal row kind changed.
Multi-machine posture: unchanged; machine-local preview runner. A takeover reads the same journal through the same restore path, so raw rows and a snapshot give the same brake on either machine.
Layer below: restoreSnapshot and snapshotOf (the compaction verifier compares the restored projection with the live one, and a stamped entry round-trips exactly), the summary-failed reducer, summaryStoppedAt / summaryBraking and the format-scoped attempt budget, read and unchanged apart from the stamp. summarySpanFailures, summaryFailures and summaryOverCapFrontiers are not format-scoped in replay either, so they restore as before.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-bound.test.ts
Hook bypass: none
Convergence: none
Decision: summarybound-snapshot-format-stamp | stamp each saved failure with its format and filter on restore, rather than a snapshot-wide format field, because the list is the only format-scoped state and the reducer already has the row's format in hand | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-summarybound-PROGRESS.md
Decision: summarybound-unstamped-is-format-2 | an entry with no format is read as format 2, the only format any landed build saved in this list | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-summarybound-PROGRESS.md
Decision: summarybound-l28-fixtures | commit two encrypted fixtures produced by the cint-L28 source rather than load that source from git at test time, so the test does not depend on the gate checkout's history depth | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-summarybound-PROGRESS.md
Prompt review: no prompt, question or model-output reader changed.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/fixtures/summary-format-L28-compacted.encrypted, tests/preview/fixtures/summary-format-L28-raw.encrypted, tests/preview/journal.ts, tests/preview/summary-bound.test.ts

## Closing block

simplestRobustRoute: the required behavior is that the same history gives the same summary brake whether it is read as raw rows or from a snapshot, across a format change. The simplest robust route is this proposal: the saved failure carries its format and restore applies the same current-format test the reducer applies to raw rows.
80/20: 0 must-fix, 1 note — live catch-up on Justin's root is still unproven by this change; it only removes the snapshot path's stale brake.
VERDICT: author submission; the independent verdict is recorded as a pass
