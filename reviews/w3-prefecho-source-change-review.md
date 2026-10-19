# Change review — w3-prefecho-source: a preference echo is a no-op only when the model cites the record on file

Subject base: 59c66a48fa6aca275329c06fdfae303f30fa5358
Review state: open
Reviewed content: none
Outcome: Astra's cint-L12 round 1 review (MUST-FIX 1) showed that w3-prefecho used a missing lexical cue as proof that no change was requested. An uncued direct change ("Could you give detailed answers from now on?") whose decision carried {mode:"prefer", source:<this turn>, quote:<the old active preference>} was sent as a success reply, and nothing was recorded. The cued phrasing ("Please give detailed answers from now on.") stayed pending. memoryFrom now drops the echo only when the item cites an offered active preference by that record's own source and exact quote, so the model's own contextual decision says the preference on file stands. An item that names this turn as the source of a clause the turn does not contain leaves open whether a change was requested. It keeps the strict check, and the turn stays pending. The uncued/unedited test remains, but it can now only narrow the no-op, never license it. Recorded shapes replayed: the original-source echo from updates 969389758/969389759 and 7 of 8 replays of 969389782 is now answered. The this-turn-source echo (1 of 8 replays of 969389782) is pending, as it was at base. The equivalent-phrasings regression covers both phrasings. The w3-prefecho record's false claim about direct requests is corrected in place.
Affected rules: 10 (meaning, not a keyword cue, decides whether a change was requested; the deciding signal is the model's cited source), 85 (an unresolved correction stays pending instead of being lost behind a success reply), 7 (nothing is written for a no-op or for a refused decision), 41/58/70 (the acceptance of model output is narrowed, not widened), 37 (source fix, no quarantine), 74 (this record), 116 (one condition narrowed at the existing validator; no new field, prompt, gate or model call)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: narrows an existing no-op condition in memoryFrom back toward the base refusal; no prompt, parser shape, send path or write path changes
Side effects: the 1-of-8 recorded shape (echo attributed to this turn on a plain question) gets the undecided notice again, as it did at base; this is the conservative side the review asked for
Undo and recovery: revert this commit and its register regeneration; no persistent shape changes
Multi-machine posture: none; per-journal decision code, the same on every host
Layer below: memoryPreferenceState (active preferences, unchanged); the offered memoryCandidates set (preference candidates carry the record's source id, unchanged)
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

simplestRobustRoute: the no-op keys on the source the model itself cited (the offered record versus this turn) at the one validator; no new model field, no added cue phrase, no separate review service
80/20: 1 must-fix addressed, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
