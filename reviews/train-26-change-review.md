# Change review — train-26 continuing topic sessions

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact live train-19 base, reviewed main design text, and reviewed continuing-topic sessions with one installation allowance and two live workers.
Affected rules: Purpose 2/3/6; Rules 1, 5, 7, 29, 30, 32, 34, 36, 37, 42, 44, 46, 49, 60, 61, 63, 68, 74, 75, 84, 90, 91, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — encrypted custody and existing credential walls; spend cap — shared installation reservation and durable per-topic charges; stop — existing owner/stop fences; no duplicate sends — durable intake-bound sender and uncertain dispatch retention; durable intake — journal and host snapshot before worker input.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combines reviewed concurrent scheduling and continuing process custody with the live build; changes no authority grant.
Side effects: Two topic workers share one allowance and retain independent FIFO/cursors. Idle retirement retains memory, charges and unresolved work. The existing explicit activation must match the topic policy. Main governed bodies retain main text; live-only documentation remains and changelogs preserve all old versions. Generated artifacts are replayed, not hand-merged. No live root is changed.
Undo and recovery: Revert the train before deployment, preserving the live base. Once topic custody is used, retain its original evidence and uncertain outcomes; do not delete or open it as an old single-host snapshot. Roll forward through the existing migration rather than renew allowance or replay unknown effects.
Multi-machine posture: Existing journal owner fence and replication policy remain; process handles and host snapshots are deliberately machine-local and cannot be adopted by another machine. The Studio owns platform-bound certification and live acceptance.
Layer below: Inspected the member review and report, host queue persist-before-dispatch, shared parent charge, exact retirement, admission reserveCall, journal topic packet/drain, physical topic recovery and durable thread-bound sender. The integration preserves those implementations without parallel authorities.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Prompt review: Existing answer envelope, summary and review interpretation remain. Topic packets retain shared memory and topic history; recorded userwalk outputs replay through the shipped journal closure. Main purpose wording is tested against the pinned briefing and fixed byte floor; no new prompt interpretation is authored by this train.
Decision: train-26-main | Merge exactly ea8808d878b9a1d673e9fba1755a72261074fd1c, citing reviews/amend-single-machine-1013.md and reviews/install-platform-neutral-1013.md; main governed body text is authoritative. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-topics | Merge exactly 99b8a3272b853049aa6d9c4b395d61d949f79ed1, citing reviews/step1c-topics-1013-change-review.md and /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1c-topics-1013-PROGRESS.md; includes its reviewed host and copy ancestry. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-desk-A | Preserve all live and member behavior; only conflicts are main changelog pairs, merged by preserving live entries and appending new main entries with distinct revisions, then rendering Markdown. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-desk-B | Create the branch directly at exact live ac3bd4d8874495f8b66b571837a1380995113d7a; preserve its ancestry and the topic member's step1b ancestry without moving either branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-desk-C | No genuine product conflict and no omitted head; regenerate publications using the existing desk chain. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-desk-D | Run targeted foreground checks on WSL; identify platform-bound checks for the Studio without modifying their contracts, logins or conformance declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
Decision: train-26-repin | Use the downloaded repin/build/rehash/register replay chain; refresh the inventory hash of the changed assembly contract and bind generated publications to committed combined source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md
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
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label and unknown-source capability guidance, unchanged by this scheduling change; tests assert that documented provenance contract, not a phrase-triggered lifecycle or acceptance decision.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory-list reply, unchanged by this change; the test checks its exact empty-result rendering, not a model judgment keyed to fixture wording.
Prompt finding: 034c5250da92 | protocol-literal | Existing standing-authority policy wording, unchanged here; the fixture asserts the shared grant/revocation description, not a phrase-triggered answer.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing tool authority policy, unchanged here; this describes allowed scope and does not choose an answer by input wording.
Prompt finding: 6af48f94b789 | protocol-literal | Existing single-machine effect boundary wording, unchanged here; the effect checkpoint enforces it and the test pins truthful capability description.
Prompt finding: b00ed403060a | protocol-literal | The repeated existing tool-scope instruction is policy text, not a fixture cue or input branch; the new route does not alter it.
Prompt finding: b1bb3946362d | protocol-literal | Existing agent identity opening, unchanged here; every input uses it without test-specific dispatch.
Prompt finding: 450c79237a95 | protocol-literal | Existing conflict/recall evidence instruction, unchanged here; matching assertions protect evidence handling for arbitrary memories.

Decision: train-26-review | Repair the missing Subject base and mandatory metadata in main's platform-installation review guide, keeping its original design body intact and citing this train for the combined source scope; cover the register publication in this record. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-26-PROGRESS.md

Generated register: replayed from combined source 5fe4a1ef0b38cd093fc5cf69ff0ad147e0db511a, generation sha256:7c26d28c1d7748fa52192310216cecb1c4aa28d8363d48a6a4b51c086ac719f0; shape-only evidence.

simplestRobustRoute: This is the simplest robust route: two ordinary exact-head merges, preserving reviewed implementations, followed by the existing repin/build/rehash/register replay and consumer checks. No new classifier, store or gate. Start guards remain durable authenticated intake and current activation/owner admission; completion is correlated reply evidence; stop, bounded allowance, no-repeat and secret floors remain held. The desk owns unattended live acceptance; this record claims only combined-tree verification.
80/20: Changed tests, direct consumers and required journal/register/pinned-text checks in bounded foreground runs; no full suite or load injection. Host-only checks remain for the gate host under the explicit brief.
VERDICT: author submission; independent review and live acceptance belong to the desk
