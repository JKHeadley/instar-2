# Carryover row 03: lost-worker recovery inventory

Source: JKHeadley/instar commit `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`, `src/monitoring/ResumeQueue.ts`, `ResumeQueueDrainer.ts`, `SessionRecovery.ts`. Destination starts at `14aaecc7d23d192add125c447d49120d9aa9a95e`. This is a behavior inventory, not a live-proof certificate. Row 03 remains OPEN.

The 1.x source distinguishes a terminal reap queued for revival from a recovery bounce, a paused queue from a cancelled entry, a resource hold from a failed spawn, and a spawned process from resumed work. These distinctions matter more than the class names.
Register enforcement: the changed dispatch stays in the existing Part Eight assembly and public harness ports; NF-52 checks the pure-core boundary, P3-NF-01 and the owner-reference wiring check bind source bytes, and R105 binds the native harness composition certificate. The source-pin and certificate findings remain visible for the desk. No declaration is weakened or relabelled to claim parity.

| Imported behavior | 1.x location and thresholds | 2.0 route and evidence | Parity assessment | Rules |
|---|---|---|---|---|
| Durable intake before worker dispatch | `ResumeQueue.considerEnqueue/persist`: temp, fsync, rename, directory fsync | `production-conversation-session.ts` enqueues before dispatch; `ConversationSessionStore` requires atomic durable writes; `production-session-work.ts` appends the edge before launch. `production-conversation-session.test.ts`: busy arrival and restart queue tests | Existing route preserves the original message, not a reconstruction of the dead session | 1/46/68/114 |
| Stable identity and tombstones | `stableKeyFor`, duplicate open entry, tombstones survive dequeue | `enqueue` binds operation to exact request digest; settled rows remain; prior row-03 `run/collect` checks the durable edge and result digest. Same test file duplicate and conflict cases | Existing route is stricter: identical operation never acquires a second effect identity | 26/63/68 |
| Lost enqueue reconstruction | `reconcileFromReapLog`, 30-second boot delay, last 1,000 reap rows within 24 hours | Input is persisted before any dispatch, so queued input exists without a reap event. `host restart drains queued input` | Existing route closes the crash window before work rather than reconstructing it after loss | 2/46/68 |
| Abandoned dispatched work | `reconcileStartingEntries`: increment attempt and requeue, up to 3 | `recover` retains interrupted dispatch as uncertain, with its original request; test `an unresolved dispatched input is never replayed` | Deliberately stricter because an interrupted launch is not proof of no effect | 4/42/68 |
| Lost live worker with no tool effects | `SessionRecovery.recoverFromCrash` kills, truncates and restarts | Existing conversation exit path validates current grant, calls, sends, tool-preparation counter and child edges, retires exactly and restores original input. Captured-shape lost-worker tests | Existing route avoids transcript rewinding and stops on uncertainty | 26/59/68 |
| Safe revival held by capacity | Drainer leaves entry queued when resource gates refuse | This change records a queued revival after confirmed retirement and a no-launch capacity refusal. Original input, deadline, grant and allowance survive restart; 60-second retry cadence | Ported into existing queue; no second store, timer or queue owner | 46/55/60/68 |
| Fresh claim and revalidation | `validateReality`: existing worker, resume UUID, topic owner, project binding, operator stop, run/commitment still live, job state and paths | Queued revival rechecks owner, parent, placement, scope, current grant, original delivery digest/path, deadline, spend and outward-send certainty. Driver checks original accepted delivery and dead original worker. New decision-neighbor tests | Ported identity/revalidation contract; launch exceptions remain uncertain | 28/29/63/114 |
| Exact retirement | `killForRecovery`, central termination authority | `retire` closes admission, controls exact claim/incarnation, releases resource lease; unconfirmed cleanup cannot queue a safe revival | Existing exact identity and cleanup checks are retained | 26/60/63 |
| No replay of unknown effects | 1.x relies partly on prompt/history and at-least-once restart | 2.0 refuses unknown sends, changed tool counts, open children, interrupted dispatch and interrupted replacement; original input retained | Stronger structural floor; tests include both unknown and known-empty effect states | 1/4/63 |
| Remaining allowance | `canSpawnSession`, session count, migration gates | Existing resource owner plus current activation admission; cumulative call accounting and original parent deadline across replacements | Existing route never gives a replacement a new spend budget | 55/60/61 |
| Resource hold is not failed spawn | `gateBlock` returns without incrementing attempts | New queued revival counts capacity deferrals separately, without consuming launch attempts; repeated-hold/restart test | Ported distinction; no unbounded spending while held | 40/46/60 |
| Priority and FIFO | `nextCandidates`: interactive, job, other; FIFO; one candidate per 60-second tick | Existing conversation queue is FIFO; `resource-owner.mjs` orders critical work before maintenance and reserves answer capacity | Cross-class parity needs explicit assessment: the current worker binding requests maintenance capacity | 15/46/60 |
| Calm streak | 3 consecutive normal pressure ticks; reset on pressure; manual drain skips only calm | Existing resource owner checks current pressure and capacity at each admission | Exact 3-tick hysteresis is not yet carried over or proven superior in 2.0 | 55/60/61 |
| Attempt ladder and breaker | 3 spawn attempts; 2-minute exponential backoff; 3 consecutive failures; 30-minute breaker | Existing host-watch crash population and backoff protect host restarts; conversation unknown launch never retries automatically | Worker-specific full ladder is not yet demonstrated equivalent | 55/61 |
| Resurrection ledger | 2 quick re-resurrections per stable key in 24 hours; reset after full age-limit working lifetime or elapsed window | Existing accepted input has at most one confirmed worker restoration; input and lifetime remain durable | Stronger no-replay bound, but repeated independent worker-loss episodes need full parity assessment | 55/61/68 |
| Queue bound and overflow | 50 open entries; oldest lowest priority becomes retained `gave-up:overflow` and attention item | Existing conversation limit is 64 unsettled / 4,096 retained inputs and rejects before accepting over capacity | Intake preservation is stronger; no imported low-priority eviction | 46/60 |
| TTL, pause and requeue | 24-hour incident age excluding pause; pressure-starved flag; original queuedAt retained; requeue only gave-up, not cancelled | Original admitted parent/turn deadline remains authoritative; input remains retained after expiry or stop | Exact operator queue pause/requeue and pressure-starved presentation are not yet equivalent | 46/68/93/97 |
| Stale emergency pause | Auto-clear only specific old emergency pause with new active-run evidence >60 minutes later; never deliberate stop-all | 2.0 uses explicit stop authority and admission, not a separate stale emergency pause that recovery may clear | No automatic weakening of stop is imported | 4/63/93 |
| Ownership vs claimability | Paused live queue still owns its entry; claimability excludes paused | Queued durable input remains owned even when capacity or current grant holds execution | Input remains retained; new queued outcome says waiting for capacity, never restarted | 26/42/68 |
| Dry-run posture and status | Fleet observe-only; would-resume once; guard posture reports disabled runtime; pull queue snapshot | Existing reviewed session activation and pull outcomes; this fix applies to the already enabled route | No new dark feature; full queue-status parity needs assessment | 39/72/73/76 |
| Notices | One aggregate attention item; pressure-held after 20 minutes; paused-with-waiting and breaker; successful spawn says restarted, not resumed | Existing host-watch notice episode is durable, grant-bound and never resent when uncertain | Worker-queue-specific aggregation/20-minute hold notice is not yet carried over | 52/53/87/88/89 |
| Supervision | Observe-only Tier-1 check, 5-second deadline, shed/unparseable audit, never overrides hard guards | Existing model judgment and reply review consume the returned work; recovery path enforces exact known state | Equivalence of the pre-revival sanity observer has not yet been established | 38/41/57/58/67/75 |
| Worktree preservation | Revival instruction and commitment when dirty worktree evidence exists | `src/assembly/worktree-recovery.ts`, `tests/assembly/worktree-recovery.test.ts` provide dedicated worktree inventory/recovery | Wiring from all lost-worker origins still needs a complete parity proof | 2/8/68/83 |
| Tool stalls and error loops | Stall detector, crash detector, repeated-error detector; 3 attempts, 15-minute cooldown; exact transcript via lsof | Existing per-harness driver observations, bounded lifecycle and host watchdog | Full detector-by-detector comparison is not yet complete | 26/55/59/68 |
| Context wall | Durable first-seen latch, transcript-growth deferral, 30-minute ceiling; compact before fresh restart | Existing conversation compact-then-replace flow preserves exact pending input; tests cover captured output shapes, deadline and effect uncertainty | Existing recovery is safer than transcript truncation; full 30-minute latch parity remains to assess | 26/47/55/96 |
| In-flight reply race | Poll topic history up to 7 seconds at 500ms, inject already-sent reply into fresh prompt | Journal send intent/receipt blocks uncertain outward sends; native adapter admits only correlated turn-end and reply digest | Stronger exact evidence; arbitrary sleep cannot establish no duplicate send | 1/26/63 |
| Transcript mutation and backups | Rewind last exchange, last successful tool, then 3 exchanges; backup cleanup after 24 hours | No transcript rewind is used to authorize replay; agent-owned journal and original intake are retained | Not imported: replaying a rewound action cannot satisfy the no-duplicate floor | 7/26/96/116 |
| Channel/framework scope | Telegram, Slack and Threadline/job paths have distinct wiring | Existing public harness adapter and conversation topics ports are channel-independent | Complete live cross-channel proof remains desk-owned and unclaimed | 30/105/113/114 |

