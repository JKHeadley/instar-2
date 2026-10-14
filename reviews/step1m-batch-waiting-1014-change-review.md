# Change review — batch waiting topic messages

Subject base: 9d8c16f03f6917b9850269f3773809bd39fa9335
Review state: open
Reviewed content: none
Outcome: Waiting topic messages share one continuing model turn while each intake retains its own result and unique outbound send. Long waits receive one durable, bounded progress line.
Affected rules: Rules 1, 15, 26, 29, 34, 36, 42, 46, 49, 52, 55, 60, 63, 68, 74, 75, 77, 87, 89, 95, 96, 101, 102, 105, 111, 113, 116.
Affected floors: secrets — existing outbound checks; spend cap — existing shared host reservation and per-intake journal reservations; stop — existing guards before model and send; no duplicate sends — existing durable per-intake intents plus durable progress intent; durable intake — existing queue retained, atomic batch outcome checkpoint.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the continuing model envelope, durable batch recovery and user-facing progress delivery.
Side effects: Multiple queued messages now share one model turn. The model returns an operation-indexed result array. Each result uses the existing answer reader, memory and promise validation, and send doorway. Definitely unstarted batch admission releases every unused reservation and retains each refusal for that pass. Media waits for its existing custody path. Malformed recovered results settle uncertain after retirement so later input can continue. No authority or budget expands. A lone message retains its existing envelope. The coordinator must recover correlated batch results before retiring the former worker.
Undo and recovery: Preserve all journals and custody. Rollback requires a reader that understands batch and waitingProgress fields; never delete records or replay uncertain effects. Correlated completed batches recover without a model call; undispatched queues drain normally. A dispatched tool-bearing batch without correlated completion remains uncertain, as on the existing single-input path.
Multi-machine posture: Process handles and topic snapshots remain machine-local under the existing owner fence. The journal retains its existing replication demand. No second owner or cross-machine worker adoption is introduced.
Layer below: Inspected the public conversation adapter's correlated Stop receipt, host resource retirement, journal model reservations and answer collection, outbound intent/receipt replay, disclosure and provenance checks. Tests exercise the shipped journal modelBatch closure and coordinator rather than a substitute queue.
Bug class: live-path
Bug evidence: reproducer=tests/preview/journal-topic-sessions.test.ts; live=tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json
Hook bypass: none; core.hooksPath is unset; the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: The batch envelope specifies exact operation identity and result structure, not semantic verdicts. Captured summary writer, uncertain summary, undecided/unsure Jev, reply review, delivered reply and historical empty reply shapes are replayed through the new batch path; those roles remain quoted evidence except the original reply fields. No live walk or delivery acceptance is claimed.
Prompt finding: 849db3a6296a | quoted-evidence | Existing memory-list wording is retained unchanged; the batch change does not add a semantic phrase matcher.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing recall instructions are retained unchanged; evidence is quoted data, not a new fixed-phrase decision.

Decision: step1m-batch | Snapshot the waiting topic prefix into the existing host queue and atomically checkpoint per-operation results; retain the single-message envelope. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md
Decision: step1m-progress | Use the brief's 45000 ms interval under Rule 87, with a separate slot in the existing durable notice records and the ordinary send doorway. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md
Decision: step1m-recovery | Read a correlated closed batch before worker retirement; preserve uncertainty when the adapter cannot prove completion rather than replaying possible effects. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md
Decision: step1m-replay | Reuse captured journal shapes already committed with source/update provenance when the large Studio exports return HTTP 413. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md

Decision: step1m-publication | Regenerate the register from the exact source commit; preserve the Studio-owned native certificate declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-repair-132417-PROGRESS.md

Subject (15 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/README.md, src/assembly/conversation-topics.ts, src/assembly/production-conversation-session.ts, tests/assembly/conversation-topics.test.ts, tests/preview/batch-waiting-progress.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts

simplestRobustRoute: Reuse the durable host queue, adapter receipt, journal intake preparation and unique sends. This is the simplest route: no new worker, scheduler, store or authority. The batch identity array prevents misattributing results; atomic checkpointing prevents partial result custody; the progress intent prevents repeated status sends across crashes. Start guards are verified intake, current authority, shared allowance and stop; end guards are correlated completion and per-intake send receipts. Unknown dispatch remains unknown. Offline evidence proves the named paths, not unattended live-user acceptance.
80/20: Targeted source-consumer tests, recorded-shape replay, typecheck and required architecture/register/change-review/pinned gates. No full suite, live walk, login use or load test.
VERDICT: author submission; no independent convergence or live acceptance claim
