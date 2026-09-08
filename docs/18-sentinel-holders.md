**Status: draft, awaiting approval. Governed.**

# Part fourteen — the sentinel and watchdog holders

**Value — purpose.** Instar should notice when durable work, its worker, or the machinery that
notices failures has stopped making truthful progress. It should prove that it looked, distinguish
a warning from authority, and take only bounded recovery actions whose effects are independently
observable. This part packages the 1.x sentinel and watchdog family as ordinary registered part-nine
holders. It gives that family no private power.

**Rule — reading convention and evidence discipline.** Rules 9, 13, 26, 41, 42, 43, 49, 59,
61, 69, 90, 91, 107 and 111; **checks: P14-NF-01/02/05/08/09/45/49/50**. Every normative claim in
this document is in a Rule block and names executable checks. Value blocks are proposals for the
operator to accept or reject. A configured file, enabled flag, timer, process, log pathname, session
label or component self-report is never proof that a holder ran or that protection passed. A
measurement records the named subject, hardware, workload, clock basis, eligible failures and actual
observations. A target, configured interval, estimate or successful-only percentile is not measured.

---

## 1. Ownership and boundaries

**Rule — part fourteen defines no new core type.** Rules 1, 30, 45, 49, 69, 90 and 113;
**checks: P14-NF-01–04**. This is an adapter, holder and package design over the landed core. A
holder package means a shipped set of registered `VerificationPlan` instances and their executable
bindings; it is not a register kind or persisted core schema. Earlier parts own every consumed type.

| Earlier part | Types and authority consumed here |
|---|---|
| One — constitutional types | typed identity, evidence, freshness, standing, refusal, conflict, measurement and disposition primitives |
| Two — durable facts | append-only facts, signed history, source vectors, capture references, projections and conflict-preserving replay |
| Three — register | declarations, holder entries, `holds`/`freshnessProbe`/`scope`/`authority` facts, rule graph, check-run records and honesty classes |
| Four — intake | authenticated intake, principal and conversation binding, authorization classification and preserved refusal |
| Five — run graph | durable runs, steps, transitions, budgets, exit tests, progress, worker grounding, continuation and delegation edges |
| Six — execution | leases, fences, admission reservations, `LoopPolicy`, `LoopRecord`, `RecoveryRecord` and bounded recovery ownership |
| Seven — judgment doorway | `JudgmentRequest`, attempts, resolutions, declared floors, model provenance and later outcome review |
| Eight — effect doorway | `OperationDefinition`, `EffectRequest`, validation, observation, settlement, `OutboundMessage` and adapter ports |
| Nine — verification holders | `VerificationPlan`, `VerificationRequest`, `Assessment`, `ProbeRecord`, `RetrospectiveReviewRecord`, `SemanticReviewRecord`, `Grade`, `AssessmentClosure` and guard posture |
| Ten — assembly | public adapter seams, confinement, production wiring and hostile-cut harness |
| Eleven — operator surfaces | authenticated pull views, the minimal plane, bounded notices and operator action surfaces |

**Rule — the package cannot reinterpret an earlier owner.** Rules 4, 26, 30, 42, 45, 57, 63,
66, 86, 95 and 107; **checks: P14-NF-03/04/10/11/16/25/27/32/36/40/42**. It cannot infer
standing from a session, turn a signal into a block, swallow a refusal, choose a winner among
conflicting facts, create a retry rule, edit a durable run, or call an adapter directly. Each
consumer re-resolves the current signed source vector and required standing before relying on a
finding or starting an effect. A field reported by the holder about its own authority, posture,
ownership or success is evidence to assess, never authority.

**Value — package boundary.** One package is preferable to independent daemons because one
registered inventory can expose missing coverage, duplicate voice, shared resource pressure and
cross-holder races. The package remains replaceable. A deployment may substitute different
executables while preserving the same plans, evidence bars and public ports.

---

## 2. The registered holder family

**Rule — every member is an ordinary part-nine plan with named arms.** Rules 5, 9, 34, 38, 39,
43, 49, 59, 69 and 78; **checks: P14-NF-05–09/12–15/22/37/38**. Each row becomes one or more
versioned `VerificationPlan` instances. Every arm names its exact subject, executable, schedule,
freshness window, evidence sources, independent witness, failure action, capacity budget and
activation state. A scheduler fire proves only that a slot became due. Worker receipt proves only
receipt. Fresh failed execution proves that the holder ran and failed; it does not prove protection.

