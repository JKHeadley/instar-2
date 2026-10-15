# Change review — sibling words

Subject base: 239dd8ab59d8fb35cb661d892000e80f7055ba93
Review state: open
Reviewed content: none
Outcome: other topics receive recent API-accepted agent statements and current promise states, refreshed immediately before dispatch from the existing journal.
Affected rules: 7, 28, 34, 36, 42, 49, 60, 74, 83, 84, 96, 101, 102, 111, 113, 116
Affected floors: secrets — existing redaction and memory withholding precede clipping; verified operator audience required. Spend cap — no new model call. Stop — existing post-reader guard remains. No duplicate sends — no effect or receipt writer added. Durable intake — existing journal and dispatch custody unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes context seen by the model across topics, not authorization or send policy.
Side effects: equal receipt timestamps retain newest journal order, and grouped replies retain their promises without duplicating the statement. Bounded additional context can consume packet space; the existing packet and delivery limits remain. Unknown or partial sends are omitted rather than described as delivered. Promise quotations retain explicit lifecycle status. Cross-topic promise and recent-reply candidate context no longer carries the operator's original question alongside it. No private inbound text is added by this projection.
Undo and recovery: revert this change; no journal schema change or migration. Existing receipts and commitments remain the only sources; reopening or compaction reconstructs the same projection.
Multi-machine posture: existing journal replication and conversation ownership apply. This read reflects the owner journal at dispatch; no claim of instantaneous knowledge across disconnected machines, no new store or writer.
Layer below: examined wholeReplyReceipt and multipart outcomes, operatorWriter verification, commitmentOpen and closure records, memory projection and redaction, dispatch admission and custody persistence, and existing cross-topic commitment rendering.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts
Hook bypass: none
Convergence: none
Decision: sibling-words-journal | project accepted agent replies and promise lifecycle from the existing journal, with topic/time and bounded excerpts; no watcher, new call or store | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-words-1015-PROGRESS.md
Decision: sibling-words-current-topic | pass the dispatch operation to the existing freshness reader so it excludes the current topic even on a reused worker | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-words-1015-PROGRESS.md
Decision: sibling-words-private-question | omit the operator's original question from cross-topic reply-commitment and recent-reply candidate context; keep own-topic context intact | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sibling-words-1015-PROGRESS.md
Prompt review: recorded summary-writer, uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty reply shapes from retrospective-duty-followup-train-1-2026-10-08.json are replayed in actual prepared dispatch envelopes with sibling words present. No changed output parser or semantic gate. Live model consistency and the desk proof-room switch check remain desk-owned; no live-provider or Telegram proof claimed.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: e8708c7fea24 | protocol-literal | existing memory source-label guidance in journal.ts, unchanged by this change.

## Closing block

simplestRobustRoute: this is the simplest robust route: derive a bounded view from existing reply receipts and commitment state and refresh it through the existing dispatch reader. The credible failure is a sibling advising without knowing a newer statement or closure; another store or watcher would add synchronization without closing the dispatch gap. Start guards are verified audience and accepted receipt; end state is current topic-excluded evidence in dispatch custody; limits are item, excerpt and byte caps with omission disclosure. No autonomous shipped-path completion claim.
80/20: exercise the consumer with fresh and reused sessions, closed versus open promises, unknown sends, redaction, forgetting, bounds and recorded shapes; targeted tests and machine checks precede desk review. No independent convergence claimed.
VERDICT: author submission; the desk records its own independent verdict
