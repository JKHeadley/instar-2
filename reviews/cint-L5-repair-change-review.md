# Change review — cint-L5 repair: a plain reply while a request is open is asked once for its decision

Subject base: 6312dd5accb576bc37bc903017477b65272bd90b
Review state: open
Reviewed content: none
Outcome: On a copy of the live preview (16:13, build 6312dd5a) the probe "Canary-copy check …: my test marker is probe-9f77778e. What is my test marker?" was sent the memory-undecided notice instead of its marker. Cause: a reminder request ("Remind me today at 2:45 pm") was open, and the answer model replied in plain text. The int13 guard treats any plain operator reply as an unrecorded decision about open requests (Rules 57, 93) and routes it through the unresolved-decision hold; this journal's summary reservation is UNKNOWN, so the wedge fix's settle path immediately settled the probe undecided and rendered the fixed notice. The live build 422570a0 answered its probes before the request existed, so the same defect was latent there. Fix at the source: a plain answer to a verified-operator turn while a request is open gets one re-ask on the same turn (the existing format re-ask machinery, under the same call cap, never for a probe or a due turn), asking for the reply object with cancelReminders ([] when none). The model decides whether the message cancels anything; a second plain reply keeps the existing recovery hold unchanged. The format-retry record gains `undecided: true` (answer role only, no failure class) beside the existing `failureClass: 'malformed'`.
Affected rules: 10 (the model, not a keyword, decides a cancellation), 14 and 15 (the operator channel keeps being answered), 37 (fixed at source, no quarantine), 57 and 93 (a reminder stays unsent until a recorded decision; a second plain reply still holds it), 74, 116 (one bounded re-ask reuses the format re-ask; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged (the re-ask is one counted, token-reserved call under the existing cap, at most once per turn, shared with the malformed re-ask); stop — unchanged (no re-ask while halted); no duplicate sends — unchanged (the re-ask precedes any intent; one reply per turn); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one bounded re-ask on an existing path plus an optional record field that replays older journals unchanged; no system-prompt, provider-policy or invocationPolicyDigest change
Side effects: a plain answer while a request is open costs one more model call; the answer is then sent as an ordinary answer instead of being held or replaced by the memory-undecided notice
Undo and recovery: revert the fix commit, the repin, the regeneration and this record; journals holding an `undecided` format-retry row would then refuse to replay, so revert only before such a row is written, or keep the record validation
Multi-machine posture: single-machine preview runner only; no shared state changed
Layer below: tests/preview/journal.ts requestedPushesActive, openRequests, the answer format re-ask and the format-retry projection
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L5-plain-reask | a plain answer while a request is open is re-asked once for the decision instead of narrowing the guard with a keyword, because a lexical cue may not decide a cancellation (Rule 10) and the always-plain cancellation must stay held | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L5-PROGRESS.md
Prompt review: one new packet field text, ANSWER_DECISION_REMINDER, carried as formatReminder only on the re-ask (like ANSWER_FORMAT_REMINDER); it states the plain reply recorded no decision and names the reply object with cancelReminders; the system prompt is unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | the packet instruction for questions about what the operator said, retained verbatim; the test checks the instruction is carried (unchanged here)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/journal-requested-action.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: reuse the existing one-shot answer re-ask to obtain the missing decision, leaving the unresolved-decision hold as the fallback; proved by the exact probe shape, a re-asked cancellation, the unchanged always-plain hold test, and an offline replay of the kept canary copy
80/20: 0 must-fix, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
