# Change review — Codex model-map receipt carries its subsidy review time

Subject base: 79be7e88e9e6445a675d1c7117d68da4c9ae84a4
Review state: open
Reviewed content: none
Outcome: Mechanical merges of waiting trains can select a receipt-bound Codex declaration through the unchanged planner, because one committed input now binds a fresh catalog time and a recorded subsidy review time.
Affected rules: 26, 56, 70, 74, 90, 101, 102, 107, 111, 113, 116
Affected floors: secrets — only selected non-secret catalog fields and login mode retained; spend cap — no generation or paid call; stop — unchanged; no duplicate sends — no outbound path changed; durable intake — no runtime or storage change.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Evidence-only renewal in the existing declaration. No change to routing, model selection, policy, prompts or freshness windows; the checker suggests significant because of the path under src.
Side effects: Both stamps move forward, so the unchanged windows expire later. The accepted receipt path now holds this review; the earlier receipt stays in history at 4c562e19d. Generated register provenance changes: republished at the source commit, content otherwise unchanged.
Undo and recovery: Revert these commits and regenerate. The earlier stamps return and the merge refusal returns with them. No runtime state changes.
Multi-machine posture: Declaration and register travel through git. The catalog and login reading belong to the Mac Studio's default Codex home and do not certify another machine's credentials or quota. The Mama PC, source of the earlier receipt, was unreachable and is named in the receipt.
Layer below: Read pipeline/resolve-provider-stamps.py proof_for, choose and plan, pipeline/merge-live-chain.sh, commit 4c562e19d and src/assembly/production-codex-provider.ts subscription-only login handling. The planner refuses to infer a review time; this records one.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset.
Convergence: none
Prompt review: No model-facing prompt, output parser or accept/escalate/refuse logic changes; real model-output replay is inapplicable.
Decision: codex-map-fresh-receipt | Repeat the catalog read and subsidy review on the Mac Studio with the Mama PC unreachable, record the actual review time, and update the receipt at its accepted path; the planner stays unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/codex-map-receipt-1106/progress.md

Subject (11 paths): docs/defects/codex-model-map-receipt-2026-11-06.md, docs/release-evidence/codex-model-map-refresh-1105.json, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/codex-map-receipt-1106-change-review.md, src/assembly/production-codex-provider.declarations.json

## Closing block

simplestRobustRoute: Renew evidence at its owning declaration and receipt through the existing refresh pattern. No planner change, new watcher or new receipt path.
80/20: One missing recorded time blocks every train with its own stamp; one real review clears it through the existing check.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
