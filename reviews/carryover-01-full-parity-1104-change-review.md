# Change review — whole promise carryover audit and scheduled observation

Subject base: bd82575495ca48ce4470a02593d1ca1983fa5fd4
Review state: open
Reviewed content: none
Outcome: Give admitted undated reply promises a work cadence without requiring a duplicate loop declaration. Carryover row 01 in lanes/carryover-1028.md: observe undated scheduled follow-through as well as dated promises, re-arm observation on each durable work slot, preserve open state across future/unknown due observations, and report dependency waits honestly. Whole-feature inventory and remaining compliance work are recorded separately; this change does not claim full parity or live acceptance.
Affected rules: 1, 8, 9, 22, 26, 34, 42, 44, 49, 52, 55, 60, 63, 68, 70, 74, 83, 87, 92, 93, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no new outbound path or text; spend cap — owner work admission unchanged; stop — sentinel and owner stops unchanged; no duplicate sends — observer cannot send, owner slot reservation and UNKNOWN retention unchanged; durable intake — source journal remains authoritative and every observation persists before requesting work.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes scheduled promise observation and requests for the existing bounded worker; holds no effect authority.
Side effects: Undated scheduled obligations enter the promise pull report. Waiting results no longer appear as acted. New scheduled slots no longer inherit old one-shot observation markers. A promise reappearing in the owner population reopens an older closed observation; the pinned original module fails that regression and the repaired unit passes. Older compacted promise projections receive the same defaults as raw replay (Rule 44). Older sentinel rows without dueAt remain readable; new rows validate the optional timestamp.
Undo and recovery: Revert the observer and adapter changes together. The additive dueAt field grants no effect authority; prior readers tolerate it. The original work-slot identity and delivery receipts remain unchanged and uncertain sends must never be repeated.
Multi-machine posture: All observation state stays in the existing owner journal and follows its replication/replay. Existing owner admission controls the worker. No new store, local timer or machine election.
Layer below: Read the governing purpose and main's full rule book, complete pinned PromiseBeacon and CommitmentTracker, boot/create/mutation/delivery callers, legacy tests and existing Five-owned scheduling, journal work reservation, result projection and sentinel append-before-effect boundary. The observer was narrower than its worker and incorrectly treated future schedules as closure.
1.x reuse: PromiseBeacon.schedule/fire re-arms from a durable anchor; CommitmentTracker keeps owner separate from dependency and retains unverifiable pending work. The 2.0 adaptation uses the already-authoritative work slot and structured waiting result, preserving the existing stop/spend/uniqueness boundaries rather than adding another timer or store.
Bug class: integration
Bug evidence: reproducer=tests/preview/live-sentinels.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, provider parser, review verdict or acceptance threshold changed. Observation consumes already-admitted structured work results. The admission repair schedules already-model-declared promises; recorded final-reply bytes from update 715676157/message 7234 exercise the new path before and after journal replay. The declaration envelope is constructed, not claimed as captured metadata. Constructed boundary tests add no inference about free text.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged action-claim guidance requires evidence of an attempted avenue; the fixture verifies that instruction. Snapshot normalization adds no instruction or phrase-based model verdict.
Prompt finding: 85544c20941f | protocol-literal | Unchanged durable-intake status reply tells the user retained messages need not be resent; admission and snapshot projection add no phrase-trigger decision.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged recall provenance instruction requires source labels and disclosure of unknown sources; the new work defaults do not change that instruction.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged deterministic empty-memory status text is asserted by its consumer test; no prompt answer is supplied by this change.
Decision: CARRYOVER-01-ADMIT-UNDATED | A model-admitted undated promise owns internal preparation on the existing cadence; an explicit dependency refines the default and a send still requires its own grant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-01-full-parity-1104-PROGRESS.md
Decision: CARRYOVER-01-OBSERVE-SLOTS | Reuse the owner's schedule for undated and recurring observation; keep dependency waits distinct from progress and never derive closure from a missing due instant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-01-full-parity-1104-PROGRESS.md