| Family | Registered arms | Question answered | Required independent evidence |
|---|---|---|---|
| Silent-stop coverage | shape check, runtime invariant, live probe, retrospective review | Does every admitted worker/run stop mode have detection, recovery ownership and a tested positive neighbor? | run/step history, exact worker-incarnation observation and later disposition |
| Session watchdog | live probe, model sentinel, retrospective review | Is a specific worker blocked beyond its declared progress expectations, after known waits and active progress are excluded? | action-time process identity, live frame/process observation and part-seven resolution when meaning is required |
| Helper watchdog | live probe, model sentinel | Is a delegated child missing progress, failed, or disconnected without its parent accounting for the result? | delegation edge, child run/lease history and parent result-destination state |
| Context-wedge sentinel | parser check, live probe, model sentinel | Do repeated adapter errors establish a non-resumable conversation context rather than a one-off refusal? | real captured adapter bytes, exact session/incarnation and independent re-challenge result |
| Compaction sentinel | runtime invariant, live probe, retrospective review | Did a compaction preserve and account for the last inbound message and re-ground the worker? | part-five grounding and continuity records, exact inbound id and worker-consumption witness |
| Presence holder | runtime invariant, model sentinel, retrospective review | Has admitted user input lacked an attributable response or honest bounded status while work remains owned? | intake fact, outbound settlement, run progress and speaker authority re-resolved at use |
| Promise holder | runtime invariant, live probe, retrospective review | Does an agent-owned open commitment have current progress, a valid blocker probe, or a bounded revival path? | durable run/commitment source, due obligation, probe evidence and terminal disposition |
| Crash-loop holder | runtime invariant, retrospective review | Does one operation class repeatedly fail under a pinned population strongly enough to propose a pause? | complete attempt population, duration/outcome facts and part-seven classification |
| Session reaper | shape check, live probe, retrospective review | Is a named worker disposable now without ending work, breaking reachability or widening exposure? | live run/lease/delegation/commitment state, measured hardware pressure and action-time identity |
| Guard-posture tripwire | shape check, runtime invariant, live probe, retrospective review | Is every required arm actually executing and independently witnessed at its current generation? | part-nine source observations, check/probe records, assembly inventory and external freshness witness |

**Rule — signal and authority remain separate.** Rules 4, 10, 12, 38, 42, 57, 67 and 86;
**checks: P14-NF-10–12/18/21/23/26/29**. Regexes, elapsed-time thresholds, unchanged terminal
frames, process names, adapter text, config differences and resource readings may raise a signal.
They do not decide a person's meaning, establish a semantic wedge, prove a worker is stuck, or
authorize recovery. Exact structural invariants may enforce recorded governed state. Other
classification goes through part seven with the relevant full context, explicit allowed outcomes
and a conservative fail direction. An unavailable judgment provider swaps through the registered
doorway or leaves the case unresolved; it never falls back to a keyword verdict.

**Rule — retrospective review catches failures a live detector cannot see.** Rules 24, 41, 58,
65, 70, 85, 108 and 111; **checks: P14-NF-13–15/41/48**. Reviews pin actual eligible
populations, including missed cases, false positives, repeated recoveries, user corrections,
operator overrides and cases omitted by unavailable telemetry. They compare conclusions and stated
reasons separately with later outcomes. A recurring self-heal produces a root-cause obligation.
Review sampling, omissions, independence, findings and disposition are recorded in
`RetrospectiveReviewRecord`; a review does not rewrite the original finding or effect settlement.

---

## 3. Fresh proof and the four-state package view

**Rule — a configured holder is never presumed alive.** Rules 9, 13, 26, 39, 43, 56, 73 and 95;
**checks: P14-NF-06–09/17/18**. Every enabled instance emits fresh proof of running from recorded
execution on named hardware. The proof identifies plan generation, executable and fixture digest,
logical slot, attempt, start/end observations, result, exact subject population, machine identity,
clock basis and independent witness. A never-run, late, incomparable-clock, copied, self-witnessed,
wrong-generation or wrong-machine result is not fresh. Freshness is evaluated when consumed from
source history, never refreshed by copying into a dashboard row.

**Rule — the operator-facing family view uses exactly four labels without replacing part nine's
posture.** Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–20**. The package view is
a deterministic projection of part nine's per-arm and per-instance posture, not a new authority or
stored truth. Raw posture, missing arms and evidence references remain visible.

| Label | Derivation |
|---|---|
| `on-confirmed` | Current declaration requires the instance, production wiring is present, every required arm has a fresh passing result for the current generation and independent witness, and no effect arm is inhibited. |
| `dry-run` | Required observation arms have fresh proof, while one or more declared effect arms are deliberately inhibited by governed activation policy; no prevented effect is claimed to have occurred. |
| `off` | Current governed declaration says the instance is inactive and runtime evidence agrees. A ships-dark holder is honestly off, not healthy and not divergent. |
| `diverged` | Any other state: required but missing, never run, stale, failed, errored, unknown, wrong generation, unwitnessed, configured/runtime disagreement, unexpected dry-run, or unexpectedly active. |

**Rule — aggregation fails toward the weakest required arm.** Rules 26, 33, 42, 43, 59, 69 and
73; **checks: P14-NF-19–22**. One `on-confirmed` arm cannot paint its siblings green. A family is
`on-confirmed` only when every required instance and arm is `on-confirmed`. It is `off` only when
all current declarations say off and runtime agrees. It is `dry-run` only when all required
observation arms pass and every inhibition is declared. Mixed, missing, stale or contradictory
states are `diverged`. A complete count travels separately from any bounded list so truncation
cannot resemble an all-clear.

