# Change review — w4-doorway repair: a long answer keeps its own effect refusal

Subject base: 648b03108b9a9c1566821b537c5ad5b074d1bcb5
Review state: open
Reviewed content: none
Outcome: Unit review (Astra) MUST-FIX on w4-doorway: the turn-specific effect-doorway refusal rode the optional reminder slot, so an answer whose body plus the notice exceeded the 3,500-byte send budget went out without it, and the refusal was offered for that turn only, so it was never reported. Now an `effect:` notice that does not fit clips the answer body (marked with …) to keep room for it in the same single send. Other reminder notices keep their optional behaviour. Register regenerated at e39987a1.
Affected rules: 42 (a refusal stays recognizable through every layer: the answer can no longer drop it), 52 (still one bounded notice inside one answer, no new message), 8 and 100 (notice dedup and keys unchanged), 34 (a long-answer neighbor test on both sides: shortened with the refusal, sent whole without one), 74 (this record), 116 (one clip at the existing notice point; no new sender or stage); Purpose: Part Twelve §3, infrastructure reports the refusal even when the model omits it
Affected floors: secrets — unchanged; spend cap — unchanged, no new model call; stop — unchanged; no duplicate sends — unchanged: the notice still rides inside the one answer, keyed per turn and call, and openReplyNotices still spends it; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a bounded repair inside the existing answer-notice point of an already-reviewed critical unit; it changes only how much of an over-long answer body is sent when that turn's own refusal must ride along.
Side effects: an answer whose own turn had a doorway refusal and whose body exceeds ~3,500 bytes minus the notice is shortened, ending in …; the cut text is not sent. Fulfillment and promise claims are already re-decided against the final written text, so a claim in the cut tail is counted refused rather than recorded. Answers without an effect notice are unchanged.
Undo and recovery: revert commit e39987a1 and the regenerated register; no journal row shape changed, so no root needs restoring.
Multi-machine posture: unchanged; the decision is local to the worker composing the one answer and the journaled answer text records exactly what was sent.
Layer below: openReplyNotices and the notice validation (unchanged); the worker's existing byte-bounded clip helper; the existing 3,500-byte answer budget shared with follow-up reports.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: doorway-refusal-reserved | an effect: notice is mandatory for its own turn, so the answer body is clipped to keep room for it rather than dropping it; other notices stay optional | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-doorway-PROGRESS.md
Prompt review: no model-facing text changed; the notice line and deny reason are as reviewed. The long-answer test drives the worker with the recorded refused unsandboxed Bash trace shape (the hook's real decision), as in the reviewer's reproduction.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=regenerated register output, no deferred work

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/effect-doorway.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: required outcome: the refusal reaches the operator in the same answer whatever the answer's length. The simplest robust route reserves the notice's bytes at the one existing notice point by clipping the body with the worker's existing clip helper; the single send, turn identity and notice dedup stay as they were. A separate refusal message or a carry-forward to later turns would add a sender or state and was not needed. Proven both sides: the new test fails without the fix and passes with it; the short-answer and no-refusal neighbors pass.
80/20: 0 must-fix, 1 note — the body clip is a byte cut marked with …, not a sentence-aware shortening; acceptable for a ~3 KB answer.
VERDICT: author submission; the independent verdict is recorded as a pass
