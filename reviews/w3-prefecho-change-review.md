# Change review — w3-prefecho: a plain question re-stating a preference already on file is answered

Subject base: e2582787757457965f14d60a6e59e3521b868f2e
Review state: open
Reviewed content: none
Outcome: The answer check on a copy of the live preview for cint-L12 (e2582787) gave no real answer: the operator's plain "what is my test marker?" was answered with the fixed "I couldn't record that memory change" notice. Replaying the stored prompt of update 969389782 against the same model (claude-sonnet-5) reproduced the cause in 1 of 8 runs: the reply was right, but the decision also carried {mode:"prefer", source:<this turn>, quote:"Your replies are too long — keep them to two sentences."}, a re-statement of the preference already on file. memoryFrom refuses a prefer quote that is not in the triggering message, so the whole decision was refused, the turn was held for summary judgment, and (the copy's journal has no summary able to decide it) settled as undecided. Replays of 969389758 and 969389759 (the same notice on plain capability questions in the same journal) gave the same echo under the preference's original source id. memoryFrom now drops, as a no-op, a prefer item on an ordinary (uncued, unedited) turn whose quote is an active preference's quote, when the quote is not in the message and the source is this turn or that active preference's own source. Nothing is written for it; every other item, and every direct preference/correction request, keeps the existing strict check.
Affected rules: 7 (a memory change is recorded only from an exact, valid decision; the echo writes nothing), 14 and 15 (the operator's plain question is answered instead of withheld), 37 (source fix, no quarantine), 74 (this record), 2 and 3 (both sides tested with the recorded shapes), 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged (the turn was always journaled; only its reply changes from the undecided notice to the model's answer)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one validator condition that only turns a refusal into a no-op for an item that restates existing state; no prompt, parser shape, send path or write path changes, and direct requests are untouched
Side effects: on an ordinary turn, a model decision whose only memory content is such an echo is now answered normally (with memory []) instead of held; an uncued restatement whose quote IS in the message is unaffected (still recorded as before)
Undo and recovery: revert 6d85685f and its register regeneration; nothing persistent changes shape (no new journal record kind or field)
Multi-machine posture: none; per-journal decision code, the same on every host
Layer below: memoryPreferenceState (active preferences, unchanged); memoryCue / preferenceCue (the existing lexical cues, unchanged); the Rule 19 uncued-unresolved precedent in the same answer path
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-uncued-unresolved.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-prefecho-evidence/replay.txt
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; the answer and summary prompts are unchanged
Prompt finding: 849db3a6296a | protocol-literal | the runner's fixed reply when no memory is saved; the memory-list test asserts that fixed text (unchanged here)
Prompt finding: bd01de21286a | protocol-literal | the packet instruction to cite sourceLabel, retained verbatim; the hallucination-rate test checks the instruction is carried (unchanged here)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing answer-guidance wording for questions about what the operator said, unchanged here; the hallucination-rate test checks it is carried
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-uncued-unresolved.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: one no-op condition at the one validator that refused the echo, scoped to ordinary turns and to quotes already on file; no prompt change (nondeterministic) and no change to the held/summary path
80/20: 0 must-fixes, 1 note (the copy's journal also has an orphaned 2026-09-27 summary reservation and no summary that fits, so any genuinely pending memory request there still settles as undecided; that is the existing designed fallback for direct requests and is not changed here)
VERDICT: author submission; the independent verdict is recorded as a pass