**Rule — load-bearing gaps are explicit owned findings.** Rules 8, 15, 43, 64, 68, 71, 73 and
87; **checks: P14-NF-21–24**. A load-bearing gap exists when a currently required protection arm
is not `on-confirmed`. `dry-run`, `off` and `diverged` therefore expose gaps on a critical path even
when their state is intentional. The finding names the affected rule/outcome, instance, first
observed source vector, current evidence, owner, safe fail direction and next due assessment.
Activation policy may permit a bounded soak or an explicit accepted risk, but neither relabels the
gap as protected. The pull surface shows all gaps. A push notice is an ordinary part-eight effect
and follows section 8.

---

## 4. The silently-stopped matrix

**Rule — harness onboarding supplies the complete stop-mode matrix.** Rules 30, 34, 36, 43, 59,
64, 68, 69 and 115; **checks: P14-NF-25–30**. The part-ten adapter registration cannot complete
until every row below names a detector arm, an evidence bar, recovery owner, safe failure direction,
real captured fixtures and an end-to-end positive neighbor. An adapter may add rows. It may not
delete the common rows or claim coverage from another harness's parser.

| Stop mode | Evidence required before classification | Recovery owner and safe direction |
|---|---|---|
| Launch rejected or worker never consumes input | admitted intake plus absent exact-incarnation consumption after bounded observation; adapter launch receipt alone is insufficient | five keeps the run owned; six schedules bounded recovery; reachability remains open |
| Input buffered, relay disconnected or delivery uncertain | exact intake/effect identity, adapter observation and unresolved consumption/settlement | eight reconciles occurrence; no blind reinjection |
| Prompt, approval, credential or operator wait | live frame plus typed run blocker and current authorization state | five records the real blocker; silence never becomes consent |
| Bounded external wait | declared wait subject/deadline, live process identity and progress evidence | loop remains active within its policy; timer alone cannot interrupt |
| Provider unavailable, rate-limited or account unusable | typed adapter refusal and current doorway/account observations | seven/eight select only registered alternatives; refusal stays refusal |
| Worker exits, disconnects or PID is reused | exact session/incarnation/lease and action-time process identity | six recovers the run; stale PID cannot be signaled |
| Worker alive without attributable progress | unchanged evidence plus exclusion of active tool, helper, known wait, idle-complete and recent durable progress | seven classifies within declared outcomes; unresolved stays visible |
| Delegated helper stalls or fails | live child edge, child run/lease facts, result destination and parent accounting | parent run owns redrive or closure; helper event never becomes completion |
| Context becomes non-resumable | repeated real adapter error capture, same context/incarnation and independent challenge | fresh grounded worker proposed through eight; corrupt context is never resumed |
| Compaction loses continuity | exact last inbound id absent from grounding/continuity accounting or post-compaction consumption | five retains work and requires truthful re-grounding; output growth is insufficient |
| Stop, fence, lease, capacity or hardware loss | source facts from their owners and named-hardware measurement | six reassigns or recovers within budget; session event cannot close the run |
| Malformed, delayed or misleading output | captured bytes, parser result, provenance and independent outcome witness | parser signal plus judgment as needed; no unsupported success claim |

**Rule — absence of progress is subject-specific.** Rules 13, 26, 39, 55, 57 and 95;
**checks: P14-NF-26–30**. Each plan declares what counts as progress for that run kind and worker
adapter. Time since terminal output is not interchangeable with time since a durable step,
subprocess output, helper result, provider receipt or effect settlement. Thresholds are finite
safety ceilings and scheduling inputs, not proof of a wedge. Capacity claims name the hardware,
core count, available memory, pressure sample, workload and observation window. A platform load
average or free-memory heuristic alone cannot authorize reaping.

---

## 5. Context wedges and compaction continuity

**Rule — context-wedge evidence identifies the exact failed context.** Rules 26, 30, 36, 41,
42, 67, 86 and 96; **checks: P14-NF-11/12/25/29–32**. The thinking-block corruption signature
and repeated usage-policy rejection from 1.x remain parser signals over captured real adapter bytes.
The holder binds observations to the same conversation context, worker incarnation and adapter
generation, distinguishes a one-off refusal from repeated non-resumability, and requests semantic
judgment where exact adapter semantics do not settle the claim. Recovery cannot resume the context
proved corrupt. It proposes a fresh worker that must ground through part five; adapter text never
becomes permission to kill or spawn.

**Rule — compaction recovery proves continuity, not activity.** Rules 9, 26, 47, 68, 96 and 110;
**checks: P14-NF-31–35**. The obligation binds the pre-compaction last inbound message id, source
vector and open run steps. Success requires a recorded post-compaction grounding step, actual clock
read, accounting for that exact inbound message, worker consumption and a continuing durable run.
Transcript byte growth, a changed frame, a spinner, a new process, a recovery injection or a
generic response proves none of those predicates. A finished run is not injected. An active worker
is not interrupted merely because a timer expired. The same logical recovery episode deduplicates
all triggers.

**Rule — recovery preserves work across worker replacement.** Rules 31, 32, 33, 42, 63, 68, 96,
110 and 113; **checks: P14-NF-32–36**. Before replacement, the consumer re-resolves run ownership,
conversation ownership, lease/fence, operator stop, pending intake, delegation and effect exposure
from signed history. A remote observer may contribute evidence but cannot act locally for another
owner. The new worker uses the same durable run identity and records grounding and continuity. A
partition may delay recovery; it cannot create two authorized voices or silently discard the old
worker's uncertain effects.

