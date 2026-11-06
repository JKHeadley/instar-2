# Change review — train-182 carries the one proven Codex observation

Subject base: ed109ab78e0342da1a348c1b30f6f78b0d5041f6
Review state: open
Reviewed content: none
Outcome: This train's Codex declaration carries the observation bound by the committed train-187 receipt, the one every train converges on, so its merge with live passes the unchanged planner without any new evidence.
Affected rules: 26, 42, 56, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no credential access; spend cap — same ratio, basis and windows; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Two evidence stamps return to a committed, receipt-bound observation; no routing, model, policy, prompt or window change. The checker's suggestion follows the source path.
Side effects: The evidence deadline moves back to 2026-12-09, still fresh. The newer observations stay in history and are not promoted.
Undo and recovery: Revert these commits and regenerate; the merge refusal returns. No stored state.
Multi-machine posture: Declaration and receipt travel through git; the observation certifies no other host's credential or quota.
Layer below: Read pipeline/resolve-provider-stamps.py proof_for and plan, pipeline/merge-live-chain.sh, the train-192 restore 0dd520cac and the train-187 receipt. The planner reads the receipt from the same commit as the stamps.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset.
Convergence: none
Prompt review: No model-facing prompt, parser or accept/escalate/refuse logic changes.
Decision: train-182-observation-a | Restore exact ade91bee0 declaration bytes so one observation holds across trains, at the desk's decision; no new timestamp or planner change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-observation-a-PROGRESS.md

Subject (2 paths): reviews/train-182-observation-a-change-review.md, src/assembly/production-codex-provider.declarations.json

## Closing block

simplestRobustRoute: Restore committed proven bytes through the existing receipt check. No added resolver, new timestamp or weakened check.
80/20: One observation clears the shared refusal; the pipeline owns the full suite and independent review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