The implementation and tests in this branch close the capacity-stranding defect. Rows explicitly marked incomplete above must not be represented as full feature parity or live proof.

## Round 2 (fix/carryover-03-full-parity-r2-1104): carried source and its 2.0 wiring

Step 1 copied the three 1.x modules, their pure helpers and five test files byte-for-byte
(commit `a4eadbaa`); step 2 adapted them in place behind existing Part Ten ports. Carried
lines are the final lines unchanged from the raw copy; adaptation lines are the final lines
added by the diff from that copy. Core modules reach no clock, timer, filesystem or process
(NF-52): persistence is the host store, time is the injected clock in milliseconds.

| File | 1.x source | Raw lines | Final lines | Carried | Adapted |
|---|---|---|---|---|---|
| `src/assembly/revival-queue.ts` | `src/monitoring/ResumeQueue.ts` | 994 | 632 | 513 | 119 |
| `src/assembly/revival-drainer.ts` | `src/monitoring/ResumeQueueDrainer.ts` | 807 | 767 | 532 | 235 |
| `src/assembly/worker-recovery.ts` | `src/monitoring/SessionRecovery.ts` | 1203 | 1096 | 794 | 302 |
| `src/assembly/work-evidence.ts` | `src/core/WorkEvidence.ts` | 162 | 162 | 162 | 0 |
| `src/assembly/stall-detector.ts` | `src/monitoring/stall-detector.ts` | 177 | 163 | 105 | 58 |
| `src/assembly/crash-detector.ts` | `src/monitoring/crash-detector.ts` | 277 | 233 | 188 | 45 |
| `tests/assembly/revival-queue.test.ts` | `tests/unit/resume-queue.test.ts` | 503 | 510 | 395 | 115 |
| `tests/assembly/revival-drainer.test.ts` | `tests/unit/resume-queue-drainer.test.ts` | 848 | 818 | 614 | 204 |
| `tests/assembly/worker-recovery.test.ts` | `tests/unit/SessionRecovery.test.ts` | 406 | 414 | 149 | 265 |
| `tests/assembly/revival-queue-paused-claimable.test.ts` | `tests/unit/ResumeQueue-paused-claimable.test.ts` | 125 | 118 | 91 | 27 |
| `tests/assembly/revival-queue-autoheal-lock.test.ts` | `tests/unit/resume-queue-autoheal-lock.test.ts` | 161 | 101 | 26 | 75 |

