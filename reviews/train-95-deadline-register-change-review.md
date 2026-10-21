# Change review — train-95 deadline register replay

Subject base: cd99d36100e14c8e9d2bc9205f192e2b976810ff
Review state: open
Reviewed content: none
Outcome: Republish the register from cd99d36100e14c8e9d2bc9205f192e2b976810ff so the published deadline and promotion-record source hash match the repaired source.
Affected rules: 37, 49, 69, 72, 73, 74, 90, 101, 111, 112, 113, 116
Affected floors: secrets — untouched; spend cap — untouched; stop — untouched; no duplicate sends — untouched; durable intake — untouched. Publication grants no new authority.
Operator questions: none
Suggested tier: critical
Declared tier: standard
Tier rationale: Mechanical shape-only replay of committed declarations through the existing generator; no runtime or constitutional wording changes.
Side effects: Seven generated publications acquire the new source commit, generation and source pins, including the finite October 24 step-check deadline. No approval or graduation is claimed.
Undo and recovery: Regenerate from a reviewed correcting source commit; preserve promotion history, evidence and the dark status. Never edit generated pins by hand.
Multi-machine posture: Committed generated publications are identical across machines. No machine-specific state changes.
Layer below: Existing build-register replay from the committed source, promotion-record latest deadline, generated declaration and source wiring. The owner-manifest and chain refresh tools reported zero changed pins; generated source wiring is refreshed by replay.
Bug class: none
Bug evidence: The initial register:check correctly reported the expired committed declaration and lint reported its stale promotion-record source pin. Replay now reports 293 entries, 117 Rules, 34 terms, 48 warnings and 109 prerequisites, authority shape-only; final check outputs are recorded in the repair progress file.
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanical replay of existing registered obligations; the step-check graduation commitment remains assigned to the desk with the October 24 deadline in promotion-record.ts

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: This is the simplest robust route: reproduce the existing generated publications from the committed source, with no new tooling or hand-edited pins. Existing source identity, wiring and register checks hold publication consistency; this makes no autonomous completion claim.
80/20: Mechanical publication only. The underlying finite-deadline decision and unresolved graduation remain explicit in the source review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
