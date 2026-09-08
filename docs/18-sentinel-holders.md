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
| Seven — judgment doorway | `JudgmentRequest`, attempts, resolutions, declared floors, model provenance and benchmark definitions |
| Eight — effect doorway | `OperationDefinition`, `EffectRequest`, validation, observation, settlement, `OutboundMessage` and adapter ports |
| Nine — verification holders | `VerificationPlan`, `VerificationRequest`, `VerificationAssessment`, `ProbeRecord`, `RetrospectiveReviewRecord`, `SemanticReviewRecord`, `Grade`, `AssessmentClosure` and `GuardPostureView`; nine owns later grading and outcome review |
| Ten — assembly | public adapter seams, confinement, production wiring and a hostile-cut harness (a test driver that stops the responsible process between adjacent durable steps and reconstructs from owned history) |
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
freshness window, evidence sources, independent witness, failure action and capacity budget through
the owning plan fields. Runtime activation is not an arm field; it comes from the Part Ten binding
admission requested below. A scheduler fire proves only that a slot became due. Worker receipt
proves only receipt. Fresh failed execution proves that the holder ran and failed; it does not prove
protection.

| Family | Registered arms | Question answered | Required independent evidence |
|---|---|---|---|
| Silent-stop coverage | `build`, `runtime`, `probe`, `retrospective` | Does every admitted worker/run stop mode have detection, recovery ownership and a tested positive neighbor? | run/step history, exact worker-incarnation observation and later disposition |
| Session watchdog | `probe`, `sentinel`, `retrospective` | Is a specific worker blocked beyond its declared progress expectations, after known waits and active progress are excluded? | action-time process identity, live frame/process observation and part-seven resolution when meaning is required |
| Helper watchdog | `probe`, `sentinel` | Is a delegated child missing progress, failed, or disconnected without its parent accounting for the result? | delegation edge, child run/lease history and parent result-destination state |
| Context-wedge sentinel | `build` (parser fixture), `probe`, `sentinel` | Do repeated adapter errors establish a non-resumable conversation context rather than a one-off refusal? | real captured adapter bytes, exact session/incarnation and independent re-challenge result |
| Compaction sentinel | `runtime`, `probe`, `retrospective` | Did a compaction preserve and account for the last inbound message and re-ground the worker? | part-five grounding and continuity records, exact inbound id and worker-consumption witness |
| Presence holder | `runtime`, `sentinel`, `retrospective` | Has admitted user input lacked an attributable response or honest bounded status while work remains owned? | intake fact, outbound settlement, run progress and speaker authority re-resolved at use |
| Promise holder | `runtime`, `probe`, `retrospective` | Does an agent-owned open commitment have current progress, a valid blocker probe, or a bounded revival path? | durable run/commitment source, due obligation, probe evidence and terminal disposition |
| Crash-loop holder | `runtime`, `retrospective` | Does one operation class repeatedly fail under a pinned population strongly enough to propose a pause? | complete attempt population, duration/outcome facts and part-seven classification |
| Session reaper | `build`, `probe`, `retrospective` | Is a named worker disposable now without ending work, breaking reachability or widening exposure? | live run/lease/delegation/commitment state, measured hardware pressure and action-time identity |
| Guard-posture tripwire | `build`, `runtime`, `probe`, `retrospective` | Is every required arm actually executing and independently witnessed at its current generation? | part-nine source observations, check/probe records, assembly inventory and external freshness witness |

