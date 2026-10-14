# Change review — train-31 pipeline repair 113916

Subject base: 01abdb8341aa6332cc84a5551c528a0fcdd5be20
Review state: open
Reviewed content: none
Outcome: Restore accepted step1k host repairs in train-31 while preserving reply revision identity, shorter deadlines, network-tool guidance and truthful native certification.
Affected rules: Purpose 2/3/5; Rules 1, 7, 26, 33, 34, 36, 37, 42, 45, 46, 49, 55, 60, 63, 68, 70, 74, 75, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — existing custody and outbound checks; spend cap — original shared reservation and earlier parent deadline; stop — existing exact worker retirement and guards; no duplicate sends — original journal reservation and receipt, no uncertain dispatch replay; durable intake — queue and complete outcomes retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Result collection crosses durable host and journal stores; persisted lifetime constrains worker authority.
Side effects: Pending results use existing answer review and send; bounded unresolved references replace repeated answers without deleting history. No new sender, queue or resource owner.
Undo and recovery: Revert the integration only before deployment; retain compatible host/journal readers, snapshots, original and child identities and receipts. Reverting collection leaves retained answers undelivered. Never replay uncertain effects.
Multi-machine posture: Existing owner fencing and journal replication remain. Worker handles and encrypted host snapshots are deliberately machine-local; no cross-host worker adoption.
Layer below: Adapter non-dispatch versus uncertain dispatch, durable call checkpoint, original parent edge, topic shared liability, exact prepared-packet comparison and journal answer/review/send transitions.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only.
Convergence: none

Prompt review: Bounded journal history and rolling summaries remain authoritative; only unresolved operation references are appended. Archived summary uncertain, Jev uncertain/undecided, reply-review, delivered and empty reply shapes replay through collection; recorded repair and held-reply cases remain.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal protocol instruction, unchanged by collection; not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Existing journal protocol instruction, unchanged by collection; not a semantic keyword classifier — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: tests/preview/journal-conversation-session.test.ts:481 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:514 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:516 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:518 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:520 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:521 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:522 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:523 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:524 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:525 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:526 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:527 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:528 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:529 | not-a-deferral=Executable deferred-result regression; no promised work postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:534 | not-a-deferral=Executable deferred-result regression; no promised work postponed.

Subject (11 paths): register-source/owner-references/preview.json, scripts/conversation-host-store.declarations.json, src/assembly/conversation-topics.ts, src/assembly/production-conversation-session.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/production-conversation-session.test.ts, tests/preview/conversation-session-answer.ts, tests/preview/journal-agent.mjs, tests/preview/journal-conversation-session.test.ts, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts

## Closing block

Decision: train31-repair-merge | Merge accepted e3e3f88f ancestry instead of rewriting the repair; preserve train-31 revision and browsing behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-113916-PROGRESS.md
Decision: train31-repair-tests | Combine host and journal fixture regressions; retain train-31 certification tests because they already cover both declared and synthetic certificate states. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-113916-PROGRESS.md
Decision: train31-repair-pins | Regenerate owner hashes, grounding chain and register publication with the delegated desk tools; never hand-edit pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-113916-PROGRESS.md

simplestRobustRoute: This is the simplest route: merge the accepted step1k repair, retaining existing host custody, topic routing and journal answer consumer. Collection does not dispatch or charge. Earlier persisted parent deadlines constrain new topics and replacement workers, while revision deadlines only shorten execution. Bounded unresolved references prevent repeated full answers exhausting delivery capacity. Exact admission and stop guard start; exact packet and receipt guard completion; retained call and lifetime bounds guard execution. No fresh live acceptance is claimed.
80/20: Three reproduced defects fixed via accepted ancestry; targeted foreground tests and cheap checks on WSL. Full suite and physical native certification remain Studio-owned.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
