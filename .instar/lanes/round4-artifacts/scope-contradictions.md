# Round 4 implementation blockers — not a repair certificate

Source HEAD: f7aba10cdee37fa62dc03c1afcbe0b4d399088aa.

## Incompatible unchanged Q7/Q8 prerequisites

The archived `real-owner-probes.test.ts` defines ONE `realDelivery()` helper. Both Q7 and Q8 call it without arguments. It uses `effectFixture()` and its `ordinary-reply` message, obtains a real Six claim, and returns a specification and the real Ten runtime.

Q7 starts with `const admitted=value(runtime.recordContextDelivery(spec));`. That must succeed before the test reaches `transport.consume(liveClaim,fence)` and the zero-invocation assertion. Q8 starts from the same helper and requires `runtime.recordContextDelivery(spec)` to return Refused because its effect is an ordinary reply. There is no preceding authority difference at these calls. A general role check cannot satisfy both. Refusing the Q7 prerequisite does not pass Q7 for the right reason. Distinguishing these calls by the test title, filesystem fixture directory, callback shape, or future consumption would violate the explicit round-4 rules.

The same issue affects R8's ordinary-reply acceptance control. The review itself identifies that fixture limitation.

## Missing owner operation arm

`src/effects/contracts.ts:19` declares only `purpose: 'ordinary-reply'` for `OutboundMessage`; `src/effects/records.ts:96` and `:175` enforce it. `EffectDoorway.handoff()` operates on that Eight-owned request and calls Six's consume before invoking its adapter. No context-delivery payload/definition arm exists in the current public Eight API. Adding one to Eight or reinterpreting an ordinary reply as context delivery is outside this round's Ten/Five cut. Ten must not counterfeit an Eight-owned record or registration to make this positive possible.

`src/transport/authority.ts:288–295` requires the exact live `DispatchClaim` in its private authority map and durably consumes it. The current Ten driver receives only claim/operation strings and a structural `execution.deliver` callback. The unchanged R2 helper supplies no real Six authority, fence, or live claim capability, yet requires exactly one callback invocation before the simulated acceptance-append cut. Making that supplied callback execute once via a replacement Ten-local flag would fail the requested owner-authority requirement.

## F8 versus immutable landed boot positives

`tests/assembly/production-fixture.ts:101` supplies a structural graph with no-op `open/read/ground/transition/readExit`. `tests/integration/assembly-production.test.ts:8–11` requires `bootProductionAssembly()` with this graph to succeed. Several landed integration/e2e cases do the same. They have no native reader, confined driver, or graph factory provenance. They are unchanged on local main b7702a2 and are locked by this round's instructions.

Requiring real graph/runtime/harness/store/scope provenance at every production boot correctly refuses these compositions too. Allowing only those no-op test graphs through would be the explicitly forbidden test-input-shape exception. Keeping an optional marker gate would leave original unmarked V31 open.

## Needed contract resolution

A successful repair requires an actual Eight-owned context operation arm, real authority/capability prerequisites for the durable invocation positives, a valid context-effect setup for Q7 while Q8 retains its ordinary reply, and permission to update landed boot-positive fixture wiring to genuine production factories. The safety assertions themselves need not be weakened. Until those prerequisite/scope constraints change, all four findings cannot be honestly certified fixed under the simultaneous instructions.

No marker, fixture exception, assertion rewrite, or owner-boundary bypass is proposed here. F2/F3/F8/F9 remain OPEN; this document is not DONE success evidence.

## Executed guard experiment

A four-line additive experiment in Ten required the decoded payload purpose to be `context-delivery` and required the existing graph capability unconditionally at production boot. The original reviewer tests and locked integration test were unchanged. Result: process exit **1**; **2 passed, 2 failed, 48 unselected/skipped**. Q8 and original unmarked V31 passed. Q7 failed at its initial `value(recordContextDelivery(spec))` with `ordinary reply is not a context delivery`. The landed P10-SEAM-04 boot positive failed with `production boot requires a factory-issued grounding graph`. This is executable evidence of the conflicting prerequisites, not a repair credited from setup refusal.

Both source files were then restored byte-for-byte; `git diff --exit-code -- src` returned 0. The exact experiment patches and result are retained beside this report. No experimental guard ships on this branch.

## Test process capture

The first full focused baseline produced a complete JSON report: **119 passed, 9 failed, 0 skipped, 128 total**. Its wrapper then attempted to assign zsh's readonly `status` variable, so that wrapper's exit is not used as the Vitest exit. The same focused command was repeated with Node `spawnSync` recording the child process status directly. The final `focused.exit` and `focused.json` are the authoritative paired records.

The continuation capability was checked through the authenticated local API and was enabled. Its start endpoint rejected the non-Telegram owner identifier with `invalid-owner`; no numeric Telegram topic was supplied in this task, and no unrelated topic ledger was created or restarted.

Final focused baseline: **Vitest exit 1; 119 passed, 9 failed, 0 skipped, 128 total**. Failures: **R2, R3, original unmarked V31, Q1, Q2, Q3, Q5, Q7, Q8**. Both native positives **N1/N2 pass**. These are final measured outcomes on unchanged f7aba10 implementation; none of the failed cases is credited as fixed.