**Rule — enrollment and activation have an exact source projection.** Rules 5, 26, 42, 43, 45,
49, 69, 73 and 95; **checks: P14-NF-05/09/16–23/48–50**. At one pinned part-two source
vector, the projection selects current part-three `Declaration` records whose `kind` is `sentinels`
or `features` and whose required facts identify this package. `Declaration.id` is the holder id;
`Declaration.status` is `live`, `dark`, `soaking`, or `retired`; `Declaration.holds` supplies its
rule edges; and the sentinel's `requiredFacts.freshnessProbe`, `requiredFacts.scope` (`live` or
`retrospective`) and `requiredFacts.authority` (`signal` or `block`) retain the meanings imposed by
part three. A sentinel with `requiredFacts.scope: live` must also name its guarded
`requiredFacts.irreversibleMoment`. A current part-nine
`VerificationPlan` enrolls that declaration only when `VerificationPlan.subject.holder` equals the
`Declaration.id`, its `subject.generation` is current, and each required `arms[].id` is represented.
Execution comes only from `ProbeRecord.plan` plus `ProbeRecord.arm`; freshness and protection come
from the matching `GuardPostureView.plan` and its per-arm posture, never from the plan's
`activation` test-evidence lists.

The production instance population must be derived from part-ten assembly facts. The landed
`AssemblyManifest.publicPorts` and scope-wide `AssemblyAdmission` cannot identify a holder, plan,
arm, instance, observation/effect mode, or operation. Part fourteen therefore depends on the
additive Part Ten holder-binding and binding-admission records requested in
`.instar/lanes/design-sentinel-holders-seam-request-assembly.md`. A binding is
**observation-only** only when that record says `mode: observation` and carries no part-eight
operation; it is **effect-capable** only when `mode: effect` references a current registered
`OperationDefinition`. Its runtime state comes from the current binding admission. A missing,
conflicting, partial, or stale binding makes the required population incomplete and therefore
`diverged`; no arm kind or executable name is used to guess the mode. Until that seam lands and its
production bindings pass P14-NF-49/50, no package instance is eligible for `on-confirmed`.

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

**Rule — a configured holder is never presumed alive.** Rules 9, 13, 26, 39, 43, 73 and 95;
**checks: P14-NF-06–09/17/18**. Every enabled instance emits fresh proof of running from recorded
execution on named hardware. The proof identifies plan generation, executable and fixture digest,
logical slot, attempt, start/end observations, result, exact subject population, machine identity,
clock basis and independent witness. A never-run, late, incomparable-clock, copied, self-witnessed,
wrong-generation or wrong-machine result is not fresh. Freshness is evaluated when consumed from
source history, never refreshed by copying into a dashboard row.

**Rule — the operator-facing family view uses exactly four labels without replacing part nine's
posture.** Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–20/54**. The package view is
a deterministic projection of the source mapping in section 2 and part nine's raw per-arm posture,
not a new authority or stored truth. For each declared instance the projector applies the rows below
in order and stops at the first match. Raw posture, missing arms, binding admissions, declaration
facts and evidence references remain visible.

| Label | Derivation |
|---|---|
| `diverged` — precedence 1 | The required population is empty or incomplete; sources conflict; any required arm is missing, never run, stale, failed, inconclusive, errored, unknown, wrong-generation or unwitnessed; any binding is missing or unexpectedly active/inhibited; or declaration and runtime disagree. A fresh failed observation reaches this row before any later label. |
| `off` — precedence 2 | The current declaration `status` is `dark` or `retired`, every known binding admission is `inhibited` or `retired` for that declared reason, no execution is active, and precedence 1 did not match. Off is honest inactivity, never protection. |
| `dry-run` — precedence 3 | The declaration is currently required (`live` or `soaking`), every required observation-only binding is active with fresh passing independently witnessed arms, at least one required effect-capable binding is deliberately `inhibited` by the current governed declaration/admission, all other required bindings are accounted for, and precedence 1 did not match. No prevented effect is claimed. Zero effect inhibitions cannot produce this label. |
| `on-confirmed` — precedence 4 | The declaration is currently required, every required binding is active in production, every required arm has a fresh passing result for the current generation and independent witness, no effect-capable binding is inhibited, and precedence 1 did not match. |

