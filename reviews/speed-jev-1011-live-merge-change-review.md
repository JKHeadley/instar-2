# Change review — Merge live memory notice compatibility into Jev latency branch

Subject base: a5c0e7d5f064b4f1f00cb7cb52102cb3e7e261f8
Review state: open
Reviewed content: none
Outcome: Merge live memlive-1011 notice compatibility into speed-jev-1011, retaining the Jev audience-read latency improvement and both branch histories.
Affected rules: Rules 26, 34, 36, 37, 49, 70, 74, 90, 101, 110, 111, 112, 113 and 116; purpose retained ability and coherent memory.
Affected floors: secrets — existing custody/disclosure; spend cap — existing durable reservations; stop — unchanged checkpoints; no duplicate sends — original intents and receipts; durable intake — unchanged encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the live continuity fix into the performance branch; preserved model-visible continuity evidence is checked through recorded journal replay.
Side effects: Historical memory-failure notice bytes remain pending, like the current notice, while successful answers remain addressed. Jev retains all predicates and bounded concurrent reads. No new runtime behavior beyond the two existing changes; generated publications resolve through the existing generator.
Undo and recovery: Revert the merge with its first parent and regenerate publications to restore the prior branch. Durable journal bytes are untouched and need no migration.
Multi-machine posture: No new state or authority. The current journal owner recognizes historical notice bytes on any machine; admission probes remain local and every owner revalidates audience, ownership and durability.
Layer below: Inspected continuityFor, replyBody, memoryPending and memoryUndecided with intent/sent evidence, plus the original Jev optimization review. Sources merged without conflict; only publication metadata conflicted. Fixture replay covers historical/current failure and successful answer after encrypted reopen, while injected-clock Jev replay retains one HTTP request and one send.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and actual shared hooks directory contains sample files only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No new prompts or parsers. Merged continuity classification is replayed using actual captured notices and journal-memory-save-live recorded summary, Jev, review, delivered and empty shapes.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory grounding and inventory instruction, unchanged by this merge.
Prompt finding: bd01de21286a | protocol-literal | Existing memory grounding and inventory instruction, unchanged by this merge.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing memory grounding and inventory instruction, unchanged by this merge.

Subject (2 paths): tests/preview/journal-boundaries.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge preserving both histories, retain both source changes, and regenerate derived publications from merged source. No new mechanism or restriction is introduced. Existing secrets, cap, stop, intake and duplicate-send guards remain. Recorded offline worker replay is evidence for integration, not a new live deployment claim.
80/20: Run TypeScript, focused affected-path tests, required pinned-text cases and cheap checks; the pipeline owns the full suite and independent landing acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
