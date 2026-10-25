# Change review — Keep meaning recall advancing past a rejected summary

Subject base: 779c15ea26aa634ee1b02159cef2bbaf1671d0f0
Review state: open
Reviewed content: none
Outcome: After failed compaction, the existing write-side meaning index can cover newer messages without accepting the failed summary.
Affected rules: 7, 10, 11, 32, 34, 35, 36, 37, 42, 49, 55, 60, 70, 74, 75, 95, 96, 101, 113, 116
Affected floors: secrets retain index-input redaction and custody; spend cap retains shared reservations and two attempts per source; stop is checked before index dispatch; no duplicate sends retains untouched intent/UNKNOWN fences; durable intake and original messages remain in the encrypted journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Default-on repair of memory retrieval following a rejected summary; no authority or protocol expansion.
Side effects: A failed summary now permits one existing index-only batch per idle pass, up to eight sources, including unsummarized messages. This spends the existing shared call allowance. Remaining pass slots stay available to compaction; per-source attempts remain capped at two. Healthy short tails retain their prior behavior. Failed/UNKNOWN index calls stop the pass as before. No summary can commit through this index path.
Undo and recovery: Revert the selector change to restore the old scheduling. Existing meaning-index rows remain readable and valid; no migration, deletion or send replay is needed.
Multi-machine posture: No new store or coordination mechanism. Meaning terms use the existing durable journal records and replay/replication posture; ordinary worker ownership still controls calls. Offline fixtures and test journals are deliberately local test evidence.
Layer below: Read the full constitution; inspected 1.x TopicMemory.insertMessage's independent message persistence; read 2.0 runSummary, meaningTermsIndex, indexOnly, index-reserve/meaning-index replay validation, ownedRecall/searchFor and summary faithfulness admission. Read the proof-room journal offline without touching its runner or network surfaces. The actual rejection concerns false delivery certainty, not a lost fact; the reviewer must continue to refuse it.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/faithfulness-stall.test.ts; live=tests/preview/fixtures/faithfulness-stall-2026-10-25.json
Evidence boundary: Exact recorded facts, fillers, delivered replies, candidate and review outputs are replayed offline. Index-only responses reuse recorded candidate concepts with explicit source remapping for filler/new-message tests. A 60000-byte test limit exercises history set-aside without machine load. Desk owns live group S acceptance after shipping.
Hook bypass: none
Convergence: none
Decision: independent-meaning-index | Reuse the existing index-only pass for a rejected tail, one batch per idle pass, instead of weakening faithfulness or adding a second memory engine. The batch limit leaves compaction room in the existing pass budget. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-faithfulness-stall-1025-PROGRESS.md
Prompt review: No prompt or output parser changes. Existing index inputs remain scrubbed original operator messages; model-generated cues remain retrieval hints and never become asserted facts. Recorded protocol bodies are fixtures, not instructions or new keyword rules.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Validation: Failing-first regression reproduced the absent index offer. Recorded rejection, semantic retrieval, later intake, restart persistence, bounded omissions, stop, shared call cap and healthy-tail neighbors are tested. Existing summary and meaning-index regression checks and mandatory READY checks are recorded with final results in PROGRESS.

## Closing block

simplestRobustRoute: This is the simplest robust route: broaden the existing bounded index-only selector after rejected compaction. It prevents summary review from withholding independent retrieval hints, while retaining that review as the only admission to summary memory. One recovery batch per pass prevents index backlog from occupying every summary slot. Start guards remain eligible retained operator messages, idle worker, live stop state and shared allowance; end guards remain valid source-bound terms and a passing review for summary commits. Offline replay is evidence of the repair, not an unattended live-success claim.
80/20: Submit the minimal selector repair, real recorded-shape replay and both sides of the affected boundaries. Independent convergence and live acceptance remain with the desk.
VERDICT: author submission; no independent verdict asserted