**Rule — family aggregation is ordered and mutually exclusive.** Rules 26, 33, 42, 43, 59, 69
and 73; **checks: P14-NF-19–22/48/54**. First, an empty/incomplete required-instance population or
any `diverged` instance makes the family `diverged`. Second, all instances `off` makes it `off`.
Third, if every required instance is `dry-run` or `on-confirmed` and at least one is `dry-run`, the
family is `dry-run`. Fourth, all required instances `on-confirmed` makes it `on-confirmed`. Every
other mixture, including `off` mixed with an active state, is `diverged`. One green arm therefore
cannot paint siblings green. A complete population count travels separately from any bounded list
so truncation cannot resemble an all-clear.

**Rule — load-bearing gaps are explicit owned findings.** Rules 8, 15, 43, 64, 68, 71, 73 and
87; **checks: P14-NF-21–24**. A load-bearing gap exists when a currently required protection arm
is not `on-confirmed`. `dry-run`, `off` and `diverged` therefore expose gaps on a critical path even
when their state is intentional. The finding names the affected rule/outcome, instance, first
observed source vector, current evidence, owner, safe fail direction and next due assessment.
Activation policy may permit a bounded soak—an owner- and deadline-bound observation period in
which selected effects remain inhibited while their gap stays visible—or an explicit accepted risk,
but neither relabels the gap as protected. The pull surface shows all gaps. A push notice is a
part-eight effect and follows section 8.

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
request, the holder obtains fresh PID, parent, start identity, argv shape (the executable plus its
ordered arguments as observed at action time), worker incarnation and
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
87 and 88; **checks: P14-NF-22/24/38/39/42–47**. First, every self-action class has finite
per-target, per-conversation, per-machine and total action budgets and concurrency limits; a
pool-wide action has a pool-wide bound. Second, every retry uses finite backoff, maximum attempts,
duration and breaker transitions. Third, deduplication uses a **causal episode**: the stable identity
joining observations and actions caused by one originating failure across retries, workers and
machines; a new local key cannot reset it. Fourth, exhaustion records a typed refusal, leaves an
owned gap and names the terminal owner. Notifications consume their own bounded aggregate budget
and group by the same causal episode.

**Rule — breaker claims stop at the landed Part Six boundary.** Rules 26, 45, 55, 61, 69 and 95;
**checks: P14-NF-43/47/49**. The landed `LoopPolicy` can presently enforce only `maxAttempts`,
`minDelay`, `maxDuration`, `timeout`, `concurrency: 1`, `failDirection: closed`, and
`breaker: stub-closed`; landed `LoopRecord` states are `scheduled`, `running`, `restoring`,
`waiting`, and `stopped`. It has no open/half-open/closed breaker transitions, cooldown,
failure-threshold, half-open trial budget, or pressure identity shared across targets, conversations,
machines and the pool. Part fourteen therefore depends on the additive Part Six contract requested
in `.instar/lanes/design-sentinel-holders-seam-request-loop-breaker.md`. Until it lands and the
shared-pressure fixture passes, automatic repeated self-action is inhibited after the first admitted
attempt; a holder cannot claim a breaker by keeping a private counter.

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

The landed effect contract currently requires `EffectRequest.message: string`, and its
`OperationAdapterPort.invoke` accepts only an `OutboundMessage` whose sole purpose is
`ordinary-reply`. It therefore cannot express process kill/spawn/close/compaction, scheduler pause,
account swap, configuration change, filesystem/git mutation, or infrastructure action/result
notice as typed effects. These classes must not be encoded as message text. Part fourteen depends
explicitly on the additive Part Eight typed-payload seam requested in
`.instar/lanes/design-sentinel-holders-seam-request-effect-doorway.md` and the corresponding Part Ten
drivers requested in `.instar/lanes/design-sentinel-holders-seam-request-assembly.md`. Until both
land and pass P14-NF-42/45/46/49/50, all affected effect-capable bindings remain inhibited and their
instances can be no better than `dry-run`; only effects already representable by the landed doorway
may execute. The sole existing path used here is an ordinary agent text reply: decode the current
`OutboundMessage`, prepare/adopt the `EffectRequest`, invoke its registered message adapter, obtain
the required Part Nine assessment and let Part Eight settle it. Infrastructure notices and every
recovery mutation remain blocked rather than masquerading as that reply.

