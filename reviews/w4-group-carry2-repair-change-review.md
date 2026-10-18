# Change review — Repair carried request recovery, memory edits and semantic recall

Subject base: 81d6682fc49effbca4ec73b9ce7f1f3a7516b2e3
Review state: open
Reviewed content: none
Outcome: Preserve carried requests across pre-dispatch disclosure loss, admit carried-source correction/forget through existing memory consumers, and preserve local/authorized external semantic recall.
Affected rules: 4, 7, 11, 28, 32, 33, 34, 36, 42, 44, 45, 46, 49, 57, 70, 74, 75, 83, 85, 86, 93, 96, 101, 111, 113, 116; purpose constraint 2 and ability/checkpoint direction
Affected floors: secrets — final disclosure admission and existing outbound checks; spend cap — reserve only admitted calls, original zero-helper-spend gate; stop — checked after asynchronous admission; no duplicate sends — UNKNOWN effects remain non-repeatable; durable intake — existing journal and holds preserve pending work
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Model/send disclosure and durable memory consumers determine externally visible behavior.
Side effects: Reply intent is appended synchronously only after disclosure succeeds; answer reservations likewise follow disclosure. Saved answers can resume delivery without re-answering. Snapshot provenance stays immutable; its serving projection withholds corrected/forgotten clauses, with replacement values in destination memory. Local rerank callbacks remain available; host external:true callbacks use bounded async preparation and disclosure checks. Synchronous read-only probes do not launch external calls. Delegated desk rehash/repin found no pin changes; generated register artifacts were replayed from source commit 20817b4b839ec89798b145445dcb4bb565621d89.
Undo and recovery: Revert this repair before deployment if needed; no schema/frame migration. Existing UNKNOWN effects are never presumed unused. Existing durable holds resume with restored disclosure and never replay an uncertain effect.
Multi-machine posture: Existing machine-local exclusive journal writer; holds and memory edits follow journal replay/replication. Each serving host checks current disclosure; no new distributed store or owner.
Layer below: Journal reserve/intent ordering and compaction; request ownership/openRequests; source-aware memory projection and exact-quote validator; synchronous recall owner zero-helper-spend admission; physical send provenance and no-duplicate settlement.
Bug class: durability
Bug evidence: reproducer=tests/preview/group-carry-requests.test.ts; restart=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-group-carry2-repair-PROGRESS.md
Hook bypass: none
Convergence: none
Prompt review: The existing memory item guidance now explicitly permits predecessorMemory.entries source and text. Carried entries are projected by destination correction/forget and participate in the existing resolver. No new model round. All 384 real proof-room journal rows (updates 715672479–715672500) replay, including summary uncertainty, Jev unsure/unavailable, reply review and delivered replies; actual answer 715672480 exercises disclosure hold/restart/delivery. The empty-answer case remains explicitly synthetic under the prior desk ruling, not claimed as a recorded empty bubble.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed protocol wording, unchanged by this repair
Prompt finding: bd01de21286a | protocol-literal | existing fixed protocol wording, unchanged by this repair
Prompt finding: fb5fa7e706c8 | protocol-literal | existing fixed protocol wording, unchanged by this repair


## Closing block

simplestRobustRoute: Use existing durable holds, reservation/intent records, memory validator/projection and recall owner. Move disclosure before irreversible preparation so there is no unused reservation to unwind. External rerank preparation needs a small gather/await adapter because the existing composer is synchronous; it prevents disclosure without disabling that capability. No new journal frames, scheduler or service. Start guards are current disclosure, stop and bounds; end-state tests show exactly one recovered delivery and projected corrected memory; actual recorded answer 715672480 recovers unattended on the real worker.
80/20: Targeted tests and typecheck pass. Independent unit review found the three defects repaired here; this record claims no independent convergence. Full pipeline certification remains the automatic gate after push; saved sibling report evidence limitations are recorded in PROGRESS.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