---

# Carryover row 01 — pinned source behavior inventory

Scope: `lanes/carryover-1028.md`, row 01. Source: JKHeadley/instar
`4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`. `B` below means
`src/monitoring/PromiseBeacon.ts`; `T` means `src/monitoring/CommitmentTracker.ts`.
Both complete files were read, along with creation/mutation routes, server boot,
revival/delivery callbacks, check-in reconciliation and the legacy test inventory.
The prior deadline-order commit `bd82575495ca48ce4470a02593d1ca1983fa5fd4` remains intact.

This inventory is an author audit, not Astra's compliance verdict. **Whole-feature
parity is incomplete.** A passing promise observer test does not close the row.
`OPEN` means the behavior has neither a complete port nor sufficient evidence for
omission. Tests named below are evidence locations; actual executed results belong
in the builder report, not an implied claim that every named test ran.

## Commitment ownership, storage and lifecycle

| Legacy behavior and source | 2.0 disposition / evidence | Status |
|---|---|---|
| `T.record` (672): stable ID, source, request/answer, topic/session, owner and dependency, creation time, active external-key deduplication. | `src/rungraph/promises.ts` owns stable journal-array identities and source/quote joins; `tests/rungraph/promises.test.ts` proves joins and retained closures. This change gives modern undated reply promises a cadence even without a redundant loop declaration. The legacy external-key producer API is not represented. | Partial; external-key caller parity OPEN. |
| `T.normalizeState/transitionState` (1107/1145): owner and blocker are separate; authorization blocker requires action class. | Promise owner remains agent while `PromiseWork.waitsOn` can be operator/external; `journal-obligations.test.ts` tests waiting/resume/retention. The legacy typed action-class authorization transition is not ported by this change. | Partial; typed authorization lifecycle OPEN. |
| `T.mutate` (2095 onward): per-ID FIFO, queue cap 256, CAS retries 5, persist before event; write failure restores state. | Enclosing journal append validates a copy, persists then applies. A second CAS store would compete with that writer. `live-sentinels.test.ts` exercises append refusal, restart and replication; `journal-obligations.test.ts` exercises reservation/recovery. Literal queue counts are not copied into a second store. | Existing single-writer route retained; broader producer admission remains OPEN. |
| `T.load/save`: version-2 migration, atomic rename, replication incarnation/sequence high water, origin-only writes and owner forwarding. | Existing encrypted journal and `journal-replication.ts` remain authority; two-machine sentinel test rechecks peer admission. No legacy JSON import or cross-agent external-key forwarding adapter was added. | Partial; import/caller migration OPEN. |
| `T.withdraw/resume/deliver/expire` (914–1014): terminal transitions, reason/receipt, resume clears suppression. | Journal closures retain evidence; results close on delivered receipt, not on work completion. `owed-delivery.test.ts`, `journal-obligations.test.ts`, `journal-requested-action.test.ts` contain unknown/delivered/withdrawn neighbors. No equivalent general-purpose withdrawal/resume endpoint for every legacy commitment kind. | Partial; general lifecycle callers OPEN. |
| `T.verify/verifyOne` (1425/1483): manual and behavioral work cannot be proven by an automatic check; one-time file/config checks can verify. | Structured worker reports and receipt-bound closure avoid claiming delivery from observation. No typed file/config verifier for this commitment population has landed here. | OPEN. |
| `T.verifyConfigChange/attemptAutoCorrection/checkForEscalation` (1687/1756/1800): watch every 60s (first 15s), correction, escalation after 3 corrections in 1h; no repeated violation alerts after escalation. Topic/session config roots become manual; a conflicting newer global watch supersedes the old watch. | No replacement proven by promise scheduling. Legacy regression files include `CommitmentTracker-config-watch-conflicts.test.ts` and `CommitmentTracker-verify-batches-saves.test.ts`. The config reader/writer must use owned typed effects, not ambient fs in `src/`. | OPEN, including thresholds and opposite boundaries. |
| `T.getBehavioralContext/writeBehavioralRules/ensureBehavioralRulesFile` (1621/1835/1713): durable behavioral rules injected into sessions, missing file repaired without treating its existence as behavioral compliance. | Modern directives are in the full context packet and do not expire; `journal-obligations.test.ts` tests retention through compaction. No exhaustive equivalence proof for legacy behavioral-rule producers or their repair lifecycle. | Partial; caller and repair parity OPEN. |
| `T.markReplyArrived/findByThreadId` (1015/1207): index active Threadline work; arrival is distinct from beacon heartbeat; terminal records excluded, redrive is monotonic. | General result receipts are separate from observation, but no Threadline commitment adapter or thread-ID join port is present in this unit. Legacy `CommitmentTracker-threadline-reply.test.ts` is the acceptance source. | OPEN. |
| `T.recordProbe/reconcileGraveyard` (1037/1070): structured checked/readiness probe (500-character bound), reset dead-letter episode, supersession closes only when the successor is verified/delivered; cap 25/pass. | Generic external-wait reassessment exists. Probe schema, dead-letter reset and superseder lifecycle are not equivalent to it and have not been ported. | OPEN. |
| `T` blocker episodes: post-persist transitions, 64 episodes/16 transitions, drop telemetry and 30-day counters. | Journal retains worker waiting facts; no proved replacement for legacy episode/drop telemetry. Do not claim a generic status count is parity. | OPEN. |
| `T.sweepAutoExpiry/expireCommitments`: 14-day operator wait; 21-day inactive-agent default (dry run); 6h sweep, first 30s, cap 500; external wait protected, future hard deadline protected, fresh probe renews inactivity; disposition ledger retained. | Timer closure of operator directives is forbidden by Rule 93. `commitmentOpen` plus explicit journal closure and `journal-obligations.test.ts` directive-retention test demonstrate the safer no-expiry behavior for directives. Non-directive stale-item disposition and its review trail are still unported. | Directive timer closure omitted with proof; remaining stale-item review OPEN. |
| `T.backfillUnverifiableOneTimeActions` (578): old violated unverifiable actions can be backfilled to delivered. | Not adopted: modern work/send uncertainty stays owned and unrepeated; `journal-obligations.test.ts` recorded uncertain/empty-output tests and `owed-delivery.test.ts` cover this safety floor. No migration may manufacture a delivery receipt. | Unsafe completion inference omitted (Rules 26/42/68). |

