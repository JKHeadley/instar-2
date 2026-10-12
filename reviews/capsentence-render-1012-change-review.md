# Change review — Render capability sentence before review and send

Subject base: 7db7ba5c60b3fd2f732e5f4b9d7ff053e327dd13
Review state: open
Reviewed content: none
Outcome: Self-description references render the current tools/outbound sentence exactly once before answer or revision review and send.
Affected rules: 1, 10, 12, 25, 36, 45, 49, 70, 74, 78, 84, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — existing send journal; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Model-facing presentation protocol and journal/revision wiring; no grant, blocking, spend or send-admission change.
Side effects: The marker is replaced before review; duplicates collapse. Whole exact variants of the obsolete person/agent instruction normalize to the hashed record. Other prose and already-correct single copies stay unchanged. No intent classifier. Invalid evidence stays intact for existing review.
Undo and recovery: Revert this change and regenerate source pins. No new durable schema. Recorded answers and revisions already contain rendered text, so replay uses their original reviewed bytes.
Multi-machine posture: Stateless per-turn rendering from the exact persisted note. Every machine runs the same logic; journal ownership and send deduplication remain authoritative. No new store.
Layer below: Generated capability-note excerpt and renderedCapabilitySha256; journal answer extraction; persisted reply-revision prompt; review-before-send and duplicate-send journal.
Bug class: integration
Bug evidence: reproducer=tests/preview/capsentence-render.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory inspected, samples only
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Replace the existing byte-copy instruction with one explicit rendering marker. The model still decides whether it is describing capabilities. The renderer performs exact protocol substitution, never meaning classification. Historical fixtures remain immutable; tests explicitly translate only the superseded instruction.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing source/authority protocol wording, unchanged by this rendering repair; not an intent classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 849db3a6296a | protocol-literal | Existing source/authority protocol wording, unchanged by this rendering repair; not an intent classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 95e349aaf4ac | protocol-literal | Existing source/authority protocol wording, unchanged by this rendering repair; not an intent classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."
Prompt finding: e8708c7fea24 | protocol-literal | Existing source/authority protocol wording, unchanged by this rendering repair; not an intent classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (7 paths): tests/preview/briefing.ts, tests/preview/capability-render.ts, tests/preview/capsentence-render.test.ts, tests/preview/fixtures/capsentence-render-2026-10-12.json, tests/preview/journal-boundaries.test.ts, tests/preview/journal.ts, tests/preview/train-12-capability-replay.test.ts

Decision: capsentence-render-marker | Replace the copy instruction with a marker that code resolves from the same hashed capability note; no new capability wording or model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capsentence-render-1012-PROGRESS.md
Decision: capsentence-render-legacy | Normalize only whole-record person/agent forms required by the superseded prompt, including the complete recorded 12:24 failure; never detect intent by keywords. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capsentence-render-1012-PROGRESS.md
Decision: capsentence-render-provenance | On absent or invalid evidence preserve input for existing review rather than fabricate capability text or add a blocking gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capsentence-render-1012-PROGRESS.md
Decision: capsentence-render-revision | Resolve revised text from the persisted original capability note before recording and review, never from current configuration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capsentence-render-1012-PROGRESS.md

Evidence: Full 12:24 delivered reply, capability-note provenance and K11 FAIL for update 715675677 are retained verbatim in tests/preview/fixtures/capsentence-render-2026-10-12.json. The regression failed on the unchanged base and passes through answer, review and send after the repair. Repeated drain sends once. The old train-12 instruction mapping changes only the self-description line, retaining captured bytes.

Publication: The supplied desk repin/owner-rehash scripts found zero stale artifact pins. Regenerated the seven register publications in replay mode from source commit 88675ffb44470cc3bb094d5f0bdb94593e9dad14 after lint identified the newly imported renderer in the wiring roster. Capability wording is unchanged; publication provenance and the source graph advance.

## Closing block

simplestRobustRoute: This is the simplest robust route: an explicit marker resolved from the existing hashed capability note at the answer and revision boundaries. No extra model call, gate, authority path or state. Whole-record legacy forms are needed because the old prompt explicitly requested the person/agent wording that caused update 715675677. Start: a supplied source note whose excerpt and sentence digests match. End: rendered candidate reviewed and sent once. Limit: missing references or invalid notes remain untouched; arbitrary prose is not classified. Shipped-path offline journal replay is recorded, not a new live delivery claim.
80/20: Targeted foreground tests at nice 10 with one worker, architecture/typecheck/register checks; full suite and live proof remain on the Studio gate per the brief.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
