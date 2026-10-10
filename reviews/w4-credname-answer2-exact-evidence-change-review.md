# Change review — Preserve exact credential-bearing memory decision evidence

Subject base: 80b50752cd1ec5bb009f7c2ae82d5674d2cd01ab
Review state: open
Reviewed content: none
Outcome: credential wording no longer changes exact quote-bearing memory candidates or summary passages; a model can copy offered evidence and durably correct memory.
Affected rules: 4/57 (exact source, quote and authorization checks retained), 7/85/90 (corrections persist without rewriting history), 34/36/37/70 (failing reproducer and packet-copy regressions plus recorded replays), 49/74/111 (consumer and lower projection review), 83/93 (reminders retain eligibility), 100 (redaction and custody unchanged), 101/102 (plain commits and reported decision), 113 (stateless multi-machine projection), 116 (reuse existing memory projection)
Affected floors: secrets — existing redaction and custody retained; spend cap — existing model/reply bounds retained; stop — existing worker and scheduler checks retained; no duplicate sends — original durable identities and receipts retained; durable intake — original accepted messages and correction records retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: model-visible evidence controls durable memory corrections and release of the correction reply.
Side effects: memory candidates retain public credential labels while display history remains friendly. The same projection applies to local/imported messages, prior reply candidates, prior summary evidence, and summary memoryRequest. Summary cancellation compares against the same offered request. No validator, authority, model call, schema or store is added or weakened. Exact redaction and corrected/forgotten-text suppression remain.
Undo and recovery: revert this repair; no migration is needed. Reversion restores the quote mismatch. Existing held corrections can proceed through the repaired decision path within unchanged bounds.
Multi-machine posture: stateless projection on each runner; journal ownership, replication, correction identity and send deduplication remain unchanged. No machine-local feature state.
Layer below: projectMemoryClause and reply suppression; memoryFrom source/standing/quote/replacement checks; summaryPassages projection; channel alias resolution; durable memory append/replay; reminder eligibility and send receipts.
Bug class: integration
Bug evidence: reproducer=tests/preview/credential-answer.test.ts
Hook bypass: none
Convergence: none
Decision: w4-credname-answer2-exact-evidence | preserve the existing memory projection for every quote-bearing decision field; format only display prose so source validators remain exact | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-credname-answer2-repair-222532-PROGRESS.md
Prompt review: the offered evidence changes, not the instruction or parser. Replay recorded activation history 969390281-969390285 and delivered 969390298; exact recorded reply now appears in the decision candidate while display history uses credential wording. Existing recorded summary writer uncertain and Jev undecided shapes 715672480-715672497 and reply-review PASS/VIOLATION shapes 715673352/715673353 and 6232017 run through the installed formatter. Packet-copy tests cover operator/reply/import/summary corrections, invalid quote rejection and durable replay. No new live-provider or live-send claim.
Prompt finding: 849db3a6296a | protocol-literal | unchanged instruction; no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | unchanged instruction; no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | unchanged instruction; no new literal classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (2 paths): tests/preview/credential-answer.test.ts, tests/preview/journal.ts

Register regeneration: delegated rehash and repin reported zero changed pins. The register builder replay regenerated generated/ against source commit 076e1c780b8a0fdbfd620dc12c6f5d01004396ca; no pin was edited by hand.

## Closing block

simplestRobustRoute: this is the simplest route: use the existing redacted memory projection for exact evidence and apply credential wording only to display prose. One reply projection is shared by evidence and display. It prevents a copied candidate being rejected, without fuzzy matching or new machinery. Existing intake, source authority, stop, spend and receipt checks remain the guards.
80/20: the supplied worker reproducer and focused corrected-reminder regression fail before repair; packet-copy correction tests pass after repair with invalid-quote neighbor rejected. Recorded-shape replay and targeted checks provide submission evidence; the desk owns combined-build and live certification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