**Rule — uncertainty never becomes a fresh attempt.** Rules 24, 26, 42, 46, 55, 58, 61 and 107;
**checks: P14-NF-44–47**. After a crash or lost receipt, recovery reconstructs the original logical
effect identity and queries the exact adapter journal. Automatic retry requires independent evidence
that the prior effect did not happen, cannot still happen, and cannot still charge. Otherwise the
effect stays uncertain and its maximum exposure remains visible. A new worker, absent process,
expired timer, missing local log or repeated request is not non-occurrence evidence.

**Rule — destructive local guards remain defense in depth.** Rules 26, 42, 49, 60, 66, 69 and 74;
**checks: P14-NF-03/04/42/45/51–53**. A process kill, file removal, configuration change or git mutation
must first survive the core effect contract and then its adapter's target guard. The 1.x
`SourceTreeGuard`, `SafeGitExecutor` and `SafeFsExecutor` establish the preserved requirement:
canonicalize the raw target, refuse protected source targets on uncertainty, constrain narrow
exceptions to an exact operation and canonical target, and audit the requested/resolved target,
principal, decision and result. Those modules do not become alternate 2.0 doorways, and a local
guard's refusal remains a refusal through settlement. Crash-safe persistence evidence is owned by
Part Ten P10-NF-28/29/33; the typed filesystem/configuration/git drivers additionally face the
Part Fourteen cut in P14-NF-53.

---

## 9. The guard-posture tripwire and watcher independence

**Rule — the watcher of watchers is registered and independently witnessed.** Rules 9, 26, 33,
43, 60, 69 and 73; **checks: P14-NF-06–09/16–24/48**. The tripwire compares current declared
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

