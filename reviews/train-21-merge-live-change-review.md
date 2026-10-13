# Change review — train-21 merges live train-19 without losing history

Subject base: 20c2b0b295ef7a4384b88ad51777610aab48078b
Review state: open
Reviewed content: none
Outcome: Merge live train-19 into train-21, retaining all governing history and the Linux custody broker.
Affected rules: Purpose 2/3; Rules 1, 26, 34, 36, 37, 49, 74, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — existing custody and redaction; spend cap — existing bounded model work; stop — existing cancellation and exact-PID broker stop; no duplicate sends — existing durable ownership and receipts; durable intake — existing journal retention.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates the live model-facing repairs with the independently administered Linux custody implementation.
Side effects: Incoming grounded refusals and relative reminder resolution are retained exactly. No product code conflict or document-body conflict occurred. Changelog revision numbers may differ between branches while their complete semantic entries survive. Generated output is rebuilt from committed combined source.
Undo and recovery: Revert this merge and its publication before deployment, preserving both branch ancestries and durable journals. Do not erase evidence or downgrade readers of already-written refusal diagnostics.
Multi-machine posture: Existing conversation ownership, replication and send fencing remain. Broker custody stays deliberately machine-local per installed host. No new peer dependency or durable store.
Layer below: Read the constitution from origin/main, prior train-19/train-20 integration reviews, Rule 90 suffix validation and changelog renderer. Compared both parent histories and inspected the broker unit reviews. No runner, live root or installed service is changed.
Bug class: integration
Bug evidence: reproducer=tests/platform/custody-platform.test.ts
Hook bypass: none; core.hooksPath is unset and the shared hooks directory contains sample files only.
Convergence: none
Prompt review: Incoming live train-19 changes are retained unchanged; targeted captured refusal and reminder replays cover recorded summary, Jev, review and delivered reply shapes. No fresh provider call or live installation acceptance is claimed.
Decision: train-21-merge-live | Merge origin/train-19 ac3bd4d8874495f8b66b571837a1380995113d7a by ordinary forward merge; preserve the complete train-21 broker implementation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-21-merge-live-1013-PROGRESS.md
Decision: train-21-merge-history | Preserve train-21 arrays as an exact suffix. Deduplicate incoming entries only when every field other than revision matches; prepend distinct entries in incoming order with sequential unused revisions. Render Markdown with the repository renderer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-21-merge-live-1013-PROGRESS.md
Decision: train-21-merge-publication | Retain the prior generated publication temporarily, then run the existing repin/build/owner-rehash/register-replay chain from committed merged source; never hand-merge generated output. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-21-merge-live-1013-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary merge, semantic union of changelog entries and existing generators. No new production machinery. Verified durable intake and custody guard start; durable dispatch and contextual review guard completion; existing resource, spend and stop bounds remain. Captured replay is integration evidence, not unattended live acceptance.
80/20: Foreground targeted changed tests and direct consumers, static checks and pinned READY checks; host-only checks belong to the Studio gate.
VERDICT: author submission; independent review belongs to the desk
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction; the cited recall test checks that it reaches the packet. This repair adds no phrase-based judgment.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response; the cited test checks its existing renderer, not a classifier introduced by this change.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 849db3a6296a | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Prompt finding: 0abb3dc96311 | protocol-literal | Historical prompt translation checks the reviewed unresolved-date admission instruction; it is not an expected model answer or an intent detector.
Prompt finding: 7c45ffbe90ad | protocol-literal | Historical prompt translation checks the new admitted-reminder evidence field while retaining the recorded verdict; it is not an expected model answer or an intent keyword test.
Prompt finding: b1bb3946362d | protocol-literal | Existing production-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Prompt finding: 42faf877ba82 | protocol-literal | Existing production-codex-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Deferral: tests/preview/fixtures/reminder-relative-1013.json:329 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:772 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:793 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:803 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
