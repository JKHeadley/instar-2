# Change review — Recall evidence survives packet pressure

Subject base: a82cdeac28e30f18a6f3dfee9335ae71ca31b890
Review state: open
Reviewed content: none
Outcome: Retain selected semantic/generated-cue originals during packet pressure, including earlier operator conversations, without re-ranking paraphrases solely by original word overlap.
Affected rules: 7, 11, 26, 34, 36, 49, 60, 74, 76, 96, 102, 113, 116, 117
Affected floors: secrets — existing redaction retained; spend cap — no added calls; stop — unchanged admissions; no duplicate sends — unchanged send path; durable intake — original journal records remain authoritative
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes which evidence reaches the answer model; recorded-shape regression and direct consumer suites required.
Side effects: Within the existing optional-evidence tier, semantic/cue-selected evidence now outlasts lexical-only evidence. A weak cue can therefore displace a stronger lexical source. Candidate and byte limits, lookup priority, obligation tiers and final reachability shedding remain intact. No new store, service, dependency or model call. Regenerated the register against the exact source commit to refresh source pins; no owner manifest, authority or inventory change.
Undo and recovery: Revert this commit. The added composition field is transient; no durable schema migration or journal rewrite is needed.
Multi-machine posture: Uses the existing journal projection on each owner; no machine-local durable state added. Replicated original history and cues deterministically produce the same priority. Cross-conversation replay is within one operator journal; no new account or audience join.
Layer below: src/recall/retrieve.ts composeRecall and tests/preview/journal.ts packet drop ordering; existing lexical-only pressure, lookup, redaction and authority boundaries retained.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: recall-keep-owner-priority | Preserve only selected semantic/cue priority, leaving lexical-only ties and existing higher-priority tiers unchanged; this repairs the measured loss without replacing recall. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/recall-keep-1016-PROGRESS.md
Prompt review: No instruction string changes. The model-facing context selection changes; recorded proof-room originals, index output sample A, real answer output P1, and historical summary/uncertain/reviewer/empty-reply shapes are replayed. No fixture phrase is inserted into an instruction; dispatch remains neutral.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged pre-existing instruction asserted by its existing test, not a new fixture-derived instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged pre-existing instruction asserted by its existing test, not a new fixture-derived instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged pre-existing instruction asserted by its existing test, not a new fixture-derived instruction — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/recall/README.md, src/recall/retrieve.ts, tests/preview/journal-recall-keep.test.ts, tests/preview/journal.ts, tests/recall/retrieve.test.ts

## Closing block

simplestRobustRoute: This is the simplest route: expose already-computed meaning selections from the recall owner and carry their order into the existing trimming comparator. It prevents a selected paraphrase being discarded by a second lexical-only ranking. Start: admitted historical candidates; end: bounded prepared packet or existing reachability floor; limits: existing result, byte, spend and stop bounds. No live unattended completion claim; desk proof-room execution remains required.
80/20: Author checks the changed comparator and owner data flow; no independent convergence claim. Semantic-index completeness and live activation are not claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
