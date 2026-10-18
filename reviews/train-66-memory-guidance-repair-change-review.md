# Change review — repair the compact memory-guidance consumer assertion

Subject base: 3024d75b446783a8e7d8da06351fdca3569e0614
Review state: open
Reviewed content: none
Outcome: Restore the memory-update recorded regression tests after the accepted compact answer guidance changed wording; retain distinct checks of answer and declaration-repair instructions.
Affected rules: Rules 26, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; this changes test expectations only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test helper and its repair-surface calls; no prompt, parser, admission or runtime change.
Side effects: The answer test now requires the complete compact same-fact update instruction, including old source, new clause, history preservation and correction distinction. Repair tests require their separate full update instruction. Recorded admission, restart, independent facts and invalid recall-source checks remain intact.
Undo and recovery: Revert this test-only change; the stale answer wording expectation would fail again. No runtime state needs recovery.
Multi-machine posture: Shared repository tests; no new machine-local state or runtime behavior on any host.
Layer below: Read journal.ts answer packet construction and declaration-repair reminder, readAnswer parsing, and the captured memory-update fixture. The compact answer still carries the update enum in MEMORY_ITEM_SHAPE and the explicit same-fact instruction. Existing tests drive the actual worker, durable projection and reopen path rather than substituting a label for saved state.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing text or response interpretation changes. Added literals assert existing delivered guidance in tests only.
Decision: train66-guidance-surface-assertions | Check the actual complete instruction separately for answer and repair surfaces instead of requiring repair wording in the compact answer; preserve all behavioral replay assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-66-repair-052944-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the stale consuming assertion using the two existing guidance surfaces, without changing accepted runtime wording, adding machinery or weakening memory admission checks. Existing source validation and replayed durable outcomes remain the guards. No live or autonomous-completion claim is made.
80/20: Run the changed recorded regression file, typecheck, architecture, lint, register and change-review checks; preserve the Studio full-suite gate and its separate acceptance bar.
VERDICT: author submission; no independent convergence claim — the review desk records its judgment
