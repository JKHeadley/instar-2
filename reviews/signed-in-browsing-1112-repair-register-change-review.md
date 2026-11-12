# Change review — replay signed-browser repair register

Subject base: ee3c8a0e2919e8e24f68a2eafc872d25c3bf403f
Review state: open
Reviewed content: none
Outcome: generated register and capability views pin the committed signed-browser repair source ee3c8a0e2919e8e24f68a2eafc872d25c3bf403f. This is mechanical publication of a partial repair, not closure of MUST-FIX 1.
Affected rules: 5, 49, 69, 74, 90, 101, 102, 111, 113, 116, 123
Affected floors: secrets — no credential or enrollment change; spend cap — no model call or billing change; stop — no runtime change; no duplicate sends — no identity or effect change beyond the parent source commit; durable intake — no intake change.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: generated governance inputs are pinned to committed source and must be replayed mechanically.
Side effects: generated file hashes, source revision and rendered views change together. No declaration or native certificate is hand-edited.
Undo and recovery: replay the existing generator from the chosen source commit; never hand-edit source pins or remove durable effects.
Multi-machine posture: generated repository artifacts are shared through Git. Profile state remains deliberately machine-local as declared in the source review.
Team posture: no access, ownership or sharing change; same source review posture applies.
Layer below: scripts/build-register.mjs replay/check and scripts/check-register-wiring.mjs enforce source roster, code bytes and consumed inputs. The source repair review carries the actual browser/effect-owner evidence and explicitly open capability finding.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: signed-browser-repair-register | Replay the official generator from the committed source; no owner manifest changed and no pin or certificate was edited by hand. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/signed-in-browsing-1112-repair-build-report.md
Prompt review: no prompt or model-output grammar changes; rendered capability views preserve their source declarations.
Deferral: generated/register.json:1 | not-a-deferral=mechanical serialization of existing register facts, with no newly deferred behavior
1.x comparison: inherits the source repair comparison at db3ed6d3052cfcc24888b6c8bc86086abcfc2987, including PlaywrightProfileRegistry.ts, SigninProfileGuard.ts and docs/specs/playwright-profile-registry.md. This commit publishes 2.0's existing register; it imports no new 1.x behavior.

simplestRobustRoute: run node scripts/build-register.mjs --replay --commit ee3c8a0e2919e8e24f68a2eafc872d25c3bf403f and check its output. This is the existing mechanical publication route, with no new machinery.
80/20: the replay succeeds with 308 entries, 123 rules and 34 terms. Final lint/register checks and the Studio-local report limitation are recorded in the handoff report. The full MCP capability finding remains open.
VERDICT: mechanical author submission; no independent convergence or READY claim
