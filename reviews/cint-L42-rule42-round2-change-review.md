# Change review — cint-L42 round-2 repair: bounded runner outcome lists keep every refusal beside the effect refusal

Subject base: 899934b5db0b1b0a52fdceac0d1cee275871f883
Review state: open
Reviewed content: none
Outcome: Integration review round 2 (Astra) MUST-FIX 1 on cint-L42: the round-1 repair kept a whole-answer clip as its fallback when runner outcome lines left no room for the model body, and the previous record's claim that this was "not reached in practice" was wrong: seven admitted reminders of 445 bytes each, all cancelled in one turn beside a nonmatching directive and a refused unsandboxed Bash step, reached it and cut the directive refusal while the model's false "saved" claim stayed. The cancellation and saved-instruction acknowledgements now name at most three items, each clipped to 160 bytes, and count the rest (the existing request-list pattern), so every runner line is bounded. The fallback is removed: when no room is left for the model body, the body alone is dropped, never a runner line. Cancellation authority, the number of cancellable requests and the directive limits are unchanged.
Affected rules: 42 (a refusal stays a refusal: the directive, cancellation and date refusals and the effect refusal all reach the operator in the one answer), 14, 57 and 93 (cancellations are still acknowledged, now as a bounded named list with a count, and every cancellation still lands in the journal), 8 (follow-up reports ride only whole or stay pending; unchanged), 52 (one bounded answer; outcome lists are bounded), 34 (the regression drives the real worker with the reviewer's reproduction on both sides of the effect refusal; it fails on the previous head and passes now), 74 (this record), 116 (reuses the existing three-item list pattern; no new queue, gate, model call or stage); Purpose: Part Twelve §3
Affected floors: secrets — unchanged; spend cap — unchanged, no new model call; stop — unchanged; no duplicate sends — unchanged: one send per answer; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a bounded change inside the existing answer-composition point of an already-reviewed critical unit; it shortens two acknowledgement lists and removes a fallback that could drop a refusal.
Side effects: an answer that cancels or saves more than three items names the first three, each clipped to 160 bytes, and says how many more; a single cancellation or instruction reads as before. When the model body cannot fit beside the runner lines and the effect refusal, the body is omitted rather than any runner line.
Undo and recovery: revert this commit range; no journal row shape changed, so no root needs restoring.
Multi-machine posture: unchanged; the decision is local to the worker composing the one answer.
Layer below: the worker's clip helper and the 3,500-byte answer budget; openReplyNotices and the effect notice line (bounded to 600 characters, unchanged); the cancellation and directive validation (unchanged).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: bounded-outcome-lists-no-whole-clip | runner outcome lists are bounded so they always fit beside the effect refusal, and the whole-answer clip is removed so only the model body can be shortened or dropped | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L42-PROGRESS.md
Prompt review: no model-facing text changed; only runner-authored acknowledgement lines sent to the operator. The regression replays the reviewer's seven-cancellation reproduction with the recorded refused unsandboxed-Bash trace shape.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output, no deferred work

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: every runner refusal and the effect refusal reach the operator in the same answer. The simplest robust route bounds the two unbounded acknowledgement lists with the existing three-item pattern and drops only the model body when room runs out; nothing else is added.
80/20: 0 must-fix, 0 notes. The previous record's "not reached in practice" note is withdrawn as false.
VERDICT: author submission; the independent verdict is recorded as a pass
