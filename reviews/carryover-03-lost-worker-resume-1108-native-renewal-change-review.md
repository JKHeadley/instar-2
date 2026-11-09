# Change review — row 03 native Darwin conformance renewal and register replay

Subject base: e1b60f970f212bbfc6f7a6cbafdfaba9695e7192
Review state: open
Reviewed content: none
Outcome: Astra round 1 MUST-FIX for unit-carryover-03-lost-worker-resume-1108. The run-entry reconciliation in src/assembly/production-session-work.ts changed the preview-self-host-native × claude-code-subscription × darwin × self-hosting composition bytes, so its declared certificate (sha256:3139c2ad…) no longer matched (R105). The existing contract tests/preview/native-harness-contract.test.ts was run on the Studio (DaBombs-Mac-Studio, node 24.14.1): before renewal 9/10 passed and only the certificate assertion failed, measuring sha256:f3711da6405063a9f0d45b70129ac2b66af229f91f8703f60f2bc5ffa4c822bb; the declaration was renewed to that digest and the contract then passed 10/10, and node scripts/check-architecture.mjs exits 0. The register was replayed for the new commit. Row 03 stays OPEN pending the desk's live proof.
Affected rules: 26, 34, 37, 49, 70, 74, 101, 105, 111, 113, 115, 116; architecture R105.
Affected floors: secrets — no new surface; spend cap — unchanged, no model call added; stop — unchanged and covered by the contract; no duplicate sends — unchanged and covered by the contract; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: byte-bound native conformance evidence changes; executable behavior is unchanged from the reviewed recovery commit.
Side effects: the declaration and generated publication bind the measured composition and the current committed source bytes.
Undo and recovery: revert together with the recovery source change and regenerate publication; the older certificate cannot certify the new bytes.
Multi-machine posture: the shared declaration certifies only the exact Darwin runtime measured on the Studio (node-24.14.1@sha256:91d3afb6…, unchanged).
Layer below: scripts/composition-digest.mjs currentRuntime/composition digest, tests/preview/native-harness-contract.test.ts, desk manifest rehash and repin (0 pins changed), scripts/build-register.mjs --replay. Same route as 8e80381b2 and 6afe1d863. 1.x comparison is inherited from the recovery record (reviews/carryover-03-lost-worker-resume-1108-change-review.md); this commit adds no behavior.
Bug class: none
Bug evidence: evidence maintenance; before/after native contract results are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-lost-worker-resume-1108-PROGRESS.md under "Pipeline repair".
Hook bypass: none; core.hooksPath is unset and no hook bypass flag was passed.
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

## Closing block

simplestRobustRoute: run the existing native contract and renew the existing declaration to the measured digest only after all ten cases pass; no new runtime machinery, no capability disabled, no digest changed without the contract.
80/20: native contract 10/10, architecture, lint, register check and change-review checks; the pipeline owns the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
