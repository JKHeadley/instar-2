# Change review — train-60 reviewed D5 regression integration

Subject base: b55334d38982aadd018bcac54cf703aeaff986c2
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed D5 preference/directive regressions and refresh their existing publication pins.
Affected rules: 7, 26, 34, 37, 47, 49, 69, 74, 90, 93, 96, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no production behavior or model call added.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only reviewed member plus deterministic owner-reference and generated publication refresh.
Side effects: Adds regression coverage for two existing journal projections. Generated publication changes identify the committed test bytes. Existing host-watch timing checks remain host-dependent on WSL.
Undo and recovery: Revert the regression and replay the existing register from the reverted source; no runtime state migration.
Multi-machine posture: Unchanged existing journal ownership and replication; no new state or writer. Verification runs locally on WSL; Studio owns native and live acceptance.
Layer below: Read constitution in full, member report and cint-L37 desk-chain report. Member tests use actual encrypted journal summary/reopen and distinguish active preferences from open directives; real updates 46040188 and 46040189 support the projection diagnosis, not live compaction.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample files only.
Convergence: none
Decision: train-60-merge | Ordinary merge of exact reviewed 8f0e8fb2ac4b87ff7976e39ed4d87a031899e7c0 fast-forwarded; source report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/d5c-directive-1017-PROGRESS.md read through Studio API. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md
Decision: train-60-A | Preserve reviewed member bytes without product edits; no overlapping source or changelog conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md
Decision: train-60-B | Create branch directly at exact live b55334d38982aadd018bcac54cf703aeaff986c2; no main merge or later branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md
Decision: train-60-C | No conflict requires omission; sole requested member remains an ancestor. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md
Decision: train-60-D | Apply explicit WSL exceptions to unchanged launcher and native checks; disclose results and leave Studio acceptance to desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md
Decision: train-60-desk | Use downloaded repin/build/rehash/replay chain; commit changed owner-reference before replay so committed source and artifact hashes agree. No generated hand edits or guard change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-60-PROGRESS.md

## Closing block

simplestRobustRoute: Ordinary merge and existing generation chain are the simplest robust route. No added machinery. Start at exact live base, preserve all five safety floors, test existing consumers and defer deployment to the authorized desk. No autonomous product-completion claim.
80/20: Run specified targeted tests, journal checks and pinned gates in foreground chunks, without full-suite or duplicate-base comparison.
VERDICT: author submission; independent desk review pending