| 1.x module | What the named source does today | 2.0 requirement and disposition |
|---|---|---|
| `GuardPostureTripwire`, `guardPosture`, `guardPostureView`, `GuardPostureProbe` | Compares configured guard state and probe evidence through component-specific state. | Fresh source execution, complete load-bearing gaps and the off/diverged distinction remain; configuration alone never confirms health. |
| `ContextWedgeSentinel` | Parses captured context-error signatures and proposes replacement under its component policy. | Repeated exact-context evidence, one-off-refusal exclusion, real parser fixtures and fresh part-five grounding remain. |
| `CompactionSentinel` | Verifies recovery using JSONL size/mtime growth (`src/monitoring/CompactionSentinel.ts:410`). Claude prefers an exact session UUID but may fall back to the newest project JSONL; Codex and Gemini select the newest account/project-level transcript (`:488`). It deduplicates recent reports, defers for active work and bounds injection attempts. | P14-NF-31/33/34 require exact pre-compaction inbound accounting, current open-obligation grounding and one logical effect identity. Current activity heuristics are evidence only and do not satisfy continuity. |
| `SessionWatchdog` | Applies exclusions and escalating process actions around a tmux-oriented session identity. | Known-wait exclusion, action-time exact descendant identity, direct-target discipline, bounded escalation and truthful principal attribution remain. |
| `ActiveWorkSilenceSentinel` | Enumerates registered sessions independently of inbound-topic traffic and escalates when the same active-work frame remains frozen for a finite backstop (90 minutes by default); it does not itself authorize a kill. | Preserve registry-wide coverage and a finite frozen-indicator backstop, but require subject-specific progress evidence, part-seven classification when semantic, and part-eight authorization before any recovery. |
| `SocketDisconnectSentinel` | Detects the socket-disconnected frame, sends bounded recovery nudges with backoff (four attempts by default), and verifies that the disconnect text disappears. | Preserve bounded re-challenge and verification while binding the exact worker/context and using the typed effect and loop seams; disappeared text alone is not durable recovery. |
| `ProactiveCompactionSentinel` | Ships disabled unless explicitly enabled and dry-run by default; for autonomous Claude sessions it checks an idle state and a context threshold, then applies a cooldown before direct compaction triggering. | Preserve ships-dark/dry-run posture, idle exclusion and cooldown; compaction becomes a typed effect and success requires exact continuity rather than trigger receipt. |
| `HelperWatchdog` | Emits signal-only helper stall/failure events while the parent session may remain live. | Delegation-edge coverage and parent result-destination accounting remain; a timer alone does not prove failure. |
| `PresenceProxy` | Correlates unanswered messages with component-specific activity classification and bounded notices. | Intake-to-reply accounting, live corroboration, one voice and conservative uncertainty remain. |
| `CommitmentTracker`, `PromiseBeacon` | Track open commitments, blocker/progress cadence, non-terminal `atRisk`, and active-beacon caps. | Durable owner/blocker state, structured probes, bounded revival and internal-by-default follow-through remain. |
| `CrashLoopPauser` | Queries at most 1,000 run-history rows per job (`src/monitoring/CrashLoopPauser.ts:94`) and retains only five failure ids as evidence (`:122`); it applies fixed count rules, excludes critical/never-pause jobs and defaults to dry-run. | P14-NF-40/41 require the complete pinned eligible population, typed shedding exclusions, part-seven resolution and a reversible typed pause. The current capped query/evidence is not completeness proof. |
| `SelfActionGovernor` | Centralizes class/target admission with observe-only defaults, caps and breaker state; pool-shared mode auto-demotes when more than one machine is registered because there is no pool-wide ceiling. | Preserve the shared chokepoint and conservative demotion. Full automatic mode waits on the Part Six shared-pressure/breaker seam and Part Eight/Ten typed effects. |
| `ExternalHogSentinel` | Composes resource classification, protected floors and brakes but ships observation-only/dry-run; it does not kill a process. | Keep it observation-only until exact target evidence, governed thresholds, named-hardware measurements and typed process effects pass. A resource heuristic never becomes kill authority. |
| `SessionReaper`, `ReapLog` | Candidate and occurrence state are component-specific; historical reaps can coexist with later revival. | Protected/minimal sessions, work-outlives-worker, bounded action, revival ownership and separate live eligibility versus historical occurrence remain. |
| `SourceTreeGuard`, `SafeGitExecutor`, `SafeFsExecutor` | Canonicalize and guard destructive source/filesystem/git targets through local wrappers and audit their calls. | Raw-target canonicalization, fail-closed protected-target checks, narrow audited exceptions, refusal propagation and crash-safe mutation remain adapter defenses under the requested typed doorway/drivers. |