---

## 6. Presence, promises and crash loops

**Rule — presence observes an answer obligation without impersonating the agent.** Rules 14, 41,
46, 52, 63, 77, 87, 88 and 89; **checks: P14-NF-22/24/36–39**. The holder joins authenticated
inbound intake, attributable agent replies, infrastructure notices, current run progress and current
speaker authority. Infrastructure status carries infrastructure provenance and never counts as the
agent's answer. The holder does not speak from a timer alone. It first attempts eligible bounded
self-heal; unresolved action-needed or result-bearing output is aggregated and sent only through
part eight. Pull posture remains complete when push output is disabled.

**Rule — promise watching follows durable ownership.** Rules 8, 9, 13, 46, 55, 64, 68, 83, 87,
92 and 93; **checks: P14-NF-37–41**. A promise arm consumes the durable work/run source selected by
parts three and five; this part does not create a competing commitment schema. Each open agent-owned
obligation has a cadence, blocker state, next probe or progress due, terminal test and bounded
revival policy. `at-risk` is non-terminal. An external wait needs a fresh structured probe. An
operator-owned or authorization-blocked item is not falsely narrated as agent progress. Caps apply
per obligation, conversation, machine and package, and overflow stays visible rather than vanishing.

**Rule — crash-loop pausing is evidence-gated and reversible.** Rules 13, 24, 40, 55, 57, 61,
74, 86 and 95; **checks: P14-NF-40–43**. The holder evaluates a complete pinned attempt population
for one operation class and generation. Short failures, repeated equivalent causes and recurrence
are separate observations, not a hard-coded universal verdict. A part-seven resolution may propose
a bounded pause only among registered allowed actions. Critical/minimal-plane work follows its own
declared floor. Expected admission shedding is recorded as expected capacity enforcement, not a
crash. A pause is a part-eight reversible effect with a finite scope, cause, review time and undo
operation; editing a jobs file directly is forbidden.

---

## 7. Session watchdogs and reapers

**Rule — a watchdog cannot infer operator action or signal an unverified process.** Rules 13, 26,
39, 42, 60, 68, 86 and 89; **checks: P14-NF-26–30/42/44**. Immediately before any process-directed
request, the holder obtains fresh PID, parent, start identity, argv shape, worker incarnation and
lease evidence. PID reuse, adapter-host selection, known bounded waits, active helpers, compiler/test
services and current durable progress refuse the candidate. Any intervention records the true
principal and cannot be presented as user cancellation. A pane-wide interrupt cannot substitute
for a verified descendant target.

**Rule — reaping disposes of a worker, never its work.** Rules 7, 15, 26, 60, 61, 63, 68 and 97;
**checks: P14-NF-32/35/42–46**. Eligibility is re-resolved at effect validation and excludes the
minimal-plane reserve, a worker holding active or uncertain work, open delegation, current
commitments, compaction recovery, explicit protection, operator stop processing and any case whose
identity is uncertain. Age or pressure makes a candidate due for assessment, not disposable.
Successful worker closure leaves the durable run alive until its own exit test passes or a bounded
recovery/reassignment record owns it. `ReapLog`-style historical occurrence remains distinct from
the live eligibility projection.

**Rule — no unbounded kill, swap, spawn, pause or notification exists.** Rules 52, 55, 60, 61, 63,
87 and 88; **checks: P14-NF-22/24/38/39/42–47**. Every self-action class has finite per-target,
per-conversation, per-machine and total budgets, concurrency limits, backoff, episode deduplication,
breaker state, maximum attempts and a terminal owner. Pool-wide action requires a pool-wide bound.
Exhaustion records a refusal and leaves an owned gap. It cannot be hidden by starting a new episode,
machine, key or worker. Notifications share the same budget and aggregate by causal episode.

---

## 8. Every recovery enters the effect doorway

**Rule — holders request effects; they never perform them.** Rules 29, 41, 42, 55, 58, 60, 61,
63, 74, 86 and 95; **checks: P14-NF-32/36/40/42–47**. A recovery is a part-five run step under a
part-six lease and loop policy. Semantic selection, when needed, is a part-seven judgment. The
selected registered `OperationDefinition` receives an `EffectRequest` through part eight. Validation
re-resolves subject, standing, owner, scope, generation, fence, budgets, conflicting facts and
current need. The adapter returns typed occurrence evidence. Part eight settles application,
quiescence and charge separately. Part nine then assesses whether the recovery restored the named
outcome. No holder imports process, messaging, scheduler, filesystem, git or harness mutation APIs.

**Rule — uncertainty never becomes a fresh attempt.** Rules 24, 26, 42, 46, 55, 58, 61 and 107;
**checks: P14-NF-44–47**. After a crash or lost receipt, recovery reconstructs the original logical
effect identity and queries the exact adapter journal. Automatic retry requires independent evidence
that the prior effect did not happen, cannot still happen, and cannot still charge. Otherwise the
effect stays uncertain and its maximum exposure remains visible. A new worker, absent process,
expired timer, missing local log or repeated request is not non-occurrence evidence.