## Cadenced follow-through, recovery and delivery

| Legacy behavior and source | 2.0 disposition / evidence | Status |
|---|---|---|
| `B.start/schedule` (606/718): pending enabled records only, newest 20 beacon cap, overflow retained but suppressed, record/resume re-arms, terminal stops; last heartbeat or creation anchors cadence; 1s minimum timer. | `schedulePromise` + `createNextDueWake` derive one timer from durable work; `promise-wake.test.ts` tests restart, stale callbacks, clock changes and admission. New observer retains future/unknown open items and re-arms each slot. Existing capacity limits bound work, but newest-20 suppression semantics are not reproduced or demonstrated superior. | Partial; cap/suppression lifecycle OPEN. |
| `B.clampCadence/effectiveCadenceMs` (2348/1773): default 20min; clamp 1min–6h; at-risk doubles cadence. | 2.0 has recorded run cadence (`loopRevisitMs`), default 1h required by Rule 92; `journal-loop-cadence.test.ts` covers replay and bounds. Per-commitment overrides and risk doubling have not been carried over. | Run default constitutionally adapted; per-item tuning OPEN. |
| `T.detectTimePromise` (1335): duration/2 cadence, hard deadline 3x capped 24h; EOD 1h/12h, tomorrow 2h/24h, soon 30min/2h; regex semantic authority. | Modern `recordedPromises` consumes model-declared verbatim promises, with resolved dates. No keyword semantic authority is imported (Rule 10). The tuned inferred cadence/deadline outcomes still need a model-backed equivalent or demonstrated replacement. | Semantic parser replaced; tuned outcome parity OPEN. |
| `softDeadlineAt`, `nextUpdateDueAt`, `hardDeadlineAt` fields. | The first two are stored but not consumed in these two legacy modules. Hard deadline is used for near-deadline text and expiry protection, not an unconditional hard-deadline expiry engine. Prior deadline ordering is retained and tested in `journal-obligations.test.ts`; do not invent behavior from field names/comments. | Actual deadline-pressure/expiry-protection port OPEN; inert fields not claimed as features. |
| `B.fire` (753): speaker/conversation ownership, live session/epoch, quiet 22:00–08:00 in boot defaults (recheck 10min), LLM spend 100 cents (recheck 1h). | Ordinary-lane owner/peer/stop/cap admission remains authoritative. Source-bound requested results use the standard delivery path. Per-beacon quiet-hours/spend suppression and exact retry intervals lack complete equivalence proof. | Floors preserved; tuned policy OPEN. |
| `B.userOutputEnabled` (2313): default false; output-off does no capture, proxy LLM, aggregate, attention or human send, while internal heartbeat/recovery remains live. Agent-owned follow-through also suppresses status output. | Observer has no send capability; internal worker does due work without new intake, and unrequested results wait for the next reply. `live-sentinels.test.ts`, `journal-obligations.test.ts` prove that boundary. Global explicit output-on legacy modes are not implemented by this observer. | Default silent internal path retained; output-on mode parity OPEN. |
| `B.normalizeOutput/hash/captureBounded` (416/441/514), `fire`: 200 lines/4096 bytes; strip ANSI/spinners/timestamps/counters; changed-output progress judgment, 2 unchanged ticks risk, default no filler, 60min liveness, deadline pressure within 2 cadences. | `live-sentinels.ts` and production frame classifiers already distinguish active/idle/unknown observations; work results, not transcript growth, carry completion authority. No complete promise-specific progress-hash/atRisk projection with these thresholds. | OPEN; cannot substitute a generic silence detector as full parity. |
| `B.autoPause/closeOutTurnFinished` (1090/1162): 4 unchanged ticks auto-pause, 3 idle turns pause, user-resume prompts. | Rule 22 requires remaining judgment/work to stay agent-owned; a pause must not abandon it. Existing worker retains open obligations. Legacy terminal/pause policy needs a compliant explicit work disposition, with threshold and non-terminal-risk tests. | OPEN. |
| `B.escalate/resolveInFlight/rung2/rung3` (1238/1345/1406/1453): 3 revives, exponential floor 120s, global 2, one spawn per 5s tick, persist attempt before spawn; settle 30s + 10s grace, epoch confirmation, duplicate-spawn evidence; rung2 max4/floor30min/quiet hours; terminal attention after exhaustion. | Production work-edge reservation and collection retain original operation identity; unknown child is not relaunched. `production-session-work.test.ts` and `journal-obligations.test.ts` replay real checkpoints. This does not prove all legacy revival rung thresholds and notification outcomes. | OPEN, including driver wiring and failure neighbors. |
| Server revival callback: reject queued/live sessions; 1h idempotence map; revived session needs fresh authorization (configured 30min TTL), external-operation gate can hold. | Existing governed work/session admission is reused; no new spawn callback was introduced. Complete callback equivalence has not been established. | OPEN. |
| `B.emitUserSendSerial/applyDeliveryOutcome` (1971/2106): serialize logical commitment:sequence sends, frozen content while origin-held, reconcile original receipt, advance sequence before retire; typed delivered/standdown/permanent/transient, 3 transient failures, hourly standdown recheck. | Result identity is `(obligation, slot)` with a frozen bound reply and durable receipt; UNKNOWN never becomes a fresh send. `owed-delivery.test.ts`, `journal-requested-action.test.ts`, `journal-obligations.test.ts` exercise delivery and unknown recovery. Full output-on beacon notification classes and retry outcomes remain absent. | Result safety retained; beacon-specific delivery lifecycle OPEN. |
| `B.flushTopicAggregate` (1563): shortest visible cadence per topic; durable frozen pending prefix, serial flush; account only actual delivery; restore pending messages even if commitments paused/terminal. | Requested-result batching uses source-bound same-conversation results after intake; it is not evidence that every status/attention aggregate class survives restart. | Result batching retained; full aggregate/outcome parity OPEN. |
| `B.sweepExternalBlocks` (2230): hourly lease-owned scan, stale probe 24h or total age14d, once-per-episode attention only with output enabled, never closes; a new probe re-arms. | External waits recheck on owner cadence and remain open. Stale-probe threshold, total-age threshold and episode visibility are not present as an equivalent. | OPEN. |
| `CommitmentSentinel`: full-context model finds supported missing commitments and deduplicates. | `retrospective-promises.test.ts` replays actual recorded promises and uncertainty; `reconcilePromises` reuses the owner projection. Modern undated direct admission is repaired here, reducing dependence on retrospective repair. | Existing path plus this repair; no new heuristic. |
| `checkInReminderCore` / `CheckInReminderReconciler`: independent absolute checkInAt, terminal/already-reminded/routing filters, attempts5 and cap25/pass, stamp success only after send; default dry-run. | Dated result scheduling is not an independent check-in lifecycle. A compliant implementation needs a durable check-in item and ordinary message eligibility/settlement; legacy send-before-stamp can repeat after crash and must not be copied as authority. | OPEN. |