**Rule — omitted 1.x modules receive an explicit package disposition.** Rules 30, 42, 45, 55,
59, 61, 68 and 69; **checks: P14-NF-25–35/42–49**. `ActiveWorkSilenceSentinel` is carried into
silent-stop/session-watchdog coverage under P14-NF-25–30; its finite frozen-frame threshold raises
evidence for Part Seven, never kill authority. `SocketDisconnectSentinel` is delegated to Part Six
loop ownership and the requested Part Eight/Ten typed delivery/recovery path under P14-NF-32/34/
42–47. `ProactiveCompactionSentinel` is carried into the compaction holder under P14-NF-31–35 and
remains dry-run until typed compaction and continuity evidence land. `SelfActionGovernor` is
re-expressed as Part Six admission/breaker plus Part Eight settlement under P14-NF-43–47; no private
governor is authoritative. `ExternalHogSentinel` is included only as an observation arm feeding the
session-reaper assessment under P14-NF-27/30/32 and is excluded from automatic process action until
P14-NF-42/49/51/52 pass.

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
| Three → nine/package | current `Declaration`, `holds` and sentinel required facts | join `Declaration.id` to `VerificationPlan.subject.holder` and expose missing enrollment | three owns declaration gap; nine owns assessment |
| Four/five → silent-stop holders | authenticated intake, run/step/progress/grounding facts | assess exact obligation and worker without changing it | five owns work completion |
| Six → holders | lease, fence, loop, recovery and admission observations | bind evidence to current execution authority | six owns execution/recovery lifecycle |
| Holders → seven | captured signal and allowed classification outcomes | decide within floors with complete context | seven owns semantic resolution |
| Holders/seven → eight | registered operation plus effect request | revalidate and settle occurrence/quiescence/charge | eight owns effect settlement |
| Eight → nine | effect observations and independent outcome evidence | assess restoration without rewriting settlement | nine owns verification assessment |
| Ten → package/nine | requested holder binding and binding admission | derive exact required instances, arm mode and production activation without inference | ten owns assembly and binding admission; nine owns posture |
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
| Breaker pressure | drive two holders and multiple workers against one shared operation family through failure, open, cooldown, half-open and recovery | one Part Six pressure identity and breaker history governs all contenders; private counters or worker restart cannot close it |
| Resource use | saturate sessions, helpers, probes, judgments, captures and notices at limit and limit-plus-one | declared memory/process/token/money/concurrency ceilings hold; minimal plane retains reserve |
| Reaper safety | combine old idle workers with active runs, uncertain effects, helpers, commitments, compaction and PID reuse | only exact disposable workers become eligible; zero durable runs end from worker closure |
| Continuity | compact and replace workers at every grounding/consumption boundary with last-message variations | exact inbound id is accounted for and same run continues; activity-only evidence fails |
| Reconstruction | corrupt disposable snapshots and rebuild at equal source vectors on two supported architectures | equal posture/gap projection; conflicts and missing lineage remain explicit |
| Notification | burst failures, repeated self-heals and cross-machine duplicates through real channels | action/result-only, one provenance-correct aggregate per causal episode within finite budget |

**Rule — hostile-cut evidence crosses a real durability boundary.** Rules 26, 33, 34, 42 and 69;
**checks: P14-NF-45/46/53**. A **hostile cut** is a test-controlled stop of the responsible process
between two adjacent durable/effect steps, followed by reconstruction from owned history; it is not
a graceful shutdown or an in-memory exception.

**Rule — activation requires all three test tiers and a graduated evidence record.** Rules 34, 37,
43, 62, 65, 70, 72, 73 and 105; **checks: P14-NF-45/48–50**. Unit tests cover decoders,
classification floors, aggregation and budgets. Integration tests exercise public part-five through
part-nine ports with real persistence and every effect refusal. Live lifecycle tests use production
assembly, real adapters, named hardware, independent witnesses and the real operator channel for
any user-facing output. Each effect-capable binding begins with an `inhibited` Part Ten binding
admission and therefore projects `off` or `dry-run` according to its current declaration; it has an
owner, deadline, graduation bar, rollback operation and retrospective review.
No screenshot, mock, config, boot log, timer registration or document check establishes live status.
The typed-effect, assembly-binding and breaker seam dependencies named above are activation blockers,
not future implementation details that this part may silently emulate.

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
| P14-NF-18 | timing | Fresh failed or never-run holder reads confirmed/dry-run; the same binding with a fresh passing independently witnessed result reaches its otherwise eligible state |
| P14-NF-19 | aggregation | One green arm hides stale/missing sibling or an off instance is mixed with an active one; complete all-on and declared on/dry-run populations reach their ordered labels |
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
| P14-NF-33 | continuity | A finished run or an open obligation with current attributable progress receives injection; an open owned obligation with exact last-inbound grounding, no current progress/known wait, current lease and eligible recovery evidence receives one bounded request |
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
| P14-NF-50 | evidence/e2e | Declared fixture with missing check-run, named hardware or independent witness emits no live/held claim; a current production assembly actually executes unit, integration and lifecycle tiers with current digests, named hardware and independent witnesses and becomes eligible for only the corresponding held/live claim |
| P14-NF-51 | target guard | Raw path, symlink or ancestor resolution reaches a protected target, or canonical identity is unavailable, and the adapter refuses; a separately rooted disposable target with verified canonical ancestry is allowed |
| P14-NF-52 | target guard | Broad exception, target substitution or missing audit field is refused; one exact audited operation/target exception is allowed, and an adapter refusal is preserved unchanged through effect settlement |
| P14-NF-53 | storage fault | Hostile cuts around typed configuration/filesystem/git write, flush, rename, observation and settlement never expose partial state or false success; old-or-new durable state reconstructs under Part Ten P10-NF-28/29/33 |
| P14-NF-54 | projection | Fresh failed observation, zero effect inhibitions, empty required population, or mixed off/active instances take an ineligible label; paired complete inputs reach diverged, on-confirmed, diverged and the ordered family label respectively |