**Rule — destructive local guards remain defense in depth.** Rules 26, 42, 49, 60, 66, 69 and 74;
**checks: P14-NF-03/04/42/45**. A process kill, file removal, configuration change or git mutation
must first survive the core effect contract and then its adapter's target guard. The 1.x
`SourceTreeGuard`, `SafeGitExecutor` and `SafeFsExecutor` establish the preserved requirement:
canonicalize the raw target, refuse protected source targets on uncertainty, constrain narrow
exceptions, and audit the exact operation. Those modules do not become alternate 2.0 doorways, and
a local guard's refusal remains a refusal through settlement.

---

## 9. The guard-posture tripwire and watcher independence

**Rule — the watcher of watchers is registered and independently witnessed.** Rules 9, 26, 33,
43, 56, 60, 69 and 73; **checks: P14-NF-06–09/16–24/48**. The tripwire compares current declared
plans, assembly inventory and fresh source execution. It detects missing enrollment, declaration/
runtime disagreement, stale or never-run arms, failed probes, unexpected dry-run, unexpected
activation and loss of its own observer. Its own plan is load-bearing, has an out-of-process witness,
and cannot mark itself `on-confirmed`. Observer loss preserves the last confirmed horizon and opens
an owned gap; it never reports an empty green inventory.

**Rule — baselines cannot bless disappearance.** Rules 24, 26, 32, 33, 42, 43, 45 and 90;
**checks: P14-NF-17–21/48**. A corrupt or absent snapshot, new inventory key, machine rename,
restart, config rewrite or manifest change cannot silently become the new healthy baseline.
Reconstruction comes from signed history and current assembly. A changed generation reopens proof.
The alert/disposition is durably accepted before any baseline advances. Cross-machine aggregation
preserves contradictory heads and per-machine ages; another machine's healthy arm cannot cover a
missing local instance unless the plan explicitly declares a shared subject and witness.

---

## 10. What Instar 1.x does today and what carries forward

**Rule — earned guarantees survive the change in architecture.** Rules 24, 26, 45, 59, 61, 68,
70, 88 and 111; **checks: P14-NF-25–35/37–48**. The layer-below audit covered the named modules and
the incidents recorded with them. The following behaviors are requirements, not endorsements of
their current implementation.

| 1.x module | Incident-earned behavior that carries forward |
|---|---|
| `GuardPostureTripwire`, `guardPosture`, `guardPostureView`, `GuardPostureProbe` | The June 5, 2026 load-shed edit disabled five guards; the outage was noticed hours later and the dark context-wedge guard missed a live wedge. Guard health must come from fresh execution, enumerate load-bearing gaps and distinguish intended off from divergence. |
| `ContextWedgeSentinel` | The May 28 thinking-block corruption and June 5 repeated policy-rejection wedge made a live-looking context permanently non-resumable. Repeated exact-context evidence, one-off-refusal exclusion, real parser fixtures and fresh grounded replacement remain. |
| `CompactionSentinel` | Fire-and-forget recovery could fail silently; an idle killer then removed the session. Stale UUIDs false-escalated, finished sessions received recovery input, and active work was interrupted. Episode dedupe, exact context binding, kill veto, bounded recovery and continuity proof remain. |
| `SessionWatchdog` | Legitimate waiters, adapter hosts and long-lived test services were mistaken for stuck work, while generic cancellation text blurred who acted. Known-wait exclusion, action-time process identity, direct-target discipline, bounded escalation and truthful principal attribution remain. |
| `HelperWatchdog` | Child tool work could stall or rate-limit while the parent watchdog still saw a live top-level session. Delegation-edge coverage and signal-only child failure/stall events remain; a timer alone does not prove failure. |
| `PresenceProxy` | User input could sit unanswered while a worker remained present, and unavailable classification once treated a stuck Codex pane as active. Intake-to-reply accounting, live corroboration, one voice and conservative uncertainty remain. |
| `CommitmentTracker`, `PromiseBeacon` | Open promises became graveyard rows or noisy progress narration; a promise blocked on the operator could be falsely treated as agent-owned. Durable owner/blocker state, structured probes, non-terminal risk, boot caps, bounded revival and internal-by-default follow-through remain. |
| `CrashLoopPauser` | Repeated job failure needed a stop-bleeding mechanism without pausing critical work or mutating everything. Complete attempt populations, dry-run graduation, bounded reversible pause and critical-path floors remain. |
| `SessionReaper`, `ReapLog` | Reaping generated a 17,503-kills/day flood, and a June 26 age-limit reap was followed by a silently held revival. Protected/minimal sessions, work-outlives-worker, bounded action, revival ownership and separate live verdict versus historical occurrence remain. |
| `SourceTreeGuard`, `SafeGitExecutor`, `SafeFsExecutor` | On April 22, 2026 a fixture targeted the real source checkout and wiped 1,893 files. Raw-target canonicalization, fail-closed protected-target checks, narrow audited exceptions and crash-safe state writes remain adapter defenses. |

