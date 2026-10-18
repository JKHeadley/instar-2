# Change review — Render capability grants and limits from the supplied note

Subject base: 0ed77d1682e55fb894fdc1f13b26cabd62972e00
Review state: open
Reviewed content: none
Outcome: A capability reference renders one complete public grant/limit list from the supplied capability note, eliminating the recorded grant paraphrase before review and send.
Affected rules: 1, 4, 10, 25, 36, 49, 70, 74, 78, 84, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — existing journal/send admission; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Presentation protocol repair at the existing answer/revision boundary; no grant, effect admission or durable schema change.
Side effects: A capability reference now denotes the whole answer, including the former exact tools/outbound sentence and its two legacy pronoun forms. Surrounding model prose is replaced rather than trusted as framing. Ordinary unmarked replies remain untouched. Internal feature bullets are excluded; switched-off and limit lines remain verbatim. Missing, malformed or unverified notes remain unchanged for existing review. This is not an intent classifier and makes no guarantee about unmarked arbitrary prose.
Undo and recovery: Revert this change and regenerate source publications. Persisted answers retain their reviewed bytes. No journal migration or new state.
Multi-machine posture: Stateless deterministic rendering from the turn's supplied note; revisions use the persisted original prompt, never a fresh configuration read. Existing ownership and send deduplication are unchanged.
Layer below: Generated capability-note section layout and excerpt/sentence hashes; existing renderer calls before answer/revision review; journal send and repeated-drain behavior.
Bug class: integration
Bug evidence: reproducer=tests/preview/capsentence-render.test.ts
Hook bypass: none; core.hooksPath unset, common hooks directory inspected and contains sample hooks only
Convergence: none
Prompt review: Replace the old instruction allowing positive capability paraphrase with the existing explicit reference for the entire capability list. No new capability wording or semantic blocking instruction. Exact limits and grants come from the same note, not a new prompt copy.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Existing tool-record wording unchanged; not an intent classifier — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "tools: full claude code set"
Prompt finding: 95e349aaf4ac | protocol-literal | Existing authority protocol unchanged — fixture-phrase tests/preview/briefing.ts <- tests/preview/selfdesc-abilities.test.ts: "via the doorway's four tests; standing grants need no new approval."

Decision: capability-lines-whole-reference | Render the whole capability answer from the existing note when its explicit reference is used; keeping surrounding free prose preserves the recorded overclaim. No paraphrase matching or new model gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-PROGRESS.md
Decision: capability-lines-note-sections | Use existing public Capabilities and limit sections, excluding internal bullets, preserving every emitted line verbatim and validating section boundaries. No new capability wording or note schema. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-PROGRESS.md
Decision: capability-lines-recorded-replay | Replay exact delivered 715675709 bytes recovered through read-only proof artifacts against separately recorded note 715675677; disclose that the original 715675709 prompt was not exported. Preserve existing recorded summary/Jev/review/empty-shape replays. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-PROGRESS.md

Evidence: The unmodified 715675709 delivered reply fails the regression on base and passes after implementation through actual offline journal answer/review/send. Its exact tools/outbound sentence is the existing protocol reference, so the replay adds no marker. All emitted grants and limits come from the note; output contains answers the operator and never as the operator. Exactly-once insertion, idempotence, revision rendering, unrelated answers and malformed-note neighbors are covered. No live delivery or independent judgment claim.

Publication: Regenerated the seven register publications in replay mode from source commit ae53af1cc9dbb13cd1be9a33b4f18e45fd84efa2. Only publication provenance advances; capability declarations and wording are unchanged.

Validation: Renderer 18 cases, journal boundary 23 cases and default-context floor 6 cases pass. Typecheck, build and architecture pass. Direct-import and final gate results are recorded in the desk handoff report.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing reference renderer to the entire capability answer. A marker substitution that retains surrounding prose cannot eliminate the recorded grant overclaim there. The deliberate tradeoff is canonical note framing for referenced answers; mixed or ordinary answers remain model prose under existing review. Start: explicit reference plus validated note. End: note-derived public grants and limits reviewed and delivered once. Limits: no additional authority, model call, store or gate; malformed evidence is preserved. Offline recorded-case replay exercises the shipped journal path, not a new live delivery.
80/20: Targeted direct-import tests and unchanged context-floor checks, then typecheck, architecture, register and pinned READY tests. The Studio gate owns live and host-dependent checks.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
