# Change review — w3-memmisfire: a plain question whose decision echoes its own reply as a preference gets its answer

Subject base: ebaa3b171595de51468a133a7b045b8abfbabdf5
Review state: open
Reviewed content: none
Outcome: Live proof room on cint-L13 72fb5a82, update 715672853 (group K, 22:12 PDT): the operator's plain question "What can you do in this chat, and what can't you do?" was answered "PREVIEW — I couldn't record that memory change. Please send it again." Cause, from the journal rows: the answer decision (claude-sonnet-5) carried a good reply plus memory [{mode:"prefer", source:<this turn>, quote:"Replies to two sentences, as requested."}]. That quote is a clause of the model's own reply, not of the operator's message, so memoryFrom refused it (prefer requires the quote in the trigger's text), which refused the whole decision (invalidMemory). The answer row was written with memoryPending, the turn was held "memory correction pending", the summary judgment could not run (earlier span failures; memory-undecided reason summary-failed), and the reply renderer sends MEMORY_UNDECIDED_REPLY whenever memoryPending and memoryUndecided both hold, so the recorded answer was discarded. L12's repair (6d85685f) covered a prefer item citing the on-file preference under its own source, not this own-reply shape. Fix at the source, in the answer-decision block: on a turn that is not an edit and matches no memoryCue or preferenceCue, a prefer item that names this turn, carries only mode/source/quote, and quotes a clause found in the decision's own reply but not in the operator's message is set aside before memoryFrom (the agent's own words are no evidence of an operator request). If nothing else is proposed, memory is [] and the model's answer is sent with one runner line: "No memory or preference change was saved from this message. If you meant to change one, please say it again." The validator, cued and edited requests, every other invalid proposal and the undecided notice are unchanged.
Affected rules: 2 (nothing silently lost: the set-aside is announced in the reply, and a meant change is asked for again), 7 (nothing is written for the set-aside item), 10 (cues still only schedule judgment; the set-aside is a structural test of where the quote occurs, not a meaning decision), 78/84 (an ordinary question about capabilities gets the capability answer), 85 (a genuine request is never sent as a silent success: cued turns keep the hold, uncued ones get the not-saved line), 37 (fixed at source), 74, 116 (one filter beside the existing L12 no-op; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged (one fewer summary attempt on such turns); stop — unchanged; no duplicate sends — unchanged (one reply per turn); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one runner condition narrowing when an answer is held, plus one fixed appended line; no system-prompt, provider-policy or invocationPolicyDigest change; direct-request safety untouched and proven by test on both sides
Side effects: an uncued, unedited turn whose decision echoes its own reply as a preference is answered with the model's reply plus the not-saved line instead of being held; if such a turn was in fact an uncued preference request, the operator is told nothing was saved and asked to say it again instead of receiving the bare undecided notice
Undo and recovery: revert the fix commit and this record; no journal record shape changed, so journals replay under either version
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts answer-decision block (memoryFrom, memoryCue, preferenceCue, invalidMemory)
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-memory-own-reply-echo.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/results/K-proofroom-20260930-221200/reply-k1.json
Hook bypass: none
Convergence: none
Decision: w3-memmisfire-own-reply-echo | a prefer item quoting only the agent's own reply is set aside on an uncued, unedited turn, with a not-saved line, rather than widening the general refusal for uncued turns, because L12's tests deliberately keep other uncued invalid shapes pending (Rule 85) and this shape carries no operator evidence | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-memmisfire-PROGRESS.md
Prompt review: no prompt text changed; the system prompt and packet guidance are unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)

Subject (3 paths): tests/preview/fixtures/proofroom-memory-misfire-715672853-2026-09-30.json, tests/preview/journal-memory-own-reply-echo.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: one filter beside L12's existing on-file no-op in the answer-decision block, plus one fixed line; the simpler "answer every uncued refused decision" route would silently overturn L12's Rule 85 boundary tests
80/20: 0 must-fix, 0 notes — one runner condition and its both-sides tests on the recorded rows
VERDICT: author submission; the independent verdict is recorded as a pass
