# Change review — Check in once at the persisted instant

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: Explicit one-shot follow-ups wait for their persisted UTC instant, survive restart, and use the existing single dispatch and withdrawal path.
Affected rules: 1, 4, 8, 10, 26, 34, 36, 42, 44, 49, 52, 57, 63, 68, 74, 83, 93, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged outbound check and encrypted journal; spend cap — unchanged due-turn admission; stop — unchanged worker and launcher stop checks; no duplicate sends — unchanged durable due-turn/send identity and UNKNOWN fence; durable intake — original persisted resolution survives journal reopen.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Exact timing correction within the existing requested-action scheduler; no new service, state schema, model call, permission or send path.
Side effects: One-shot requests with a resolution now wait for seconds and milliseconds formerly rounded away. Legacy calendar-only requests keep their local-minute timing; recurring requests keep local occurrence semantics. Historical early due frames continue to replay rather than becoming unreadable. Existing queued actions and sent intents are not rewritten. Completion and withdrawal remain model-decided cancelReminders dispositions, not keyword classification. Generic agent commitments remain distinct.
Undo and recovery: Revert this change to restore minute-level scheduling. No data migration, destructive cleanup or journal rewrite is needed; original resolution and dispatch facts are unchanged. Reverting would restore the early-send defect but cannot authorize repeat dispatch of a recorded send.
Multi-machine posture: The deadline is part of the existing shared journal, not launch time or a machine-local timer. Current ownership, replication admission and send fencing are unchanged; no second scheduler is introduced. Test journals are deliberately local fixtures.
Layer below: Read docs/00-the-purpose.md then docs/01-the-rules.md in full; both match origin/main. Inspected D15 sections 4/5, D16 section 8 and D18 section 6 plus the NF-63 inherited-duty rows. Inspected datedFrom, activeRequests, openRequests, actionWithdrawn, pendingRequests, scheduleRequests and journal-agent.mjs pre/post-poll workCycle: the launcher already uses the worker's withdrawal-aware due point. The distinct generic commitment check-in design does not confer notification authority on a date alone.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/reminder-truth.test.ts; live=tests/preview/fixtures/reminder-truth-1014.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt, intent classifier, output grammar or routing changes. Recorded reminder 840342823 drives the new early/at-instant restart boundary; recorded 840342802/840342792 and reminder-relative-1013 raw worker frames remain replayed. Existing recorded summary, uncertain, Jev undecided/unsure, reply review, delivered and empty shapes exercise the same due worker. No fixture words were added to model instructions.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged topic-awareness instruction about attempted avenues; no phrase-trigger logic added.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged empty-memory status wording; not part of reminder timing.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged recall source-label instruction, unrelated to this exact clock comparison.
Decision: checkin-exact-instant | Consume the existing persisted resolution at the scheduler boundary, retaining legacy local-minute replay and recurring occurrence timing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/checkin-once-1016-PROGRESS.md
Decision: checkin-existing-closure | Reuse the journal's current due/send identity and model-decided cancellation contract for withdrawal or completed work; do not add a generic commitment notifier. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/checkin-once-1016-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: compare the persisted instant at the existing due point and reuse all current authority, closure and send protections. No new holder is needed. Start guards remain verified operator request and settled date; the end state is one recorded dispatch, with UNKNOWN preserved rather than retried; limits remain stop, expiry, calls, replies and turn budgets. Offline recorded replays establish behavior; unattended live proof is reserved for the desk proof room and is not claimed here.
80/20: The regression failed before the repair for both accepted and UNKNOWN sends. The focused calendar/requested-action/replay suite passes 65 tests, including both timing edges and restart/withdrawal neighbors. Generated register artifacts are refreshed from source dd7b7ed194818673d7798cbadf683ced5c6d2310 (293 entries, 117 rules), without changing runtime authority. Broader directly importing tests and the READY checks are recorded in the handoff; independent acceptance belongs to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