---

## 14. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 45, 49, 59, 64, 68, 69 and 71;
**checks: P14-NF-01/03–05/25/32/35/49/50**.

| Duty | Disposition |
|---|---|
| Rule 59 and part ten — enumerated stall coverage | **Held:** the common matrix, adapter additions, real parser fixtures and positive neighbors are required by P14-NF-25–30. |
| Part nine — fresh holder posture | **Held by consumption:** per-plan/arm/instance execution, independent witness and four-label projection are covered by P14-NF-05–24. Nine retains core posture and assessment authority. |
| Parts five/six — durable work and recovery | **Held by the claimed split:** holders detect and assess; five retains run closure; six owns leases, loops and recovery. P14-NF-31–36 refuses worker events as work completion. |
| Parts seven/eight — judgment and effects | **Partial, activation-blocking:** semantic classification uses seven. The landed eight supports ordinary replies only; typed recovery/action-result payloads and Ten drivers are requested seams. Affected bindings stay inhibited under P14-NF-10–12/40–50. |
| Part eleven — reachability and operator output | **Held by the claimed split:** complete pull posture and bounded action/result notices P14-NF-20–24/37–39. Eleven owns rendering and the minimal plane. |
| Rules 24/58 — recurrence and outcome review | **Held:** complete populations, reason/outcome separation and root-cause obligation P14-NF-13–15/41. Semantic accuracy remains judged, never mechanically guaranteed. |
| 1.x destructive target guards | **Partial, activation-blocking:** exact target verification, audited exceptions, refusal propagation and crash cuts are specified by P14-NF-51–53, but require the requested Eight/Ten typed drivers. Part eight remains the sole effect authority. |

---

## 15. Operator decisions and honest limits

**Value — accepted-gap and soak question.** Which effect classes, if any, may remain deliberately
inhibited as visible load-bearing gaps during rollout, and for how long before graduation or
rollback? Options: no accepted soak gaps; a single fleet duration for named classes; or governed
per-class durations below a fleet ceiling. **Recommendation:** per-class durations below a short
fleet ceiling, each with an owner, deadline and rollback; every such instance remains `dry-run` and
unprotected until live evidence makes it `on-confirmed`.

**Value — automatic recovery question.** Which recovery classes may graduate from signal-only to
automatic effects? Options: none; reversible low-risk classes individually; or every registered
class after tests. **Recommendation:** graduate reversible low-risk classes one by one after dry-run,
hostile-cut evidence and retrospective review; keep destructive or identity-uncertain cases held
unless their specific operation policy is approved.

**Value — eligible notification-budget question.** After eligible self-heal fails, what bounded
budget should action-needed and result-bearing pushes consume? Options: one aggregate per causal
episode; one aggregate per episode with a fleet hourly ceiling; or disable pushes and retain only
the complete pull view. **Recommendation:** one aggregate per episode under a fleet hourly ceiling.
Routine status and churn remain pull-only in every option.

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
