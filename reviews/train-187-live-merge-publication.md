# Change review — publish the reconciled train-187 register

Subject base: 616eedae315d9e058250a4ad62677f6a26d45b55
Review state: open
Reviewed content: none
Outcome: Publish the existing register replay derived from the committed merged source, preserving both branches and the verified native composition.
Affected rules: 26, 49, 69, 74, 90, 101, 107, 111, 113, 116
Affected floors: secrets — no credential output; spend cap — no model calls; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Derived register source identity and capability publications change; no execution logic changes.
Side effects: Seven generated files now cite 616eedae315d9e058250a4ad62677f6a26d45b55 and generation sha256:f2e20bda92f4855a7bc1950c5de457acc821468c1454fe754ada689f78a6893b. Replay reports 299 entries, 122 rules, 34 terms, 48 warnings and 114 prerequisites, shape-only authority.
Undo and recovery: Revert publication with the matching source merge or replay the register from the restored committed source; do not hand-edit derived pins.
Multi-machine posture: Identical generated publication on each checkout; native evidence remains specific to its declared Darwin runtime.
Layer below: Existing build-register replay/check, owner rehash and grounding chain, and the 278-file native composition contract (10/10 after renewal). The merge review carries all behavioral resolution and test evidence.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No model prompt, model output parser, admission decision or fixture content changes.

1.x comparison: Inherits reviews/train-187-live-merge-repair.md research at actual JKHeadley/instar main 083e79a9c55944fc8fba95cea55d3b6ce41b5647: src/core/ClaudeCliIntelligenceProvider.ts, docs/specs/conformance-gate-timeout.md, history 9585a36e6/d34a499bc/01e98a8ca/ab26b7ca3 and ONEX-LESSONS section 6. Bounded asynchronous execution fits the retained test repair; this shape-only 2.0 register publication uses its existing replay tool, not a new 1.x transplant.
Deferral: generated/register.json:1 | not-a-deferral=Existing register prose is retained by mechanical replay; no work is postponed.

## Closing block

simplestRobustRoute: Replay the existing register from the source commit and validate it; no new mechanism or manual pin editing.
80/20: Final committed-head lint, register check, change-review check and whitespace checks; targeted tests already passed on the unchanged source. Full-suite qualification remains with the automatic pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
