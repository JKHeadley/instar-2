# Change review — cint-L5 repair 2: a plain reply records no decision, so it is sent and every open request stays unchanged

Subject base: 128e8799fca541eaa4068e079783ae6229f22672
Review state: open
Reviewed content: none
Outcome: The answer check on a copy of the live preview failed a second time (16:29, build 128e8799, copy canary-copy-20260929-162815): the real model answered the probe in plain text even after the one decision re-ask, so the no-decision guard held the answer and the exhausted-summary settle path sent the memory-undecided notice instead of the marker. Fix at the source without relying on the model obeying a format: the guard that turned every plain operator reply into an unresolved memory decision while a request was open is removed, together with the decision re-ask. A plain reply records no decision, so nothing changes: the answer is sent (never held, never replaced by the memory-undecided notice), every open request stays exactly as it was and still falls due once, and the answer ends with a fixed plain line naming the open request(s), saying no change was recorded and asking the operator to say it again if a cancel or change was meant. Only a recorded decision cancels; a decision naming no offered request cancels nothing and says so (existing). Journals holding the 128e8799 `undecided` format-retry rows (canary copies only) stay readable.
Affected rules: 10 (only the model's recorded decision cancels; no keyword narrowing), 14 and 15 (the operator's ordinary question is answered), 37 (fixed at source, no quarantine), 57 and 93 (a request changes only by a recorded decision; with none it stays open and falls due once, and the operator is told so in plain words), 74, 102, 116 (removes a mechanism: one guard and one re-ask)
Affected floors: secrets — unchanged (the plain line quotes the operator's own request through the existing clean/redact/clip path); spend cap — lower (no extra re-ask call); stop — unchanged; no duplicate sends — unchanged (one reply per turn; the due turn is written once and sent once, replay-proved); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: removes a hold and a re-ask on the preview answer path and adds one fixed runner line; no system-prompt, provider-policy or invocationPolicyDigest change
Side effects: while a request is open, a plain-text answer carries one extra fixed line; a plain-text "cancel" no longer holds the request, it falls due unless the operator's next message records a cancel
Undo and recovery: revert the fix commit, the repin, the regeneration and this record
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts answer decision parsing, openRequests and the format-retry projection
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L5-plain-no-decision | a plain reply is treated as no decision (send it, change nothing, say so in plain words) instead of re-asking or holding, because the real model answers plainly even when re-asked and the operator floor is that an ordinary answer is sent and an undecided request falls due once | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L5-PROGRESS.md
Prompt review: the re-ask packet text ANSWER_DECISION_REMINDER is removed; the new fixed line is runner-authored reply text, not model input; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/journal-requested-action.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: remove the plain-reply hold and its re-ask; a plain reply changes nothing and says so; proved by a stub model that answers plain text to every call (the exact probe shape, a plain "cancel", a decided and an undecidable cancel) and by offline replays of both kept canary copies (marker sent once, no undecided notice; HEAD reproduces the notice)
80/20: 0 must-fix, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
