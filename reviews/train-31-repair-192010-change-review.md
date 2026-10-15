# Change review — Preserve topic handoff and revision admission across the live merge

Subject base: c5cdb4c87eaae9bf001b9a56b76912b3a8b7d732
Review state: open
Reviewed content: none
Outcome: Merge live 48ae575d into train-31 while preserving topic login handoff, bounded reply revision, and both promotion histories.
Affected rules: Rules 26, 34, 36, 37, 42, 49, 60, 63, 70, 72, 73, 74, 90, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets remain in existing custody and admission; spend cap retains cumulative reservation; stop keeps host and binding checks; no duplicate sends retains durable turn identities; durable intake remains required for original and revision topic routing.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combined conversation host and login admission wiring affect live session continuity, even though the manual repair reuses existing mechanisms.
Side effects: A topic may hand off its login at the existing turn boundary; an expired revision cannot initiate that handoff. Reply revisions inherit only an admitted and reserved parent's topic. The later recorded October 18 deadline remains current while the earlier October 16 decision remains in history. The existing macOS native certificate becomes stale for the combined composition and requires the Studio contract run.
Undo and recovery: Revert this merge and regenerate publication. Both parents and their evidence remain in git; do not rewrite live journals or repeat uncertain effects.
Multi-machine posture: Shared code only; existing owner admission, cumulative allowance and durable input identity remain authoritative. Login physical state stays machine-local and is never treated as another machine's session.
Layer below: Read the main purpose and rules in full; inspected both conflict parents, conversation host work ordering, journal topic routing, login binding configuration and promotion reduction. The merge must retain deadline admission before prepareTurn and read current authority after handoff. The moved topic callback must retain the durable revision reservation check.
Bug class: none
Bug evidence: Merge repair; targeted conversation and journal consumers exercise both parents. The added regression proves expired input never invokes handoff and live input uses the resulting authority. No live deployment or autonomous completion is claimed.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains samples only.
Convergence: none
Prompt review: No new model policy or parser is authored. Preserve the live parent's continuation grounding and replay its captured summary writer, uncertain summary, undecided/unsure Jev, reply review, delivered reply and empty reply through the replacement consumer. The candidate's captured reply-revision tests remain intact.
Decision: train-31-repair-192010-admission | Keep the input deadline check before prepareTurn, then snapshot current authority; retain reserved reply-revision topic inheritance in the moved callback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-192010-PROGRESS.md
Decision: train-31-repair-192010-history | Keep both promotion decisions in recording order, with October 18 the latest; do not erase either parent's history or invent a deadline. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-192010-PROGRESS.md
Decision: train-31-repair-192010-publication | Regenerate owner-reference pins and register using delegated scripts; retain the existing Darwin certificate unchanged for Studio renewal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-192010-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the existing implementations, preserve the two admission conditions in their new locations, and concatenate promotion history chronologically. No new mechanism is added. The credible failures are lost revision routing, expired input starting a handoff, and erased recorded history. Existing ownership, cap, stop and durable intake checks guard start and limits; targeted consumer tests guard the end state. No unattended shipped-path completion is claimed.
80/20: Step back to the seven actual conflicts; preserve tested behaviors rather than redesign either subsystem. Targeted portable tests and cheap checks run here; full-run and macOS certification remain on the Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
