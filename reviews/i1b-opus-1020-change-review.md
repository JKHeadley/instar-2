# Change review — Check the subscription output cap on the answer, not reported thinking

Subject base: 39d72c391905038ad7da24c51c6c0e8df5732b0f
Review state: open
Reviewed content: none
Outcome: The subscription provider's frame check and the preview runner's output-cap classifier compare the ANSWER's tokens (output_tokens less a well-formed reported output_tokens_details.thinking_tokens) with the 2048-token cap. Opus 5.5 rejects disabled thinking, so the pinned CLI 2.1.280 turns MAX_THINKING_TOKENS=0 into a 2048-token thinking budget. Live-proof group I on train-92-p2 (proof room three, 2026-10-20) then failed I1a/I1b and left I1d untested: the retrospective pass was refused 'review output over the cap' at 3286 output tokens, 2048 of them thinking, although its answer was 1238 tokens. With thinking counted, no narrowing of the ask could ever fit. The native self-host certificate is re-declared for the changed composition after its contract passed, and the register is replayed.
Affected rules: 9/51 (the retrospective pass, their proof artifact, can complete on Opus again); 24 (root cause of the recurring over-cap failures named: the CLI's thinking floor equalled the cap); 26/105/115 (fresh native conformance evidence for the exact composition); 106 (recorded shapes replayed: the proof-room call's usage and two direct CLI frames); 116 (one helper used at both checks; no new machinery, the cap value and the activation policy unchanged).
Affected floors: secrets — custody and disclosure unchanged; spend cap — call caps, admission and metering unchanged, and recorded usage is still the whole output; stop — the existing latch is unchanged and exercised by the native contract; no duplicate sends — dispatch and uniqueness unchanged, and an over-cap answer is still refused without retry; durable intake — journal and admission unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: It loosens the provider's output-token bound by exactly the thinking the frame reports. The answer stays bounded by the 2048-token cap and maxOutputBytes, and the call by its timeout and raw-terminal byte bound. A missing, malformed or oversized thinking count keeps the old whole-output rule. No prompt, model-facing wording or dispatch path changes.
Side effects: On a model that thinks despite MAX_THINKING_TOKENS=0, a call whose answer fits is now complete instead of uncertain. Thinking itself has no token ceiling on this route; only the timeout and the raw-terminal byte bound limit it. Recorded outputTokens still include thinking, so the retrospective budget narrowing remains conservative. On Sonnet with thinking off, behavior is unchanged.
Undo and recovery: Revert the three commits and replay the register. Restoring the old certificate alone makes the current composition fail R105. No stored-state migration is needed.
Multi-machine posture: Machine-local provider check; no ownership, replication or shared state changes. The native certificate is specific to the declared macOS runtime node-24.14.1.
Layer below: Inspected the pinned CLI binary's thinking selection (models flagged rejects_disabled_thinking get a 2048 thinking budget when thinking is disabled), call-diagnostics.mjs classification, the production-provider frame check, retrospective.ts measuredAnswerBudget/retroAnswerBudget, and the read-only copy of the proof-room journal (call-outcome diagnostic of retrospective:0). Tests were written first and failed on the accept side; afterward call-diagnostics, production-provider-subscription and the over-cap suites (161), tests/assembly (1140 passed, 6 skipped), the ready-gate tests (119) and native-harness-contract (10/10, on node 24.14.1 on the Studio) passed, as did typecheck, lint and register:check.
Bug class: live-path
Bug evidence: reproducer=tests/preview/call-diagnostics.test.ts; live=tests/preview/fixtures/thinking-floor-opus-2026-10-20.json
Hook bypass: none
Convergence: none
Prompt review: No model-facing text changes. The six findings below are existing fixture phrases that reach production-provider.ts through older tests; this change edits only the frame-check arithmetic in that file and does not touch them.
Prompt finding: 0d4664ea9de7 | quoted-evidence | Existing self-description fixture phrase of standing-trust guidance; unchanged by this unit.
Prompt finding: 14d7eeccc218 | quoted-evidence | Existing self-description fixture phrase of public-read guidance; unchanged by this unit.
Prompt finding: 450c79237a95 | quoted-evidence | Existing memory-disagreement instruction compared in journal-people; unchanged by this unit.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing fixture comparison of grant guidance; unchanged by this unit.
Prompt finding: 9781075d458e | quoted-evidence | Existing instruction to report real doorway refusals; no refusal criterion changes.
Prompt finding: b1bb3946362d | quoted-evidence | Existing Claude identity framing in the act-first capture, not a decision trigger.
Deferral: generated/register.json:1 | not-a-deferral=deterministically replayed register output containing existing descriptions, not a new commitment

Subject (13 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, src/assembly/production-provider.ts, tests/assembly/production-provider-subscription.test.ts, tests/preview/call-diagnostics.mjs, tests/preview/call-diagnostics.test.ts, tests/preview/fixtures/thinking-floor-opus-2026-10-20.json

## Closing block

simplestRobustRoute: Compute the answer's tokens once (subscriptionAnswerTokens) and use that at the two places that compare output with the cap. Raising the cap, a re-recorded activation policy, or a retrospective-only workaround would each be larger, and the last would leave every other Opus call exposed. Start guard: a well-formed thinking count only; end guard: the cap still refuses an over-cap answer; limit guards: unchanged bytes bound, timeout, call caps, stop and uniqueness.
80/20: One arithmetic change with both-sided tests on recorded shapes, the native contract and targeted suites. The Studio pipeline owns the full suite; a live group I rerun on a build containing this is still owed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
