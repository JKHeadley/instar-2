# Change review — finish a question after losing its worker

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: A confirmed worker exit before tool preparation receives one replacement through the existing harness continuation adapter, using the exact accepted input and remaining allowance. Tool-bearing uncertainty stays retained with an exact reason.
Affected rules: 4, 26, 29, 30, 34, 36, 46, 49, 55, 57, 60, 61, 62, 63, 68, 70, 74, 75, 83, 96, 101, 113, 114, 116
Affected floors: secrets — existing harness identity and admission hook; spend cap — cumulative reservation and original deadline; stop — checked before retirement and replacement; no duplicate sends — unknown outward sends prohibit continuation and no send is replayed; durable intake — original request, delivery digest and durable recovery intent survive.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Recovery changes a user-facing autonomous execution path.
Side effects: An eligible worker exit can consume remaining reserved calls on one replacement. Worker and context recovery share a one-attempt boundary. Completed tool work, missing effect counts, pending children, batch input, a paused worker and a second loss remain uncertain. Host-crash recovery remains conservative. Existing context recovery and queued-intake behavior remain covered by direct-import tests.
Undo and recovery: Revert this change and regenerate the affected source/register pins. Retained inputs remain readable because workerRecovery is an optional field; older code keeps an unresolved dispatched input uncertain on restart. No journal migration or authority change is introduced.
Multi-machine posture: Machine-local worker replacement under the existing conversation owner fence. No ownership transfer, new shared state or peer dependency.
Layer below: Read the conversation queue/reservation/retirement flow, both adapters' exit normalization, physical driver restoration checks, admission tool-preparation counter, continuation grounding consumer and 1.x recovery sources. The terminal driver independently checks the exact accepted delivery digest and absence of its original worker, and refuses a second submitted continuation. The protocol adapter previously ignored pending restoration; it now requires its own accepted submission, closed connection, exact input and original deadline before starting the restored turn through its normal delivery path. Bare launches still never replay input.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; live=tests/e2e/conversation-worker-recovery-live.test.ts
Hook bypass: none
Skip: tests/e2e/conversation-worker-recovery-live.test.ts:26 | scope=Real subscription/process proof requires explicit Studio test-login activation and an evidence destination; it was enabled and passed on the Studio, rather than spending subscription capacity in every unit-test run.
Convergence: none
Decision: work-resume-existing-continuation | Reuse existing replacement and continuation only for exact no-tool-work evidence; preserve uncertainty for every other interrupted effect. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-resume-1023s-PROGRESS.md
Prompt review: No new model prompt or parser. Recorded summary, Jev, reply-review and delivered-reply shapes from retrospective-duty-followup-train-1-2026-10-08.json pass through the replacement path with their exact saved envelope and context. Meaning does not decide liveness. Real isolated-worker evidence and limitations are recorded in PROGRESS.
Prompt finding: 0725f0150c56 | protocol-literal | Existing role/tool-refusal wording is unchanged by this repair. Its fixture assertion verifies preservation of role boundaries, not a copied phrase used to judge model output.
Prompt finding: 27d7720e7977 | protocol-literal | Existing memory/work grounding wording is unchanged. The fixture checks complete grounding delivery; no keyword gate or model verdict branches on this phrase.
Validation: Failing-first recorded-shape regression: eight failures before the implementation. The conversation session suite passes 172 tests after repair. Five recorded-protocol restoration tests failed before the adapter repair; its 19 tests then passed. The real Claude proof on an isolated test-login/workspace copy killed the exact worker before tools, returned 42 once after a 120-second foreground tool, and then killed the replacement while its sleep subprocess was running. That second input remained uncertain with the exact tool-reconciliation reason. No Telegram delivery is claimed by this local proof. Typecheck and build pass; the two final adapter files pass 156 tests. Register output was regenerated from the committed source using the existing replay generator. Final pinned checks and live evidence paths are recorded in PROGRESS. The macOS native self-host certificate is byte-bound to the prior composition and is left to the desk's contract run; no declaration is weakened.

## Closing block

simplestRobustRoute: This is the simplest robust route: extend the existing observe loop's exact exit branch to reuse replacement and accepted-input restoration. Durable recovery intent prevents crash replay, and the existing allowance, ownership and effect evidence enforce the named floors. No separate resume queue, detector, scheduler or model judge is added. Start guards require confirmed exit, zero new tool preparations, known effects/sends, no children, current authority and remaining allowance. End guards require a correlated reply and turn end, and only one recovery attempt is admitted. Unattended real-harness evidence is recorded in PROGRESS.
80/20: The author submits targeted regression and isolated live evidence, with both sides of each new decision checked. Independent convergence belongs to the desk; no independent verdict is asserted here.
VERDICT: author submission; independent review remains with the desk
