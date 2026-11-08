# Change review — A helper has no turn cap of its own

Subject base: 9a39edaeefeb72f53c21265407da20b6c9680b00
Review state: open
Reviewed content: none
Outcome: Repairs the two must-fix findings of /Users/dabombstudio/.instar/agents/echo/.instar/lanes/astra-unit-helper-limits-1107-review.md. (1) The independent four-turn helper cutoff is gone: SUBSCRIPTION_TOOL_LIMITS.childMaxTurns (src/assembly/production-provider.ts) is now the turn's shared tool-call allowance plus the helper's answer turn (maxToolCalls + 1 = 33), passed as the worker subagent's maxTurns. It never binds before the shared allowance is spent (each non-final helper turn makes a call the admission hook counts; every call past maxToolCalls is refused there), and it stays the finite number the call cap reserves per subagent before dispatch (tests/preview/tool-turn.mjs toolChildrenFit and the 'reserved' row with delegation.turnsEach, Rule 114), so the spend floor holds: the whole-task reservation is now maxTurns-1 + children x 33 (73 calls for two helpers) against the operator's call cap; a short allowance reserves fewer helpers as before. The full-tools class ceiling (tests/preview/tools-policy-class.ts FULL_TOOLS_CEILINGS.childMaxTurns) moves to 33 with an added predicate that a policy's childMaxTurns never exceeds its own maxToolCalls + 1, so the standing full-tools grant 121996 still covers the build and tools stay on; recorded L43/L44 policies stay covered. The sealed guidance-only pins (train-42) are left as a disposition this build is now outside of by exactly this cap; the test proves that restoring the old bound and sentence gives the guidance-only build exactly. The tools prompt sentence now says helpers share the turn's tool calls and work until they answer, instead of "each up to 4 turns". (2) R105: tests/preview/native-harness-contract.test.ts ran on this Studio (1 certificate failure, 9 passed, before renewal; 10/10 after), and the preview-self-host-native x claude-code-subscription x darwin x self-hosting conformance is renewed to the measured sha256:041b355ca67411c8187b76bf34028e667f411bcbeb4a45a3c9e1be3a9c765122; node scripts/check-architecture.mjs exits 0.
Affected rules: 1, 103, 104, 105, 114, 115, 116, 121
Affected floors: secrets — unchanged; no read path, credential or sandbox setting moves; spend cap — each helper's whole bound (33 calls) is reserved against the call cap before dispatch, the hook refuses calls past the shared allowance, --max-budget-usd stays the backstop; stop — the operator's stop still ends a helper past four turns and its edge is recorded cancelled (new test); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes a model-facing prompt sentence, a subagent launch bound and the class predicate a standing grant resolves through, plus a conformance certificate.
Side effects: a tool turn reserves up to 73 calls instead of 15 when both helpers fit; a helper keeps working while the turn's shared allowance lasts.
Undo and recovery: revert 8e80381b2 (restores the 4-turn bound, the class ceiling and the earlier certificate together).
Multi-machine posture: machine-local; per-turn limits and a per-host certificate, no state or store.
Layer below: Claude Code 2.1.280 --agents maxTurns per subagent; the admission hook's per-step call count shared with subagents (tests/preview/tool-admission.mjs).
Bug class: unit
Bug evidence: reproducer=tests/preview/tool-turn.test.ts
Hook bypass: none
Convergence: none
Decision: hl1107-shared-allowance | bound a helper by the turn's shared tool-call allowance plus its answer turn rather than dropping maxTurns, because the reservation needs a finite per-helper number and a helper looping on refused calls must still stop | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-limits-1107-PROGRESS.md
Decision: hl1107-class-ceiling | move the full-tools class ceiling with the bound and tie it to maxToolCalls + 1, because 4 was an implementation number no grant named (grant 121996 asked for full ability; Rule 121 source check of the operator's words) and the class's spend checkpoint is unchanged | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/helper-limits-1107-PROGRESS.md
Prompt review: one sentence of the tools system prompt changed (the subagent bound); the remaining findings are existing pinned wording, unchanged.
Prompt finding: 0d4664ea9de7 | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: 14d7eeccc218 | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: 38a2c5d186f1 | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: 45e37ea2e9e9 | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: 9781075d458e | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: b1bb3946362d | protocol-literal | existing system-prompt wording pinned by its test, unchanged by this change
Prompt finding: dd26956910e2 | protocol-literal | existing sentence ending, unchanged, pinned by production-provider-tools.test.ts
Prompt finding: e8d54b193e5d | protocol-literal | the new helper-bound wording, pinned by production-provider-tools.test.ts where the old wording is restored to prove nothing else moved

1.x comparison: JKHeadley/instar main 40676770f5d3 (inspected 2026-11-07, carried from the parent record): src/core/SessionManager.ts launches Claude Code with no --max-turns or --agents bound, so 1.x helpers are built-in subagents with no turn cap of their own, bounded only by the session's whole-task limits. This carries that behaviour over; 2.0 keeps its whole-task admission reservation and hook call count, which 1.x lacked.

Verification: npm run typecheck exit 0; new test "a helper has no turn cap of its own" passes and fails with childMaxTurns restored to 4 ("expected 4 to be greater than 4"); tool-turn, production-provider-tools, tools-policy-class, native-loop, tool-turn-replay (recorded hook/result shapes), tool-paths, tools-default, installed-harness-logins, tool-admission 156/156; native-harness-contract 10/10; node scripts/check-architecture.mjs exit 0.
Residue: guidance-only-pins | low | the sealed tools-guidance-only-v1 pins (train-42) no longer match this build by exactly the helper bound; coverage is through full-tools-checkpointed-v1 (grant 121996), proven in production-provider-tools.test.ts

## Closing block

simplestRobustRoute: one derived number in place of a fixed one, the class ceiling moved with it and tied to the shared allowance, the existing reservation unchanged in shape; no new cap or approval round.
80/20: removes the helper cutoff that stopped both ROW16 helpers, keeps spend, stop and exhaustion enforced, and restores the machine-checked conformance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
