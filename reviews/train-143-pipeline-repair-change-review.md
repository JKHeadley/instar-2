# Change review — train-143 pipeline merge repair

Subject base: ec8e745d344198d42f4cc79df8eacc793325ea17
Review state: open
Reviewed content: none
Outcome: Integrate live 933bc493 without reviving retired preferences or including memory beyond the summary frontier. Preserve both branch histories.
Affected rules: 7, 33, 36, 37, 49, 74, 90, 93, 101, 102, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain on their existing paths; no runtime executable change from the candidate parent.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Resolve a conflict in the model-facing summary packet builder, preserving the already-reviewed candidate behavior and verifying both regression families.
Side effects: Retains the candidate current preference projection and source frontier filter. Adds the live branch explanatory comment and review history. Generated register views bind the combined history.
Undo and recovery: Revert this merge against its first parent and regenerate register outputs; no live deployment or persistent schema mutation occurs.
Multi-machine posture: No change to ownership, replication or transport. Summary memory remains derived from received durable journal records on each owner.
Layer below: Read both constitutions on origin/main, both conflicting implementations, source-frontier regression, current-forget regression and source audit. The current projection prevents a later forget from being rolled back; the source cutoff prevents future memory from entering an older summary.
Bug class: none
Bug evidence: none
Regression verification: This merge resolves conflicting already-reviewed implementations without adding a runtime bug fix. Existing summary-frontier-forget and summary-candidate-frontier tests exercise the retained implementation; neither test is authored by this repair.
Hook bypass: none; core.hooksPath unset; common hooks directory contains samples only
Convergence: none
Decision: train-143-repair-projection | Retain current memory projection and source eligibility cutoff from train-143; this includes the live branch frontier protection while preserving later retirement. Keep the live explanatory comment and all histories. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-143-repair-123853-PROGRESS.md
Decision: train-143-repair-generated | Regenerate conflicting derived register files from the merged committed source using existing desk scripts and register replay; never edit hashes by hand. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-143-repair-123853-PROGRESS.md
Prompt review: No executable packet-builder change from the reviewed candidate parent, no prompt or parser change. Replay checked-in recorded shapes and both frontier regressions; fresh inaccessible live journals are not claimed.
Prompt finding: 4106b49fff07 | protocol-literal | Existing no-tools disclosure asserted by the consumer; no semantic keyword gate added.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status wording asserted by the consumer; unchanged.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-provenance guidance asserted by the consumer; unchanged.

Register replay: Regenerated all seven views from merged source 16135ff553932b21f80247aa741517e8049c24b2; generation sha256:93cc4a8361e85515512d9f5ed25d5eea929ea5e568f664ac1db1dc83b4835537, 293 entries, 117 rules, 34 terms.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, preserve the candidate projection that already satisfies both branches, and regenerate derived outputs. No new machinery. Existing authority, durable intake, stop, spend and send uniqueness guards remain intact; no new unattended capability or live deployment is claimed.
80/20: Run the two boundary regressions and recorded-shape consumers plus cheap gates; the Studio owns full-suite and host-bound verification.
VERDICT: author submission; no independent verdict claimed