**Value — what is deliberately re-expressed.** In-memory timers, JSON snapshots, regex classifiers,
component-specific queues, direct callbacks, direct process signals, direct job-file edits and
component-owned Telegram output are not carried forward as authorities. Plans and executions move
to part nine; work and continuation to five; leases, loops and recovery to six; semantic decisions
to seven; mutations and messages to eight; wiring to ten; pull and operator action to eleven.
Module names may survive as package labels, but they do not own truth.

**Rule — 2.0 forecloses the 1.x failure shapes.** Rules 1, 9, 24, 26, 33, 42, 55, 61, 63, 68,
86 and 110; **checks: P14-NF-03/04/07–12/16–24/31–48**. The design forbids configuration-as-health,
self-certified ticks, latest-file fallback across sessions, transcript growth as continuity, timer
expiry as stuck proof, keyword meaning as authority, component-private retries, baseline advance
before durable disposition, direct mutation, notification before failed self-heal, reaping that
ends a run, and new worker identities used to escape uncertainty or budgets.

---

## 11. Behavioral seams and shared failure traces

**Rule — each cross-part handoff has one record and one closure owner.** Rules 33, 42, 45, 46,
49, 63, 68 and 69; **checks: P14-NF-03/04/32/36/40/42–48**.

| Producer → consumer | Record passed | Consumer obligation | Closure owner |
|---|---|---|---|
| Three → nine/package | holder declarations, rule edges, activation and required instances | enumerate plans and expose missing enrollment | three owns declaration gap; nine owns assessment |
| Four/five → silent-stop holders | authenticated intake, run/step/progress/grounding facts | assess exact obligation and worker without changing it | five owns work completion |
| Six → holders | lease, fence, loop, recovery and admission observations | bind evidence to current execution authority | six owns execution/recovery lifecycle |
| Holders → seven | captured signal and allowed classification outcomes | decide within floors with complete context | seven owns semantic resolution |
| Holders/seven → eight | registered operation plus effect request | revalidate and settle occurrence/quiescence/charge | eight owns effect settlement |
| Eight → nine | effect observations and independent outcome evidence | assess restoration without rewriting settlement | nine owns verification assessment |
| Nine/package → eleven | raw posture, four-label projection, gaps, evidence refs and horizons | render pull-first and preserve unknowns | eleven owns surface delivery |

**Rule — four shared traces have one answer.** Rules 24, 26, 31, 33, 42, 55, 61, 63, 68 and 95;
**checks: P14-NF-32/35/36/42–48**.

| Trace | Required outcome |
|---|---|
| Crash after a recovery applies but before local receipt | reconstruct the original effect, query independent occurrence, keep maximum exposure and do not mint another identity |
| Ownership moves while a holder assesses a session | old observer may append evidence; effect validation re-resolves and only the current owner may act or speak |
| Guard observer and target fail together | last horizon expires, package becomes `diverged`, load-bearing gap remains owned and no empty all-clear is emitted |
| Reaper closes a worker during open durable work | eligibility must refuse; if an external kill still occurs, five/six recover the same run and record the breach for retrospective review |

---

## 12. Non-functional checks and activation

**Rule — every bound is finite, attributable and measured on named hardware.** Rules 13, 34, 39,
43, 55, 60, 61, 64 and 75; **checks: P14-NF-06–09/22/24/27/38/39/43–50**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Detection latency | inject each stop mode at every adjacent durable boundary on each supported adapter and named machine class | record worst eligible source-to-assessment latency including failures; missed/late case makes posture diverged |
| Proof freshness | stop, delay, duplicate, reorder and clock-skew holder executions across restart and machine handover | stale/incomparable/wrong-generation proof never reads confirmed; outage remains owned |
| Self-action settlement | burst correlated and distinct episodes beyond per-target, machine and pool limits; crash around each effect boundary | finite actions and queue bytes; no identity reset or blind retry; overflow refuses visibly |
| Resource use | saturate sessions, helpers, probes, judgments, captures and notices at limit and limit-plus-one | declared memory/process/token/money/concurrency ceilings hold; minimal plane retains reserve |
| Reaper safety | combine old idle workers with active runs, uncertain effects, helpers, commitments, compaction and PID reuse | only exact disposable workers become eligible; zero durable runs end from worker closure |
| Continuity | compact and replace workers at every grounding/consumption boundary with last-message variations | exact inbound id is accounted for and same run continues; activity-only evidence fails |
| Reconstruction | corrupt disposable snapshots and rebuild at equal source vectors on two supported architectures | equal posture/gap projection; conflicts and missing lineage remain explicit |
| Notification | burst failures, repeated self-heals and cross-machine duplicates through real channels | action/result-only, one provenance-correct aggregate per causal episode within finite budget |

**Rule — activation requires all three test tiers and a graduated evidence record.** Rules 34, 37,
43, 62, 65, 70, 72, 73 and 105; **checks: P14-NF-45/48–50**. Unit tests cover decoders,
classification floors, aggregation and budgets. Integration tests exercise public part-five through
part-nine ports with real persistence and every effect refusal. Live lifecycle tests use production
assembly, real adapters, named hardware, independent witnesses and the real operator channel for
any user-facing output. Each effect-capable plan begins `off` or `dry-run` according to governed
activation, has an owner, deadline, graduation bar, rollback operation and retrospective review.
No screenshot, mock, config, boot log, timer registration or document check establishes live status.

