# Change review — approval-page (step 6a): the approval page under the existing dashboard's tunnel origin

Subject base: c14e24c4bfb4dfd39d9fb0d2bb6684d0bb4c9358
Review state: open
Reviewed content: none
Outcome: the build-3b independent approval surface accepts one lowercase path segment in its public base (the mount the existing dashboard forwards unchanged, for example /approve). The page, its script (base read from the page, not guessed from the path) and its links live under the prefix, every other path answers 404, the passkey is bound to the dashboard host, and the runner client's link and status name the mounted page. Authority is unchanged: the passkey signature over the exact challenge, decision and fresh nonce is the only yes, one use on both sides, and the operator store must still be owned by an identity other than the runner's (a same-identity store stays installed: false).
Affected rules: 4, 14, 15, 26, 28, 55, 60, 74, 79, 80, 82, 86, 98, 106, 113, 116
Affected floors: secrets — unchanged, no secret added; the dashboard PIN approves nothing; spend cap — unchanged, a raise still needs the verified passkey act; stop — unchanged, the page's Stop reaches the latch under the mount as before; no duplicate sends — unchanged, the page sends nothing; durable intake — unchanged
Operator questions: none in this diff; installation needs the P-01 custodian decision recorded in the lane PROGRESS
Suggested tier: critical
Declared tier: critical
Tier rationale: touches the approval surface that completes a cap raise; authority logic itself is untouched, only its path prefix
Side effects: an existing surface.json gains a mount field (rewritten on the surface's next start); a pre-existing root-mounted configuration keeps its exact paths; a runner reading an older surface.json without mount treats it as root-mounted
Undo and recovery: revert the two commits; a mounted surface falls back to refusing its non-root base at start (loud), nothing is recorded or lost
Multi-machine posture: machine-local, deliberately: the surface, the dashboard proxy and the runner share one machine (single-machine shape, no peer dependency)
Layer below: scripts/approval-surface-core.mjs verifyAssertion/verifyRegistration origin and rpId checks and readOwnedFile ownership check, unchanged and exercised by the mounted test
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register regeneration, no deferred work

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/approval-surface.mjs, tests/preview/README.md, tests/preview/approval-surface-client.mjs, tests/preview/approval-surface.test.ts

## Closing block

simplestRobustRoute: the required outcome is the existing passkey approval page reachable from the operator's phone through the existing dashboard instead of a new host name or server. The simplest route is a path prefix on the existing surface: the dashboard forwards one path unchanged to the loopback page; no new server, login, UI stack or verifier. No machinery is added beyond the prefix check and the base carried in the page.
80/20: tsc --noEmit clean; architecture check passed; the touched test file passes 10/10 including a new mounted test (approve applies exactly one raise; decline, replay on page and runner, wrong operator, altered wording, other-site passkey and off-mount paths refuse); a mutation reverting the page base to path-guessing fails that test.
VERDICT: author submission; the independent verdict is pending
