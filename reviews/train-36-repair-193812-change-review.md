# Change review — train-36 live merge repair

Subject base: 5248d3330fa24cb91ceb10c27deb550f67ec30a8
Review state: open
Reviewed content: none
Outcome: Merge live 48ae575d into train-36, preserving topic pool behavior and both recorded step-check deadline decisions.
Affected rules: Rules 26, 37, 49, 72, 73, 74, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing topic custody unchanged; spend cap — existing shared accounting unchanged; stop — existing exact retirement and stop guards retained; no duplicate sends — original identities and receipts retained; durable intake — existing queued intake retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates the live topic pool branch with the candidate; conflict repair itself changes only promotion metadata and its regression evidence.
Side effects: The October 16 decision remains historical; the later recorded October 18 decision remains effective. The observer remains dark with no stage evidence. Live topic account selection and transcript continuity are preserved without source conflict edits.
Undo and recovery: Revert the merge before deployment if refused. Keep all original journal, promotion and account history. Deployment and native contract verification remain desk-owned.
Multi-machine posture: No new distributed state or peer dependency; preserves the existing owning-host fence, account custody and journal continuation.
Layer below: Inspected promotionOf last-entry selection and promotionRecordFindings chronological validation; both require preserving timestamp order. Checked the imported topic pool review and the merge source diff; no source conflict changes to its stop, reservation or durable intake paths.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and shared hooks directory contains only sample hooks.
Convergence: none
Prompt review: Conflict resolution changes promotion metadata only, no model prompt, model parser or model acceptance decision. Imported topic pool behavior retains its recorded-shape replay tests and member reviews.
Decision: train-36-repair-history | Preserve both deadline decisions verbatim in recording-time order; current declaration and README keep the later October 18 deadline without adding a new extension or claiming graduation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-36-repair-193812-PROGRESS.md
Decision: train-36-repair-register | Regenerate publication through the supplied desk scripts and register replay after merging; preserve all member history and use the existing generator rather than hand-edit hashes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-36-repair-193812-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merge, chronological union of existing decisions, existing generator and targeted consumer tests. No new machinery or runtime limits; current admission, stop, cap, ownership and durable receipt guards remain in place. No unattended live-completion claim.
80/20: Test the resolved conflict and imported changed consumers, then cheap portable gates; the Studio owns full-run and native evidence.
VERDICT: author submission; no independent convergence or deployment claim