---

## 13. Negative contract fixtures

**Rule — each negative has a realistic positive neighbor.** Rules 34, 36, 37, 69 and 70;
**checks: P14-NF-01/50**.

| Fixture | Stage | Failure exposed; positive neighbor |
|---|---|---|
| P14-NF-01 | build | Missing owner, family, seam, incident or check; complete inventories resolve |
| P14-NF-02 | docs | Unlabelled claim, forbidden history prose or unsupported measured claim; governed lint and bound evidence pass |
| P14-NF-03 | architecture | New core schema/register kind or private earlier-part import; existing types and public ports pass |
| P14-NF-04 | architecture | Holder mutates run, lease, effect, adapter or surface directly; doorway delegation passes |
| P14-NF-05 | build | Family or arm lacks a registered current plan/holds edge; complete generation-bound plans pass |
| P14-NF-06 | lifecycle | Config, file, timer or process existence marks alive; fresh executed proof on named hardware passes |
| P14-NF-07 | fault | Self-report is sole witness or holder marks itself confirmed; independent source witness passes |
| P14-NF-08 | timing | Copied, expired, future-clock or incomparable proof reads fresh; consumption-time valid interval passes |
| P14-NF-09 | lifecycle | Old executable/fixture/plan generation confirms current holder; exact current digests pass |
| P14-NF-10 | security | Holder-reported standing or ownership authorizes action; signed-history re-resolution passes |
| P14-NF-11 | semantics | Regex, timeout or unchanged frame blocks/classifies meaning; signal plus bounded judgment passes |
| P14-NF-12 | fault | Judgment outage falls back to keyword success; provider swap or unresolved disposition passes |
| P14-NF-13 | review | False positives, misses, overrides or failures omitted from population; pinned complete population passes |
| P14-NF-14 | review | Original finding/effect is rewritten by later grade; separate retrospective record passes |
| P14-NF-15 | recurrence | Repeated self-heal closes as isolated success; owned root-cause obligation passes |
| P14-NF-16 | projection | Stored four-label field becomes authority; deterministic projection from raw posture passes |
| P14-NF-17 | fault | Corrupt/absent baseline becomes new green baseline; signed reconstruction exposes unknown/divergence |
| P14-NF-18 | timing | Fresh failed or never-run holder reads confirmed; running proof and passing protection remain separate |
| P14-NF-19 | aggregation | One green arm hides stale/missing sibling; weakest required arm makes family diverged |
| P14-NF-20 | projection | Truncated anomaly list reports all-clear; full count plus bounded details passes |
| P14-NF-21 | posture | Required dry-run/off arm is called protective; visible load-bearing gap passes |
| P14-NF-22 | load | Gap or event emits unbounded per-item notices; bounded pull view and causal aggregate pass |
| P14-NF-23 | activation | Accepted risk/soak relabels a gap confirmed; explicit risk beside unchanged posture passes |
| P14-NF-24 | lifecycle | Gap disappears without evidence/disposition or self-heal attempt; owned due finding remains |
| P14-NF-25 | build | Harness registration omits a common stop mode or positive neighbor; full matrix passes |
| P14-NF-26 | timing | Elapsed terminal silence alone proves stuck; subject-specific progress evidence passes |
| P14-NF-27 | performance | Target/estimate/platform load average is called measured; named-hardware workload sample passes |
| P14-NF-28 | process | Known waiter/helper/compiler/active work is interrupted; exclusion evidence keeps it running |
| P14-NF-29 | parser | Hand-typed or another adapter's bytes establish wedge; real captured adapter fixture passes |
| P14-NF-30 | process | Stale/reused PID or pane-wide interrupt targets work; action-time exact descendant identity passes |
| P14-NF-31 | continuity | Transcript growth/spinner/new process proves compaction recovery; grounding and last-inbound accounting pass |
| P14-NF-32 | ownership | Recovery/reap acts without current run, lease, fence and conversation re-resolution; exact current authority passes |
| P14-NF-33 | continuity | Finished run receives injection or active worker is interrupted on timer; exact open obligation passes |
| P14-NF-34 | dedupe | Parallel compaction triggers create multiple recoveries; one logical episode/effect identity passes |
| P14-NF-35 | lifecycle | Worker loss/reap terminates durable run; same run gains bounded recovery or queued revival |
| P14-NF-36 | multi-machine | Non-owner acts/speaks or remote health covers local instance; evidence-only observer and current owner pass |
| P14-NF-37 | presence | Infrastructure notice counts as agent answer or carries agent provenance; separate attributable outcomes pass |
| P14-NF-38 | load | Presence/promise overflow vanishes or spawns without cap; visible overflow and layered bounds pass |
| P14-NF-39 | messaging | Status pushes before self-heal or per item; failed-heal-linked action/result aggregate passes |
| P14-NF-40 | crash-loop | Hard-coded count directly pauses critical work; pinned population and bounded judgment pass |
| P14-NF-41 | review | Successful-only attempts or expected shedding count as crashes; complete typed population passes |
| P14-NF-42 | effect | Holder directly kills/spawns/swaps/pauses/notifies/edits; registered effect request passes |
| P14-NF-43 | load | New key/worker/machine/episode escapes action cap; hierarchical identity-stable budget refuses |
| P14-NF-44 | process | Generic cancellation text claims operator action; recorded true principal and observation pass |
| P14-NF-45 | fault | Lost effect receipt starts fresh attempt; original identity reconciliation passes |
| P14-NF-46 | settlement | Absence of local process/log proves non-occurrence/quiescence/charge; independent adapter evidence passes |
| P14-NF-47 | lifecycle | Attempt exhaustion disappears or loops forever; typed refusal, maximum exposure and owner pass |
| P14-NF-48 | fault/e2e | Watcher failure or empty inventory paints green; expired horizon and owned divergence pass |
| P14-NF-49 | wiring/e2e | Required port is null/no-op/mock or bypassed; production assembly and real delegation evidence pass |
| P14-NF-50 | evidence/e2e | Declared fixture has no actual check-run, named hardware or independent witness; no live/held claim is emitted |

