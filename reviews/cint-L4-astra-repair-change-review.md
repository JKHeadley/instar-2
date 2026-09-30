# Change review — cint-L4 repair of Astra NO: index-only UNKNOWN accounting and recall scoring input

Subject base: 6d6f2b87a3394648a4e20e73fab5fdd4386fc0c7
Review state: open
Reviewed content: none
Outcome: Astra MUST-FIX 1: an index-only reservation superseded before its result arrived is kept in a new journal field indexUnknown (preserved by snapshots, default [] for older ones) and counted, with the one still open, in unknownCallCounts().index, so status, the verified approval decision and the cap-raise refusal all see it; a later completed batch no longer clears it. Astra MUST-FIX 2: recall scoring's two reply-text inputs use the existing replyBody() normalization, so a generated Rule 110 disclosure no longer distorts contextual ranking; the memory-sentinel case is restored unskipped and its defect record closed with the corrected diagnosis. Then desk repin and register regeneration.
Affected rules: 11, 26, 37, 39, 74, 77, 110, 116
Affected floors: secrets — unchanged; spend cap — strengthened: a lost index result now blocks a cap raise like every other UNKNOWN call, reservations and charging unchanged; stop — unchanged; no duplicate sends — unchanged, indexing sends nothing; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: tests/preview/journal.ts changes the shared UNKNOWN count that gates cap raises, adds a journal projection field, and changes live recall ranking input
Side effects: a journal with a lost index result now reports it as UNKNOWN and refuses a cap raise until reviewed; recall ranking ignores the disclosure words in replies; the projection gains indexUnknown: [] by default
Undo and recovery: revert 34600493 and regenerate pins; indexUnknown is additive and ignored by older readers of the projection
Multi-machine posture: machine-local single-writer preview journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; the journal reducer (index-reserve / meaning-index), snapshotOf and the snapshot reader, unknownCallCounts and its consumers (admitCaps, verified approval, journal-agent status), recallFor and selectRecall inputs; Astra's reproducers in lanes/astra-cint-L4-evidence
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed; only recall scoring input text changes
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (14 paths): docs/defects/full-suite-load-timeouts.md, docs/defects/memory-sentinel-timing-flake.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-meaning-backfill.test.ts, tests/preview/journal-spend-cap.test.ts, tests/preview/journal.ts, tests/preview/memory-sentinel.test.ts

## Closing block

simplestRobustRoute: one additive list of superseded index keys folded into the existing shared UNKNOWN count, and the existing replyBody() normalization at the two recall inputs; no new subsystem, reranker or model call (Rule 116).
80/20: both reproduced defects fixed at their source with both sides tested (lost vs completed index result; restored recall case plus 26 recall files); tsc, lint, register:check pass here, full gate reruns next.
VERDICT: author submission; the independent verdict is pending
