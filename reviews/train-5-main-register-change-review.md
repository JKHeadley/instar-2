# Change review — Bind merged register publication

Subject base: a290d6276541addd908a42bc797ce23fcc95357f
Review state: open
Reviewed content: none
Outcome: Recompute the conversion binding from the merged bootstrap anchor, retaining main's approved document corpus and the branch's declaration shape; regenerate the register from committed inputs.
Affected rules: 37, 49, 69, 74, 90, 101, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; offline replay grants no runtime authority
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Mechanical recomputation of source hashes and generated publication using the existing canonical hash and register builder.
Side effects: Register replay now accepts the exact merged source corpus and shape. Content changes continue to fail the existing binding checks.
Undo and recovery: Revert the publication change and regenerate against the desired committed source; an unmatched anchor is still refused.
Multi-machine posture: Shared source and generated files are deterministic across machines; local logs remain external to the repository.
Layer below: scripts/register-source.mjs source capture, canonical hash, the merged bootstrap-shape.json and main-approved document hashes, and the replay-only boundary in scripts/build-register.mjs.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none

Subject (1 paths): scripts/build-register.mjs

## Closing block

simplestRobustRoute: Recompute the existing pin and run the existing generator; no new mechanism, source exception or runtime authority.
80/20: The mismatch was reproduced by register replay; final publication, document and contract checks are recorded in the external train-5 repair progress.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