Newly written 2.0 wiring: `production-conversation-session.ts` +183/−22, `conversation-topics.ts`
+11/−1, `tests/preview/journal-agent.mjs` +8/−1, `tests/assembly/production-conversation-revival.test.ts`
320 lines (fifteen can-fail decision-boundary cases), the shared fixture +3/−1.

| Imported behavior | Round-2 status | Evidence |
|---|---|---|
| Cross-class priority (interactive, job, other; FIFO) | Carried in the queue. In 2.0 one conversation holds at most one open entry; cross-class ordering is the resource owner's critical-before-maintenance order with its answer reserve, so the shipped conversation worker now holds the `answer` family instead of `maintenance`. Scheduled session work keeps `maintenance` and its own obligation tick. | `revival-queue.test.ts` ordering cases; `tests/preview/journal-agent.mjs` hold family; `scripts/resource-owner.mjs` `eligible` |
| One candidate per tick | Carried per conversation; across topics the topics owner's `revivalGate` admits one revival per drain interval, read by the drainer as its quota gate. | `production-conversation-revival.test.ts` "cross-topic one-per-interval gate" |
| Three calm pressure ticks | Carried: `pressure` port, 3 consecutive `normal` readings, reset on any other reading, an unreadable gauge is not calm; the streak is durable with the brakes. Shipped host reads the resource owner's sampled level (normal; elevated → moderate; critical, shutdown, unknown → critical). A host without a gauge cannot count calm ticks and keeps the resource owner's admission as its pressure gate. | "waits for three consecutive calm ticks", "calm streak is durable", "without a gauge"; drainer calm-gate cases |
| Retry/backoff/breaker and settling | Carried: 3 attempts, 2-minute exponential backoff, 3 consecutive failures open a 30-minute breaker, 15-second settling observation (bounded by the admitted lifetime). Stricter than 1.x: the ladder admits only a replacement that died with exact proof of no effect; unprovable effects invalidate the entry and a launch that threw is settled uncertain by the host. A capacity hold consumes no attempt. | "fifteen-second settling check … ladder", "open breaker … across restart", "unprovable effects … never retried"; drainer ladder cases |
| Two resurrections per 24 hours | Carried: ledger keyed on the conversation, 24-hour window, `seenWorkingPastAgeLimit` reset kept (a 2.0 worker that completes its lifetime is retired by the host, never counted as a loss); the cap is loud and retains the input as failed. | "resurrection ledger caps the third loss"; queue ledger cases incl. REPRO 52075 |
| Pause, requeue, TTL, status | Carried: queue-global pause freezes TTL clocks, requeue only from gave-up (never cancelled, never while paused) re-anchors the TTL and reopens the retained input, cancel, 24-hour TTL with pressure-starved marker, queue snapshot plus drainer status on `port.revival`. The admitted lifetime (≤ 4 hours) is the tighter brake in 2.0. | "TTL expires a held revival", "cancel settles", queue TTL/requeue cases |
| Aggregated notices | Carried through the `notice` port: pressure-held after 20 minutes, paused-waiting (per episode and growing backlog), breaker, ttl-expired, gave-up, invalidated, resurrection-cap, overflow, "restarted" on success. Dedupe markers are durable: no repeat across host restart. The shipped host's attention surface for this port is not yet wired (see remaining). | "twenty minutes … pressure-held", "paused-waiting … not again after restart"; drainer G2 and Layer-1 cases |
| Tier-1 sanity check | Carried observe-only: prompt and identity-only provenance, verdict audited, never a gate, 5-second deadline through `io.wait`, shed on timeout or error. The shipped host's judgment-doorway binding for `sanityCheck` is not yet wired. | "observe-only Tier-1 check"; drainer Tier-1 cases |
| Lost-worker origins and dirty worktree | The exit-mid-turn origin runs through the queue; the existing worktree recovery (`worktree-recovery.ts`) and the `onWorktreeRevival` hook remain separate owners. Not complete: see remaining. | existing `worktree-recovery.test.ts` |
| Stall/crash/error-loop detectors and cooldown | Carried as pure detectors over adapter-parsed entries and the 3-attempt/15-minute/1-hour ladder with durable state. The crash origin in production is the exit observation (drainer ladder). Stall and error-loop detection in production needs the harness adapter to supply transcript entries; not wired. | `worker-recovery.test.ts` detector and ladder cases |
| Context-wall latch and ceiling | Carried in `worker-recovery.ts`: durable first-seen latch, transcript-growth deferral with zero attempts spent, 30-minute ceiling, compaction-first rung. Production keeps the existing compact-then-replace path, which requires the driver's exact idle-prompt evidence before any action and records `contextRecovery` durably before control input; the 30-minute ceiling is not wired into that path. | "context wall" cases in `worker-recovery.test.ts` |
| Stale emergency pause auto-resume | Not carried (Rules 4/93): a pause holds until an explicit resume. | "pause is never cleared by elapsed time"; drainer "never auto-resumed" |
| Lockfile single writer | Not carried: the conversation ownership fence is the writer; the store refuses corrupt or foreign records instead of auto-healing. | `revival-queue-autoheal-lock.test.ts` |
| Dry-run posture | Not carried (Rules 73/76). | — |
| Transcript rewind, 7-second reply poll | Not carried (Rules 1/26/63): rewind only through a host port that performs one, reply from send receipts. | `worker-recovery.test.ts` "without a rewind port", "exact already-sent reply" |

Remaining after round 2 (not READY): shipped-host wiring of the `notice`, `audit` and `sanityCheck`
ports; harness-adapter transcript observation for the stall and error-loop detectors and the
30-minute context-wall ceiling on the production compact path; a complete proof from every
lost-worker origin to dirty-worktree recovery; live channel, framework and host proof (desk-owned).

## Round 3 (fix/carryover-03-full-parity-r2-1104, continued): production wiring

Base b15a3184. This round binds the remaining 1.x behavior to the shipped path. No 1.x line is
newly copied; the carried modules are unchanged. All new lines are 2.0 wiring and tests.

| File | Change | Lines |
|---|---|---|
| `scripts/production-session-io.mjs` | `readTranscriptTail`: bounded tail read, partial first line skipped, timestamps to epoch ms, Claude Code only, O_NOFOLLOW regular file | +45 |
| `src/assembly/contracts.ts` | `HarnessTranscriptObservation`; optional `observeTranscript` on the continuing adapter contract | +14 |
| `src/assembly/production-session-driver.ts` | `SessionIO.readTranscriptTail?`; `observeTranscript(identity)` resolving the Stop-hook session id, else the launch id | +17/−1 |
| `src/assembly/production-session-work.ts` | driver type carries `observeTranscript?` | +5/−1 |
| `src/assembly/conversation-harness-adapter.ts` | passthrough | +1 |
| `src/assembly/production-conversation-session.ts` | `SessionRecovery` in the port: transcript observation at the 30-second cadence, detectors keyed per conversation, kill-to-queued-revival behind the shared `revivalFloor`, child-work veto, exhausted/cooldown notice, context-wall latch bound to compact-then-replace, `workerRecoveryState` durable, `revivalStatus` on the port surface | +170/−23 |
| `src/assembly/conversation-topics.ts` | `revivalStatus()` pull lines from the durable topic records | +9 |
| `tests/preview/journal-agent.mjs` | `revivalAttention` (sidecar + audit log), `revivalSanityCheck` over `jev-revival-sanity`, `notice`/`audit`/`sanityCheck` on the topic config, `observeTranscript` on the driver wrapper, revival notices in `replyNotices`, revival status in the status pull | +23 |
| `tests/preview/revival-attention.mjs` | the attention and audit binding | 63 (new) |
| `tests/preview/revival-sanity.ts` | question and verdict interpreter | 21 (new) |
| `tests/preview/model-call-boundary.ts` | registers `jev-revival-sanity` (route typesafe-jev, `record-verdict` only, signal) | +2 |
| `tests/preview/self-state.ts` | `appendLine` shared by the run log and the audit log | +4/−1 |
| `tests/assembly/production-conversation-recovery.test.ts` | twelve can-fail boundary cases | 268 (new) |
| `tests/preview/journal-conversation-session.test.ts` | five live-path wiring cases (source extraction and a consumer-level stalled transcript) | +105 |
| `tests/assembly/production-session-driver.test.ts` | `observeTranscript` case | +26 |
| `tests/preview/production-session-io-transcript.test.ts`, `tests/preview/revival-attention.test.ts` | reader, sidecar, audit and verdict cases | 59 + 79 (new) |

