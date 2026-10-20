# Change review — walk-fix-correction-ack: a memory correction reads as one sentence

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: the correction acknowledgement reads 'Now: new. Was: old.' instead of 'Changed old. → new.' (walk-24 msg 11, runs A and B), at no more bytes than before.
Affected rules: 74, 77, 80, 89, 113, 116
Affected floors: secrets — the clauses are the same accepted journal quotes as before, redaction path unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: host template wording only.
Side effects: the old clause is kept verbatim because corrected-history withholding matches the reply against the exact quote (a stripped full stop let the old value back into recall in journal-memory-dedupe); only the new clause's end punctuation is normalized. A quoted-clause draft was dropped: it grew the reply and broke that match. Multi-change replies still join with '; '.
Undo and recovery: revert the commit; the old template returns. Recorded replies are not rewritten.
Multi-machine posture: machine-local reply text only.
Layer below: inspected memoryAcknowledgement's change filter (unchanged), the withheld-history path for corrected clauses, and the memory-list exclusion.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-correction-ack-diff.test.ts
Hook bypass: none
Convergence: none
Decision: correction-ack-quote | two sentences, new value first, old clause verbatim, since a quote may be a whole sentence and withholding matches it exactly | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md
Prompt review: not model-facing: host template. Replayed the walk's recorded quote/replacement shapes (A msg 11 sent text).
Prompt finding: 4106b49fff07 | protocol-literal | existing tool-attempt honesty guidance in journal.ts, unchanged by this unit.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response contract in journal.ts, unchanged by this unit.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label and uncertainty guidance in journal.ts, unchanged by this unit.

Subject (5 paths): tests/preview/journal-corrected-history.test.ts, tests/preview/journal-correction-ack-diff.test.ts, tests/preview/journal-forget-property.test.ts, tests/preview/journal-memory-correction.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: change the one template string. This is that route.
80/20: wording only; 'Saved the requested fact.' left as is.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