## This branch's executable repair and limits

- `CARRYOVER-01-ADMIT-UNDATED`: modern model-admitted undated reply promises get
  an owner and internal-work cadence without a second declaration. A same-reply
  explicit dependency refines the default; dated and legacy notes retain their meaning.
- `CARRYOVER-01-OBSERVE-SLOTS`: observe the owner's undated/durable schedule, retain
  future/unknown open items, re-arm a new slot, and report dependency waits rather
  than calling them acted. No new timer, worker, model gate, store or send capability.
- Pure red-before tests cover the admission gap and four observer boundaries.
  Journal red-before tests reproduce undated omission, including raw and older-snapshot replay of recorded reply
  update **715676157**, delivered message **7234**. The recorded final text is real;
  test declaration envelopes and clocks are explicitly constructed.
- General work recovery tests replay `work-recovery-2026-10-15.json`: captured
  summary uncertainty, Jev undecided/unsure, review output and empty reply shapes.
  They remain non-evidence of a completed work result. Exact IDs and execution
  results are recorded in the builder report.
- No changed code imports ambient I/O/time/process or uses the `Date` identifier
  in `src/`. Host calendar/storage adapters stay in their existing locations.
- No legacy JSON files, broad routes, config mutations, unchecked direct sends or
  terminal auto-expiry are copied merely to make the feature appear present.

Whole parity cannot be asserted until the OPEN rows have implemented, wired,
can-fail proofs or explicit code-and-test-supported superior 2.0 dispositions.
Astra's review and the desk's live proof remain distinct acceptance steps.

simplestRobustRoute: Extend the existing pure observer and its journal adapter, with one optional durable slot field. This is the simplest robust route: it prevents stale observation markers from swallowing subsequent checks without introducing a competing schedule, queue, store or send path. Existing owner admission and work/result receipts remain the start/end/floor guards. No unattended shipped-path completion is claimed.
80/20: Four red pure regressions and one red journal integration reproduced, then all 32 tests in those files passed. Targeted importers, build, typecheck and machine checks cover the implementation; whole-feature review remains explicit.
VERDICT: author submission; no independent convergence or live-proof verdict asserted.
