# Change review — w4-dashboard repair round 2: a send outcome's reason is bounded to the page's state field

Subject base: af1648aea686e4e7afbf02a35700d45332d8921f
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) found that the round-1 delivery formatter interpolated a refusal or UNKNOWN reason unbounded into a message's state, while the page refuses a state over 200 characters; a supported 92-character Telegram refusal description made a limited answer's state 204 characters, so checkSnapshot and publish threw and the previous snapshot stayed frozen. The reason is now clipped to the room the state field leaves (DASHBOARD_LIMITS.stateChars, mirrored as DASHBOARD_BOUNDS.stateChars in the page), so the outcome and "it is not sent again" always survive and the journal keeps the full reason. The limited-answer test gains the long-reason case: the state stays within the bound, keeps the refusal wording, the journal holds the full reason, and the snapshot publishes and replaces the previous one; without the fix the same test fails with "dashboard text field invalid".
Affected rules: 26 and 42 (a refused or UNKNOWN send stays visible as settled and not resent, whatever the reason's length), 60 (the page's finite bound is kept and now named once on each side), 36 (both sides: short reason unchanged, long reason clipped and publishing), 37 (fixed at source, nothing quarantined), 74
Affected floors: secrets — unchanged: the reason still passes through redact; spend cap — unchanged: the dashboard grants nothing; stop — unchanged; no duplicate sends — unchanged: nothing is sent, and the not-resent wording always survives the clip; durable intake — unchanged: the journal keeps the full reason
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes what the operator-facing page behind the operator's credential reports about delivery.
Side effects: a provider reason longer than the room left in the state field is shown clipped with an ellipsis on the dashboard only.
Undo and recovery: revert these commits and this record; the journal format is unchanged and the snapshot file is disposable.
Multi-machine posture: machine-local, unchanged.
Layer below: the journal's sendOutcomeOf (unchanged) and the page's checkSnapshot bound (unchanged value, now a named constant).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: dashboard-r2-clip-reason | clip only the reason, not the whole state, so the outcome and the not-resent wording can never be cut off; keep the page bound at 200 rather than raising it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-dashboard-PROGRESS.md
Prompt review: no model-facing text changed; the dashboard is read by the operator, never by a model.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/operator-dashboard.mjs, tests/preview/operator-dashboard.test.ts, tests/preview/operator-dashboard.ts

## Closing block

simplestRobustRoute: clip the reason at the one formatter that builds the state, against one named bound shared in meaning with the page; no new service, gate or protocol, and no agent ability removed.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
