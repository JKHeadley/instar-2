**Status: draft, awaiting approval. Governed.**

# Part fifteen — scheduled and recurring work

**Value — purpose.** A schedule should make useful work dependable without turning a clock into
authority. A due instant should survive a restart, compete honestly for finite capacity, and end
with a visible disposition even when no worker runs. This part packages that behavior over the
landed core. No automatic check proves that a chosen cadence, priority, or capacity policy is wise.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91 and 113; **checks:
P15-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every claim belongs to its nearest
Rule or Value block. This part defines no new core type. It consumes the public contracts of parts
one through eleven and supplies package, adapter, and holder behavior over them. A named check is
an implementation obligation, not evidence that software exists. Measured means recorded
execution on named hardware and workload, never a configured target, extrapolation, or estimate.

---

## 1. Ownership and boundaries

**Rule — part fifteen defines no new core type.** Rules 1, 30, 49, 66, 69, 90 and 114;
**checks: P15-NF-01/03**. A job manifest is a part-ten package resource whose decoder selects and
configures existing types. A schedule holder is a part-nine holder realized by part ten. A due
occurrence enters through part four and becomes a part-five durable run. This part does not create
a second event, result, run, lease, loop, judgment, effect, evidence, package, or surface schema.

| Owner | Names and contracts consumed here |
|---|---|
| One | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Authorization`, `Scope`, `Provenance`, `Result`, `Success`, `Refused`, `Outcome`, `Evidence`, `Measurement`, `Profile`, `Decision`, `ActionFloor`, `Conflict` and `UnresolvedInput` |
| Two | fact envelope, append and admission, causal frontier, durability state, version chain, projection, checkpoint, folded-through vector, capture reference and status, correction, retraction, redaction and provisional or contested taint |
| Three | declaration, register generation, generation record, governed port, check-run record, rule graph and honesty class |
| Four | intake port, scheduled-tick identity, system principal, event-id authority, authorization request, operating standing and session-start evidence |
| Five | `Run`, `RunStep`, `RunTransition`, `RunBudget`, `RunExit`, `SessionGrounding`, `ContinuityAccounting`, `ExhaustionRecord`, result destination, agent transport envelope and delivery evidence |
| Six | `Lease`, `FenceToken`, `AdmissionReservation`, operation identity and mapping, spend reservation, `LoopPolicy`, `LoopRecord`, `RecoveryRecord`, scan cursor and transport receipt |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `JudgmentResolution`, provider attempt and receipt, model map, floor, benchmark and hold-cost records |
| Eight | operation definition, effect request, validation, dispatch, observation, settlement and outbound message |
| Nine | verification plan, request, assessment, probe, semantic review, outcome grade and guard posture |
| Ten | local capability package, executable assembly, adapter binding, isolation evidence, package source and activation report |
| Eleven | operator surface, pending-work and run projections, verified operator action, minimal plane and attributable delivery |

**Rule — approved design and landed executable support are different facts.** Rules 26, 34, 43,
66, 69 and 71; **checks: P15-NF-01/03/52**. The prerequisite ledger below is checked against both
the owning design and its public `src/` contract. A design row is not callable merely because its
owner and intended shape are known. Part fifteen cannot activate the affected family until the
owner has landed the named behavior and its acceptance evidence has passed through the production
assembly.

| Owner and prerequisite | Governed design contract | Public implementation at this source head | Required acceptance evidence and activation dependency |
|---|---|---|---|
| Four — scheduled-system intake and recovery enumeration | Part four specifies scheduled ticks, system principals and `(job id, scheduled instant)` identity | `IntakePort.receive` is a message slice: its parser accepts message/stop payloads and its principal resolver refuses non-person sources | The Part Four intake/run-binding seam request must land. Two peers must submit the same canonical tick, recover a crash after intake, and obtain the same intake fact. Scheduled families remain inactive until then. |
| Five — all lawful Run exits and designed continuity records | Part five owns completed, unreachable and cancelled `RunExit`, `ExhaustionRecord` and `ContinuityAccounting` | `RunExit.kind` and the transition validator accept only `completed`; no `ContinuityAccounting` or `ExhaustionRecord` implementation exists under `src/` | The Part Five run-closure seam request must land with decoder, writer, replay and fault evidence for all three exit arms and both records. Families needing unreachable/cancelled closure remain inactive; completion-only fixtures may activate only when they never claim the missing arms. |
| Six — recurring parent duty, breaker and missed coverage | Part six specifies persistent parent budgets, multiple bounded episodes, open and trial-after-cooldown breaker behavior and a missed-count fact | `LoopPolicy.breaker` accepts only `stub-closed`, concurrency is one, a transport slice permits one episode per Run, and `LoopRecord`/`ScanCursor` contain no missed-range membership or disposition contract | The Part Six recurring-loop seam request must land with parent-budget, breaker and missed-coverage fixtures. Recurring scheduling and crash-loop claims remain inactive until then. |
| Six — bounded key paging | Part six says the work owner supplies ordered keys and six only pages them | `BoundedDueScanPort.page` and `ScanCursor` are landed with that selection-only boundary | Part fifteen must derive and register due keys itself, then prove cursor identity and bounded paging. It may not encode missed-range authority into an opaque key or cursor field. |
| Seven/eight/nine — fresh invocation after uncertainty | The owner designs require separate non-occurrence, delayed-execution exclusion and final-charge assessment before a fresh attempt | The public six/eight/nine settlement path retains unknown charge and prohibits another attempt; seven requires a fresh attempt and operation when provider/input changes | Joint settlement and fresh-admission fixtures P15-NF-23/35 must pass. No additional part-fifteen retry seam is assumed. |

**Rule — a schedule is a stimulus, never standing or success.** Rules 4, 28, 42, 63, 66, 68
and 93; **checks: P15-NF-04/05/06**. The clock adapter may submit only the registered scheduled
tick through part four. Part four authenticates the package-minted system principal, resolves the
job's current recorded grant, and admits or refuses that tick. Part six alone grants temporary
ownership and resource admission. A process start, clock callback, file presence, queue insertion,
lease, or worker receipt proves only its narrow event. None proves that work succeeded or that an
effect happened.

**Rule — adapters remain replaceable edges.** Rules 1, 30, 43, 66 and 67; big picture section 10;
**checks: P15-NF-03/07**. The clock parser, calendar library, quota collector, harness, model
provider, notification adapter, and package storage are bound through their existing governed
ports. Core scheduling decisions branch on decoded values and recorded evidence, not provider
names, process names, file paths, or shell output. Replacing one adapter cannot alter old
occurrence identity, authority, run history, or unresolved obligations.

---

## 2. Declarative job packages

**Rule — one manifest is the complete scheduling declaration.** Rules 1, 44, 66, 78, 90 and
103; **checks: P15-NF-08/09/10**. Each enabled job is supplied by one approved part-ten package
version and one matching feature declaration. The manifest is closed, bounded, canonically
encoded, content-addressed, and decoded before activation. Unknown fields, ambiguous encodings,
case-folded identity collisions, invalid calendar values, incompatible package dependencies, and
conflicting active definitions refuse the affected job without stopping the minimal plane.

**Rule — the manifest separates identity, policy, and executable content.** Rules 25, 28, 57,
60, 69, 75 and 90; **checks: P15-NF-08/11/12**. The manifest contains the following groups. These
are package fields and references to owned values, not a new core record.

| Field group | Required content |
|---|---|
| Identity | Stable registered job id, display name, accountable owner, package version and content digest; a slug is only a display and lookup label |
| Schedule | Exactly one recurring `cron-v1` five-field expression plus an IANA named time zone, or one absolute RFC 3339 offset timestamp; activation instant; pinned time-zone-data and calendar-policy versions; nonnegative current-lateness cutoff |
| Work | Registered entry point, immutable body or artifact digest, expected result destination, grounding contract and required predecessor references |
| Authority | Package-minted system principal, standing-grant reference, scope, operation classes and required authorizations; manifest text grants nothing |
| Bounds | Part-five run budget and exit test; part-six duration, attempt, concurrency, token, money, byte and notification allocations; numeric zero remains zero |
| Admission | Priority class, eligible assemblies and machines, required capability set, capacity-evidence policy, global-once or every-eligible-machine placement, catch-up policy, finite class shares and concrete fairness/delay bounds |
| Intelligence | Part-seven route and floor references, supervision level, supervised step boundaries, capture and grading requirements |
| Effects and proof | Part-eight operation references, stable operation identity rules, part-nine verification plan, accepted outcome evidence and uncertainty owner |
| Recovery | Part-six parent duty, rolling budget, loop, backoff, breaker outcome-window and recovery-policy references; maximum overdue age and final exhaustion destination |
| Presentation | Part-eleven topic or destination reference, push policy and operator-facing description; presentation cannot alter execution policy |
| Activation | Required checks, semantic review, assembly compatibility, live holder proof and rollout state |

**Rule — recurring calendar expansion is deterministic.** Rules 26, 33, 39, 69 and 90;
**checks: P15-NF-09/13/14**. A recurring manifest names a valid cron expression, an IANA time zone,
and the registered calendar-policy version. `cron-v1` means a five-field, minute-resolution
calendar expression in minute, hour, day-of-month, month and day-of-week order. It admits decimal
values, lists, inclusive ranges, `*` and positive integer steps; it admits no seconds, years,
macros or names. When day-of-month and day-of-week are both restricted, either match selects the
wall time. An IANA time zone is a named zone interpreted with the manifest's exact time-zone-data
version. RFC 3339 is the absolute timestamp grammar with a required numeric offset or `Z`.

The default calendar policy maps a nonexistent wall time using the last valid UTC offset before
the gap, and marks that mapped instant missed. A manifest whose gap mapping collides with another
wall selection at the same absolute instant is invalid. For `America/New_York` with the pinned
2027 rules, wall `2027-03-14 02:30` maps with offset `-05:00` to
`2027-03-14T07:30:00Z`; its identity is `(job instance id,
2027-03-14T07:30:00Z)` and its initial disposition is missed. Wall `2027-11-07 01:30` occurs at
both `05:30Z` and `06:30Z`; the default earlier policy selects only `05:30Z`, so the later fold is
not an occurrence. A policy choosing both selects two distinct absolute instants.

A **current occurrence** is a due instant whose nonnegative age at the supplied `asOf` clock is
less than or equal to the manifest's current-lateness cutoff. An older due instant is missed. At a
five-minute cutoff, `12:00:00Z` is current at `12:05:00Z` and missed at
`12:05:00.001Z`. A **missed group** is the maximal ordered set of missed instants for one job
instance, package version and calendar-policy version between the exclusive durable expansion
cursor and the current/missed boundary. Its identity binds the first and last instants, count,
ordered-membership digest, prior cursor and catch-up policy. Once recorded, membership never
changes; partial processing resumes at the first member without a disposition.

Calendar expansion is a pure fold over the approved manifest, activation instant, pinned time-zone
data, prior expansion cursor and one supplied `asOf` clock measurement. Equal causal frontiers do
not imply equal expansion. Peers converge only when all those inputs, including the exact `asOf`
bytes, are equal. Different discovery clocks produce separate testimony and may expose different
due prefixes; they never alter an already named occurrence. A time-zone-data change requires a new
package version and cannot rewrite past occurrences.

**Rule — a one-shot is an absolute obligation.** Rules 8, 26, 46, 68 and 97; **checks:
P15-NF-14/15**. A one-shot manifest carries one absolute instant and no recurrence. Before that
instant it remains pending. At or after that instant its scheduled tick is admitted exactly as a
recurring tick. A pre-admission Refused remains a part-four receipt and does not pretend a Run
exists. An admitted one-shot closes only through part five's completed, demonstrated-unreachable
or scope-covering cancelled exit. Capacity enforcement, queue pressure, pausing, disabling a
timer, deleting a local cache, or observing that time passed only inhibits execution and keeps the
obligation owned. A lawful terminal exit prevents another scheduled admission; an operator may
request a separate manual Run with a new part-four event identity.

**Rule — install, update, disable, retire, and fork preserve provenance.** Rules 28, 44, 71, 78,
90 and 103; **checks: P15-NF-10/16/17**. Shipped jobs retain their signed package source and exact
body digest. User jobs occupy a separately owned namespace. An operator override creates a new
approved package lineage rather than editing a shipped source in place. Disable and retire inhibit
future scheduled admissions but keep manifests, prior runs, open obligations, and the digest at
which the action occurred. Package update is atomic at the approved package boundary. Interrupted
staging is visible and never selected as the active definition.

---

## 3. Occurrences, durable runs, and exactly-once scheduling

**Rule — occurrence identity is constitutional and stable.** Rules 7, 26, 28, 33 and 90;
**checks: P15-NF-18/19**. Every due occurrence uses part four's scheduled-tick identity `(stable
job instance id, scheduled instant)`. All installations use one registered scheduled-ingress
adapter namespace. Within an installation its authenticated route is exactly: adapter id from that
entry, channel `scheduled:<installation id>`, sender equal to the package-minted system principal,
identity epoch equal to that principal's signed key epoch, and event id equal to the canonical hash
of `(namespace version, job instance id, RFC-3339-Z scheduled instant)`. The canonical tick bytes
contain only schema version, job instance id, scheduled instant, package digest, calendar-policy
version and time-zone-data version, in part one's canonical encoding. Discovery clock and source
machine are separate part-one `Evidence` testimony referencing the event id; they never enter the
route or tick bytes.

Two active package versions that select the same job instance and instant therefore use the same
event id. Equal bytes collapse to the original intake admission. Different package or calendar
bytes under that id produce part four's mismatch/conflict result; arrival order cannot choose a
winner. This contract depends on the Part Four intake/run-binding seam request because the landed
port does not yet admit system principals or this scheduled payload.

**Rule — one conditional chain selects the intake-to-Run binding.** Rules 26, 33, 45, 68 and 90;
**checks: P15-NF-18/20/21/22**. The package derives one Run id as the canonical hash of the
scheduled-ingress namespace and occurrence identity. It first calls Part Four's requested
`receiveScheduledTick`. An admitted result or duplicate reference resolves to the one authoritative
intake-admission fact. It then opens that deterministic Run id through part five, whose landed
`RunAdmissionPort.create` conditionally appends the immutable Run root. The root causally requires
the intake fact and carries that fact as its opening. The selected binding is that pair; a clock
callback, discovery testimony or part-six reservation cannot select a different Run.

A crash after intake admission leaves its existing `blockedOn: run-admission` obligation visible.
Recovery enumerates those scheduled admissions through the requested Part Four read operation,
derives the same Run id and calls the same conditional create. A crash after Run creation but
before acknowledgement returns the existing immutable root. During a partition, peers may record
separate discovery testimony, but required intake/Run durability and part-six ownership inhibit
business execution until one causally valid binding is visible. Equal competing roots merge by
identity; unequal roots conflict and remain inhibited. No peer mints work from its local discovery
clock or chooses a winner by arrival time.

**Rule — exactly once means one durable scheduling disposition, not one successful effect.** Rules
26, 33, 42, 45, 68 and 90; **checks: P15-NF-18/20/21/22**. Concurrent delivery, restart replay,
late peer delivery and operator refresh return the same intake receipt, Run binding or missed-group
coverage. The current projection is re-derived from signed history at a pinned causal frontier. A
Run's own reported state, a last-run field or a machine-local queue is never authority. The exact
mapping is:

| Scheduling condition | Intake and control record | Run mapping and lawful closure |
|---|---|---|
| Not yet due | No scheduled intake exists | No Run exists; pending is derived from the manifest and supplied clock |
| Due and admitted for execution | One Part Four intake admission; Part Six reservation results remain narrow control Results | Exactly one deterministic Run root; only a Part Five completed, demonstrated-unreachable or scope-covering cancelled `RunExit` is terminal |
| Equal redelivery or replay | Duplicate receipt references the original admission | Returns the same Run; it creates no step or attempt |
| Refused before work admission | Part Four preserves the tick and its `Refused` | No Run is invented; the registered policy owns any later fresh observation |
| Queue, quota or breaker inhibits execution | Capacity enforcement may be `Success` with capacity applied for that control operation; the Run appends a waiting or halted `RunTransition` | The admitted business obligation remains open, owned and visible; `shed` is only a presentation label for this inhibited no-execution state, never a `RunExit` |
| Optional occurrence deliberately does no work | The manifest's immutable exit test explicitly accepts named no-execution evidence for this occurrence class | A checked `completed` RunExit may close it only after that evidence passes; queue pressure or a capacity Result cannot substitute |
| Missed group | Requested Part Six missed-coverage record gives every member a disposition and links any previously admitted member | Members deliberately not executed have no individual Run; the group may bind at most one catch-up Run exactly as defined below |

**Rule — this guarantee does not claim exactly-once effects.** Rules 24, 26, 42 and 63;
**checks: P15-NF-21/23**. Part fifteen promises one logical scheduled run and at most one admitted
provider invocation for each admitted attempt identity. A logical step may have sequential,
bounded attempts only through the fresh-attempt contract below. Part eight and part nine determine
whether an external effect happened. A timeout, lost callback, expired lease, new worker, changed
provider or new budget cannot turn uncertainty into safe repetition. Recovery observes the
original operation identity. Uncertainty stays visible until independently assessed
non-occurrence, exclusion of delayed execution and final charge all settle it.

**Rule — due discovery is level-triggered and bounded.** Rules 8, 46, 55, 61, 68 and 92;
**checks: P15-NF-24/25/26**. The scheduler holder uses part six's persistent loop, due index and
scan cursor. Each recurring job is one persistent parent duty. Its due instants open bounded
episodes under the parent's shared rolling budgets and breaker. **Level-triggered** means an
unsettled due condition remains selectable on every bounded scan; no one-time callback edge is
needed to preserve it. A current occurrence remains due
until its Run has a durable admission and disposition; losing a callback merely causes another
lookup. Each pass has finite pages, work, duration and resource bounds. Fair paging prevents one
dense schedule from starving other jobs. A configured holder is not live because its manifest
exists: part nine requires fresh evidence of an actual scan, a challenge occurrence, its intake
receipt, and the matching run observation. Persistent parent budgets and breaker behavior depend
on the Part Six recurring-loop seam request; the landed loop slice cannot provide them.

**Rule — missed instants are counted, coalesced, and never erased.** Rules 26, 42, 46, 55 and 68;
**checks: P15-NF-14/20/24/27**. After sleep, outage, restart, or partition healing, the loop derives
every eligible scheduled instant since its durable cursor in bounded pages. Part six coalesces the
wake. Through the requested Part Six missed-coverage operation it records the group's first/last
instant, exact ordered-member digest and count, derivation-input digest, scan-cursor predecessor,
and one disposition reference for each member. `none` records deliberate no-execution for every
member. `latest` does the same for older members and links the latest member to the group's one
catch-up Run. The Run id derives from the immutable group id, so replay cannot add another.

A previously admitted member remains linked to its existing Run and is never absorbed into a new
no-execution claim. A partially processed group retains its fixed membership and resumes at the
first member lacking a disposition; it cannot move the boundary or repeat its catch-up Run. The
record is causally linked to the exact `ScanCursor`; `LoopRecord` continues to own wake and breaker
progress, not range membership. A job cannot run early merely because it has never run.
Occurrences before the package activation instant do not exist. This coverage depends on the Part
Six recurring-loop seam request because neither landed `LoopRecord` nor `ScanCursor` can express it.

**Rule — a manifest change has a clean temporal boundary.** Rules 33, 44, 90 and 97;
**checks: P15-NF-16/19/28**. Activation records the first instant governed by the new package
version. Past occurrence identities keep their admitted package digest. An occurrence discovered
under an old active version completes under that run's immutable contract unless a current
authority or safety check refuses its next effect. A changed schedule governs only not-yet-named
future instants. Conflicting activation boundaries inhibit affected admission and surface a part-two
Conflict; no clock winner chooses one.

**Rule — every-machine jobs expand into registered machine-scoped instances.** Rules 32, 33, 60,
63 and 113; **checks: P15-NF-18/30/36/51**. A manifest selects either `global-once` or
`every-eligible-machine`. The latter is permitted only when each result is a physical fact of the
target machine or another registered machine-local outcome. At the pinned expansion frontier, the
package derives one stable job instance id from `(job id, target machine id)` for every eligible
target. Each instance receives its own tick, Run, lease, scope check, local resource reservation
and Result. A target already processed is deduplicated by its instance identity; adding a target
creates only that target's future instances.

An every-machine instance cannot emit a shared or conversation-scoped effect unless a separate
global-once Run admits and deduplicates that effect. Ordinary shared-effect jobs remain
`global-once` and use one cross-machine occurrence identity. Compatibility import maps 1.x
`perMachineIndependent: true` to every-eligible-machine only after its declared effects and storage
are proven machine-local; otherwise import inhibits the job and reports residue. The two-machine
fixture requires two local scan Results for the former and one global effect for the latter.

---

## 4. Quota-aware admission, placement, and concurrency

**Rule — capacity is observed at the admission that spends it.** Rules 13, 26, 39, 40, 60, 63,
75 and 95; **checks: P15-NF-29/30/31**. Each model, session, process, provider and notification
step requests a part-six AdmissionReservation against its ancestor RunBudget. The decision cites
fresh capacity Evidence and Measurement for the actual account, framework, assembly, machine and
window. A quota percentage without source, subject, observed time, reset window, freshness bar, or
account binding is unknown. Configured ceilings and expected durations are policies, not measured
use. Script or local steps may bypass model-quota demand only when their own CPU, memory, process,
effect and concurrency demands are still admitted.

**Rule — the quota brake and placement share one eligibility decision.** Rules 1, 26, 40, 63 and
67; **checks: P15-NF-30/32/33**. The admission candidate set is the same set the placement adapter
can actually launch on. A brake cannot approve an account that placement rejects, and placement
cannot select an account the brake did not assess. A hard machine preference narrows candidates;
it never bypasses a quota wall, stale evidence, missing capability, standing, isolation or spend
bound. When no eligible candidate remains, the Run records a capacity Result and follows its
approved re-observation policy. The Result may truthfully say the scheduler shed this admission
opportunity, but the Run remains waiting and owned. It does not launch on the least bad machine
merely to appear active.

**Rule — unknown capacity never becomes phantom headroom.** Rules 26, 40, 42, 60 and 95;
**checks: P15-NF-29/31/34**. A model-spending step with missing, stale, corrupt, incomplete, out-of-
range, or framework-inapplicable quota evidence cannot treat the absent value as zero use. Its
capacity-evidence policy declares the affected consumer's direction. The recommended ordinary-job
default inhibits low-priority execution and refuses any account whose known short-window wall
predicts immediate failure. Critical work may use only separately reserved, currently evidenced capacity. A framework
with no provider usage surface stays labelled unobservable and uses its approved finite exposure
cap plus call-time settlement; it is never reported as healthy.

**Rule — rerouting is a new admission decision, not inherited permission.** Rules 28, 32, 35,
56, 57, 63, 75 and 113; **checks: P15-NF-32/35/36**. A reroute preserves the Run, step identity,
floor and remaining budget. Moving an observer or recovery worker preserves the immutable original
attempt, operation identity, input digest and reservation; it can only query that attempt. Changing
provider or input proposes a fresh part-seven attempt under the same logical RunStep. It may invoke
only after the original attempt has independently accepted non-occurrence, delayed-execution
exclusion and final charge, part eight has settled it, and part six has mapped a new operation,
created a fresh reservation and issued a fresh one-use claim. A **billing lane** is the recorded
provider account, price policy, quota window and charge-settlement source for one attempt; it is
evidence about the actual route, not authority to use it.

Every destination re-resolves standing, framework compatibility, model map, capability package,
fresh quota, account identity, lease, isolation and capture policy. It records actual machine,
framework, model, account reference, billing lane and reason. A configured pin or requested model
is never reported as the route that ran. If no compatible destination passes, the Run waits with a
capacity Result; it does not mint another operation merely to appear active.

**Rule — concurrency is reserved before launch and released by evidence.** Rules 25, 33, 60, 61
and 63; **checks: P15-NF-30/37/38**. A **job family** is the registered set of job instances that
share one manifest lineage, work entry point and resource policy. Part six enforces finite global,
installation, framework, account, job-family and per-job caps plus the Run's parent allocation. Numeric zero means no new
admission. A slot is reserved before worker creation and remains charged while execution or
settlement is unknown. Completion evidence, not process disappearance alone, releases it. Queues
are durable run states, bounded, priority-ordered, and fair within a class. A full queue ends the
affected admission attempt with a capacity-applied Result and leaves the Run waiting on a bounded
re-observation. It never drops an enqueue and never constructs a business `RunExit`.

**Rule — priority chooses order, not truth or authority.** Rules 4, 18, 40, 60 and 63;
**checks: P15-NF-33/37/39**. Priority may order eligible admissions and select an approved
inhibition band. It cannot widen scope, increase a budget, defeat a stop, skip supervision,
ignore uncertainty, steal an existing reservation, or certify stale evidence. The minimal plane,
emergency stop, diagnosis and bounded repair keep their reserved capacity. After those reserves,
the scheduler uses weighted deficit round robin across priority classes and FIFO with bounded age
promotion inside each class. Every active class has a finite configured weight; the maintenance
class has a nonzero minimum share. Age promotion changes ordering only and cannot cross a resource,
standing, stop or uncertainty gate. The deployment policy states the fair-round workload,
maintenance share and maximum added delay for higher-priority work; missing values refuse
activation. This fixed mechanism prevents indefinite starvation while preserving explicit caps.

---

## 5. Execution gates and supervision

**Rule — preflight is an ordinary recorded step.** Rules 1, 4, 42, 57, 66 and 67;
**checks: P15-NF-05/40/41**. A zero-token preflight invokes a registered programmatic capability
through the normal run and effect boundaries. Its inputs, output, exit meaning, duration and
evidence are recorded as a RunStep Result. A valid no-work finding ends the Run successfully with
zero items; inability to inspect is Refused or failed according to the operation contract. Free-
form shell text, command-prefix classification, nonzero-means-no-work convention, and an
unattributed local file cannot serve as the gate contract.

**Rule — supervision levels select registered part-seven plans.** Rules 34, 38, 56, 57, 66 and
90; **checks: P15-NF-11/42/43**. The manifest chooses one of three package-level levels, each
resolved to an approved judgment plan and model floor. `tier0` permits only deterministic,
non-critical steps whose holder map contains no mind-held boundary. `tier1` places a bounded light
model supervisor after every declared critical programmatic step and before its next consequential
step. `tier2` uses a capable model for the job's reasoning and still records independent required
supervisor or verification boundaries. The strings are manifest choices, not a new core type.

**Rule — missing supervision is not affirmative validation.** Rules 38, 42, 43, 56 and 95;
**checks: P15-NF-42/43/44**. Each critical step records the matching JudgmentRequest, attempt,
receipt, resolution and exact step digest. A missing provider, timeout, insufficient floor,
unavailable capture, malformed answer, or absent resolution follows the job's declared failure
direction and remains visible. It cannot downgrade to `tier0`, use keywords as judgment, or treat
model fluency as proof. The deterministic bootstrap that admits the supervisor call is finite and
cannot ask another model to approve its own invocation.

**Rule — opted-in post-completion learning is owned work.** Rules 8, 41, 46, 58, 68 and 85;
**checks: P15-NF-42/44/45/50**. The manifest's post-completion learning mode is `off` or
`required`. `off` creates no reflection and cannot report that learning occurred. `required` adds
a bounded RunStep after the business outcome and before the package's closure condition. It uses
part seven to consolidate a reflection, part nine to assess the result, and registered package
operations to derive reusable blocker knowledge. The Result cites the completed Run, exact output
capture, reflection, pattern analysis, derived knowledge and all failures. Part five owns step
progression and decides whether the declared exit test can close; the scheduler package owns the
queue hold, not the learning verdict.

The learning attempt has a finite timeout, attempt budget and maximum consecutive queue holds.
Until its Result permits progression, the next queue-drain operation remains inhibited. At timeout
or the hold ceiling, the queue resumes with a visible unavailable/Refused learning Result while a
separate owned learning obligation remains open; neither case is reported as captured learning or
rewrites the business outcome. Compatibility import maps 1.x `livingSkills.enabled` with
`integrationGate` absent or true to `required`, including its proceed-with-warning timeout and
three-hold ceiling, and maps explicit false or disabled living skills to `off`. The fixture checks
reflection recording, high-confidence blocker derivation, failed-job hold, timeout release and the
fourth consecutive block release without losing the uncaptured-learning obligation.

**Rule — workers execute runs; sessions do not own them.** Rules 41, 46, 68 and 92;
**checks: P15-NF-21/45**. A session, subprocess, or remote agent receives one leased RunStep with
grounding, bounds, predecessor facts, exit test and result destination. Worker death leaves the Run
and its obligations durable. A completion marker or transport receipt proves only the named stage.
Part five decides progression and closure from accepted results. Handoff prose is a claim to
re-resolve against signed history, never the source of current schedule, authority or completion.

---

## 6. Recovery, crash-loop control, and honest reporting

**Rule — recovery uses the one loop and one identity.** Rules 8, 24, 46, 55, 61, 68 and 92;
**checks: P15-NF-21/23/24/46**. Retry, delayed observation, quota wait, lease takeover, worker
replacement, notification delivery and crash recovery use part six's LoopPolicy and LoopRecord.
Observation and worker replacement preserve the original Run, step, attempt and operation
identities. A permitted fresh invocation preserves the logical Run and step but uses seven's new
attempt and six's new linked operation after complete settlement of the predecessor. Backoff,
attempt limit, deadline, resource budget, next wake and exhaustion destination are durable.
Restart does not reset them. An operator retry is a separately admitted event and cannot erase the
earlier uncertain Run or bypass its execution and charge settlement.

**Rule — crash-loop pausing is a durable circuit state.** Rules 26, 42, 55, 60 and 88;
**checks: P15-NF-46/47/48**. A registered breaker policy evaluates accepted Run outcomes within a
declared **causal window**: the last `N` accepted outcomes for the job family through
the pinned causal frontier; `N`, the counted outcome classes and the failure threshold are immutable
policy fields, so equal frontiers produce equal membership. It can count failures, spawn refusals,
early terminal failures and repeated resource exhaustion, while distinguishing no-work, operator
cancellation, capacity-applied inhibition and timeouts with unresolved effects. Crossing the
threshold inhibits new ordinary executions for that job and records one pause episode with
supporting Run ids. It does not disable the manifest, rewrite history, classify a timeout as
harmless, or reset because work moved machines. This behavior depends on the Part Six
recurring-loop seam request; the landed `stub-closed` policy supplies no such breaker state.

**Rule — pausing stops waste without deleting the duty.** Rules 8, 14, 46, 55 and 88;
**checks: P15-NF-47/48/49**. While the breaker is open, due ticks still enter intake and receive
durable paused, nonterminal Run transitions. **Half-open** means the open breaker admits only its
declared finite trial count after cooldown while all ordinary executions remain inhibited; an
accepted success closes the episode and an accepted failure reopens it. The breaker follows part six's bounded half-open and recovery policy,
or waits for a verified operator action when policy requires one. Essential observation, emergency
stop, diagnosis and breaker probe work use their separately reserved minimal capacity and cannot
be paused by the failing job. A critical job has an explicit approved fail direction; a hardcoded
never-pause list is not authority.

**Rule — every due occurrence is reportable as fact.** Rules 26, 41, 42, 87 and 89;
**checks: P15-NF-20/31/38/48/50**. The part-eleven schedule projection joins current signed
manifest history, part-four intake receipts, part-five runs, part-six reservations and loops,
part-seven supervision, part-eight settlements and part-nine assessments. It exposes pending,
admitted, running, waiting, no-work, coalesced, shed, paused, refused, failed, uncertain and
completed cases with reasons and source references. It shows actual machine, framework, model,
billing lane, measured use and evidence freshness when known. Missing facts remain unknown. A
record's own `status`, `lastRun`, `nextScheduled`, percentage or success string is never accepted as
authority without re-resolution against its owners' signed history.

**Rule — notification is quiet but loss is never silent.** Rules 52, 53, 54, 87, 88 and 106;
**checks: P15-NF-49/50**. Routine successful and no-work occurrences remain pull-first. One
episode-scoped aggregate reports persistent shedding, pause, repeated failure, overdue uncertainty,
exhaustion, invalid manifests, dead holders and undelivered prior alerts to the configured alert
destination. Delivery uses part eight, records attribution and receipt stage, retries within a
finite budget, and keeps unsent status visible. A missing sink or failed send cannot mark the alert
delivered or hide the underlying run.

---

## 7. What Instar 1.x does today and what carries forward

**Rule — the layer-below audit names preserved behavior and its earned incident.** Rule 111;
**checks: P15-NF-02/51**. The audit covered `JobScheduler`, `JobLoader`, `AgentMdJobLoader`,
`AgentMdReconcile`, `AgentMdAtomicSave`, `AgentMdLockFile`, `InstallBuiltinJobs`,
`buildPerSlugManifest`, `JobClaimManager`, `JobLeaseClaimStore`, `JobLeaseCutoverGate`,
`JobRunHistory`, `SkipLedger`, `IntegrationGate`, `QuotaTracker`, `CrashLoopPauser`,
`MigrationInvariants`, `MigrationLedger`, `OutstandingPromptTracker`, the `Mentor*` job modules,
the job types in `core/types`, and the installed `.instar/jobs` manifests. The following behaviors
carry forward through the 2.0 owners rather than by copying those modules.

| Preserved behavior | Incident that earned it | 2.0 expression |
|---|---|---|
| A never-run future job does not fire on boot | ACT-724 discharged an annual reminder on the day it was created because absence of `lastRun` was mistaken for overdue | Activation instant plus deterministic due history; P15-NF-14/27 |
| Model-free work does not consume a model session | Codey F005 left script jobs hanging for hours with pending history and occupied session capacity | Registered programmatic RunStep with its own bounds; P15-NF-29/40 |
| One slow or restart-surviving job cannot overlap itself invisibly | The June 15 headless-reroute O3 finding showed an in-memory active-run map vanished across restart while the live session survived | Occurrence identity, durable run and reservation; P15-NF-18/21/37 |
| A tick cannot resend while prior work is awaiting its result | `OutstandingPromptTracker` was added after a 15-minute mentor cadence could resend while a reply took more than 16 minutes, creating a ping-pong loop | Durable run and operation identity, outstanding obligation and bounded loop; P15-NF-21/38/46 |
| Multi-machine claims use durable fencing and one cutover path | Best-effort bus claims could diverge under partition, and simultaneous bus and journal paths created a split claim domain | Part-six lease, fence and coherent assembly activation; P15-NF-21/36 |
| Jobs declared independent run once on every eligible machine | `perMachineIndependent` was added because a global slug lease elected one machine for a scan whose result described each machine's own disk; six installed per-slug manifests use it | Registered machine-scoped job instances with one Result per target; global-once remains mandatory for shared effects; P15-NF-18/36/51 |
| Quota admission and placement use the same eligible account set | Account-blind throttling stopped an entire agent with fresh accounts idle, while a looser brake than placement caused respawn loops | One recorded admission candidate set; P15-NF-30/32 |
| Unknown quota is not zero headroom | A non-authoritative 186 percent JSONL estimate stopped all work; a permanently unreadable framework was later treated as healthiest by a zero default | Source-aware evidence policy and bounded unknown posture; P15-NF-29/31/34 |
| Quota warnings are episode-scoped | A missing-file path emitted about 902 warnings per day and buried useful signal | Durable episode aggregation through eleven/eight; P15-NF-49/50 |
| Script-job consecutive failure survives a new attempt and alerts remain retryable | Reset-at-start made every persistent script failure look like failure one; the script path now preserves the streak until subprocess success, and failed alert delivery retains retry state | Fact-derived breaker episode and durable notification loop; P15-NF-46–50 |
| Model-session failure counting needs correction rather than preservation | A successful model-session spawn still resets `consecutiveFailures` and clears alert state before completion; repeated successful spawns followed by failed completions can therefore increment from the reset value again | One outcome-derived breaker fold shared by script and model jobs, with no start-time reset; repeated spawn-success/completion-failure fixtures in P15-NF-47 |
| Crash loops pause waste but preserve diagnosis | Repeating import, overload and incomplete-tool failures consumed compute and polluted signal while duration changes could not fix their causes | Part-six breaker with separate minimal repair capacity; P15-NF-47/49 |
| Built-in manifest generation is checked against its consumer | Hand-written producers omitted required priority, duration and model fields, causing every built-in AgentMD job to fail loading fleet-wide for about a week | One closed package decoder plus producer-consumer fixture; P15-NF-08/10 |
| Compatibility conversion proves zero job loss, zero schedule drift and user-namespace preservation | The AgentMD migration needed `MigrationInvariants` because a successful command was not evidence that every old job retained its meaning | One-way import with source bytes and explicit residue; P15-NF-16/17/51 |
| Signed built-ins, namespace separation and collision refusal remain | Forged default origin, body drift, case collisions and interrupted two-file saves could otherwise select unintended work | Part-ten signed atomic package lineage and explicit conflict; P15-NF-09/16/17 |
| Large history is read incrementally and remains honest about unmeasured jobs | Repeated synchronous parsing of a roughly 13 MB job ledger froze the event loop for 13–16 seconds; empty populations were prone to false percentages | Part-two append/projection/checkpoint model and measured-only aggregates; P15-NF-26/50 |
| Demotion is rechecked at the launch boundary | A machine could start writable, lose its role, and keep firing cron tasks from the stale boot posture | Current part-six ownership and standing check at reservation and dispatch; P15-NF-05/21/36 |
| Job prompts are grounded and tool/model choices are recorded | Headless jobs historically inherited more tools, remote services and billing paths than their work required | Part-five grounding, part-ten isolation and actual route evidence; P15-NF-12/35/45 |
| Opted-in completion performs learning before queue progression | `IntegrationGate` synchronously reflects, records reflection, derives high-confidence common blockers and may hold queue drain after a failed job; timeout proceeds with warning and a fourth consecutive block auto-releases | The bounded post-completion learning step and explicit compatibility policy in section 5; P15-NF-42/44/45/50 |

**Rule — 1.x mechanisms deliberately re-expressed through the core are not parallel systems.**
Rules 1, 30, 66, 68 and 114; **checks: P15-NF-03/51**. `croner` callbacks become clock-adapter
stimuli. `jobs.json`, per-slug JSON and AgentMD frontmatter become one package manifest. The
in-memory queue becomes part-five run state. `SkipLedger` and `JobRunHistory` become projections
over admitted facts. Claim managers become part-six leases and fences. Retry timers become the
part-six loop. `QuotaTracker` becomes a capacity-evidence adapter consumed by admission. Shell
gates become registered RunSteps. The 1.x supervision strings map to parts seven and nine.
`IntegrationGate` maps specifically to section 5's post-completion learning step, Result and
bounded queue-hold policy; generic per-step supervision does not replace it. `Mentor*` and other job-specific state machines become ordinary capability
packages rather than scheduler internals. Telegram topic coupling becomes a part-eleven
destination rendered through the part-eight message operation.

**Rule — the 2.0 design forecloses the audited mistakes.** Rules 1, 26, 33, 42, 55, 66, 67 and
90; **checks: P15-NF-08/18/21/29/38/40/46/51**. It has no slug-only claim, process-local retry
authority, queue that can overflow by dropping, success inferred from spawn, last-writer job
state, missing-value-to-zero quota default, hard pin that defeats a wall, least-loaded launch when
all candidates are blocked, free-form shell gate, silent invalid-entry exclusion, self-reported
route, body and manifest as independent authorities, hardcoded critical exemption, or breaker
reset on restart. Compatibility import preserves old bytes and reports anything it cannot map; it
does not keep two live scheduling authorities.

---

## 8. Non-functional checks and activation

**Rule — activation follows the governed dependency order.** Rules 34, 43, 65, 66, 72, 73,
78, 83 and 103; **checks: P15-NF-03/08/42/45/50/52**. A job family activates only after its
manifest and feature declarations are approved, its package is assembled, every referenced port
is real—including every prerequisite in section 1—supervision and verification coverage are present, compatibility import is complete, and
unit, full-port integration and production-lifecycle evidence exists. Dark and dry-run states
remain distinct. Dry run admits challenge occurrences and records intended admission decisions but
cannot invoke the business entry point. Activation of one job cannot silently activate another.

**Rule — the scheduler is a held runtime outcome.** Rules 9, 38, 41, 43 and 78; **checks:
P15-NF-24/42/52**. Part nine holds the scanner, calendar expansion, intake path, reservation path,
worker path, breaker, reporting projection and notification path. Fresh proof includes an
independently originated challenge scheduled instant, actual scan on the named installation,
matching dedup identity, run admission, bounded execution or deliberate no-work result, and an
independent witness. A loaded manifest, active process, heartbeat, timer registration or self-
reported green status is insufficient. Missing or expired proof renders the affected holder stale
or unknown and blocks only consumers whose approved policy requires it.

**Rule — performance and pressure claims are measured on named subjects.** Rules 13, 39, 40, 43,
60, 61, 64 and 75; **checks: P15-NF-26/30/37/50/52**. Activation records hardware, operating
system, assembly, storage mode, time-zone data, manifest population, schedule density, concurrent
workers, provider/account class, fault schedule and sample completeness. It measures discovery-to-
admission delay, due-debt age, queue wait, reservation time, run duration, recovery time, projection
rebuild, CPU, memory, bytes, tokens, money, notification volume and fairness. Failed, timed-out,
shed and missing samples stay in the population. A configured goal or successful-only percentile
is never labelled measured.

The deployment policy supplies the following finite values before instrument or job activation.
Each value carries units, registered subject and producer, exact workload shape, sample population
and accountable part-five investigation owner. Part ten's `GrowthPolicy` and
`GrowthObservation` contract supplies the common measurement envelope; part five supplies the
owned breach Run. Missing policy, producer or complete sample refuses activation. A runtime breach
inhibits only the affected admission class, retains due work, and opens one deduplicated breach
Run; it never edits the target to make the sample pass.

| Scheduling measurement | Required declared workload and policy values | Acceptance comparison and overrun action |
|---|---|---|
| Discovery-to-admission delay and due-debt age | Named hardware/assembly; job count; due instants per minute; page item/duration bounds; peer count; fault schedule; `maxDiscoveryToAdmission` and `maxDueDebtAge` durations | Every eligible sample, including timeout/missing lower bounds, must be within its matching duration. Overrun keeps the occurrence due, inhibits the affected activation or class, and opens the owned breach Run. |
| Fair service and queue delay | Named class weights; nonzero `minimumMaintenanceShare`; fair-round admission count and duration; sustained arrivals per class; zero/boundary/boundary-plus-one caps; `maxHighPriorityAddedDelay` | Observed eligible service per completed fair round meets the declared share, and added high-priority delay stays within its duration. Missing or breached values inhibit the policy and open the breach Run; they cannot select strict starvation. |
| Projection rebuild | Named corpus with manifest, occurrence, Run, attempt and evidence counts plus canonical bytes; cold/warm mode; `maxProjectionRebuildDuration` and `maxProjectionRebuildMemory` | Equal-vector rebuild must be complete and byte-equal within both bounds. Timeout, partial data, divergence or bound overrun blocks the affected live projection and opens the breach Run while the fact spine remains authoritative. |

**Rule — contract-check inventory is complete and executable.** Rules 34, 36, 37, 69 and 91;
**checks: P15-NF-01/02**. The implementation test manifest must map every Rule block to at least
one check below and to its executed check-run record. P15-NF-01 through P15-NF-52 are distinct
contract checks. Shared traces may reuse one execution record when the manifest declares the
alias; duplicated labels cannot inflate coverage.

---

## 9. Negative contract fixtures

**Rule — every negative has a realistic positive neighbor.** Rules 26, 34, 36, 37 and 69;
**checks: P15-NF-01/02**. Each row is a future executable fixture at the named stage. The failure
must be refused or exposed, while the neighboring valid case must pass through the same public
ports. Synthetic fault timing is allowed for crash cuts; parser and adapter fixtures use real
captured bytes where their owner requires them.

| Identifier | Stage | Must refuse or expose; valid neighboring case |
|---|---|---|
| P15-NF-01 | build/architecture | New or duplicate core type, private import, missing owner; exact consumed-owner inventory and public ports pass |
| P15-NF-02 | build/governance | Rule, check, inherited duty or 1.x audit module unmapped; complete manifest with executed evidence still distinguished from declaration passes |
| P15-NF-03 | architecture/wiring | Clock, quota, lease, judgment, effect, verification or surface bypasses its owner; one assembled public-port path delegates to real implementations |
| P15-NF-04 | integration | Cron callback, locality or package signature treated as standing; authenticated tick plus current recorded system grant passes |
| P15-NF-05 | race/security | Grant, stop, role or ownership changes between tick and launch but cached approval launches; fresh reservation and dispatch checks accept unchanged sources |
| P15-NF-06 | contract | Spawn, queue, lease or receipt reported as business success; accepted terminal RunExit and outcome evidence report their narrow claims |
| P15-NF-07 | architecture | Provider-name branch or hardcoded path changes policy; replacement adapter with identical decoded values preserves decisions |
| P15-NF-08 | decode/build | Unknown field, missing bound, duplicate id or producer omits a required manifest field; closed canonical manifest round-trips through its consumer |
| P15-NF-09 | calendar/decode | Non-`cron-v1` syntax, invalid zone/version, ambiguous normalization or gap-mapping collision activates; valid five-field pinned expansion produces canonical instants |
| P15-NF-10 | package/lifecycle | Invalid single job stops all service or is silently excluded; affected job is refused and surfaced while independent jobs and minimal plane run |
| P15-NF-11 | build | Authority, budget, supervision or proof is hidden in prose/frontmatter outside the manifest; explicit owned references decode and bind the body digest |
| P15-NF-12 | isolation | Job inherits undeclared tool, secret, provider or filesystem power; assembled least-authority entry point receives only declared capabilities |
| P15-NF-13 | permutation | Peers with equal frontier but different `asOf` clocks are asserted equal, or equal complete inputs disagree for New York gap `2027-03-14 02:30` / fold `2027-11-07 01:30`; exact gap `07:30Z` missed identity and default fold `05:30Z` identity pass |
| P15-NF-14 | lifecycle | Future one-shot fires on boot, nonexistent wall time has no absolute identity, or missed tick disappears; only due absolute instant admits and every mapped missed instant gets a disposition |
| P15-NF-15 | lifecycle | One-shot fires again after restart, local timer deletion closes it or expired time proves delivery; same identity resolves the original intake receipt and terminal RunExit, while manual rerun has a new event |
| P15-NF-16 | package/race | Update rewrites past run contract or half-staged package activates; immutable old digest completes and fully committed future version begins at boundary |
| P15-NF-17 | security | User file masquerades as signed default, case collision wins by order or retirement deletes history; verified namespace and explicit conflict/retired state pass |
| P15-NF-18 | concurrency/multi-machine | Different discovery bytes enter canonical tick, same global instant creates two Run bindings, or every-machine scan collapses globally; shared route/bytes plus conditional binding yield one global Run, while two machine-scoped instances yield two local Results |
| P15-NF-19 | multi-machine | Peers expand different active definitions and choose by arrival time; one approved temporal boundary passes, conflict inhibits affected slot |
| P15-NF-20 | rebuild | Inhibited, paused or coalesced member disappears, a partial missed group moves membership, or all members are said to own Runs; fixed coverage resumes at first open member and links at most one catch-up Run |
| P15-NF-21 | fault/multi-machine | Crash between intake selection and Run creation, crash after creation before ack, lease expiry or takeover duplicates work; deterministic binding returns the same Run and observation precedes action |
| P15-NF-22 | rebuild/security | Run's own status or mutable last-run file overrides signed history; owner-derived fold at a pinned frontier passes |
| P15-NF-23 | fault/effect | Timeout, process death or changed provider retries, or accepted no-effect plus quiescence but unknown final billing permits invocation; only independently accepted non-occurrence, delayed-execution exclusion and final charge followed by settlement and fresh conditional admission permit one new attempt/operation/claim |
| P15-NF-24 | lifecycle | Timer/callback loss clears due debt or restart resets cursor; level-triggered scan reconstructs the same due set |
| P15-NF-25 | load/fairness | Missing share/delay/workload activates, dense schedule monopolizes scan or scan exceeds page budget; declared fair-round load meets maintenance share and high-priority-delay bars through the persistent cursor |
| P15-NF-26 | performance/rebuild | Missing duration/memory/corpus bound activates, full-history scan runs on every tick, cache is unbounded or target is called measured; complete equal-vector rebuild meets both recorded bounds on named corpus/hardware |
| P15-NF-27 | lifecycle | Never-run job is assumed overdue or long outage launches every missed execution; activation boundary plus approved coalesced catch-up passes |
| P15-NF-28 | package/race | Schedule edit retroactively creates/removes occurrences; old named slots persist and only future unnamed slots use new package |
| P15-NF-29 | measurement | Missing/stale/corrupt/out-of-range quota becomes zero or target percent becomes actual use; fresh subject-bound evidence and explicit unknown pass |
| P15-NF-30 | integration/accounting | Reservation absent, wrong account/window, cap exceeded or use uncharged; exact candidate allocation and settlement update pass |
| P15-NF-31 | load | Known short-window wall launches, unknown model quota silently proceeds or capacity Result is called business failure/success; approved scoped inhibition, open obligation and honest control Result pass |
| P15-NF-32 | integration | Brake allows candidate placement rejects, or placement selects unassessed account; one shared eligible candidate set launches |
| P15-NF-33 | placement | Hard pin or critical priority defeats wall/cap/standing; preferred eligible target passes and blocked preference records capacity Result |
| P15-NF-34 | contract | Framework without usage surface appears healthiest or uses unlimited exposure; labelled unobservable finite exposure and settlement pass |
| P15-NF-35 | reroute | Observer move changes original mapping, or changed provider/input reuses the attempt/operation; read-only observation preserves both, while a settled predecessor permits full destination re-resolution plus a new linked attempt, operation, reservation and claim |
| P15-NF-36 | multi-machine | Demoted/stale worker launches, two claim systems operate or actual route differs from report; current fence and recorded destination pass |
| P15-NF-37 | concurrency/load | Zero cap defaults positive, slot reserves after spawn, fair share fails, or full queue drops/terminates admitted work; pre-launch finite reservation plus capacity Result leaves the Run owned and waiting |
| P15-NF-38 | accounting/fault | Process exit frees uncertain slot or dropped queue lacks disposition; accepted closure releases once and unresolved exposure stays charged |
| P15-NF-39 | load/security | Priority widens authority, budget or bypasses stop/supervision; priority only orders otherwise eligible requests |
| P15-NF-40 | contract/isolation | Free-form shell gate, command-prefix classification or arbitrary exit convention runs; registered exact programmatic operation returns typed Result |
| P15-NF-41 | integration | No-work is failure, inspection failure is no-work or preflight output lacks provenance; same probe distinguishes all three with evidence |
| P15-NF-42 | build/wiring | Critical step lacks supervision or named plan is null/no-op; every declared boundary has real part-seven request/resolution wiring |
| P15-NF-43 | judgment | Supervisor unavailable downgrades to raw, wrong floor passes or model approves its own call; declared scoped failure direction and finite bootstrap pass |
| P15-NF-44 | contract | Supervisor output for another step/digest authorizes progress or fluency proves outcome; exact bound resolution plus independent verification passes |
| P15-NF-45 | lifecycle | Worker/session death loses Run, handoff prose supplies authority, or learning receipt closes work without its Result; durable Run resumes and owner-accepted business/learning results advance their declared steps |
| P15-NF-46 | fault | Restart, new machine, cron window or manual trigger resets attempts/backoff; same durable loop exhausts at original bound |
| P15-NF-47 | lifecycle | Breaker counts no-work/capacity inhibition as crash, resets on reroute, or repeated successful model spawns followed by failed completions remain at failure one; accepted completion outcomes drive one script/model-common persistent episode over the declared `N`-outcome window |
| P15-NF-48 | lifecycle/reporting | Open breaker deletes due ticks, edits manifest off or silently suppresses critical job; paused runs remain visible and approved essential fail direction holds |
| P15-NF-49 | load/notification | Every failure sends, broken sink marks delivered or job pause disables diagnosis; one bounded episode, visible unsent record and reserved repair path pass |
| P15-NF-50 | surface/measurement | Projection trusts self-report, omits dispositions, claims configured target measured or hides missing samples; signed-source reconstruction and complete measured population pass |
| P15-NF-51 | compatibility/lifecycle | 1.x import keeps two authorities, drops invalid entry/history, loses IntegrationGate behavior, or maps unsafe `perMachineIndependent` work to global/every-machine execution; one-way explicit mappings, preserved source bytes and surfaced inhibited residue pass |
| P15-NF-52 | activation/e2e | Missing prerequisite seam, manifest existence, mocks, process heartbeat or successful-only Run declares live; real production assembly challenge crosses scheduled-system intake, binding, lease, Run, supervision, result and independent witness |

---

## 10. Inherited duties and disposition

**Rule — no inherited duty is redefined or left ownerless.** Rules 8, 49, 69, 71 and 114;
**checks: P15-NF-01/02/03/52**. The rows below state this package's consumer obligation. Earlier
parts retain their types, meanings and producers.

| Source duty | Disposition in part fifteen |
|---|---|
| Part four — scheduled tick intake and system standing | **Held at the consumer contract, pending the named seam:** shared authenticated ingress, canonical tick bytes, separate discovery testimony, current grant and preserved admission/refusal, P15-NF-04/05/18/21. Four retains classification, dedup and admission. |
| Part five — durable work and session independence | **Held, with deliberate coalescing:** each occurrence selected for execution resolves to one durable Run; nonexecuted missed members resolve through six's requested coverage record, and one group may share one catch-up Run. Runs retain exit, budget, grounding and result destination; P15-NF-20–22/45. Five retains progression and closure, pending the section-1 closure seam where an unavailable/cancelled arm is needed. |
| Part six — periodic loop, leases, recovery and spend | **Held at the requested seam:** level-triggered scan, coalesced wake, coverage record, cursor, parent budget, conditional reservation, fencing, fresh-attempt mapping and breaker use six's contracts, P15-NF-21/23–25/30/37–38/46–48. The landed selection-only cursor remains unchanged; no scheduler-owned retry engine remains. |
| Part seven — critical-pipeline supervision and learning | **Held at the package mapping:** three manifest levels resolve to registered plans/floors with exact attempt evidence and no recursive approval; post-completion learning uses a distinct bounded judgment step and Result, P15-NF-42–45. Seven owns judgments, attempts and provider receipts. |
| Part eight — scheduled effects and notification | **Held at the caller contract:** observation preserves the original operation; a permitted fresh invocation uses a new settled attempt/operation; final-charge settlement and attributable bounded alert delivery remain with eight, P15-NF-23/35/38/49. |
| Part nine — scheduler holder and outcomes | **Held:** live scheduler, calendar, breaker, supervision and reporting arms require fresh independent challenge evidence; stale proof never remains green, P15-NF-24/42/47/50/52. Nine owns assessment and grade. |
| Part ten — packages, adapters and assembly | **Held:** closed signed manifest, atomic activation, namespace separation, compatibility import, isolation and real port wiring, P15-NF-03/07–12/16–17/51–52. Ten owns the executable assembly. |
| Part eleven — operator visibility and verified actions | **Held at the projection contract:** complete occurrence dispositions, actual route/cost, breaker state, stale holder proof, verified enable/disable/manual-run actions and quiet aggregate alerts, P15-NF-15/20/48–50. Eleven owns presentation and verified human input. |
| 1.x `perMachineIndependent` | **Preserved explicitly:** safe machine-local jobs expand into registered per-target instances with one Result each; shared effects stay global-once, P15-NF-18/36/51. |
| 1.x `IntegrationGate` | **Preserved explicitly:** opt-in reflection, recorded learning, blocker derivation and bounded queue progression use section 5's owned step; opt-out remains an explicit skip, P15-NF-42/44/45/50/51. |
| Rule 38 — model supervision over critical steps | **Held:** tier mapping plus real per-step part-seven evidence and scoped unavailable behavior, P15-NF-42–44. Semantic adequacy stays judged and graded by nine. |
| Rules 40 and 60 — capacity is success and work has resource limits | **Held:** a capacity control Result is honest but cannot close unfinished business; admission is source-aware and all queues, attempts, reservations and exposures are finite, P15-NF-29–39/46. |
| Rules 41, 42 and 89 — observable intelligence, refusal preservation and provenance | **Held:** every occurrence and supervision/effect stage keeps its narrow Result, evidence and actual route; no silent drop or false completion, P15-NF-06/20/31/41/44/50. |
| Rule 111 — layer-below audit | **Held:** section 7 names audited 1.x modules, earned incidents, preserved guarantees, core re-expression and forbidden mistakes; P15-NF-02/51. |

---

## 11. Operator decisions and honest limits

**Value — operator decision: missed-work policy.** Should a recurring job that missed several
instants execute once for the latest missed group or record all as missed without execution?
Options are `latest` and `none`; both retain one durable disposition per occurrence. The
recommendation is `latest` for maintenance and observation jobs, with `none` required for
time-sensitive sends or effects whose usefulness expires.

**Value — operator decision: local-time behavior.** Should repeated local wall times choose the
earlier instant, the later instant, or create both occurrences? The recommendation is the earlier
instant, paired with a visible missed disposition for nonexistent wall times. It best matches the
ordinary meaning of one daily calendar duty while keeping behavior deterministic.

**Value — operator decision: unknown-quota posture.** Should ordinary model jobs with unknown but
not known-exhausted quota inhibit only low priority, inhibit low and medium, or refuse all new model
work? The recommendation is to inhibit low priority, retain finite exposure for medium and high work,
and require separate evidenced reserve for critical work. Known short-window walls always refuse.

**Value — operator decision: fairness envelope.** Which compliant outcome should the fixed weighted
deficit-round-robin and bounded-aging mechanism target under the declared saturation workload?
Option A guarantees maintenance at least 10 percent of eligible admissions and limits added delay
for ready critical work to 30 seconds. Option B uses 20 percent and 60 seconds. Option C uses
25 percent and 120 seconds. The recommendation is B: it gives maintenance a meaningful floor
without presenting starvation or an unbounded delay as an admissible policy.

**Value — operator decision: breaker recovery.** Should an opened job breaker recover only after
verified operator action, or allow one bounded half-open probe after its cool-down? The
recommendation is a single half-open probe for reversible and observation-only jobs, and verified
operator action for irreversible or authority-changing jobs. Neither option suppresses due-tick
accounting or diagnosis.

**Value — operator decision: compatibility horizon.** Should 1.x job definitions remain readable
for one release train, two release trains, or indefinitely? The recommendation is two release
trains with a one-way importer, preserved source bytes, an explicit residue report, and no dual
runtime authority. Indefinite live compatibility would preserve the split-brain manifest and
claim mistakes this design removes.

**Value — honest limits and costs.** Calendar correctness still depends on the selected time-zone
data and clock source. Exactly-once scheduling cannot prove exactly-once external effects. A total
loss of the required durable fact replicas can lose obligations within the declared loss model.
Opaque providers can leave quota, charge, or execution unresolved. Strong fencing and source-aware
capacity reduce availability during partitions and telemetry outages. Complete occurrence history,
independent probes, model supervision and retained uncertainty consume storage, latency and money.
No check decides that those costs are worthwhile for every installation.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90
and 109; **checks: P15-NF-02/52** and the governed review process. This document claims no
deployment, live holder, measured performance, review convergence or operator approval.
Implementation becomes eligible only after this exact design independently converges and the
operator records approval. Implementation does not itself establish a live claim. Activation and
runtime certification then require section 8's real unit, full-port integration, multi-machine,
fault-cut, load, isolation, semantic-review and production-lifecycle evidence. Approval is separate
from both technical construction and live evidence.

*Depends on: Part one — constitutional values; Part two — the fact envelope; Part three — the
register; Part four — intake; Part five — the durable run graph; Part six — transport, leases,
loops and recovery; Part seven — the judgment doorway; Part eight — the effect doorway; Part nine
— verification holders; Part ten — assembly; Part eleven — operator surfaces.*
