# Change review — cint-L39 Astra round 2 repair: a later tool attempt's trace accumulates onto earlier attempts' calls

Subject base: 9b5cfa7f7cf60f3fe54b105325b07dae3eb0d311
Review state: open
Reviewed content: none
Outcome: Astra's cint-L39 round 2 MUST-FIX 1: projectToolTurn replaced turn.toolAttempts and reset toolAttemptsOmitted from each trace alone, so a format re-ask that ran on tools and made no calls erased the first attempt's three admitted calls, and declaredObligations then gave the reply review an empty list under the exhaustive "The only tool calls this reply's turn made" meaning while the turn statistics counted three calls. Fix at the source: each trace appends its calls to the turn's existing excerpt up to the existing bound (TOOL_ATTEMPTS_REVIEWED) and adds every call past the bound to toolAttemptsOmitted, so the excerpt is the turn's first calls across all attempts in order and the partial meaning is chosen whenever any attempt's calls are not shown. No new store, model call or gate. A new regression drives two traced attempts ([3, 0]: the reviewer's shape, exhaustive with all three; [6, 6]: overflow across attempts, partial with omitted 4) through the journal and its reopen; it fails on the prior code and passes now. Astra's probe (createJournalWorker → runToolTurn → format retry → review → reopen over the recorded live-2026-10-03 task fixture) now gives the review 3 calls at cap 18, matching toolCalls 3, and is unchanged at cap 12.
Affected rules: 45 and 58 (the review's evidence of the turn's tool calls is complete or says it is partial), 84 (a retry never erases recorded history from its projection), 37 (fixed at its source, no quarantine), 116 (reuses the existing bound and omission count), 74 (this record)
Affected floors: secrets — unchanged, the excerpt holds the same redacted call fields; spend cap — unchanged, reservations untouched; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a projection fix in the preview journal's review input; the model-facing meaning strings are unchanged, only which of the two existing strings is chosen when a turn has more than one traced attempt.
Side effects: none
Undo and recovery: revert the repair commit and its two desk commits.
Multi-machine posture: none; the projection is rebuilt from the same journal rows on every machine.
Layer below: tests/preview/tool-turn.mjs runToolTurn trace emission and the tool-turn reservation rows, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commit; no bypass flag)
Convergence: none
Decision: cint-L39-tool-attempts-accumulate | accumulate each attempt's calls into the one bounded excerpt with a running omitted count, rather than carry per-attempt excerpts, because the review needs only a truthful bounded list and the existing partial meaning already says absence proves nothing | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L39-PROGRESS.md
Prompt review: no prompt text changed; the two existing review meanings are selected as before, now from all attempts' calls.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: append to the existing bounded excerpt and count the overflow; no new structure.
80/20: the reproduced shape and its overflow neighbour are proven through reopen; targeted runs only, the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass
