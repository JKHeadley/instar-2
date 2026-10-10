# Change review — Preserve exact summary history evidence

Subject base: e26ee57ba92b1223372e91b19f4bc11605be1f97
Review state: open
Reviewed content: none
Outcome: summary history preserves exact redacted message and reply evidence, so correctly copied facts and commitments survive admission and journal reopen.
Affected rules: 4/57 (unchanged exact admission), 7/11/96 (retained factual memory and summary grounding), 34/36/37/70 (red-to-green worker regression and recorded replays), 49/74/111 (consumer and lower-layer review), 83 (reply commitments retain exact evidence), 100 (existing redaction and custody), 101/102 (plain commits and reported decision), 113 (stateless cross-machine projection), 116 (reuse existing memory projection); purpose constraint 2 (nothing that mattered silently lost)
Affected floors: secrets — existing redaction and custody preserved; spend cap — unchanged model-call and packet bounds; stop — unchanged admission checks; no duplicate sends — unchanged durable identities and receipts; durable intake — original journal records unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: summary history is model-facing evidence for retained factual memory and commitments.
Side effects: summary history uses memoryClean and memoryReplyFor; ordinary answer history retains friendly credential wording. The existing summary-only flag is named forSummary to make its purpose explicit; conversation/date labels and reply-provenance behavior are unchanged. No quote validator, prompt instruction, authority, model call, store or schema changes. Existing suppression of corrected/forgotten memory stays in both projections.
Undo and recovery: revert this repair; no migration is required. Original messages remain in the journal; reversion restores the summary quote mismatch.
Multi-machine posture: stateless projection on each runner, with no added machine-local state; ownership, replication, intake identity and send receipts unchanged.
Layer below: projectMemoryClause, memoryReplyFor suppression and redaction, groundingHistory, original-source memoryItems admission, commitmentsFrom exact message/reply matching, summary append/reopen and sent-text projection.
Bug class: integration
Bug evidence: reproducer=tests/preview/credential-answer.test.ts
Hook bypass: none
Convergence: none
Decision: w4-credname-answer2-summary-evidence | use the existing memory projection for quote-bearing summary history, including replies and notices, while retaining friendly wording on answer display and strict source admission | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-answer2-repair-224251-PROGRESS.md
Prompt review: instructions and validators are unchanged. The formatter-on/off packet-copy regression admits exact facts and reply commitments and rejects invented suffixes, before and after journal reopen. Recorded activation history 969390281-969390285 and delivered reply 969390298 now reach the actual summary history without label rewriting. Captured delivered reply 715672479 and empty reply-in-context 715672550 reach that same path. The empty-context replay uses a synthetic terminal marker to admit the captured shape; it is not evidence of an empty Telegram delivery. Existing recorded writer uncertain and Jev undecided cases 715672480-715672497 and reply-review PASS/VIOLATION cases 715673352/715673353 and 6232017 remain targeted replay evidence. No new live-provider or live-send claim.
Prompt finding: 849db3a6296a | protocol-literal | unchanged instruction and no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | unchanged instruction and no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged instruction and no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (2 paths): tests/preview/credential-answer.test.ts, tests/preview/journal.ts

Register regeneration: delegated rehash and repin changed zero manifest/inventory pins. The register builder replay refreshed generated/ against source commit f99cbf6926c7d9f43cccda05a5e392d61cb470d0; no pin was hand-edited.

## Closing block

simplestRobustRoute: reuse memoryClean and memoryReplyFor for summary history, because the model must return exact excerpts; apply friendly wording only to answer display. This is the simplest route and adds no gate, fuzzy match, model call or storage. Intake, source authority, stop, spend and receipt checks remain the guards.
80/20: the formatter-on regression and recorded activation summary replay fail on the reviewed source; the repaired path preserves exact facts and reply commitments with the invented-quote neighbor rejected. Targeted evidence is submitted to the desk for combined and live certification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
