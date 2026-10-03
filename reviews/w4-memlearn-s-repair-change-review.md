# Change review — w4-memlearn-s repair round 1: full-history reminders recorded; unresolved source never asserted never-stored

Subject base: 4735ef15cc6a191c140cf2ab1b7dd63b21b3cd96
Review state: open
Reviewed content: none
Outcome: Unit review round 1 (Astra, VERDICT NO) named two must-fixes in the memory-failure projection; each is fixed at its source. (1) tests/preview/memory-learning.ts memoryFailureOffer now admits any eligible previous operator answer (same thread, accepted, answered, no requested action, not an edit, operator-written), including a full-history one: a plain "I don't know" states no wrong value, so the correction signal could not cover it and the reminder was silently lost. The offer is the packet's lowest-priority guidance and yields first in tests/preview/journal.ts's byte-envelope variants, so a packet that fit before the offer existed still fits unchanged (honest prompt-byte accounting; no extra model call, no detector). Writer and replay keep the same principal, conversation, edit, probe and resource checks. (2) The never-stored cause is replaced by source-unresolved: when the report names no original and no earlier operator message states its words exactly, the record says whether the fact was stored is unknown (Rule 11: a wording miss is not evidence of absence); the reminder keeps its retrieval-hint lesson; a resolved source is still classified from grounding. Tests: the submitted full-history loss is now a positive recording (cause shown-not-used) with an ordinary full-history answer carrying no report as its negative neighbor and a forged non-own-words quote failing replay; a source-less paraphrase on the recorded proof-room fixture is source-unresolved with the exact-clause resolved neighbor (not-retrieved). Part 21 §16, §12 P21-NF-25/26, §13 P21-NEG-32 and changelog revision 6 follow.
Affected rules: 4 (deterministic report validation, unchanged rule applied at writer and replay), 10 (offer placed by structure, never by message words), 11 (a wording miss is not evidence of absence; source-unresolved), 13 (cause and count subjects say what is known), 26 (the cause is read from verified state, uncertainty recorded), 34 (unit tests on the recorded room), 36 (observer #106: recorded P2, P3, never-said, answered shapes replayed), 37 (fixed at source; nothing quarantined), 74 (this record), 78 and 84 (structural capability guidance, status line), 85 (feedback durably improves recall), 90 and 91 (changelog revision 6), 101 (plain commits), 108 (separate cause justification), 116 (smallest change: one condition removed, one cause renamed, one yield variant); Purpose constraint 2 (nothing silently lost).
Affected floors: secrets — unchanged (report text bounded and redacted as before); spend cap — unchanged, the report rides the existing answer call; stop — unchanged; no duplicate sends — unchanged reply path; durable intake — unchanged, the record remains a projection over journal rows
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes model-facing packet guidance on most operator turns and the recorded memory-failure cause.
Side effects: the memoryFailureDecision guidance now rides most operator turns' packets (after the first answered turn in a conversation) unless byte pressure yields it; status lines say "source unresolved" where they said "never stored".
Undo and recovery: revert the repair commit; no stored row changes shape (the cause is recomputed on read).
Multi-machine posture: unchanged; machine-local derivation replayed from the single journal.
Layer below: checked the answer-row writer (offer read from the actual sent context) and replay validation (structural offer), the byte-envelope variant order and the floor guide, and the grounding fields classify reads.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: one model-facing string changed, MEMORY_FAILURE_DECISION (tests/preview/memory-learning.ts): its first sentence drops "given while part of memory was not in front of you verbatim"; the rest is unchanged and copies no test phrase. It now rides any operator turn after an answered operator turn and yields first under byte pressure. Recorded real answers replayed on the recorded room (P2, P3, never-said, answered) show the offer and that an answer without the field records nothing; the model's own report remains a stub, since no recorded output carries the field yet.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (15 paths): docs/21-the-recall-doorway.changelog.json, docs/21-the-recall-doorway.changelog.md, docs/21-the-recall-doorway/12-non-functional-checks-and-activation.md, docs/21-the-recall-doorway/13-negative-contract-fixtures.md, docs/21-the-recall-doorway/16-memory-failures-and-the-learning-loop.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/memory-learning.test.ts, tests/preview/memory-learning.ts

## Closing block

simplestRobustRoute: remove the grounding condition from the existing offer and rename the cause that asserted an unproven absence; one yield-first variant keeps every previously fitting packet byte-identical. No new model call, detector, store or loop.
80/20: 0 must-fix; notes — the model's memoryFailure output is still scripted until a recorded live report exists; wrongly-stored/summarized-away and the pin/cue limits keep the reviewer's accepted residue (NOTE 1).
VERDICT: author submission; the independent verdict is recorded as a pass
