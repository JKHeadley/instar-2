# Change review — register contract map requires CI proof only for non-runtime held evidence (P3-NF-25)

Subject base: 8fdfb114c7833209e4fdcd00501a0b588e658d7b
Review state: open
Reviewed content: none
Outcome: scripts/check-register-contract-map.mjs demanded a passing CI test for every held fixture or probe, including the 16 probes declared at stage runtime. Seven of those (held-reply notice, reminder, provider outcomes, spend cap, summary check, step check, stop) cannot reach a result in the offline CI world, so the gate could never pass. The design settles the split: docs/07-the-declarations.md P3-NF-25, "The build checks declarations; the runtime holder checks freshness." The checker now excludes stage runtime evidence from the CI must-pass set; build-stage fixtures and probes keep it. The defect record docs/defects/preview-runtime-probes-without-ci-proof.md is closed with this citation.
Affected rules: 37, 43, 74, 107, 116
Affected floors: secrets — unchanged; spend cap — unchanged (its runtime probe is proven live); stop — unchanged (proven by the desk's recorded live proof, as its declaration already states); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: narrows what one build checker demands, to exactly what the design assigns to the build; no runtime path changes
Side effects: runtime-stage probes are no longer a CI gate item; they remain declaration-checked at build and are exercised by the pipeline's live proof after deploy
Undo and recovery: revert the commit; the gate returns to requiring CI proof for runtime probes
Multi-machine posture: not applicable, a repository check
Layer below: docs/07-the-declarations.md (P3-NF-25, the holds field), docs/06-the-fact-envelope.md (stage definitions), scripts/check-register-contract-map.mjs, the defect record
Bug class: a checker enforcing at the wrong stage
Bug evidence: gate run on 0fcb14da and the post-check repair's diagnostic run (all 30 P3 contracts mapped once the seven were set aside)
Hook bypass: none
Convergence: none

## Closing block

simplestRobustRoute: one filter condition that states the design's own stage split, instead of fake CI scenarios for outcomes only a live runner can observe (Rule 116), and no quarantine (Rule 37).
80/20: lint and register:check pass; the other contract checkers were run against the prior gate results and fail only on tests the post-check repair restored after that run; the full gate reruns next.
VERDICT: author submission; the independent verdict is pending
