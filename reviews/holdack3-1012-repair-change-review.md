# Change review — Repair acknowledgement continuation, recovery and host timing evidence

Subject base: 78d9a17ed44115b3f21439aaf0c685c7fbbe0bce
Review state: open
Reviewed content: none
Outcome: Acknowledgement remains eligible through answer-producing retries and memory lookup. Restart reconstructs every eligible queued timer before serial answer work. The actual-host fixture controls answer latency and proves completed subprocesses and both final replies.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/28/32/36/37/41/45/46/49/52/54/55/58/60/63/70/74/75/77/87/89/101/111/113/116.
Affected floors: secrets — unchanged outbound secret and custody checks; spend cap — no new model calls, existing call/reply admission; stop — existing dispatch cancellation and stop checks; no duplicate sends — durable intents and UNKNOWN fence unchanged; durable intake — same synchronous journal and cursor.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: User-visible timer lifecycle and recovery across durable intake with actual host send evidence.
Side effects: All eligible timers can resume together after reopen; each remains bounded by admitted turns and existing send admission. Format repair, timeout replacement and lookup retain the original timer until their settled result. Fast settled answers still cancel before slow review. Old acknowledgement text/digests and journal consumers remain readable (Rule 45). Signed infrastructure provenance is unchanged (Rule 89). Host test changes only injected timing and completion evidence; real resource launch, HTTP send, secret custody and status assertions remain.
Undo and recovery: Revert the repair source and regenerate owner pins/register publication; no journal schema migration. Reopen accepted/UNKNOWN intents never retries their sends. Reverting reintroduces the reviewed timing defects.
Multi-machine posture: Timer remains deliberately process-local; reconstruction uses existing durable intake on each owner. Ownership, replication, stop and effect admission remain authoritative. Paid reservations remain immediately before invocation, never speculative at timer construction.
Layer below: Inspected settled/formatReask/replaceTimedOut and memory lookup, serial drain admission, current() cancellation at send, durable intake, real host resource funnel and subprocess shutdown. Status 0 alone cannot distinguish normal completion from a timeout followed by graceful shutdown. The fixture now checks error, signal and exit status and both delivered final answers. The status subprocess shares the injected clock epoch so provider verification age stays meaningful.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, samples only.
Convergence: none
Decision: repair-timer-boundaries | Reuse the existing timer and dispatch mechanism, with cancellation after settled continuations and reconstruction before drain awaits; no added worker or paid call. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack3-1012-repair-PROGRESS.md
Decision: host-fixture-time | Inject wall time and one-shot acknowledgement timers through fixture modules; keep actual monotonic resource deadlines and host operations, and allow a 90-second process ceiling separate from the eight-second behaviour assertion. The reviewed 30-second timeout must fail explicitly, never count as completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack3-1012-repair-PROGRESS.md
Prompt review: No prompt, parser or model judgment changes. Replay exact recorded answer/Jev shapes 969390407–410, lookup requests P4 and completed P1 answer from proofroom2-recallrank-2026-10-02.json, and the existing seven summary/uncertain/undecided/review/delivered/empty shapes in reply-acknowledgement.test.ts through the scheduling path.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged answer protocol; repair changes only timer lifecycle — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: bd01de21286a | protocol-literal | Unchanged answer protocol; repair changes only timer lifecycle — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel for supported remembered facts."
Prompt finding: fb5fa7e706c8 | protocol-literal | Unchanged answer protocol; repair changes only timer lifecycle — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "for a question about what the operator said"

Deferral: generated/register.json:1 | not-a-deferral=Existing register entries serialized by the generator, no new deferred work.

Evidence: Targeted acknowledgement, timing and actual host files: 33/33 passing. Host fast 4.697s and slow 4.911s; no subprocess error or signal, both final replies, all original custody/resource assertions retained. Typecheck and explicit architecture pass. No full-suite or fresh live deployment claim. The supplied gate saved-results path is absent; contract checkers must use the pipeline's next full report.

## Closing block

simplestRobustRoute: This is the simplest robust route: move one cancellation across existing continuations and reconstruct existing timers before serial awaits. No new production mechanism. Start guards are existing eligibility, stop and admission; end guard is settled answer readiness; limits remain admitted turns, one timer and one durable acknowledgement per turn. Unattended actual-host fixture completes both replies with all original floors; this is not a new live deployment claim.
80/20: Fast/slow continuation and restart regressions, recorded memory lookup, existing recorded shape replay, actual host completion, compiler and required cheap/selected gates. Added fixture synchronization prevents measured wall-time contention from changing which acknowledgement branch is exercised.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
