# Change review — w3-standground: an uncued pushback with an unresolved memory target gets the model's own reply

Subject base: 85b46430648ccb30cc58bac98ce0c03e9db821d4
Review state: open
Reviewed content: none
Outcome: Live proof I3b (Rule 19) failed on cint-L5 85b46430: after "What is 17 × 3?" → 51, the operator's "No, it's 41." was answered with the fixed MEMORY_UNDECIDED_REPLY instead of the model's reply holding 51. Cause: the turn matched no memoryCue, preferenceCue or edit, but the answer decision declared memoryDisposition "unresolved" with memory []; journal.ts set invalidMemory for ANY unresolved disposition, so the ordinary turn was held, judged by summary and settled memory-undecided, and the notice replaced the reply. Fix at the source, in the answer-decision block only: an unresolved disposition with no memory proposal (memory [] or absent) on a turn that is not memoryUndecided, not an edit, not cued by memoryCue or preferenceCue, and not already settled by a summary is an empty memory decision — the same rule the adjacent code already applies to a missing decision. The model's reply is sent and nothing is written. Cued and direct requests, invalid memory/date/undo/merge proposals, personMerges validation, the answer-correction path and every fixed notice are unchanged.
Affected rules: 7 (an unresolved decision writes nothing: memory is set to []), 10 (the cue still only schedules judgment; cued turns keep the hold), 19 (the agent's own answer reaches the operator), 37 (fixed at source, no quarantine), 74, 116 (one condition beside the existing missing-decision rule; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged (one fewer summary call on such turns); stop — unchanged; no duplicate sends — unchanged (one reply per turn, replay sends nothing new); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one runner condition that narrows when an answer is held; no system-prompt, provider-policy or invocationPolicyDigest change; direct-request safety untouched and proven by test
Side effects: an uncued turn whose model says it cannot identify a memory target and proposes nothing is answered with the model's reply instead of being held; an uncued direct forget that cannot be resolved (for example "Please stop remembering …" with no offered candidate) is likewise answered with the model's honest reply, writing nothing
Undo and recovery: revert the fix commit, the regeneration and this record; no journal record shape changed, so journals replay under either version
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts answer-decision block (memoryCue, preferenceCue, invalidMemory)
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-uncued-unresolved.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/I-proofroom-20260929-201552/reply-i3b.json
Hook bypass: none
Convergence: none
Decision: w3-standground-empty-unresolved | an explicit unresolved disposition with no proposal on an uncued ordinary turn is treated like the already-accepted missing decision, because nothing was asked of memory and holding the answer denies Rule 19 | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-standground-PROGRESS.md
Prompt review: no prompt text changed; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-uncued-unresolved.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: one condition beside the existing missing-decision rule in the answer-decision block; nothing else
80/20: 0 must-fix, 0 notes — one runner condition and its both-sides tests
VERDICT: author submission; the independent verdict is recorded as a pass
