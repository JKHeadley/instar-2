# Change review — Credential-name pipeline repair

Subject base: 1751db2bb96a9a3f3d1c364d1edb2851a0644afe
Review state: open
Reviewed content: none
Outcome: Merge current origin/main into sb-w4-credname with ordinary merge history and verify the resulting landing baseline and existing credential behavior; render the two stale generated changelogs from their existing JSON sources.
Affected rules: 1, 37, 49, 69, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets — credential boundaries retained; spend cap — no calls added; stop — unchanged; no duplicate sends — original keys retained; durable intake — no state rewriting
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: The merge introduces only the operator-approved request record; no runtime source, prompts or policy changes.
Side effects: Main becomes an ancestor of the branch without erasing the reviewed unit history. Existing generated evidence is checked against the merged tree. Two generated changelog Markdown files are rendered from their already-reviewed JSON source; no governed prose or JSON history is edited.
Undo and recovery: Revert the integration commit if needed while preserving all runtime journals and credential custody records.
Multi-machine posture: Repository integration is portable and changes no machine ownership, replication or runtime state. Checks run locally on the Laptop.
Layer below: Read both governing documents in full from origin/main; inspected exact merge diff, first-landing baseline selection, review checker and supplied desk pin tools. Main adds requests/87432af9acef18cc.md only relative to the starting head.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and common hooks directory contains only sample files.
Convergence: none
Decision: sb-w4-credname-repair-132124-merge | Ordinary merge of origin/main retains reviewed history and operator-approved content; no product edit is necessary for this merge | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-repair-132124-PROGRESS.md

Decision: sb-w4-credname-repair-132124-docs | Regenerate the run-graph and assembly Markdown changelogs from existing JSON to repair document-check drift, using the existing renderer; desk pin tools verify that no hash changes are needed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-repair-132124-PROGRESS.md

Decision: sb-w4-credname-repair-132124-register | Replay the existing register against the committed repaired tree; population and authority remain unchanged, only generated commit bindings refresh | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-credname-repair-132124-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the current main and use existing targeted tests and evidence checkers. No new machinery or changed ability. Start guards are clean branch and exact main; end guards are targeted checks and committed evidence; all five safety floors stay held. No live or autonomous completion claim.
80/20: Target the integration and existing credential consumers; the desk runs the full suite and independent gate.
VERDICT: author submission; no independent verdict asserted