| Imported behavior | Round-3 status | Evidence |
|---|---|---|
| Aggregated notices | Bound: the host's one reply-notice surface carries each revival notice once in its own topic's next answer; the sidecar is bounded (64) and durable; an identical open line is one notice, a later occurrence after delivery is a new one; lines are scrubbed. | `revival-attention.test.ts`; `journal-conversation-session.test.ts` "binds the revival notice, audit and sanity-check ports" |
| Audit | Bound: scrubbed JSON lines in `revival-audit.jsonl` (topic, clock, event); a failed append changes nothing. | `revival-attention.test.ts` audit case |
| Tier-1 sanity check | Bound: `jev-revival-sanity` registered (Rule 57), carried prompt as the judged state, one `noul` question, verdict audited by the drainer, never a gate; a malformed or unavailable answer is shed. Jev's two-second bound lies inside the drainer's five-second deadline. | "revival sanity check is the registered jev-revival-sanity judgment"; `model-call-boundary.test.ts` |
| Stall / error-loop detectors in production | Bound: adapter transcript tail every 30 s while the turn is open; stall (per-tool thresholds) and error loop (3 identical failures) retire the worker behind the exit path's floor and queue the revival; child work vetoes; the 3-attempt/15-minute ladder keyed per conversation, durable across restart; exhausted ladder tells the operator once. Without a transcript observer no detector runs. | `production-conversation-recovery.test.ts` stall, floor, loop, veto, ladder, no-observer, cadence cases; consumer-level "stalled transcript on the shipped consumer" |
| Crash detector | The crash origin in production is the adapter's exact exit observation (drainer ladder); the pure detector is wired and never reached while the worker is alive. | existing exit-path cases |
| Context-wall latch and ceiling | Bound to compact-then-replace: first observation and transcript growth defer with zero attempts; 30-minute ceiling forces action; compaction in place; a recorded failed compaction admits the grounded replacement; a refused or uncertain compaction settles uncertain; an exhausted ladder settles uncertain instead of looping. The 2.0 one-recovery-per-input floor stays as the tighter brake. | "defers compaction on its first observation", "keeps growing … 30-minute ceiling", "failed compaction kills", "refused compaction", "after the ladder is exhausted" |
| Status | `revivalStatus()` on the topics port, in the host status pull beside idle cleanup. | "revival status pull line" |
| Lost-worker origins to dirty-worktree recovery | Exit, stall, error-loop and context-wall origins all enter the one queue; worktree recovery (`worktree-recovery.ts`, `onWorktreeRevival`) remains a separate owner. | — |

