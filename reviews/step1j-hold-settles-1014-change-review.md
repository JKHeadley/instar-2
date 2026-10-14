# Change review — Held replies settle through one bounded worker revision

Subject base: d53ed65386a3c4d2be9069ce2b0b0752f0b1c944
Review state: open
Reviewed content: none
Outcome: Held replies use the already-reserved revision slot in the continuing tool-capable worker, then send a reviewed answer or the existing honest-failure notice.
Affected rules: Rules 1, 4, 8, 23, 26, 29, 34, 36, 41, 42, 46, 49, 55, 57, 60, 68, 70, 74, 75, 77, 78, 84, 86, 95, 101, 102, 111, 113, 116; purpose not-knowing-is-a-task and durable-cause rules.
Affected floors: secrets — unchanged redaction and outbound checks; spend cap — existing one revision reserve and shared worker allowance; stop — existing journal and host guards; no duplicate sends — parent-only intent and receipts; durable intake — existing journal and host input custody.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Repairs an existing held-reply route without adding authority, a loop, a store or a scheduler. Offline replay uses the shipped bridge and real coordinator; the desk owns live acceptance.
Side effects: Review revisions now use the admitted conversation worker instead of the text-only subscription on step 1. An optional request deadline shortens the host lifetime and retires uncertain work. All exhausted review-hold notices use the existing final-failure wording; historical placeholders retain their history classification. Other advisory judgments remain advisory, including a recorded B07 passing verdict.
Undo and recovery: Revert these source changes while retaining journals and conversation custody. Unknown dispatched work is never replayed; the existing reservation prevents a second revision. Parent send receipts survive restart. Older requests without a deadline keep their existing parent bound.
Multi-machine posture: No new state or dispatch ownership. Machine-local host custody and the existing conversation owner remain authoritative; the revision inherits the accepted parent topic, not a new send authority.
Layer below: Inspected durable journal revision reservation and send projection; the shipped topic resolver; continuing worker request-digest, stop, resource and deadline enforcement; the session policy networkReads admission used by the resolver.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/hold-settles-2026-10-14.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Capability grounding reads SESSION_WORK_ADMISSION.networkReads, the same policy source admitted by the resolver. The revision retains contextual objections and permits only actual recorded tool attempts. Replayed original updates 840342778/840342779 and existing recorded summary, uncertain summary, Jev undecided/unsure, review, delivered and empty-reply shapes through the changed revision path. Successful revised content is simulated; no new live model, Telegram or acceptance claim.
Prompt finding: 0abb3dc96311 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an unresolved date or unrecorded scheduling claim is no admitted reminder."
Prompt finding: 5b486d8bd247 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "loops the deferrals, judgments and promises it will track, dated this turn's adm"
Prompt finding: 849db3a6296a | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing instruction or protocol wording asserted by its consumer test; this change adds no fixture-specific semantic veto — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"

Subject (8 paths): src/assembly/production-conversation-session.ts, src/assembly/production-session-work.ts, tests/assembly/production-conversation-session.test.ts, tests/preview/fixtures/hold-settles-2026-10-14.json, tests/preview/journal-agent.mjs, tests/preview/journal-conversation-session.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts

## Closing block


Decision: step1j-revision | Route the reserved revision to its continuing worker and preserve its own digest and parent send ownership. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1j-hold-settles-1014-PROGRESS.md
Decision: step1j-deadline | Shorten a revision input to the existing review deadline, with no new budget. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1j-hold-settles-1014-PROGRESS.md
Decision: step1j-settlement | Use the existing final-failure notice after exhausted review and retain recognition of old placeholder records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1j-hold-settles-1014-PROGRESS.md
Decision: step1j-grounding | Name live search/fetch from the session policy admission, without changing the reviewer authority or forcing B07 to fail. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1j-hold-settles-1014-PROGRESS.md

Generated register: shape-only replay from source commit 47aac40f9f1c260a01ba9ff66f87dfb0fc863cf6; no runtime certificate or authority declaration changed.

Deadline validation: targeted tests also refuse zero, negative, fractional, NaN and infinite deadlines before custody or dispatch; finite positive revision deadlines execute under the same parent cap.

simplestRobustRoute: This is the simplest robust route: reuse the one durable revision reservation, topic owner, worker and parent send. A distinct reserved child operation prevents request-digest conflicts without weakening identity. A shortening-only request deadline prevents the worker using its hour-long parent lifetime for a sixty-second review. End guards are the contextual revision review and one honest terminal notice; existing secrets, spend, stop, intake and send floors remain. No unattended live acceptance of this changed build is claimed.
80/20: Run changed tests and direct source consumers, typecheck, architecture, lint, register, change-review and pinned READY tests. No full suite, walks, sends or deliberate load.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
