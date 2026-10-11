# Change review — Acquire missing facts before answering with existing read tools

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: A question needing facts now directs the agent to available authorized reads before answering, with actual sources or a concrete failed-read account. The existing reply reviewer treats an offered necessary search as a handoff.
Affected rules: 10, 12, 20, 21, 23, 34, 36, 47, 49, 57, 70, 74, 78, 84, 101, 102, 103, 111, 113, 115, 116; source guidance, grounded tool availability, real replay and exact harness conformance.
Affected floors: secrets — unchanged admission and redaction; spend cap — unchanged call/output/prompt limits; stop — existing stop admission; no duplicate sends — no send-path change; durable intake — no journal/schema change.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing instructions and contextual review wording change behavior on every tool route; the exact native composition certificate changes with those bytes.
Side effects: Needed questions can consume already-budgeted reads sooner. Tool invocation-policy digests change: the desk must issue matching successor activations on landing. Static byte measurements grow by 1202; runtime caps and review reserve remain unchanged. One repeated real comparison used web reads but emitted invalid JSON; its raw output is retained and the unchanged parser refusal is replayed. The existing one format re-ask remains the recovery.
Undo and recovery: Revert this commit and restore matching prior policy activations. No migration, live configuration mutation, new persisted state or send replay is required.
Multi-machine posture: One shared tool guidance constant across Claude tools/native and Codex tools. Existing conversation ownership and admission choose the machine and authority. Real model evidence is Claude on Studio; other framings have targeted route tests.
Layer below: Inspected actual comparison journal, assembled answer envelope, memory lookup protocol, tool-system prompts, scoped admission trace, final-answer parser, Jev and full-context reviewer. Corrected the prompt sources; no extra gate, classifier or fallback was added.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/act-first.test.ts; live=tests/preview/fixtures/act-first-2026-10-10.json
Hook bypass: none
Convergence: none
Decision: act-first-tool-boundary | Shared system guidance is effective at the actual tool boundary; answer-only guidance failed the recorded replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-act-first-PROGRESS.md
Decision: act-first-memory-availability | Expose the existing lookup protocol only when it is actually offered; the real model otherwise used it for web facts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-act-first-PROGRESS.md
Decision: act-first-review | Clarify necessary reads in the existing handoff question while preserving failed-read and renewal exceptions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-act-first-PROGRESS.md
Decision: act-first-conformance | Recompute the exact composition certificate and rerun its contract after prompt source bytes changed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-act-first-PROGRESS.md
Prompt review: No fixture phrase dispatch, competitor-specific instruction or answer supplied to the model. General read-first guidance governs available tools; facts and retrieved text remain evidence. parks_on_user is a semantic question with a hypothesis, actual failed reads and unavailable tools form its opposite case. Existing parsers, review selection and holds are unchanged.
Prompt finding: 450c79237a95 | protocol-literal | Unchanged conflict clarification instruction in the existing conversation framing; test overlap does not dispatch on the fixture phrase.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:73 | not-a-deferral=Quoted recorded model output retained as replay evidence, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:112 | not-a-deferral=Quoted recorded model output retained as replay evidence, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:138 | not-a-deferral=Quoted recorded model output retained as replay evidence, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:139 | not-a-deferral=Quoted recorded model output retained as replay evidence, not an implementation promise.
Deferral: tests/preview/fixtures/act-first-2026-10-10.json:151 | not-a-deferral=Quoted malformed model output retained to prove parser refusal, not an implementation promise.

Subject (15 paths): src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, src/assembly/tool-answer-guidance.ts, tests/assembly/production-provider-tools.test.ts, tests/integration/act-first-live.test.ts, tests/preview/act-first.test.ts, tests/preview/briefing.ts, tests/preview/default-context-floor.test.ts, tests/preview/fixtures/act-first-2026-10-10.json, tests/preview/journal-envelope.ts, tests/preview/journal-longchat.test.ts, tests/preview/journal-recall-lookup.test.ts, tests/preview/reply-check.ts

## Closing block

simplestRobustRoute: Change standing tool guidance and the existing reviewer question. Restrict the existing memory lookup instruction to its offered state after a real replay showed it masquerading as a web read. Share a small dependency-free constant rather than duplicate guidance or add a router.
80/20: Real comparison and plain lookup used actual web tools and cited answers; failed read reported the attempt. Real review now distinguishes the original offer from both read outcomes. Recorded-shape replay, focused provider/memory/review/floor tests, native contract, typecheck and architecture pass. Full suite belongs to the landing pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
