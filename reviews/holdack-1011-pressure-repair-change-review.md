# Change review — Align packet pressure proof with current-question recall priority

Subject base: bcdfe74e79c20a2064e8163cb42c411adab4afa6
Review state: open
Reviewed content: none
Outcome: Restore the 5,000-turn packet-pressure proof to the current-question-first recall ordering introduced in 18dd839c, retaining exact source-ID and dropped-evidence assertions.
Affected rules: Purpose Rule 2; Rules 7, 13, 26, 37, 49, 70, 74, 96, 101, 110, 111, 113, 116.
Affected floors: secrets — unchanged runtime guards; spend cap — unchanged caps and asserted byte envelope; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged encrypted journal.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only repairs stale test expectations and strengthens refusal and generous-budget assertions; no executable runtime or model-facing change.
Side effects: The proof now rejects the obsolete exposure-first order and unexpected probe refusals. The controls still require reference signals to break equal-relevance ties and recency to win without them. No tool, network, session, authority, prompt, parser or capability changes.
Undo and recovery: Revert this test and review commit if necessary. No durable state, installed source, generated publication or migration changes.
Multi-machine posture: Test journals are deliberately machine-local temporary fixtures. Runtime replication, ownership and transport remain unchanged.
Layer below: Inspected createJournalWorker optional dropOrder in tests/preview/journal.ts: rank precedes current-question match, then questionTies/referenced, then recency. All five handoffs match equally; the continued unanswered question has no handoff evidence. The previous source repair and its real-shape replay record remain unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset; common hooks directory inspected and contains only sample files.
Convergence: none
Decision: pressure-current-question-order | Preserve the source fix and repair only its stale proof; equal matches retain reference tie-breaks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack-1011-repair-PROGRESS.md

Subject (1 paths): tests/preview/journal-packet-pressure-value.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: align exact assertions with the already repaired comparator, preserve all reference-removal controls, reject refused probes and assert the wider envelope retains the full recall list. Start is the unchanged 5,000-turn fixture; end is the exact retained/dropped evidence under the byte cap. No runtime machinery or autonomous-completion claim.
80/20: The original assertion fails reproducibly, the corrected test passes, and its controls cover signal presence and absence. Run compiler, targeted proof, required pinned-text checks and cheap gate checks; the pipeline supplies full-suite evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
