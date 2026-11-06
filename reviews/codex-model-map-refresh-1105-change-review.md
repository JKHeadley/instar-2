# Change review — Codex model-map freshness repair

Subject base: 965c0542f3106c915f8facc2adb738c931dd341b
Review state: open
Reviewed content: none
Outcome: Refresh the expired exact-model and estimated-subscription evidence from the existing Echo CLI catalog and account status, preserving the declared model and freshness windows; regenerate the register so the current-clock check can accept current facts.
Affected rules: 26, 56, 70, 74, 90, 101, 102, 107, 111, 113, 116
Affected floors: secrets — only selected non-secret catalog fields and login mode retained; spend cap — no generation or paid call; stop — unchanged; no duplicate sends — no outbound message path changed; durable intake — no runtime or storage change.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: evidence-only renewal in the existing model declaration; no change to routing, model selection, policy, prompts or freshness thresholds.
Side effects: the model and estimated subsidy cease failing the age check until the unchanged window expires; generated register provenance changes. Catalog membership is not live generation or account quota proof.
Undo and recovery: revert the renewal commits and regenerate using scripts/build-register.mjs; the stale check returns without changing runtime state.
Multi-machine posture: declaration and generated register are git-distributed; catalog and login observations are machine-local evidence and do not certify other machines' credentials or quotas.
Layer below: docs/defects/codex-model-map-refresh-2026-11-05.md records actual 1.x main 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34 paths/history and ONEX lessons; docs/release-evidence/codex-model-map-refresh-1105.json binds provider catalog time and hash, CLI version, exact model, ChatGPT login and estimated subsidy rationale. src/rulegraph/graph.ts retains the existing expiry checks; src/assembly/production-codex-provider.ts retains subscription-only invocation. Fresh app-server probe refusal is disclosed, not treated as success.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no model-facing prompt, output parser or accept/escalate/refuse logic changes; real model-output replay is inapplicable.
Decision: svi-1105-model-evidence | Renew only the exact existing model and estimated subsidy from the current provider-fetched catalog and subscription login, using the catalog time and retaining both freshness windows; do not change volume behavior or claim generation proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-volume-isolated-1105-repair-204405-PROGRESS.md

## Closing block

simplestRobustRoute: renew evidence at its existing owning declaration and regenerate through the existing tooling; this is that route. No new watcher, store, probe framework or policy is needed for this scoped repair. Start guard is the stale verdict, end guard is current-clock register acceptance, and the unchanged expiry window remains the limit guard.
80/20: one expired-evidence finding; retain the source-unit review's native/live limits and submit only the evidence renewal for review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