---

## 14. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 45, 49, 59, 64, 68, 69 and 71;
**checks: P14-NF-01/03–05/25/32/35/49/50**.

| Duty | Disposition |
|---|---|
| Rule 59 and part ten — enumerated stall coverage | **Held:** the common matrix, adapter additions, real parser fixtures and positive neighbors are required by P14-NF-25–30. |
| Part nine — fresh holder posture | **Held by consumption:** per-plan/arm/instance execution, independent witness and four-label projection are covered by P14-NF-05–24. Nine retains core posture and assessment authority. |
| Parts five/six — durable work and recovery | **Held by the claimed split:** holders detect and assess; five retains run closure; six owns leases, loops and recovery. P14-NF-31–36 refuses worker events as work completion. |
| Parts seven/eight — judgment and effects | **Held by delegation:** semantic classification uses seven; every recovery and message uses eight; uncertainty and refusal stay typed, P14-NF-10–12/40–47. |
| Part eleven — reachability and operator output | **Held by the claimed split:** complete pull posture and bounded action/result notices P14-NF-20–24/37–39. Eleven owns rendering and the minimal plane. |
| Rules 24/58 — recurrence and outcome review | **Held:** complete populations, reason/outcome separation and root-cause obligation P14-NF-13–15/41. Semantic accuracy remains judged, never mechanically guaranteed. |
| 1.x destructive target guards | **Held as adapter defense:** exact target verification, refusal propagation and audit P14-NF-03/04/42/45. Part eight remains the sole effect authority. |

---

## 15. Operator decisions and honest limits

**Value — protection threshold question.** Should a load-bearing arm count as protected only when
`on-confirmed`, or may a bounded `dry-run` soak count? Options: confirmed-only; time-bounded soak
shown as an accepted gap; or accepted off state. **Recommendation:** confirmed-only for the
protection claim, with a time-bounded soak visible as a gap until live effect evidence passes.

**Value — automatic recovery question.** Which recovery classes may graduate from signal-only to
automatic effects? Options: none; reversible low-risk classes individually; or every registered
class after tests. **Recommendation:** graduate reversible low-risk classes one by one after dry-run,
hostile-cut evidence and retrospective review; keep destructive or identity-uncertain cases held
unless their specific operation policy is approved.

**Value — operator notification question.** Should presence and promise holders push routine status?
Options: internal/pull-only; periodic aggregated status; or per-obligation status. **Recommendation:**
internal/pull-only by default, with one bounded push only for a result or action needed after eligible
self-heal failed.

**Value — deployment budget question.** Who chooses freshness windows, detection ceilings and
self-action limits after the tests expose actual distributions? Options: one fleet policy; per
hardware/deployment class; or per agent. **Recommendation:** governed per hardware/deployment class,
with a fleet safety ceiling and no value published as measured until named-hardware evidence exists.

**Value — honest limits.** These holders can prove that registered observations ran and expose
known gaps. They cannot prove that every future stall shape is enumerated, that an opaque provider
reported truth, that a semantic judgment is wise, or that an observer survives total machine and
independent-witness loss. Those limits remain visible in coverage, source horizons and
retrospective populations rather than being converted into green posture.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90,
109 and 111; **checks: P14-NF-49/50** and the governed review process. This document claims no
deployment, actual measurement, live holder, independent convergence or operator approval.
Implementation becomes eligible only after the real three-tier, hostile-cut, named-hardware,
independent-witness, channel and reconstruction evidence exists. The document check and successful
build are technical evidence only; an independent desk must converge and the operator must approve
the exact governed content.

*Depends on: Parts one through eleven, especially Five (`docs/09-the-run-graph.md`), Seven
(`docs/11-the-judgment-doorway.md`), Eight (`docs/12-the-effect-doorway.md`), Nine
(`docs/13-the-verification-holders.md`), Ten (`docs/14-the-assembly.md`) and Eleven
(`docs/15-the-operator-surfaces.md`).*
