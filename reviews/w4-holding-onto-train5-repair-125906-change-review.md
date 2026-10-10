# Change review — holding train-5 recorded prompt repair

Subject base: 8344a77768e9a9726561fb959abb3bbcd39c58d3
Review state: open
Reviewed content: none
Outcome: Repair the full historical-question comparison for the intentional review-output allocation change, preserving captured inputs, outputs and rule semantics; complete the integration record's affected-rule mapping.
Affected rules: 36, 37, 49, 67, 70, 74, 89, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — no outbound or disclosure path changes; spend cap — no provider call or reservation changes; stop — no runtime changes; no duplicate sends — signed send and UNKNOWN handling unchanged; durable intake — captured fixtures and journal behavior unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-evidence translation and review documentation only; no model prompt, parser, gate or production behavior changes.
Side effects: The historical 300-character/longer-reasoning instruction is translated exactly to the current 160/400/4000 allocation and verdict priority instructions. Full question equality still covers rule meanings and the guide; packet comparisons and real verdict replay remain intact. Future wording drift still fails. The earlier review now names Rules 67, 89 and 107 and reports its decisions at the repair report destination.
Undo and recovery: Revert this repair commit to restore the previous comparison; no durable production state or migrations are affected.
Multi-machine posture: Machine-independent fixture test and documentation only. WSL holds local execution evidence; the desk copies the report to the required Studio path. No new coordination or replicated state.
Layer below: Inspected replyReviewQuestion in tests/preview/reply-check.ts, taskFields in answer-reading.ts, historical review-r2 input envelopes and captured verdict outputs, and the original integration review. Confirmed the reproduced mismatch is confined to output allocation instructions.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-limits.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only
Convergence: none
Decision: holding-train5-repair-allocation | Extend the existing exact historical-question translation, retaining full equality and immutable captured bytes; no new mechanism or model call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-onto-train5-repair-125906-PROGRESS.md
Decision: holding-train5-repair-rule-map | Add Rules 67, 89 and 107 to the integration record and explicitly map refusal, signed infrastructure provenance and disclosed red evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-holding-onto-train5-repair-125906-PROGRESS.md
Prompt review: No model-facing change. Replay existing real self-description, limits and decline outputs from fixtures/selfdesc-2026-10-03 and selfdesc-2026-10-04; no invented output or fresh live-provider claim. The original omission is update 6231439; the tool-route capture lineage is the K11a replay of update 6232231. The same full comparisons exercise broad-claim violation and correctly scoped limit acceptance.

Subject (outside reviews): tests/preview/selfdesc-limits.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing explicit translation for the recorded allocation wording and preserve the full comparison. Start with immutable captured bytes, end with exact current-question equality and recorded verdict replay; bounded targeted checks suffice for this evidence-only repair. No autonomous runtime capability or new mechanism is introduced.
80/20: Repair the one reproduced finding, run the affected test and required cheap checks, and submit actual WSL results with missing Studio evidence explicitly classified. Full-suite and independent landing review remain with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
