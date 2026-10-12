# Change review — Keep acknowledgement review off the minimal poll path

Subject base: cc7be05c767c7eede3725c9aceefe38d52e48eaa
Review state: open
Reviewed content: none
Outcome: Acknowledgement review no longer delays the minimal responder or Telegram intake; final-answer ordering and acknowledgement ability remain.
Affected rules: Purpose ability at checkpoints, least revelation and durable cause; Rules 1/4/14/15/34/36/37/41/49/57/58/63/70/74/75/77/87/95/101/111/112/113/116.
Affected floors: secrets — existing outbound check retained; spend cap — same durable review and reply reservations; stop — intake and confirmation run before review finishes, then admission prevents send; no duplicate sends — same single in-flight promise and durable intent/receipt/UNKNOWN fence; durable intake — existing journal records subsequent input before review completion.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs scheduling at the user reachability and stop-intake boundary.
Side effects: minimal returns before acknowledgement completion. Final dispatch still awaits the same promise. A rejection remains retained until the ordinary drain observes it, avoiding unhandled rejection or silently lost failure. The crash fixture now explicitly waits for the receipt before copying the journal.
Undo and recovery: Revert this repair and regenerate publications; no journal schema changes or migration. Reverting reintroduces the demonstrated polling delay.
Multi-machine posture: Scheduling is deliberately process-local; existing durable reservations, ownership, audience admission, replication and UNKNOWN fences remain unchanged.
Layer below: Inspected host pre-poll and post-intake waits, acknowledgeReply reservation and dispatch, drain final-send ordering, limited stop confirmation and callback intake. Reran the reviewer controlled worker reproducer and its host-wiring assertion.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement.test.ts
Hook bypass: none; checked core.hooksPath (unset) and common hooks directory (sample files only).
Convergence: none
Decision: retain-rejection | Keep the same failed promise until the drain observes it; minimal only observes rejection without blocking intake. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack2-1011-repair-PROGRESS.md
Prompt review: No prompt, parser or verdict changes. Replayed recorded summary writer, uncertain summary, undecided/unsure Jev, reply review, delivered/empty reply and live lookup through the changed minimal scheduling path; exact IDs and provenance in the repair PROGRESS.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged prompt and fixture language; scheduling-only repair — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged prompt and fixture language; scheduling-only repair — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged prompt and fixture language; scheduling-only repair — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Subject (2 paths): tests/preview/journal.ts, tests/preview/reply-acknowledgement.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: start and observe the existing single promise without awaiting it in minimal; preserve the ordinary drain await and retain rejection until it is observed there. No scheduler, timer, service, new state or capability restriction. Start guards keep durable intake, elapsed threshold, audience and allowances; end guards retain final ordering, stop admission and UNKNOWN fencing. Controlled worker replay and captured live shapes are evidence, not a new live Telegram deployment claim.
80/20: One focused test file, compiler, architecture, original controlled reproducer, cheap gates and saved gate contract checks. The pipeline produces fresh full-run evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
