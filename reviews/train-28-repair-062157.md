# Change review — train-28 collected results and repair admission

Subject base: d847cc66280c1eb7205b09847f70b8ba894604d8
Review state: open
Reviewed content: none
Outcome: Restore all four demonstrated train-28 integration failures by merging the accepted host repair e23846b7 and composing its result collection and deadline with the existing topic host; carry forward the accepted 2e40cac9 reserved-child topic lookup.
Affected rules: Purpose 2/3/5/6; Rules 1, 7, 15, 29, 32, 33, 34, 36, 37, 41, 42, 44, 45, 46, 49, 58, 60, 63, 68, 70, 74, 75, 95, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — existing custody and outbound checks; spend cap — cumulative shared calls and earlier persisted lifetime; stop — existing stop checks gate dispatch and delivery; no duplicate sends — existing parent intent/receipt, no replay of uncertain dispatch; durable intake — original and repair requests and full outcomes retained in the existing encrypted snapshot.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Restores durable result delivery, inherited lifetime and tool-bearing repair routing across restart.
Side effects: Queued initial and repair calls leave the original journal reservation pending until collection. Collection selects the original or canonical repair identity and requires the exact reserved packet. No second sender, queue, budget or authority is added. Full answers remain durable while bounded journal history and summaries provide grounding; only unresolved host references supplement the packet. The model-json assertion passes because initial and collected results share the accepted answer decoder. Topic test closures receive that same helper.
Undo and recovery: Revert the repair commits before deployment if rejected. Preserve host inputs, outcomes, old migration evidence and parent send receipts. A rollback must keep a compatible collector or hold retained results; never erase or redispatch UNKNOWN work. No live installation was changed.
Multi-machine posture: Machine-local process custody under the existing conversation owner fence. Result lookup reads retained operations rather than resolving a new topic or acquiring remote authority. Existing journal replication and local durability policy are unchanged.
Layer below: Inspected host durable snapshot, adapter busy-not-dispatched and reply/turn-end semantics, coordinator admission and shared charge checkpoint, journal reserve/format-retry/answer/intent projections and its maintain-before-drain path. Reviewed exact packet matching and original/child digest guards.
Bug class: durability
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; restart=tests/preview/journal-conversation-collection.test.ts
Hook bypass: none
Convergence: none
Decision: train28-collect | Merge accepted host repair and collect original and queued repair results through the topic coordinator into the existing exact-packet parent send path. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-062157-PROGRESS.md
Decision: train28-lifetime | Use the earlier persisted installation and configured lifetime for reopened and newly created topic hosts, while allowing collection of completed results after expiry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-062157-PROGRESS.md
Decision: train28-history | Retain full outcomes in custody and use journal grounding plus bounded unresolved references instead of duplicating growing full history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-062157-PROGRESS.md
Decision: train28-repair-topic | Apply accepted canonical child lookup through a durably reserved parent; retain distinct child digest and one-repair allowance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-062157-PROGRESS.md
Decision: train28-evidence | Preserve accepted recorded-shape and restart regressions in a separate collection test, adapt shipped-closure tests, and refresh pins only with delegated desk tools. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-28-repair-062157-PROGRESS.md
Prompt review: Restores the accepted bounded unresolved-reference supplement; journal history/summary grounding stays intact. Recorded userwalk frames 404/595, repair packets 840342703/709/711, rewalk A04/B04/B24, and archived summary uncertain, Jev undecided/unsure, review, delivered and empty-reply context shapes exercise the shipped route. No new semantic gate or prompt phrase is invented.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged inherited journal instruction; this repair changes neither phrase — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged inherited journal instruction; this repair changes neither phrase — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/journal-conversation-collection.test.ts:208 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:241 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:243 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:245 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:247 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:248 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:249 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:250 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:251 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:252 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:253 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:254 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:255 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:256 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred
Deferral: tests/preview/journal-conversation-collection.test.ts:261 | not-a-deferral=Executable queued-result regression or variable; no promised work is deferred

Subject (13 paths): register-source/owner-references/preview.json, scripts/conversation-host-store.declarations.json, src/assembly/conversation-topics.ts, src/assembly/production-conversation-session.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/production-conversation-session.test.ts, tests/preview/conversation-session-answer.ts, tests/preview/fixtures/repair-admission-rewalk-2026-10-14.json, tests/preview/journal-agent.mjs, tests/preview/journal-conversation-collection.test.ts, tests/preview/journal-conversation-session.test.ts, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: This is the simplest route: reuse accepted host repair e23846b7 and reserved-child lookup 2e40cac9, expose collection through the existing coordinator and bind new topics to the installation deadline. Existing admission, packet, stop, allowance and receipt checkpoints hold the floors. Targeted shipped-closure tests prove unattended completion with substituted physical dependencies, not live installation acceptance.
80/20: Address the four reproduced integration failures and original parser assertion at source, retain accepted regressions, and verify targeted tests plus required gates. Studio owns full-suite and live acceptance; no full suite or certificate is fabricated.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Pin refresh: The delegated desk rehash tool binds PREVIEW-CONVERSATION-RESULT-COLLECTION to its separate coordinator collection regression. The chain script found no changed grounding-inventory entries. Architecture passes with no exceptions.
