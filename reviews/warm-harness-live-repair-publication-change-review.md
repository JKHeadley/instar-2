# Change review — repaired warm harness publication

Subject base: e66a6ad9b14f1b1e22c08ba4c1a119ed6c9f6f43
Review state: open
Reviewed content: none
Outcome: Publish generated register wiring for the repaired speculative process adoption and the regenerated native composition certification at source commit e66a6ad9b14f1b1e22c08ba4c1a119ed6c9f6f43.
Affected rules: 5, 37, 49, 69, 74, 101, 111, 113, 115, 116
Affected floors: secrets — generated metadata contains no credentials; spend cap — no budget changes; stop — no stop changes; no duplicate sends — no send changes; durable intake — no intake changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Generated governance publication must resolve to exact source bytes.
Side effects: Seven generated publication files are replayed by build-register from the committed source. The delegated owner-manifest rehash and inventory repin tools found no changes needed. Publication is shape-only and grants no runtime authority. No manual pin edits.
Undo and recovery: Revert the source repair and regenerate these files from the chosen committed source. Preserve existing authoritative journals and resource ledgers.
Multi-machine posture: Source and generated publication travel together on the branch; process ownership remains host-local as recorded in the repair review.
Layer below: Checked generated/source.json source commit, architecture conformance, owner-manifest rehash output and source-wiring checks. The source repair has real subprocess/Six held-slot tests, captured-output replay and native-composition contract verification.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory inspected and contains sample hooks only
Convergence: none
Prompt review: Publication changes no prompts, parsers or model acceptance logic. Source review and recorded-shape evidence are in warm-harness-live-repair-change-review.md.

## Closing block

simplestRobustRoute: Regenerate the existing publication directly from its committed source using the shipped register builder. This is the simplest route to prevent stale source wiring; no additional mechanism or authority is introduced. The existing architecture, register and review checks hold the publication boundary.
80/20: Targeted verification passed before publication. Cheap final checks run after this record is committed; the automatic pipeline owns the new full-suite report. Copied gate evidence remains bound to its original worktree and revision.
VERDICT: author submission; no independent verdict claimed