Not carried in this round, by the same rules as round 2: the free-text recovery prompt is not
injected into the harness (the driver's grounded continuation carries the pending input; the
prompt is audited only); the in-flight reply port answers null because the worker never sends
to the operator itself (Rules 42/63). The check cadence (30 seconds) is this port's tick
choice, not a 1.x threshold; the detector thresholds, ladder, cooldown, ceiling and deadlines
are the source values.

Remaining after round 3: a complete proof from every lost-worker origin to dirty-worktree
recovery (the worktree owner is separate); register regeneration for the trailing source pins
(desk-owned); live channel, framework and host proof (desk-owned).

## Physical checkout origin continuation (2026-11-05)

`host-worktree-recovery.mjs` binds the existing worktree/process census and classifier to the shipped
`journal-agent.mjs` cycle and confirmed worker retirement. The installed harness identity supplies the
worker population; separately observed parent links connect run-as processes to exact live tmux roots.
A checkout's original accepted topic comes from that ancestry, never a command label. Continuous
activity coverage, complete fresh census and no live harness process are required; uncertain evidence
retains the classifier's refusal. This intentionally defers recovery while another harness process is live.

Signed `worktree-recovery` journal intake retains the raw request and original topic without operator
identity or authority. Source/checkout deduplication survives observer-cache loss, journal compaction,
restart and the recovery worker's own file activity. The existing worker owns admission, budget and sends.
The carried detectors, thresholds, revival queue and uncertain-effect rules remain unchanged.

`host-worktree-recovery.test.ts` executes the shipped constructor, cycle and retirement binding, with a
real child process, parent ancestry and dirty Git checkout. All four loss origins reach signed intake,
the retained recorded-output file and a consumer reply. Clean, live, unknown, partial, uncovered,
recent, missing-identity and stopped observations create no request. Disconnecting the shipped tick
makes the positive test fail. Rules 2/8/26/29/42/63/83/116; source pins and native macOS conformance
remain desk-owned gates. These are local production-wiring proofs, not a live Telegram certificate.
