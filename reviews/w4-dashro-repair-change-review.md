# Change review — w4-dashro repair round 1: the read-only dashboard bounds overlapping PIN checks before awaiting the verifier

Subject base: bbee736167af78b8e9969c628b11e8753c4b2561
Review state: open
Reviewed content: none
Outcome: Unit review round 1 (Astra, VERDICT NO) named one must-fix (MF1, Rule 60): `signIn` in scripts/operator-dashboard-readonly.mjs checked completed failures and then awaited the PIN verifier without reserving capacity, so 100 wrong-PIN sign-ins pipelined over one connection put 100 checks in flight before the lock engaged. `signIn` now reserves a pending-check slot synchronously before the await, counts pending checks with completed failures against the existing limit of five, refuses overflow as `locked` without calling the verifier, and releases the slot in `finally` on success, refusal or exception. A new test drives the reviewer's burst through the real HTTP host (100 pipelined requests over one socket): at most five verifier calls run, the overflow answers 429 (5 x 401, 95 x 429), the direct path refuses while five are in flight, a thrown verifier releases its slot, and after the failure window a fresh check reaches the verifier and signs in. The same test against the pre-fix source reports 100 calls and a peak of 100.
Affected rules: 60 (the PIN checks the runner can have in flight are now bounded at the admission checkpoint, and overflow is refused rather than queued), 36 (both sides tested: the bounded burst, and recovery once checks settle), 95 (overflow fails closed as locked; a verifier exception still answers unavailable and frees its slot), 37 (fixed at its source; nothing quarantined), 74 (this record), 101 (plain commits, no bypass), 116 (one counter and a finally; no limiter service or queue)
Affected floors: secrets — unchanged (the verifier answer body is still discarded); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a three-line admission change in the read-only dashboard's sign-in plus its test; the suggested critical tier comes from the regenerated register files, which are a tool replay with no hand edits.
Side effects: while five PIN checks are in flight, a sixth sign-in is answered "Too many tries" (429) instead of waiting; the agent's tools and abilities are unchanged.
Undo and recovery: revert these commits and this record; the register regenerates from source.
Multi-machine posture: machine-local in-memory counter, unchanged posture.
Layer below: the existing PIN verifier adapter `pinCheckAt` and its five-second timeout, unchanged.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: not model-facing: no prompt, model-output parser, or decision on model output changes.
Deferral: generated/register.json:1 | not-a-deferral=generated register text replayed by tool, not postponed work

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/operator-dashboard-readonly.mjs, tests/preview/operator-dashboard.test.ts

## Closing block

simplestRobustRoute: reserve a pending slot synchronously before awaiting the verifier and count it against the existing failure limit, exactly the reviewer's smallest fix; no limiter service, queue or redesign, and no agent ability narrowed.
80/20: 0 must-fix, 1 note (N1, live coverage on the deployed path, stays with the combined build's live proof per row #502).
VERDICT: author submission; the independent verdict is recorded as a pass
