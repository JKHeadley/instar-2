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
holder package means the current Part Ten `LocalCapabilityPackage`, its exact `declarationIds`,
the referenced `VerificationPlan` instances and their executable bindings. It is not a register
kind or a new persisted core schema. Earlier parts own every consumed type.

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
| Ten — assembly | `AssemblyManifest`, `AssemblyAdmission`, `LocalCapabilityPackage`, `PackageTransition`, public adapter seams, confinement, production wiring and a hostile-cut harness (a test driver that stops the responsible process between adjacent durable steps and reconstructs from owned history); the complete worktree observation consumed here is the conditionally granted read-only worktree-observation operation in `seam-response-assembly-followup.md`, ledger #50, and is not landed |
| Eleven — operator surfaces | authenticated pull views, the minimal plane, bounded notices and operator action surfaces; the real guard-and-repair pull operation is granted in `seam-response-operator-followup.md`, with its Part Ten production wiring granted in `seam-response-assembly-followup.md`, ledger #51, and neither is landed |

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
43, 49, 59, 69 and 78; **checks: P14-NF-05–09/12–15/22/37/38/58–67**. Each row becomes one or more
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
| Orphaned-work holder | `runtime`, `probe`, `retrospective` | Did a worker die after leaving unregistered work in a dirty worktree that has since settled? | conditionally granted ledger-#50 Part Ten worktree-observation snapshot with exact dirty/lock/session state and full settle-window activity coverage, one complete fresh Part Ten process-inventory snapshot with affirmative ownership/directory exclusion, and later reconciliation disposition |
| Clean-worktree reclamation holder | `runtime`, `probe`, `retrospective` | Is a clean, merged and unused checkout safe to reclaim without losing work or racing a new user? | conditionally granted ledger-#50 Part Ten worktree-observation snapshot with current branch/head, clean and merge state, lock/session/build-marker observations and activity history; complete process ownership/directory exclusion; action-time worktree re-observation; and later effect settlement |
| Framework-prompt holder | `probe`, `sentinel`, `retrospective` | Is a worker stranded on a harness approval menu even though the exact underlying operation is already admitted, or is real authorization still missing? | current operation admission and authorization, exact worker/presentation capture, bounded re-observation and later menu/consumption observation |
| Context-wedge sentinel | `build` (parser fixture), `probe`, `sentinel` | Do repeated adapter errors establish a non-resumable conversation context rather than a one-off refusal? | real captured adapter bytes, exact session/incarnation and independent re-challenge result |
| Compaction sentinel | `runtime`, `probe`, `retrospective` | Did a compaction preserve and account for the last inbound message and re-ground the worker? | part-five grounding and continuity records, exact inbound id and worker-consumption witness |
| Presence holder | `runtime`, `sentinel`, `retrospective` | Has admitted user input lacked an attributable response or honest bounded status while work remains owned? | intake fact, outbound settlement, run progress and speaker authority re-resolved at use |
| Promise holder | `runtime`, `probe`, `retrospective` | Does an agent-owned open commitment have current progress, a valid blocker probe, or a bounded revival path? | durable run/commitment source, due obligation, probe evidence and terminal disposition |
| Dated check-in reminder holder | `runtime`, `probe`, `retrospective` | Has an open agent-owned obligation reached its exact absolute check-in instant without an already-settled reminder or terminal closure? | requested Part Five dated-reminder item and closure state, actual clock observation, exact reminder effect identity and Part Eight observation/settlement |
| Crash-loop holder | `runtime`, `retrospective` | Does one operation class repeatedly fail under a pinned population strongly enough to propose a pause? | complete attempt population, duration/outcome facts and part-seven classification |
| Budget-overrun holder | `runtime`, `probe`, `retrospective` | Has a current autonomous run crossed its governed safety ceiling strongly enough to halt new work without declaring the assignment finished? | current run/budget/head, consecutive current due observations, Part Five halt and Part Six admission state |
| Moving-worker silence holder | `runtime`, `sentinel`, `retrospective` | Is a current autonomous run still producing observed worker output but missing its attributable user-report cadence even without new inbound input or an open promise? | current run/cadence, last attributable outbound, shared output-change observation and one-voice ownership (the one current, re-resolved authority allowed to speak for that conversation) |
| Session reaper | `build`, `probe`, `retrospective` | Is a named worker disposable now without ending work, breaking reachability or widening exposure? | affirmative ready/idle evidence, sustained unchanged candidacy, a separate reap-pending grace observation, live run/lease/delegation/commitment state, measured hardware pressure, fresh full pre-effect evaluation and action-time identity |
| Process-population reaper | `build`, `probe`, `retrospective` | Does the complete current-user process population contain an old ownerless Instar command-line interface (CLI) process or leaked/reparented allowlisted Model Context Protocol (MCP) descendant that is disposable without touching live owned or external terminal sessions? | complete Part Ten process inventory, ancestry and session/worker ownership joins, then separate action-time identity |
| Guard-posture tripwire | `build`, `runtime`, `probe`, `retrospective` | Is every required arm actually executing and independently witnessed at its current generation? | part-nine source observations, check/probe records, assembly inventory and external freshness witness |

**Rule — enrollment and activation have an exact source projection.** Rules 5, 26, 42, 43, 45,
49, 69, 73 and 95; **checks: P14-NF-05/09/16–23/48–50/58**. At one pinned part-two source vector,
the projector first resolves the current Part Ten `LocalCapabilityPackage` by its exact namespace,
version and content digest. It then resolves the package selected by the current
`AssemblyManifest` and `PackageTransition`. Only the declaration identifiers in that package's
closed `declarationIds` list are members. A missing, extra, conflicting, partial or stale package
reference makes enrollment incomplete. No `requiredFacts` field is treated as package membership.

The feature declaration and the rule-holding declarations have separate jobs. An exact feature id
in `declarationIds` enrolls the package feature for its metrics and rollout gate. A feature is not a
holder, supplies an empty `holds` list and never becomes a `VerificationPlan.subject.holder`.
An exact sentinel id in `declarationIds` enrolls one rule holder. Its `Declaration.status` is
`live`, `dark`, `soaking`, or `retired`. Its `Declaration.holds` supplies the rule edges. Its
`requiredFacts.freshnessProbe`, `scope` (`live` or `retrospective`), `authority` (`signal` or
`block`) and, for live scope, `irreversibleMoment`, retain Part Three's meanings.

A current `VerificationPlan` enrolls one sentinel declaration only when
`VerificationPlan.subject.holder` equals that declaration id and its `subject.generation` is the
current register generation. Every required `arms[].id` must be present. Execution comes only from
`ProbeRecord.plan` plus `ProbeRecord.arm`. Freshness and protection come from the matching
`GuardPostureView.plan` and per-arm posture, never from the plan's `activation` test-evidence lists.
These two declaration examples use only fields admitted by the landed Part Three decoder. The
package's `declarationIds` contains both exact ids and the declaration ids for the two named bounds
referenced below.
`sentinel-holders.package-loop-policy` is the registered Part Six `LoopPolicy` that limits the
package-wide due scan and action budget. `sentinel-holders.guard-posture.loop-policy` is the
registered Part Six `LoopPolicy` named by every guard-posture plan's
`VerificationPlan.scheduling.loopPolicy`. Each bound declaration is paired with that actual
construct and its live probe. A different scheduling policy, an unresolved bound, or a declared
bound with no paired executable makes enrollment incomplete under P14-NF-58.

```json
{
  "type": "Declaration", "schemaVersion": 1,
  "id": "sentinel-holders-package", "kind": "features", "status": "soaking",
  "requiredFacts": {
    "metrics": ["sentinel-holder.instances", "sentinel-holder.gaps"],
    "gate": {"test": "P14-NF-50", "deadline": 1798761600000}
  },
  "profile": {
    "type": "Profile", "schemaVersion": 1, "consequence": "control",
    "reversibility": "reversible", "reach": "internal", "surface": "none",
    "repeats": {"kind": "bounded", "by": "sentinel-holders.package-loop-policy"}
  },
  "standards": [9, 39, 43, 59, 73], "holds": []
}
```

```json
{
  "type": "Declaration", "schemaVersion": 1,
  "id": "sentinel-holders.guard-posture", "kind": "sentinels", "status": "soaking",
  "requiredFacts": {
    "freshnessProbe": "sentinel-holders.guard-posture.probe",
    "scope": "live", "authority": "signal",
    "irreversibleMoment": "before any recovery effect is admitted"
  },
  "profile": {
    "type": "Profile", "schemaVersion": 1, "consequence": "control",
    "reversibility": "reversible", "reach": "agent", "surface": "dashboard",
    "repeats": {"kind": "bounded", "by": "sentinel-holders.guard-posture.loop-policy"}
  },
  "standards": [9, 26, 43, 59, 69, 73],
  "holds": [
    {"rule": 9, "class": "deferred", "part": 14, "ceiling": 1798761600000,
     "owner": "sentinel-holders", "overdueAction": "keep the package divergent"}
  ]
}
```

The production instance population must be derived from part-ten assembly facts. Each production
instance has its own `VerificationPlan.id` and its own canonical
`VerificationPlan.subject.governed`, including the machine/deployment and runtime-incarnation
identity selected by its binding. No plan may cover two production instances. The binding must
match its instance, plan id, holder id and governed subject before a `ProbeRecord.subject` can be
joined. Because the landed Part Nine runtime already checks `ProbeRecord.subject` against
`plan.subject.governed`, this one-plan-per-instance rule prevents one machine's pass from confirming
a sibling machine.

The landed
`AssemblyManifest.publicPorts` and scope-wide `AssemblyAdmission` cannot identify a holder, plan,
arm, instance, observation/effect mode, or operation. Part fourteen therefore depends on the
additive Part Ten holder-binding and binding-admission records requested in
`.instar/lanes/design-sentinel-holders-seam-request-assembly.md`, request
`P14-P10-holder-bindings-and-drivers-v2`. A binding is
**observation-only** only when that record says `mode: observation` and carries no part-eight
operation; it is **effect-capable** only when `mode: effect` references a current registered
`OperationDefinition`. Its runtime state comes from the current binding admission. A missing,
conflicting, partial, or stale binding makes the required population incomplete and therefore
`diverged`; no arm kind or executable name is used to guess the mode. The request also requires the
binding's plan id and governed subject to equal the per-instance plan before posture is consumed.
That request is GRANTED in `seam-response-assembly-followup.md`, ledger #9, but is not landed.
P14-NF-05/16–23/31–36/39/42/44–54/58–67 are **non-executable until
`seam-response-assembly-followup.md` lands** wherever their positive requires owner-decoded
production bindings or drivers. Until the seam lands and its production bindings pass
P14-NF-49/50, no package instance is eligible for `on-confirmed`.

The package feature and guard-posture sentinel are recurring services, so `repeats: no` would be
false even if their decoders accepted it. `repeats: no` is reserved for a genuinely single-action
feature. P14-NF-58 compares each recurring declaration's bound with the exact current plan schedule,
registered Part Six loop policy, package-wide parent budget and production binding.

**Rule — signal and authority remain separate.** Rules 4, 10, 12, 38, 42, 57, 67 and 86;
**checks: P14-NF-10–12/18/21/23/26/29**. Regexes, elapsed-time thresholds, unchanged terminal
frames, process names, adapter text, config differences and resource readings may raise a signal.
They do not decide a person's meaning, establish a semantic wedge, prove a worker is stuck, or
authorize recovery. Exact structural invariants may enforce recorded governed state. Other
classification goes through part seven with the relevant full context, explicit allowed outcomes
and a conservative fail direction. An unavailable judgment provider swaps through the registered
doorway or leaves the case unresolved; it never falls back to a keyword verdict.

The landed Seven contract records judgment requests and resolutions, but its reference executor is
not a landed Eight-admitted provider call. Live semantic classification therefore depends on the
GRANTED ledger #23 pair: `seam-response-judgment.md` supplies Seven's provider preparation and
receipt operations, and `seam-response-effects-followup.md` supplies the matching Eight
`provider-call` payload and executor path. Pure signal extraction, recorded-history joins and
conservative unresolved/refusal decisions remain executable. The live semantic positive neighbors
of P14-NF-11/40/55, and their P14-NF-49/50 production wiring/lifecycle evidence, are
**non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land**. A package must not call Seven's reference executor
directly or report model-backed classification on this HEAD.

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

**Rule — enrollment, protection obligations and required execution are separate populations.**
Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–21/54**. The enrolled population is
the complete package, declaration, per-instance plan and binding join in section 2. It does not
shrink when execution is deliberately inhibited.

At the same pinned source vector, the **protection-obligation population** is derived independently
from current Part Three critical-outcome declarations and their `requiredFacts.probe` references,
plus the current holder declarations' `holds` edges. Those registered relationships are joined to
the exact `VerificationPlan.subject.rules`, holder, governed subject, required arm and production
instance. Each row names the critical outcome, rule, holder, plan, raw Part Nine arm and instance.
It remains required until the critical outcome or holder relationship is retired or superseded in
signed history. A `dark`, `retired`, inhibited or unbound execution state does not delete it. A
missing join is itself a protection gap, never a smaller denominator.

The currently required execution population is derived separately for each enrolled instance. For
`live`, it contains every required observation and effect arm. For `soaking`, it contains every
required observation arm and any effect arm whose binding admission says it is currently intended
active; a deliberately inhibited effect arm remains enrolled but is not treated as if it executed.
For `dark` or `retired`, it is empty only while fresh independent assembly evidence proves every
binding deliberately inhibited or retired for that declaration state and no later execution
occurred. Missing, stale, conflicting or unexpected inhibition evidence never shrinks the required
execution population or the independently derived protection-obligation population.

**Rule — the operator-facing family view uses exactly four labels without replacing part nine's
posture.** Rules 13, 26, 33, 42, 43, 69, 73 and 95; **checks: P14-NF-16–20/54**. A Part Two
projection first folds only admitted facts and the pinned register generation. That facts-only fold
derives enrollment, protection-obligation and required-execution populations plus the source
references needed by the consumer. It never reads or stores `GuardPostureView`, another projection,
or a clock.

At consumption time, the family query takes an explicit evaluation clock and calls Nine's public
`VerificationRuntimePort.posture(plan, clock)` resolver for each exact current plan against the same
pinned source snapshot. If the facts-only fold and Nine resolver cannot prove the same source vector
and generation, the query refuses the comparison as `diverged` rather than mixing horizons. It then
renders the four labels from the folded populations, current binding observations and Nine's
clock-evaluated raw per-arm posture. This rendering is not a new authority or stored truth. For each
enrolled instance it applies the rows below in order and stops at the first match. Raw posture,
missing arms, binding admissions, declaration facts, evaluation clock and evidence references
remain visible.

| Label | Derivation |
|---|---|
| `diverged` — precedence 1 | Enrollment is empty or incomplete; sources conflict; a binding disagrees with its declaration, intended mode, plan, governed subject or runtime; a claimed inhibition lacks fresh independent evidence; or any arm in the currently required execution population is missing, never run, stale, failed, inconclusive, errored, unknown, wrong-generation or unwitnessed. A fresh failed required observation reaches this row. Unexpected inhibition or activation also reaches this row. |
| `off` — precedence 2 | The declaration is `dark` or `retired`; enrollment is complete; fresh independent evidence proves every binding deliberately `inhibited` or `retired` for that exact current declaration and admission generation; no later execution is observed; and precedence 1 did not match. No execution arm is required merely to prove it did not run. Off is current evidenced inactivity, never protection. |
| `dry-run` — precedence 3 | The declaration is `soaking`; every required observation binding is active and has fresh passing independent evidence; every effect binding is accounted for; at least one effect binding is deliberately inhibited by a current admission matching the declared soak; every effect binding intended active has fresh passing independent evidence; and precedence 1 did not match. A never-executed deliberately inhibited effect arm does not defeat this label. No prevented effect is claimed. Zero effect inhibitions cannot produce this label. |
| `on-confirmed` — precedence 4 | The declaration is `live` or `soaking`; every required binding is intended active and active in production; every required arm has a fresh passing result for that per-instance plan and independent witness; no effect binding is inhibited; and precedence 1 did not match. |

**Rule — family aggregation is ordered and mutually exclusive.** Rules 26, 33, 42, 43, 59, 69
and 73; **checks: P14-NF-19–22/48/54**. First, an empty/incomplete enrolled-instance population or
any `diverged` instance makes the family `diverged`. Second, all enrolled instances `off` makes it
`off`. Third, if every enrolled instance is `dry-run` or `on-confirmed` and at least one is
`dry-run`, the family is `dry-run`. Fourth, all enrolled instances `on-confirmed` makes it
`on-confirmed`. Every
other mixture, including `off` mixed with an active state, is `diverged`. One green arm therefore
cannot paint siblings green. A complete population count travels separately from any bounded list
so truncation cannot resemble an all-clear.

The aggregation is evaluated within that same consumption-time query and evaluation clock. It is
not appended to the facts-only fold.

**Rule — load-bearing gaps are explicit owned findings.** Rules 8, 15, 43, 64, 68, 71, 73 and
87; **checks: P14-NF-21–24/54**. For every protection-obligation row, the consumption-time query reads the raw
Part Nine arm posture without changing its meaning. An obligation is satisfied only when all three
facts join at the same current source vector: the exact binding is intended active and independently
observed active for this holder, plan, arm, instance and generation; the raw Part Nine arm is
`healthy`; and that posture is backed by exact current-generation fresh independent evidence. A
binding is not current active when its admission is inhibited, retired, missing, conflicting, stale,
for another generation or contradicted by runtime observation. Such a binding retains a gap even
while an earlier independent pass is fresh and Nine therefore still reports raw `healthy`.
`failed`, `stale`, `unknown` and `inactive` also expose a load-bearing gap; missing arm or instance
joins expose a gap as well. The four-state package label is displayed beside the gap but is never
compared as if it were an arm posture. An intentionally `off` instance whose critical-outcome
relationship still exists therefore retains its obligation and its gap even though its required
execution population is empty. A required never-run arm remains raw `unknown` under Nine; Fourteen
does not relabel it `inactive`. `dry-run` and `diverged` instances likewise expose their unsatisfied
obligations. The finding names the affected rule/outcome, instance, raw arm posture, binding
admission and observation, first observed source vector, current evidence, owner, safe fail direction
and next due assessment.
Activation policy may permit a bounded soak—an owner- and deadline-bound observation period in
which selected effects remain inhibited while their gap stays visible—or an explicit accepted risk,
but neither relabels the gap as protected. The pull surface shows all gaps. A push notice is a
part-eight effect and follows section 8.

---

## 4. The silently-stopped matrix

**Rule — harness onboarding supplies the complete stop-mode matrix.** Rules 30, 34, 36, 43, 59,
64, 68, 69 and 115; **checks: P14-NF-25–30/56/57**. The part-ten adapter registration cannot complete
until every row below names a detector arm, an evidence bar, recovery owner, safe failure direction,
real captured fixtures and an end-to-end positive neighbor. An adapter may add rows. It may not
delete the common rows or claim coverage from another harness's parser.

| Stop mode | Evidence required before classification | Recovery owner and safe direction |
|---|---|---|
| Launch rejected or worker never consumes input | admitted intake plus absent exact-incarnation consumption after bounded observation; adapter launch receipt alone is insufficient | five keeps the run owned; six schedules bounded recovery; reachability remains open |
| Input buffered, relay disconnected or delivery uncertain | exact intake/effect identity, adapter observation, unresolved consumption/settlement and a captured prompt presentation distinguishing authentic pending input from model-suggested ghost text | eight reconciles occurrence; only the requested typed `submit-authentic-pending-input` action may deliver it; no blind reinjection and no input submission when prompt evidence is ghost or inconclusive |
| Missing human authorization, credential or operator action | live frame plus typed run blocker and current authorization state | five records the real blocker; silence never becomes consent |
| Harness approval prompt for an already-admitted exact operation | live frame, exact operation/admission/authorization, a captured real menu, one-operation option identity and a fresh same-presentation re-observation | eight may request only ledger #41's `worker-input` action `approval-prompt-response` for the exact allow-once member, through ten's confined driver; blanket, ambiguous, persistent or unrecognized menus remain untouched and visible |
| Bounded external wait | declared wait subject/deadline, live process identity and progress evidence | loop remains active within its policy; timer alone cannot interrupt |
| Provider unavailable, rate-limited or account unusable | typed adapter refusal, current doorway/account observations and any concurrent compaction-recovery ownership | six owns one bounded backoff episode; seven/eight select only registered alternatives; the requested typed `neutral-continuation` action is distinct from compaction recovery and refusal stays refusal |
| Worker exits, disconnects or a process identifier (`PID`) is reused | exact session/incarnation/lease and action-time process identity | six recovers the run; a stale process identifier cannot be signaled |
| Worker alive without attributable progress | unchanged evidence plus exclusion of active tool, helper, known wait, idle-complete and recent durable progress | seven classifies within declared outcomes; unresolved stays visible |
| Delegated helper stalls or fails | live child edge, child run/lease facts, result destination and parent accounting | parent run owns retry through the parent run or closure; helper event never becomes completion |
| Context becomes non-resumable | repeated real adapter error capture, same context/incarnation and independent challenge | fresh grounded worker proposed through eight; corrupt context is never resumed |
| Compaction loses continuity | exact last inbound id absent from grounding/continuity accounting or post-compaction consumption | five retains work and requires truthful re-grounding; output growth is insufficient |
| Stop, fence, lease, capacity or hardware loss | source facts from their owners and named-hardware measurement | six reassigns or recovers within budget; session event cannot close the run |
| Malformed, delayed or misleading output | captured bytes, parser result, provenance and independent outcome witness | parser signal plus judgment as needed; no unsupported success claim |

The landed Part Five run graph admits only root depth, rejects nonempty grounding children and has
no `DelegationContract` or `DelegationResult`. The delegation and visible-child accounting in
`seam-response-rungraph-followup.md`, ledger #24, is GRANTED but not landed. P14-NF-25/28/31–36/
49/50/59 are **non-executable until `seam-response-rungraph-followup.md` lands** wherever the
positive requires a real child run, delegation edge or parent accounting. The package may not
simulate child facts or replace them with helper events.

**Rule — prompt recovery distinguishes authorization from harness obstruction.** Rules 4, 26, 29,
42, 57, 63, 86, 95, 98 and 103; **checks: P14-NF-25/28/42/49/50/56/62**. A missing human
authorization remains an owned Part Five blocker, and no menu or silence supplies consent. When
the underlying exact operation already has current admitted standing, a harness prompt may still
strand the worker. The holder re-resolves that operation, standing, scope and current one-use
claim. It may then request only Part Eight's GRANTED `worker-input` action
`approval-prompt-response`, ledger #41 in `seam-response-effects-followup.md`. That action binds the
existing authorized exact call, Ten's signed prompt observation with prompt-text and menu digests,
the current worker and incarnation, the selected allow-once menu member, the immutable payload
digest and a one-use claim. Part Ten's matching confined driver in
`seam-response-assembly-followup.md` re-observes those identities and digests immediately before it
presses that one menu key. The 1.x assumption that an operator-owned full-access session authorizes
every framework prompt is rejected. A blanket, scope-widening, ambiguous, persistent or
unrecognized menu receives no automatic input and remains visible with its bounded attempt history.
P14-NF-62 is **non-executable until `seam-response-effects-followup.md` and
`seam-response-assembly-followup.md` land**.

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
**checks: P14-NF-31–35/57**. The obligation binds the pre-compaction last inbound message id, source
vector and open run steps. Success requires a recorded post-compaction grounding step, actual clock
read, accounting for that exact inbound message, worker consumption and a continuing durable run.
Transcript byte growth, a changed frame, a spinner, a new process, a recovery injection or a
generic response proves none of those predicates. A finished run is not injected. An active worker
is not interrupted merely because a timer expired. The same logical recovery episode deduplicates
all triggers. A provider-throttle recovery and compaction recovery for the same worker share a
Part Six exclusion key. While either recovery is active, the other defers and reaping is vetoed.
After the governed backoff, a throttle recovery may request only its typed neutral continuation;
it cannot reuse a compaction-resume payload or claim continuity from transcript growth.

The landed Part Five slice cannot record this exact post-compaction accounting:
`SessionGrounding.reason` admits only `start`, `recovery` and `resume`, child accounting must be
empty, and `ContinuityAccounting` is absent. The owner-designed record is GRANTED through
`seam-response-run-closure.md`, and its compaction grounding, visible-child and public first-reply
consumer are GRANTED through `seam-response-rungraph-followup.md`, ledger #8/#24. Part Eight's
required consumption of that owner record before the first post-compaction reply is GRANTED in
`seam-response-effects-followup.md`, ledger #8. P14-NF-31–33 are **non-executable until
`seam-response-run-closure.md`, `seam-response-rungraph-followup.md` and
`seam-response-effects-followup.md` land** wherever their positive requires those records or the
first-reply consumer. The positive must use Five's first-reply disclosure and dispose of the exact
pre-pause inbound as `addressed`, `superseded` or `pending`. Generic activity evidence cannot
substitute for that owner-issued accounting.

The landed Part Eight/Ten contracts cannot express any of the three worker-input actions used by
P14-NF-33/56/57. Part fourteen therefore depends on
`.instar/lanes/design-sentinel-holders-seam-request-worker-input.md`, request
`P14-P8-P10-typed-worker-input-v1`. It requests owner-defined `neutral-continuation`,
`recovery-injection` and `submit-authentic-pending-input` payload actions plus confined Part Ten
drivers. Each binds the exact worker, machine, harness, session/pane, process incarnation, execution
context, run/step, recovery class and episode, input identity/digest, source generation, fresh
presentation evidence, one-use claim and consumption-evidence bar. One unresolved effect exists per
worker/context/input/episode. A lost receipt permits observation only. A retry needs decisive
non-occurrence, **quiescence**—evidence that the prior executor can no longer perform the
operation—and delayed-delivery exclusion. This request is GRANTED in
`seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, ledger #21, but is
not landed. P14-NF-33/56/57 are **non-executable until `seam-response-effects-followup.md` and
`seam-response-assembly-followup.md` land** wherever their positive requires worker delivery.

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

Fourteen can produce the facts-only fold, consumption-time query and bounded view data behind that
pull claim. The authenticated Eleven consumer and its production assembly binding are absent from
this pinned checkout. The owner-decoded guard-and-repair pull operation is GRANTED but unlanded in
`seam-response-operator-followup.md`, ledger #51. Its Part Ten production-composition and admission
wiring is GRANTED but unlanded in `seam-response-assembly-followup.md`, ledger #51.
P14-NF-20/22/24/37–39/48–50/55/59–67 are **non-executable until both grant files land** wherever
their positive claims real Eleven rendering, reachability or production wiring.
Their independent facts-fold, query, classifier and pure rendering-unit assertions remain separate
and executable against their landed owners.

**Rule — promise watching follows durable ownership and detects missing registration.** Rules 8,
9, 13, 46, 55, 64, 68, 83, 87, 92 and 93; **checks: P14-NF-37–41/55/63**. A promise arm consumes the
durable work/run source selected by
parts three and five; this part does not create a competing commitment schema. Each open agent-owned
obligation has a cadence, blocker state, next probe or progress due, terminal test and bounded
revival policy. `at-risk` is non-terminal. An external wait needs a fresh structured probe. An
operator-owned or authorization-blocked item is not falsely narrated as agent progress. Caps apply
per obligation, conversation, machine and package, and overflow stays visible rather than vanishing.
A separate sentinel arm inspects attributable conversation history for promises that have no
matching durable obligation. Its classifier uses full-context Part Seven judgment, not keywords.
A supported finding opens the ordinary Part Five registration/reconciliation path and remains a
missing-registration gap until that path records or explicitly declines the obligation. Detecting a
promise does not itself invent work authority or close the user's request.

**Rule — a dated check-in is a distinct absolute due obligation.** Rules 8, 26, 42, 46, 52, 53,
55, 68, 83, 87, 88, 89 and 92; **checks: P14-NF-37–39/45–47/63**. When an agent-owned promise includes an
absolute check-in instant, Part Fourteen needs a separate Five-owned due item rather than treating
the run's one mutable `nextWake` as that item. The landed `RunGraphPort` has no owner-decoded due-item
identity, promise relationship, registration, complete read, closure or replay operation. The exact
additive contract is GRANTED in `seam-response-rungraph-followup.md`, ledger #39, but is not landed.
It grants one Five-owned dated-reminder due-item record and public `REGISTER`, `READ` and `CLOSE`
operations; Fourteen neither names that owner type nor emulates a `run-due-view`. Under the granted
seam, Five owns registration and explicit closure: an owner-valid fulfilled,
withdrawn or superseded disposition of the underlying obligation suppresses the item, while the
exact settled reminder closes only the reminder item. The reminder holder owns complete observation
of the open dated population and compares each absolute instant with an actual clock reading.
Not-yet-due, terminally closed and already-settled items request no effect. Reaching the instant
makes the item due; it neither proves the promised work happened nor establishes that a person must
act.

A due date by itself remains a pull-visible obligation. It does not satisfy Part Eight's
`required action` or result eligibility and cannot route a system notice to the ordinary
conversation. A bounded infrastructure notice becomes eligible only when fresh evidence separately
establishes a concrete result or a human-required action and, for an internal issue, records the
eligible self-heal that was attempted and failed. That notice carries infrastructure provenance,
quotes the promise only as data, aggregates by causal episode and routes through Eight to the
declared alerts destination under Rule 53—not to the promise's original destination. Eight
re-resolves current ownership, scope, message eligibility, notification budget and route before it
records observation and settlement. If the promise explicitly requires delivery of a reminder or
result to a named destination, that is a distinct owner-approved agent reply/result contract through
Five and Eight; the holder may not infer it from the date or convert an infrastructure notice into
agent speech.

P14-NF-63 separates its positive contract into these independent assertions:

1. **Registration and replay.** Registering and replaying one promise/check-in pair preserves one
   stable due-item identity despite unrelated `nextWake` changes.
2. **Timing.** An actual clock observation selects a due item at its absolute instant; the otherwise
   identical not-yet-due item requests no effect.
3. **Closure.** Owner-valid fulfillment, withdrawal or supersession closes the underlying
   obligation, while exact reminder settlement closes only the reminder item.
4. **Date-only eligibility.** A due date without separate action-needed or result evidence stays
   pull-visible and requests no message.
5. **Eligible notice.** Fresh concrete-result or human-required-action evidence, plus the required
   failed eligible self-heal for an internal issue, requests one bounded aggregate infrastructure
   notice under the stable item identity.
6. **Routing.** The eligible infrastructure notice goes only to the declared alerts destination;
   the ordinary or original conversation route is refused.
7. **Delivery uncertainty.** A lost or ambiguous answer remains owned and uncertain under the
   original effect identity, permits read-only reconciliation and never mints a second invocation.

Attempt or notification-budget exhaustion leaves the due item and undelivered state owned and
pull-visible. Assertions 1–3 are **non-executable until the ledger #39 grant in
`seam-response-rungraph-followup.md` lands**. Assertion 5's dispatch positive is additionally
**non-executable until `seam-response-effects-payloads.md` and
`seam-response-assembly-followup.md` land**; those GRANTED files supply the typed infrastructure
notice and confined notice driver. The refusal cases in assertions 2, 4, 6 and 7 remain pure
specified neighbors; they do not establish a live positive on this HEAD.

**Rule — unregistered dirty work remains visible after its worker dies.** Rules 9, 26, 42, 45,
59, 68, 69 and 87; **checks: P14-NF-25/35/42/45/49/50/61**. Here **dirty** means a
version-controlled worktree has uncommitted or untracked changes. **Owner-dead** requires affirmative
exclusion of every relevant visible current-user process and every registered owner. For each
process, a fresh observation must either place its current working directory outside the canonical
worktree or supply independent scope evidence proving that the process cannot own or edit that
worktree. Every relevant ownership join must also resolve to no live registered owner. A complete
enumeration with an unknown directory or ownership that could belong to the worktree therefore makes
owner-dead `unknown`; the absence of a known match is not affirmative exclusion. The separate
worktree observation must also report no live session or index lock. **Settled** means complete file
activity evidence covers the plan's declared finite settle window and observes no activity in it.

The orphaned-work holder consumes the conditionally granted read-only process-inventory observer in
`seam-response-assembly-followup.md`, ledger #40. That owner-decoded snapshot covers every visible
current-user process, including launches not registered with Instar, and supplies the registered
ownership joins. It does not enumerate worktrees or supply their version-control, lock or activity
history. Part Fourteen therefore consumes Ten's separate complete read-only worktree observation and
action-time re-observation. That owner-decoded worktree-observation operation is GRANTED
CONDITIONALLY but unlanded in `seam-response-assembly-followup.md`, ledger #50. Its pinned snapshot
enumerates admitted repository roots;
reports explicit complete, partial or failed status; and supplies canonical worktree identity,
dirty state, lock/session observations and full settle-window activity coverage. A missing,
partial, failed, stale or denied process or worktree snapshot makes owner-dead `unknown`; it never
proves absence. A dirty, owner-dead and settled worktree opens one owned finding and the ordinary Part Five
registration/reconciliation path, even when no promise or run was registered. Dirty with a live
owner is not orphaned. Failed worktree enumeration makes the population `unknown`, never zero. The
absence of a last-file-activity observation also makes settle eligibility `unknown`; it cannot
establish `settled`, open the reconciliation finding or authorize preservation. The holder may only
schedule bounded re-observation until positive activity history covers the full settle window. This
observed-settle requirement is deliberately stronger than the 1.x classifier's unknown-activity
fallback. The owner decides through that durable path whether to revive, retain or discard the work
under current standing. An optional preservation commit is a separate registered Part Eight git
effect through a confined Part Ten driver. Detection never performs that mutation directly, and
preservation success does not close the reconciliation obligation.

P14-NF-61's pure classification neighbors for dirty/live, incomplete worktree enumeration, an
otherwise complete process snapshot with one unresolved directory/ownership, and unknown settle
activity remain executable. Its otherwise identical proven-outside neighbor changes only that
unresolved process to a fresh directory outside the worktree with an independently resolved
non-owner join. Its production owner-dead and complete-observation positive is
**non-executable until the ledger #40 process-inventory grant and the ledger #50
worktree-observation grant in `seam-response-assembly-followup.md` land**.
Its preservation-effect positive is additionally **non-executable until
`seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land**.

**Rule — crash-loop pausing is evidence-gated and reversible.** Rules 13, 24, 40, 55, 57, 61,
74, 86 and 95; **checks: P14-NF-40–43**. The holder evaluates a complete pinned attempt population
for one operation class and generation. Short failures, repeated equivalent causes and recurrence
are separate observations, not a hard-coded universal verdict. A part-seven resolution may propose
a bounded pause only among registered allowed actions. Critical/minimal-plane work follows its own
declared floor. Expected admission shedding is recorded as expected capacity enforcement, not a
crash. A pause is a part-eight reversible effect with a finite scope, cause, review time and undo
operation; editing a jobs file directly is forbidden.

**Rule — a confirmed budget overrun halts execution without inventing completion or operator
action.** Rules 8, 13, 55, 60, 61, 68 and 97; **checks: P14-NF-42/49/59**. The holder compares the
current Part Five run and `RunBudget` with its governed safety ceiling and requires consecutive
current observations before proposing action. Part Five owns the durable `RunTransition` to
`halted`; Part Six fences new admission and retains resource/recovery obligations. Closing an exact
worker process, when still needed, is a requested Part Eight process-control effect through a
confined Part Ten driver. The run, directive, pending effects and children remain recorded and open.
The package never deletes run state, manufactures a Part Four operator stop, or treats a safety
ceiling as `completed` or `unreachable`. Any resulting notice speaks with infrastructure provenance.

The landed `RunTransition` has no safety-ceiling action. Its only admitted transition into
`halted` is `stop`, whose trigger requires Part Four control verification. Crossing
`RunBudget.safetyCeiling` currently refuses a new step but cannot append the halt required above.
Part fourteen does not manufacture a stop or redefine Five's union. The exact additive operation
is requested in `.instar/lanes/design-sentinel-holders-seam-request-rungraph.md`, request
`P14-P5-safety-ceiling-halt-v1`, and is GRANTED in the current
`seam-response-rungraph-followup.md` but not landed. P14-NF-59's positive is **non-executable until
`seam-response-rungraph-followup.md` lands**. It must keep pending work and children open and
attribute the halt to infrastructure capacity, never the operator.

**Rule — moving output does not discharge the autonomous report cadence.** Rules 14, 46, 52, 64,
87, 88, 89 and 92; **checks: P14-NF-22/36–39/60**. The moving-worker silence holder enumerates all
current autonomous runs, so no inbound message or promise is required. It joins the current run
cadence, last attributable outbound, shared observed output change and one-voice ownership. The
finding appears on the complete pull surface and opens the ordinary Part Five cadence-repair path.
Moving output proves liveness only, not useful progress. Rule 87 makes routine status pull-only, so
the 1.x observational heartbeat line is not retained as a push. Only a separately eligible
action-needed or result-bearing message after failed self-heal may pass through Part Eight.

---

## 7. Session watchdogs and reapers

**Rule — a watchdog cannot infer operator action or signal an unverified process.** Rules 13, 26,
39, 42, 60, 68, 86 and 89; **checks: P14-NF-26–30/42/44**. Immediately before any process-directed
request, the holder obtains a fresh process identifier (`PID`), parent, start identity, argv shape (the executable plus its
ordered arguments as observed at action time), worker incarnation and
lease evidence. PID reuse, adapter-host selection, known bounded waits, active helpers, compiler/test
services and current durable progress refuse the candidate. Any intervention records the true
principal and cannot be presented as user cancellation. A pane-wide interrupt cannot substitute
for a verified descendant target.

`tmux` is the terminal-session manager used by Instar 1.x to host a worker in a pane. `SIGTERM` is
the operating system's request for a process to terminate gracefully. `SIGKILL` is the operating
system's forced termination signal, which the target process cannot handle or defer.

These are new 2.0 requirements, not guarantees of the 1.x `SessionWatchdog`: its interrupt stages
send `C-c` to the whole tmux pane, and its later `SIGTERM`/`SIGKILL` stages use the PID selected by an
earlier observation without revalidating the parent, start identity and ordered argv immediately
before signaling. The granted typed Part Eight process-control effect and confined Part Ten driver
must enforce exact action-time revalidation and direct-target-only actuation; Fourteen cannot claim
that the legacy watchdog already supplies either property.

**Rule — process reaping starts from a complete owner-resolved population.** Rules 26, 42, 49, 59,
60, 61, 68 and 69; **checks: P14-NF-27/28/30/32/42/49/64**. In addition to registered worker
sessions, the population includes untracked Instar CLI processes and allowlisted MCP descendants
that became leaked, orphaned or reparented. A live registered owner, live run/delegation, known
active child, protected/minimal-plane role, external/non-Instar terminal session, incomplete
ancestry or unknown ownership refuses automatic disposal. Old age, resource pressure and an
allowlisted executable are signals only. The holder first consumes a pinned complete Part Ten
inventory, and any selected process is independently revalidated at effect admission as the same
exact descendant identity.

The landed Part Ten `HarnessAdapterPort.observe` can observe a known `HarnessLaunchSpec`; neither it
nor the landed holder-binding/driver shape exposes a complete arbitrary process/session population.
The additive read-only, owner-decoded Part Ten process-inventory observer returning one pinned
snapshot is GRANTED CONDITIONALLY in `seam-response-assembly-followup.md`, ledger #40, but is not
landed and grants no disposal authority. P14-NF-64's complete-population and production-observer
positives are **non-executable until the ledger #40 grant in
`seam-response-assembly-followup.md` lands**.
The later actuation positive remains separately blocked on
`seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` landing.

**Rule — clean-worktree reclamation keeps every uncertain checkout.** Rules 5, 9, 26, 42, 55,
60, 61, 68, 69 and 73; **check: P14-NF-66**. Here **clean** means the current checkout has no
tracked or untracked user work after applying one registered narrow residue list. **Merged** means
the current branch head's content is already in the current default branch. Patch-equivalent
history may prove that condition. A merged-pull-request observation may prove it only when its exact
head object identity equals the checkout's current head. **Unused** means no live session or index
lock, no current process whose working directory lies inside the checkout, no live run/delegation
owner and no active-build marker. Detached or unknown branches, dirty or unmerged heads, incomplete
enumeration, failed classification and every uncertain owner/process observation remain kept.
Staleness alone never makes a checkout reclaimable.

The holder schedules a bounded initial observation shortly after activation as well as its ordinary
cadence. Part Six retains the due debt across process restarts, so repeated restarts cannot reset the
first observation indefinitely. Each pass has a finite reclaim count. Consecutive failures for one
checkout enter the shared Part Six breaker and leave that checkout visible and kept; a restart cannot
erase that pressure. Immediately before mutation, the confined driver re-reads the current branch
and head, clean state, merge evidence, owner/process/lock state and build marker. Any change or read
failure refuses the operation. Reclamation is a non-forced, enumerated Part Eight `git-mutation`
effect through Part Ten's confined driver. It removes only the reconstructable checkout; it does not
delete the branch or commits and never terminates a durable run. The full production unused-process
join is **non-executable until the ledger #40 grant in `seam-response-assembly-followup.md` lands**.
The complete worktree population, branch/head/merge, cleanliness, lock, build-marker, file-activity
and action-time re-observation positives are **non-executable until the ledger #50
worktree-observation grant in `seam-response-assembly-followup.md` lands**.
The mutation positive is **non-executable until `seam-response-effects-payloads.md` and
`seam-response-assembly-followup.md` land**.

**Rule — reaping disposes of a worker, never its work.** Rules 7, 15, 26, 60, 61, 63, 68 and 97;
**checks: P14-NF-28/30/32/35/42–46/57/59**. Eligibility is re-resolved at effect validation and excludes the
minimal-plane reserve, a worker holding active or uncertain work, open delegation, current
commitments, compaction recovery, provider-throttle recovery, explicit protection, operator stop
processing and any case whose identity is uncertain. Age or pressure makes a candidate due for
assessment, not disposable.
Successful worker closure leaves the durable run alive until its own exit test passes or a bounded
recovery/reassignment record owns it. `ReapLog`-style historical occurrence remains distinct from
the live eligibility projection.

The session reaper requires affirmative idleness through two confirmation phases. First, a fresh
worker observation must show a ready-for-input state and no active-work marker. The relevant
transcript, process and durable progress observations must also be current and unchanged. Missing
evidence or the absence of activity alone is not affirmative idleness. The same exact worker must
then remain eligible across the plan's required observation count and finite confirmation window.
Part Nine records the observations. Part Five supplies current work state. Part Six retains the due
and candidate history across worker restart.

**Reap-pending** is the finite grace state entered only after sustained candidacy. It is not
permission to terminate. At every due tick during grace, the holder performs the full classification
again and re-resolves every exclusion, owner, worker identity and relevant activity source. Resumed
or changed activity aborts reap-pending and resets candidacy. Missing or stale evidence does the
same. At grace expiry, only one more fresh full all-clear evaluation may request the typed Part Eight
process-control effect. The confined Part Ten driver still performs its separate action-time identity
and eligibility revalidation.

A normal typed refusal with an explained reason leaves that target running and does not disable
assessment of other candidates. An unexplained termination failure—an actuator exception or a
failed result without the required typed reason—stops the Part Six reaper loop and inhibits the Part
Ten effect-capable binding for every later session-reaper action until owner-visible repair and
review. It does not get treated as an ordinary candidate refusal. P14-NF-28/30's production
observation and actuation positives are **non-executable until
`seam-response-assembly-followup.md` and `seam-response-effects-payloads.md` land**. The pure
classification, grace-abort and explained-versus-unexplained disposition cases remain separately
executable against their landed owners.

**Rule — duplicate retirement preserves reachability and waits for observed drain.** Rules 14, 15,
26, 42, 55, 61, 63, 68, 77, 87 and 95; **checks: P14-NF-28/32/35/36/43/47/67**. **Duplicate
retirement** means closing a losing worker copy only after another machine is proved to be the
current conversation owner with a fresh live serving worker, while the durable work remains owned.
The 1.x cooperative stand-down path is retained as guarantees and re-expressed through the 2.0
owners. Five supplies current runs, builds, delegations, autonomous work and pending result
destinations. Six supplies ownership, lease/fence admission, a finite confirmation period, recovery
and shared breaker pressure. Eight supplies one-voice effect/message admission and the granted
`harness-operation` graceful-close arm. Ten supplies exact worker observations, binding inhibition
and the confined close driver.

Automatic retirement requires fresh remote-owner liveness from distinct advancing observations,
current ownership agreement, and no newer local inbound unless that inbound was durably diverted to
the proved owner. Unknown, stale, failed or contradictory ownership/liveness withholds retirement.
If every live copy appears held, or the pool view is unreadable, the bounded recovery releases at
least one hold toward user reachability; it may temporarily permit duplicate workers rather than
silence the conversation. Eight still re-resolves current speaker authority for every outbound
effect. A changed owner, dead remote worker or fresh undivertable local inbound releases the local
hold immediately.

A live build, live helper or autonomous run on the losing copy is **contested work**. Contested work,
an unknown contested-work read, a protected/minimal-plane role or an uncertain in-flight effect
refuses automatic hold and close. It opens one operator-visible action item and leaves the worker
able to continue; the system does not freeze a build between tool calls or manufacture consent to
suspend an autonomous run. For an uncontested duplicate, Six refuses new claims under the losing
lease/fence while an already-claimed step may settle. Consecutive observations must then establish
that no tool, helper, input, output, transcript or effect work remains in flight. Only that observed
drain permits one Eight `harness-operation` graceful-close request through Ten. Timeout or
unprovable drain leaves the duplicate and action item visible; it never escalates to a hard kill.
Repeated duplicate creation shares one persistent breaker pressure identity and cannot reset by
minting a new session.

P14-NF-67's policy/refusal neighbors are executable against the named owner contracts. Its real
graceful-close and production-driver positive is **non-executable until
`seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land**. Its persistent
shared recurrence-pressure positive is **non-executable until `seam-response-loop-breaker.md`
lands**.

**Rule — no unbounded kill, swap, spawn, pause or notification exists.** Rules 52, 55, 60, 61, 63,
87 and 88; **checks: P14-NF-22/24/38/39/42–47/67**. First, every self-action class has finite
per-target, per-conversation, per-machine and total action budgets and concurrency limits; a
pool-wide action has a pool-wide bound. Second, every retry uses finite backoff, maximum attempts,
duration and breaker transitions. Third, deduplication uses a **causal episode**: the stable identity
joining observations and actions caused by one originating failure across retries, workers and
machines; a new local key cannot reset it. Fourth, exhaustion records a typed refusal, leaves an
owned gap and names the terminal owner. Notifications consume their own bounded aggregate budget
and group by the same causal episode.

**Rule — breaker claims stop at the landed Part Six boundary.** Rules 26, 45, 55, 61, 69 and 95;
**checks: P14-NF-43/47/49/66/67**. The landed `LoopPolicy` can presently enforce only `maxAttempts`,
`minDelay`, `maxDuration`, `timeout`, `concurrency: 1`, `failDirection: closed`, and
`breaker: stub-closed`; landed `LoopRecord` states are `scheduled`, `running`, `restoring`,
`waiting`, and `stopped`. It has no open/closed transitions or **half-open** state—a bounded trial
after the breaker's pause in which only the declared trial count may run and its evidence either
closes or reopens the breaker—nor cooldown, failure-threshold, half-open trial budget, or pressure
identity shared across targets, conversations, machines and the pool. Part fourteen therefore
depends on the additive Part Six contract requested
in `.instar/lanes/design-sentinel-holders-seam-request-loop-breaker.md`, request
`P14-P6-shared-recovery-breaker-v2`. This seam is GRANTED but not landed.
P14-NF-43/47/49/66/67 are **non-executable until
`seam-response-loop-breaker.md` lands**. Until that grant lands and its shared-pressure fixture
passes, automatic repeated self-action is inhibited after the first admitted attempt; a holder
cannot claim a breaker by keeping a private counter.

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
`.instar/lanes/design-sentinel-holders-seam-request-effect-doorway.md`, request
`P14-P8-typed-recovery-effects-v2`, and the corresponding Part Ten drivers in request
`P14-P10-holder-bindings-and-drivers-v2`. The Part Eight seam is GRANTED but not landed;
P14-NF-42/45/46/51–53 are **non-executable until `seam-response-effects-payloads.md` lands**.
The matching Part Ten driver request is GRANTED in `seam-response-assembly-followup.md`, ledger #9,
but is not landed. P14-NF-42/45/46/49–53 therefore also cannot execute their production-driver
positive neighbors until that grant lands. All affected
effect-capable bindings remain inhibited. An instance is `dry-run` only if section 3's complete
enrollment, intended inhibition and fresh passing observation requirements are independently met;
otherwise it is `diverged`. Only effects already representable by the landed doorway may execute.
The sole existing path used here is an ordinary agent text reply: decode the current
`OutboundMessage`, prepare/adopt the `EffectRequest`, invoke its registered message adapter, obtain
the required Part Nine assessment and let Part Eight settle it. Infrastructure notices and every
recovery mutation remain blocked rather than masquerading as that reply.

Worker input is a separate missing class, not process control or an ordinary reply. The paired
Part Eight payload and Part Ten driver request is
`.instar/lanes/design-sentinel-holders-seam-request-worker-input.md`, request
`P14-P8-P10-typed-worker-input-v1`. It is GRANTED in `seam-response-effects-followup.md` and
`seam-response-assembly-followup.md`, ledger #21. P14-NF-33/56/57 and their P14-NF-49/50
wiring/lifecycle neighbors are **non-executable until both grant files land**.

**Rule — uncertainty never becomes a fresh attempt.** Rules 24, 26, 42, 46, 55, 58, 61 and 107;
**checks: P14-NF-44–47**. After a crash or lost receipt, recovery reconstructs the original logical
effect identity and queries the exact adapter journal. Automatic retry requires independent evidence
that the prior effect did not happen, cannot still happen, and cannot still charge. Otherwise the
effect stays uncertain and its maximum exposure remains visible. A new worker, absent process,
expired timer, missing local log or repeated request is not non-occurrence evidence.

**Rule — destructive local guards remain defense in depth.** Rules 26, 42, 49, 60, 66, 69 and 74;
**checks: P14-NF-03/04/42/45/51–53**. A process kill, file removal, configuration change or git mutation
must first survive the core effect contract and then its adapter's target guard. The 1.x
`SourceTreeGuard`, `SafeGitExecutor` and `SafeFsExecutor` establish only a partial precedent.
`SourceTreeGuard` resolves a nearest existing ancestor and refuses when canonical identity is
unavailable. `SafeFsExecutor` then permits a directory-wide carve-out for paths below `.instar/`;
that is not an exact operation-and-target exception. The 1.x audit row records one target and a
caller stack frame. It does not separately retain the requested target, resolved target and a
verified principal. Audit writing can be disabled and audit failures are fail-soft. Its atomic
write helper replaces one file through a same-directory temporary file, file synchronization and
rename. Neither wrapper supplies a general transaction across filesystem objects or across a git
operation's ref, index and working-tree changes.

The requested Part Ten drivers must add the stronger requirement. They canonicalize both requested
and resolved identities, refuse protected targets on uncertainty, limit an exception to one exact
operation and canonical target, authenticate the principal, and durably audit the request,
resolution, decision and result before reporting settlement. The 1.x wrappers remain defense in
depth, not alternate 2.0 doorways and not evidence that these new guarantees already exist. A local
guard's refusal remains a refusal through settlement.

Each mutation declares its atomic scope and crash result:

| Operation | Atomic scope and permitted claim after a hostile cut |
|---|---|
| Configuration replacement | One exact file may claim old-or-new bytes only when the driver uses a same-filesystem temporary file, synchronizes file and parent-directory state, performs one atomic replace supported by that platform and verifies the resulting digest. Otherwise it reports `uncertain`. |
| Filesystem create or replace | One exact directory entry may make the same old-or-new claim only under the configuration-replacement conditions. A same-filesystem move may claim one atomic name transition only when the platform contract proves it. Recursive removal, cross-filesystem move and multi-target change are multi-object operations and cannot claim atomicity. |
| Git ref update | One compare-and-swap ref update may claim old-or-new for that ref only. Index and working-tree mutations, checkout, merge, reset and multi-ref changes are multi-object operations and cannot inherit the ref claim. |
| Any multi-object mutation | The driver records a durable intent and per-object observations, preserves the original effect identity and maximum exposure, and returns partial or `uncertain` after a cut. Reconciliation inventories actual state before any repair. It never blindly retries. Completion needs an owner-approved transaction adapter that names its commit/rollback protocol, or a later separately admitted compensating operation. |

Part Ten P10-NF-28/29/33 applies to canonical-store persistence, not arbitrary physical mutation
atomicity. The typed filesystem/configuration/git drivers additionally face the operation-specific
Part Fourteen cut in P14-NF-53. Their transaction mechanism is an explicit dependency of the updated
Part Eight and Part Ten seam requests.

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
preserves contradictory heads and per-machine ages. Another machine's healthy arm cannot cover a
missing machine-bound instance. A genuinely shared service is enrolled as its own instance with a
separate `VerificationPlan`, binding, governed subject and independent witness. Evidence for that
shared subject satisfies only the shared-service obligation; it does not satisfy or erase an
absent local instance.

**Rule — temporal posture instability is separate from current raw posture.** Rules 9, 24, 26,
43, 58, 69 and 70; **checks: P14-NF-14/20/48/65**. **Transition instability** means more than three
changes of the raw Part Nine posture signature between adjacent eligible observations in the most
recent ten plan-scheduled ticks for one exact plan, generation and instance. The signature is an
ordered sequence of tuples, one for every arm in the exact `VerificationPlan.arms` order. Each tuple
contains only the arm id, `sourceStatus` and arm `posture`, followed by the overall
`GuardPostureView.posture`. Equality excludes `lastAttempt`, `lastSuccess`, `evaluatedAt` and every
other evidence or evaluation-time reference. Those excluded references remain evidence attached to
the observation. Missing, wrong-generation or incomparable observations are gaps, not invented
transitions. The tripwire's
named `retrospective` arm derives this temporal finding from the sequence of independently recorded
Nine observations and records the source references in its own `ProbeRecord` evidence. It does not
add a flapping label to `GuardPosture`, rewrite any source view or replace the current raw posture.
Four transitions within the ten-tick window open an instability finding even if the last raw posture
is `healthy`; three transitions are the stable-boundary neighbor and open none. A full ten-tick
unchanged signature is the stable-state neighbor. Its positive fixture uses ten distinct fresh,
successful executions: `lastAttempt`, `lastSuccess` and `evaluatedAt` change on every tick while all
arm ids, `sourceStatus` values, arm postures and overall posture stay equal. That sequence has zero
transitions. Window expiry, generation change and missing samples are explicit in the retrospective
evidence, and a later stable window disposes the temporal finding without rewriting its original
record.

---

## 10. What Instar 1.x does today and what carries forward

**Rule — earned guarantees survive the change in architecture.** Rules 24, 26, 45, 53, 59, 61,
68, 70, 87, 88 and 111; **checks: P14-NF-25–35/37–48/55–67**. The layer-below audit covered the named modules and
the incidents recorded with them. The following behaviors are requirements, not endorsements of
their current implementation.

| 1.x module | What the named source does today | 2.0 requirement and disposition |
|---|---|---|
| `GuardPostureTripwire`, `guardPosture`, `guardPostureView`, `GuardPostureProbe` | Compares configured guard state and probe evidence through component-specific state. `GuardPostureProbe` records the component posture string, not changing attempt identities, at each tick and raises `flapping` after more than three string changes in a ten-tick window, separately from the current signature. | Fresh source execution, complete load-bearing gaps and the off/diverged distinction remain; configuration alone never confirms health. P14-NF-65 carries the temporal behavior into the named retrospective arm with an explicitly selected posture-only signature while preserving attempt/success references as evidence and the current raw Nine posture separately. |
| `ContextWedgeSentinel` | Parses captured context-error signatures and proposes replacement under its component policy. | Repeated exact-context evidence, one-off-refusal exclusion, real parser fixtures and fresh part-five grounding remain. |
| `CompactionSentinel` | Verifies recovery using newline-delimited JSON (`JSONL`) transcript size and modification-time growth (`src/monitoring/CompactionSentinel.ts:410`). Claude prefers an exact session universally unique identifier (`UUID`) but may fall back to the newest project transcript; Codex and Gemini select the newest account/project-level transcript (`:488`). It deduplicates recent reports, defers for active work and bounds injection attempts. | P14-NF-31/33/34 require exact pre-compaction inbound accounting, current open-obligation grounding and one logical effect identity. Transcript growth is activity evidence only and does not satisfy continuity. |
| `SessionWatchdog` | Applies exclusions and escalating process actions around a `tmux` terminal-session-manager identity. Its first and retry interrupt stages send `C-c` to the whole pane. Later stages signal the previously stored `stuckChildPid`; the action-time liveness check is `process.kill(pid, 0)` and does not revalidate parent, start identity or ordered argv before `SIGTERM`/`SIGKILL`. | Known-wait exclusion and bounded escalation are retained. Action-time exact descendant revalidation, direct-target-only actuation, a ban on pane-wide interruption and truthful principal attribution are new 2.0 requirements enforced by the granted Eight/Ten process-control path under P14-NF-28/30; they are not claimed as inherited behavior. |
| `ActiveWorkSilenceSentinel` | Enumerates registered sessions independently of inbound-topic traffic and escalates when the same active-work frame remains frozen for a finite backstop (90 minutes by default); it does not itself authorize a kill. | Preserve registry-wide coverage and a finite frozen-indicator backstop, but require subject-specific progress evidence, part-seven classification when semantic, and part-eight authorization before any recovery. |
| `SocketDisconnectSentinel` | Detects the socket-disconnected frame, sends bounded recovery nudges with backoff (four attempts by default), and verifies that the disconnect text disappears. | Preserve bounded re-challenge and verification while binding the exact worker/context and using the typed effect and loop seams; disappeared text alone is not durable recovery. |
| `ProactiveCompactionSentinel` | Ships disabled unless explicitly enabled and dry-run by default; for autonomous Claude sessions it checks an idle state and a context threshold, then applies a cooldown before direct compaction triggering. | Preserve ships-dark/dry-run posture, idle exclusion and cooldown; compaction becomes a typed effect and success requires exact continuity rather than trigger receipt. |
| `HelperWatchdog` | Emits signal-only helper stall/failure events while the parent session may remain live. | Delegation-edge coverage and parent result-destination accounting remain; a timer alone does not prove failure. |
| `PresenceProxy` | Correlates unanswered messages with component-specific activity classification and bounded notices. | Intake-to-reply accounting, live corroboration, one voice and conservative uncertainty remain. |
| `CommitmentTracker`, `PromiseBeacon` | Track open commitments, blocker/progress cadence, non-terminal `atRisk`, and active-beacon caps. | Durable owner/blocker state, structured probes, bounded revival and internal-by-default follow-through remain. |
| `CommitmentSentinel` | Reads recent user/agent exchanges, asks a model for commitments missing from `CommitmentTracker`, deduplicates candidates and records supported missing commitments. | The promise holder retains a full-context missing-registration arm under P14-NF-55. It opens the ordinary durable-work reconciliation path; it does not gain keyword authority or a competing commitment schema. |
| `checkInReminderCore`, `CheckInReminderReconciler` | Scan absolute `checkInAt` instants; exclude not-yet-due, closed, already-reminded, unrouted, invalid and retry-exhausted commitments; cap each pass; record attempts; and expose reminders still undelivered after exhaustion. They send before stamping success, so a crash between send and stamp can repeat delivery; short-lived relay deduplication is not a global exactly-once guarantee. Delivery uses a direct injected send dependency. | P14-NF-63 retains the absolute due test, terminal/already-settled suppression, bounded attempts and visible undelivered state. The ledger #39 grant in `seam-response-rungraph-followup.md` must land to supply the distinct durable item and closure; the holder observes it. Eight owns eligibility, Rule 53 alerts routing, dispatch, uncertainty and settlement. A date alone is not required action or a result, and an internal-issue notice needs failed eligible self-heal. The direct-send bypass, original-destination default and any assumed exactly-once claim are rejected. |
| `OrphanedWorkSentinel` | Covers the population promise tracking cannot see: a worktree with uncommitted or untracked work and no live owning session/lock/process. When a last-activity timestamp exists, recent activity excludes the worktree. When that timestamp is `null`, the classifier falls through to `orphaned` and labels the result settled even though activity is unknown. It records one deduplicated finding, keeps failed worktree enumeration distinct from zero orphans and can optionally create a preservation commit behind a separate off-by-default flag. The legacy process observation does not establish a complete current-user population with registered-ownership joins. This closes the 2026-06-12 incident in which a worker died after leaving unregistered, uncommitted work invisible. | P14-NF-61 makes observed quiet across the full settle window a new, stronger requirement. It also requires affirmative process directory/ownership exclusion from the conditionally granted ledger-#40 snapshot and the separate complete worktree/activity snapshot conditionally granted in `seam-response-assembly-followup.md`, ledger #50. Dirty/live, an unresolved process directory/owner, incomplete worktree enumeration, missing/partial/failed/stale/denied process inventory and unknown activity cannot be seized. The production owner-dead positive is non-executable until both owner observation grants land. Reconciliation becomes owned Part Five work. The optional preservation commit is not inherited authority: it is a separately admitted typed Part Eight git effect through Part Ten, and direct git mutation is rejected. |
| `AgentWorktreeReaper`, `agentWorktreeGit` | Enumerates command-line-created worktrees and keeps detached/unknown, dirty, unmerged or in-use checkouts. Cleanliness includes untracked user work after a narrow residue list. Merge evidence uses patch equivalence and may use a merged pull request only when its head object identity exactly matches the worktree head. Before non-forced `git worktree remove`, it rechecks the active-build marker, current branch, in-use state, clean state and merge state. It ships off and dry-run, caps removals per pass, stops retrying one path after a process-lifetime failure count, and schedules one delayed initial pass per boot to reduce the daily-timer restart-starvation incident that had accumulated 86 worktrees and 25 gigabytes. The initial delay and per-path failure count themselves reset on restart. | P14-NF-66 retains the inverse of orphaned-work protection: only clean, merged and unused checkouts may be reclaimed. It strengthens restart behavior by preserving due observation and breaker pressure through Part Six history, and it routes non-forced removal through the granted Eight/Ten `git-mutation` path after the full action-time recheck. The complete production worktree population and pre-selection/action-time observations wait for the conditionally granted worktree-observation operation in `seam-response-assembly-followup.md`, ledger #50, to land. Dirty, unmerged, in-use, changed and uncertain checkouts remain kept. P14-NF-61 does not cover this duty. |
| `StuckInputSentinel` | Before pressing a key on the generic prompt path, compares the same pane's plain and terminal-styled captures. Dim-only text is treated as a model-suggested ghost; mixed, raced or unreadable presentation is inconclusive and is not pressed. | Silent-stop coverage retains authentic-pending-input versus ghost/inconclusive discrimination under P14-NF-56. Captured presentation is a signal; action still needs the typed effect and exact worker identity. |
| `PermissionPromptAutoResolver` | Detects registered framework approval-menu shapes, re-captures before input and bounds repeated clearing attempts. It can answer a narrowly recognized one-call option, while persistent or unrecognized menus receive a separate visibility path. Its 1.x policy assumes framework prompts in operator-owned full-access sessions are defects rather than authorization requests. | The framework-prompt holder retains bounded detection, re-observation and unresolved-menu visibility under P14-NF-62. It separately re-resolves whether the exact underlying operation is already admitted. Missing human authorization remains a blocker. The 1.x blanket authority assumption is rejected; only ledger #41's granted `worker-input` action `approval-prompt-response` may clear the exact allow-once member for an admitted call, and blanket or ambiguous options remain untouched. |
| `RateLimitSentinel` | Deduplicates one live-session throttle recovery, defers when compaction recovery owns the session, backs off before a neutral continuation, exposes active recovery to veto zombie reaping, and bounds attempts. | The session/compaction holders retain bidirectional exclusion, class-specific payloads, backoff and reaper veto under P14-NF-57. Provider text is not semantic authority, and transcript growth is not recovery proof. |
| `CrashLoopPauser` | Queries at most 1,000 run-history rows per job (`src/monitoring/CrashLoopPauser.ts:94`) and retains only five failure ids as evidence (`:122`); it applies fixed count rules, excludes critical/never-pause jobs and defaults to dry-run. | P14-NF-40/41 require the complete pinned eligible population, typed shedding exclusions, part-seven resolution and a reversible typed pause. The current capped query/evidence is not completeness proof. |
| `SelfActionGovernor` | Centralizes class/target admission with observe-only defaults, caps and breaker state; pool-shared mode auto-demotes when more than one machine is registered because there is no pool-wide ceiling. | Preserve the shared chokepoint and conservative demotion. Full automatic mode waits on the Part Six shared-pressure/breaker seam and Part Eight/Ten typed effects. |
| `ExternalHogSentinel`, `ExternalHogScanTick`, `ExternalHogKillFunnel`, `ExternalHogRealAdapters` | Ships observation-only/dry-run by default. The PIN-armed live path can terminate an exact allowlisted process. (1) Before Unix `SIGTERM` it checks the class-content arm, process identity, current CPU and protected floor. (2) Before `SIGKILL` it checks arm, identity, class and floor again. (3) Disarm during the grace interval aborts escalation. (4) A writable workspace file defers force kill within a finite bound. The real adapter supplies both signals. | Keep watch-only as the rollout default. (1) Ten's confined driver must recheck exact class, identity, CPU and protected floor before validating Eight's `SIGTERM` process-control request. A changed or unreadable input fails closed. This production positive is non-executable until `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land. (2) Ten must perform the same fresh checks before validating a separate Eight `SIGKILL` request. Stale grace evidence fails closed. This production positive has the same two seam dependencies. (3) Six owns the finite grace loop. Current disarm makes escalation ineligible. Its pure refusal neighbor is executable separately. (4) Ten supplies the current writable-workspace observation. Eight defers the force effect while it is present. Six bounds the deferral. The production positive is non-executable until `seam-response-assembly-followup.md` lands. No resource heuristic is kill authority. |
| `EnforcedTerminationWatchdog`, `enforcedTermination` | Detects active autonomous runs beyond a time, absolute or optional iteration ceiling, excluding paused/moving runs; confirms on consecutive ticks; defaults to dry-run; caps live terminations; and invokes an injected bounded termination actuator. The 1.x actuator deletes run state, records an operator stop, cancels revival state and kills the session. | Retain confirmed budget-overrun observation and bounded enforcement under P14-NF-59. Part Five owns a durable safety-ceiling `RunTransition` to `halted`; Part Six fences new admission and owns recovery/resource closure; only verified worker-process closure goes through the requested Part Eight process-control effect and Part Ten driver. The resulting notice has infrastructure provenance. Do not copy state deletion, represent infrastructure as an operator stop, or turn budget exhaustion into completed/unreachable work. |
| `AutonomousProgressHeartbeat` | Detects a live autonomous run that has been silent to the user while shared terminal output is still changing, without requiring fresh inbound input or an open promise. It uses a one-voice lease, durable per-run cooldown, widening backoff and hard cap, then may send a purely observational liveness line. | Retain the missing-population observation duty under P14-NF-60: moving-but-user-silent runs appear in pull posture and feed the owner's missed-cadence repair. Deliberately drop the routine liveness push because it is status, which Rule 87 assigns to a pull surface. A push is allowed only when the ordinary action-needed/result-bearing rule and failed-self-heal evidence independently make it eligible through Part Eight. Five owns cadence repair; eleven owns the pull view; eight owns any eligible message settlement. |
| `SessionReaper`, `ReapLog` | The ordinary classifier requires an affirmative ready-for-input frame with no active marker. A candidate must retain a byte-identical frame across the configured observation count and confirmation window. It then enters a distinct reap-pending grace interval. Every grace tick performs the full evaluation again. Transcript growth, changed frame, active work or another keep result aborts pending candidacy. A final full evaluation is required before termination. An explained `terminated: false` skip is an ordinary refusal. An actuator exception or `terminated: false` without an explanation disables further reaper actuation. Candidate state remains distinct from `ReapLog` occurrence history; historical reaps can coexist with later revival. The separate duplicate-session path requires fresh remote-owner liveness that advances across distinct snapshots. Unknown or false remote liveness withholds closeout. It refuses stand-down for protected sessions and contested builds, helpers or autonomous runs, raises one operator item, rechecks ownership and fresh local inbound, releases toward reachability when ownership/liveness or a mutual-hold view is uncertain, and closes only after corroborated consecutive drain observations. | Retain the ordinary safeguards under P14-NF-28/30 and the duplicate-retirement safeguards under P14-NF-67. Nine owns affirmative observations. Five owns live work and revival. Six owns sustained candidacy, reap-pending grace, duplicate ownership/fencing, shared recurrence pressure and the stop after unexplained actuator failure. Eight preserves an explained refusal as refusal, enforces one-voice effects and owns process-control/graceful-close effects. Ten owns production binding inhibition, exact worker/drain observations and the final action-time recheck. Protected/minimal sessions and contested work remain excluded. Unknown ownership/liveness fails toward reachability. Worker disposal never ends durable work. Production observation/effect positives wait for `seam-response-assembly-followup.md`, `seam-response-effects-payloads.md` and, for the graceful-close variant, `seam-response-effects-followup.md`; pure classification and disposition neighbors remain separately executable. |
| `OrphanProcessReaper` | Scans registered framework CLI processes, classifies exact known live Instar tmux sessions as tracked, exact known but untracked Instar sessions as orphans, and other processes as external. It can auto-kill old Instar orphans (enabled by default in this component) while only reporting external processes; production server wiring starts it and retains child-work exclusions. | Retain the untracked Instar CLI population, exact known-session join, live/child-work exclusion and external-process no-auto-kill rule under P14-NF-64. Enumeration must come through the granted-but-unlanded read-only Part Ten process-inventory observer in `seam-response-assembly-followup.md`, ledger #40, and any actuation uses the typed Eight/Ten process-control path after action-time identity revalidation. |
| `McpProcessReaper` | Scans allowlisted MCP server processes and walks a bounded parent chain toward tmux panes. It keeps a descendant when that walk successfully resolves a live tracked or external terminal session. A hop-limit hit, missing parent or cycle returns the same `null` as a genuinely parentless process. Once old enough, that unresolved process becomes reap-eligible as `orphaned-no-session`; this is the legacy unresolved-ancestry hole. Old descendants of successfully resolved stale Instar sessions and old fully reparented descendants are also eligible. It bounds reaps per pass and ships disabled and dry-run. | Retain leaked/reparented MCP coverage, allowlist, minimum age, successfully resolved live-owner/external-session exclusions, bounded pass and dark/dry-run rollout under P14-NF-64. Strengthen hop-limit, missing-parent and cycle outcomes to unknown ownership that refuses disposal. Complete production enumeration waits on the granted-but-unlanded read-only Part Ten process-inventory observer in `seam-response-assembly-followup.md`, ledger #40. A later signal uses the typed Eight/Ten process-control path and cannot inherit action authority from the 1.x classifier. |
| `SourceTreeGuard`, `SafeGitExecutor`, `SafeFsExecutor` | `SourceTreeGuard` canonicalizes the nearest existing ancestor and fails toward protection when identity cannot be resolved. `SafeFsExecutor` has a directory-wide `.instar/` subtree carve-out. The wrappers audit one target and a caller frame; audit can be disabled and write failures are fail-soft. `SafeFsExecutor` has a same-directory atomic single-file replacement helper. Git and multi-object filesystem mutations are not transactionally crash-safe. | Canonical target checks remain defense in depth. Exact operation/target exceptions, separately recorded requested/resolved targets, verified principal, durable complete audit, and operation-specific crash outcomes are new requirements on requests `P14-P8-typed-recovery-effects-v2` and `P14-P10-holder-bindings-and-drivers-v2`; they are not inherited guarantees. |

**Rule — omitted 1.x modules receive an explicit package disposition.** Rules 30, 42, 45, 55,
59, 61, 68, 69 and 87; **checks: P14-NF-25–35/42–49/55–67**. `ActiveWorkSilenceSentinel` is carried into
silent-stop/session-watchdog coverage under P14-NF-25–30; its finite frozen-frame threshold raises
evidence for Part Seven, never kill authority. `SocketDisconnectSentinel` is delegated to Part Six
loop ownership and the requested Part Eight/Ten typed delivery/recovery path under P14-NF-32/34/
42–47. `ProactiveCompactionSentinel` is carried into the compaction holder under P14-NF-31–35 and
remains dry-run until typed compaction and continuity evidence land. `SelfActionGovernor` is
re-expressed as Part Six admission/breaker plus Part Eight settlement under P14-NF-43–47; no private
governor is authoritative. `ExternalHogSentinel` is included only as an observation arm feeding the
session-reaper assessment under P14-NF-27/30/32 and is excluded from automatic process action until
P14-NF-42/49/51/52 pass.
`OrphanProcessReaper` and `McpProcessReaper` are assigned to the process-population reaper under
P14-NF-64. The former contributes the untracked Instar CLI population and external-process
exclusion; the latter contributes allowlisted leaked/reparented MCP descendants plus live-owner and
external-terminal-session exclusions. Complete observation is owned by the granted-but-unlanded
read-only Part Ten process-inventory observer in `seam-response-assembly-followup.md`, ledger #40;
any actuation remains an Eight/Ten process-control effect after fresh exact
identity revalidation. The 1.x direct kill paths are not retained as authority.
`SessionReaper`'s duplicate-session path is assigned separately to duplicate retirement under
P14-NF-67. Its fresh remote-owner liveness, contested-work refusal, owner/inbound rechecks,
reachability-first release, observed drain and bounded recurrence pressure are retained through
Five/Six/Eight/Ten. An uncertain or contested copy is not muzzled or killed automatically.
`GuardPostureProbe`'s sliding-window flapping behavior is assigned to the guard-posture tripwire's
retrospective arm under P14-NF-65. It records transition instability separately and never overwrites
the current raw Part Nine posture.
`CommitmentSentinel` is assigned to the promise holder's missing-registration arm under P14-NF-55.
`checkInReminderCore` and `CheckInReminderReconciler` are assigned to the distinct dated check-in
holder under P14-NF-63. The granted-but-unlanded ledger #39 seam in
`seam-response-rungraph-followup.md` owns the absolute due item and terminal closure.
Eight owns message eligibility, alerts routing and uncertain delivery. A date alone stays pull-only;
the direct send, original-destination default and reliance on short-lived relay deduplication are not
carried forward.
`OrphanedWorkSentinel` is assigned to the orphaned-work holder under P14-NF-61, including the
unregistered dirty/owner-dead/observably-settled population, the dirty/live exclusion and `unknown`
results for enumeration failure or missing last-activity evidence. Unknown activity cannot open a
finding or preservation effect. The production worktree/activity half waits on the conditionally
granted ledger #50 worktree-observation operation in `seam-response-assembly-followup.md` to land.
Its reconciliation belongs to Five; its optional preservation commit is a
distinct Eight/Ten typed git effect and never a holder-side mutation.
`AgentWorktreeReaper` and `agentWorktreeGit` are assigned to the separate clean-worktree reclamation
holder under P14-NF-66. This is the inverse clean, merged and unused population, not an arm of
P14-NF-61. Its initial due observation and per-checkout failure pressure survive restart through Part
Six. Every dirty, unmerged, in-use, changed or uncertain checkout remains kept. A passing action-time
recheck may request only the granted non-forced Eight/Ten `git-mutation`; no holder removes a
checkout directly.
The production population and recheck in that assertion wait on the same requested Part Ten
worktree observer.
`StuckInputSentinel` is assigned to silent-stop input-buffer coverage under P14-NF-56.
`PermissionPromptAutoResolver` is assigned to the framework-prompt holder under P14-NF-62. Missing
authorization remains a Five-owned blocker. An already-admitted exact one-operation menu may use
only ledger #41's granted Eight/Ten `worker-input` action `approval-prompt-response` after fresh
re-resolution; persistent, unrecognized, ambiguous and blanket-approval menus stay untouched and
visible. Its 1.x blanket approval authority is not carried forward.
`RateLimitSentinel` is assigned to session-watchdog and compaction-recovery coordination under
P14-NF-57. `EnforcedTerminationWatchdog` is assigned to a budget-overrun observation and a
Five/Six-owned halt under P14-NF-59; only worker closure is an Eight/Ten typed process effect, and
the package never deletes run state or fabricates operator action. `AutonomousProgressHeartbeat` is
assigned to the presence/cadence observation population under P14-NF-60; its routine liveness push
is rejected, while the pull finding and ordinary action-needed/result-bearing message policy remain.
These dispositions retain bounded intervention and exact recovery-class separation, not 1.x keyword
authority, blanket prompt authority, transcript-growth proof, state deletion, synthetic operator
attribution, direct preservation commits or routine status pushes.

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
49, 63, 68 and 69; **checks: P14-NF-03/04/32/36/40/42–49/59/60**.

| Producer → consumer | Record passed | Consumer obligation | Closure owner |
|---|---|---|---|
| Ten/three → nine/package | current `LocalCapabilityPackage.declarationIds`, `Declaration`, `holds` and sentinel required facts | select exact package members; keep features out of holder edges; join each sentinel id to one per-instance `VerificationPlan.subject.holder` and exact governed subject; expose missing enrollment | ten owns package membership; three owns declaration gap; nine owns assessment |
| Four/five → silent-stop holders | authenticated intake, run/step/progress/grounding facts | assess exact obligation and worker without changing it | five owns work completion |
| Granted Part Ten worktree-observation operation plus ledger #40 process-inventory observer → orphaned-work holder | complete worktree enumeration, dirty/lock/session state and settle-window activity coverage plus one complete fresh current-user process snapshot in which every relevant directory and ownership join is affirmatively excluded | classify dirty/dead/settled only from both complete sources; preserve `unknown` for an unresolved process directory/owner or missing, partial, failed, stale or denied observation; open ordinary reconciliation without mutating git | ten owns both observations; its worktree-observation operation is conditionally granted but unlanded in `seam-response-assembly-followup.md`, ledger #50; five owns reconciliation; eight settles any separately admitted preservation effect |
| Granted Part Ten worktree-observation operation plus ledger #40 process-inventory observer → clean-worktree reclamation holder | complete enumeration plus current branch/head, clean, merge, activity, owner/process/lock/build-marker, due-history and action-time worktree observations | keep every uncertain checkout; after the separate fresh action-time observation, request only a bounded non-forced typed git effect | ten owns both observations and the confined driver; its worktree-observation operation is conditionally granted but unlanded in `seam-response-assembly-followup.md`, ledger #50; six owns due/breaker pressure; eight settles the effect |
| Four/five/eight → framework-prompt holder | current exact operation admission/authorization plus captured menu and worker identity | distinguish missing authorization from an already-admitted operation; keep unresolved menus visible; request only scoped typed input | five owns blockers; eight settles input; ten owns the confined driver |
| Six → holders | lease, fence, loop, recovery and admission observations | bind evidence to current execution authority | six owns execution/recovery lifecycle |
| Five/six → budget-overrun holder | current run, `RunBudget`, safety ceiling, run head and resource/admission facts | confirm the governed overrun, propose a Part Five halt and require Six to fence new work; never synthesize an operator stop or a terminal result | five closes run halt/resume/exit; six closes admission and resource recovery |
| Holders → seven | captured signal and allowed classification outcomes | decide within floors with complete context | seven owns semantic resolution |
| Holders/seven → eight | registered operation plus effect request | revalidate and settle occurrence/quiescence/charge | eight owns effect settlement |
| Eight → nine | effect observations and independent outcome evidence | assess restoration without rewriting settlement | nine owns verification assessment |
| Ten → package/nine | requested holder binding and binding admission | derive exact required instances, arm mode and production activation without inference | ten owns assembly and binding admission; nine owns posture |
| Five/six/eight/ten → duplicate-retirement holder | current work/delegation/effect state, conversation owner and lease/fence, fresh remote-worker liveness, inbound diversion result and exact worker/drain observations | refuse contested or uncertain retirement; release toward reachability; for one uncontested losing copy, inhibit new claims, observe drain and request one graceful close | five keeps work; six owns ownership/fencing and recurrence; eight owns speaker/close effects; ten owns observation and confined actuation |
| Nine/package → granted Eleven guard-and-repair pull operation | facts-only package fold, explicit evaluation-clock query, raw posture, four-label rendering, gaps, complete counts, evidence refs and horizons | render pull-first, preserve unknowns and prove real authenticated reachability without re-grading | eleven owns surface delivery under the unlanded `seam-response-operator-followup.md` grant; ten owns its production binding under the unlanded `seam-response-assembly-followup.md` grant; ledger #51 records both |
| Moving-worker silence holder → five/eleven | current autonomous run, cadence, last attributable outbound and shared output-change observation | keep the lapse visible in pull posture and open the ordinary cadence-repair obligation; do not emit routine status | five closes cadence repair; eleven closes pull rendering; eight settles only separately eligible action/result messages |

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
43, 55, 60, 61, 64 and 75; **checks: P14-NF-06–09/22/24/27/38/39/43–50/66**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Detection latency | inject each stop mode at every adjacent durable boundary on each supported adapter and named machine class | record worst eligible source-to-assessment latency including failures; missed/late case makes posture diverged |
| Proof freshness | stop, delay, duplicate, reorder and clock-skew holder executions across restart and machine handover | stale/incomparable/wrong-generation proof never reads confirmed; outage remains owned |
| Self-action settlement | burst correlated and distinct episodes beyond per-target, machine and pool limits; crash around each effect boundary | finite actions and queue bytes; no identity reset or blind retry; overflow refuses visibly |
| Breaker pressure | drive two holders and multiple workers against one shared operation family through failure, open, cooldown, half-open and recovery | one Part Six pressure identity and breaker history governs all contenders; private counters or worker restart cannot close it |
| Resource use | saturate sessions, helpers, probes, judgments, captures and notices at limit and limit-plus-one | declared memory/process/token/money/concurrency ceilings hold; minimal plane retains reserve |
| Reaper and checkout-reclaim safety | combine old idle workers, untracked Instar command-line interfaces, leaked/reparented Model Context Protocol descendants and clean merged checkout candidates with dirty, unmerged, changed, detached, in-use and build-marked checkouts; also vary active runs, live owners/children, external terminal sessions, uncertain effects, helpers, commitments, compaction and process-identifier reuse | only exact disposable workers/processes and clean merged unused checkouts become eligible; external sessions and every uncertain checkout remain untouched, and zero durable runs end from worker or checkout closure |
| Continuity | compact and replace workers at every grounding/consumption boundary with last-message variations | exact inbound id is accounted for and same run continues; activity-only evidence fails |
| Reconstruction | corrupt disposable package-fold snapshots and rebuild at equal source vectors on two supported architectures; render each rebuild through Nine's public posture resolver at the same explicit evaluation clock; then advance only that clock past one passing arm's freshness end | facts-only fold bytes and rendered posture/gaps are equal at equal vector and clock; with facts unchanged, the later clock expires the arm and the package becomes `diverged`; conflicts and missing lineage remain explicit |
| Notification | burst failures, repeated self-heals and cross-machine duplicates through real channels | action/result-only, one provenance-correct aggregate per causal episode within finite budget |

**Rule — contract availability is reported separately from the check specification.** Rules 26,
34, 42, 45, 49, 69 and 107; **checks: P14-NF-01/11/33/40/42/43/49/50/53/55–67**. A fixture row below is a required
contract, not evidence that its positive neighbor can execute against this checkout. The current
boundary is explicit:

| Contract basis | Checks that can be implemented against the landed owner shape | Checks whose full positive neighbor is blocked |
|---|---|---|
| Landed register, package and verification contracts | Enrollment from `LocalCapabilityPackage.declarationIds`, one-plan-per-instance identity, the facts-only fold, Nine's public clocked posture resolver, consumption-time rendering, evidence and audit cases can be implemented without changing their owners. Part Fourteen code and real executions are still required before any result exists. | None merely because Part Fourteen is not implemented; that is ordinary implementation work, not an owner-shape gap. |
| GRANTED Seven/Eight model-provider operation, ledger #23 | Pure signal extraction, recorded-history joins and conservative unresolved/refusal fixtures remain testable without a provider dispatch. | Live semantic positives for P14-NF-11/40/55, and their P14-NF-49/50 production wiring/lifecycle evidence, are **non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land**. |
| GRANTED Part Ten holder binding/admission and driver request `P14-P10-holder-bindings-and-drivers-v2` in `design-sentinel-holders-seam-request-assembly.md`, ledger #9 | Pure unit fixtures may use candidate values, but they cannot count as owner decoding, production binding or lifecycle evidence. | Production-binding/driver portions of P14-NF-05/16–23/31–36/39/42/44–54/58–67 are **non-executable until `seam-response-assembly-followup.md` lands**. |
| GRANTED Part Five closure record in `seam-response-run-closure.md`, ledger #7 | Activity-only continuity negatives remain testable against the landed slice. | P14-NF-31–33 are **non-executable until `seam-response-run-closure.md` lands** wherever their positive requires `ContinuityAccounting`. |
| GRANTED Part Five delegation, compaction and safety-ceiling follow-up in `seam-response-rungraph-followup.md`, ledger #8/#24, plus request `P14-P5-safety-ceiling-halt-v1` | Root-only, empty-child and missing-transition refusals are testable against the landed slice. | P14-NF-25/28/31–36/49/50/59 are **non-executable until `seam-response-rungraph-followup.md` lands** wherever their positive requires delegation/visible-child accounting, compaction grounding/consumption or a safety-ceiling halt. |
| GRANTED Part Six breaker request `P14-P6-shared-recovery-breaker-v2` | First-attempt inhibition and private-counter rejection are testable on the landed `stub-closed` contract. | P14-NF-43/47/49/66/67 are **non-executable until `seam-response-loop-breaker.md` lands**. |
| GRANTED Part Eight typed-effect request `P14-P8-typed-recovery-effects-v2` | Direct-call/bypass negatives, date-only/wrong-route notice refusals and the landed ordinary-reply path remain testable. | P14-NF-42/45/46/51–53/61/63/66 are **non-executable until `seam-response-effects-payloads.md` lands** wherever their positive requires a typed recovery, git or eligible infrastructure notice effect; production-driver neighbors remain blocked by `seam-response-assembly-followup.md`. |
| GRANTED Part Eight continuity consumer and generic harness-operation follow-up in `seam-response-effects-followup.md`, ledger #8/#29 | Generic-reply rejection and first-reply reference mismatch remain testable without dispatch. | P14-NF-31–33/49/50 are **non-executable until `seam-response-effects-followup.md` lands** wherever their positive requires the first-reply consumer or a generic typed harness operation; production dispatch also waits for `seam-response-assembly-followup.md`. |
| GRANTED paired worker-input request `P14-P8-P10-typed-worker-input-v1` in `design-sentinel-holders-seam-request-worker-input.md`, ledger #21 | Authentic-pending-input discrimination, wrong-target refusal and duplicate-identity logic can be tested as pure holder decisions, but no positive worker delivery may be claimed. | P14-NF-33/56/57 and their P14-NF-49/50 production wiring/lifecycle neighbors are **non-executable until `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land**. |
| GRANTED exact-call prompt response, ledger #41: Part Eight `worker-input` action `approval-prompt-response` in `seam-response-effects-followup.md` plus its confined Part Ten driver in `seam-response-assembly-followup.md` | Missing-authorization, changed-prompt, wrong-worker, wider-selection, ambiguous-menu and reused-claim refusals can be tested as pure holder decisions. | P14-NF-62's exact-call positive is **non-executable until `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land**. |
| GRANTED Part Five dated-reminder due-item record with public `REGISTER`, `READ` and `CLOSE` operations in `seam-response-rungraph-followup.md`, ledger #39 | Date-only message ineligibility and the rule that one `nextWake` is not a distinct reminder remain testable as refusals. | P14-NF-63's registration, due-selection, closure and replay positives are **non-executable until `seam-response-rungraph-followup.md` lands**. |
| GRANTED CONDITIONALLY read-only Part Ten process-inventory observer returning one pinned snapshot in `seam-response-assembly-followup.md`, ledger #40 | Pure classifier negatives for dirty/live work, unknown settle activity, live process owners, active children, protected roles, external sessions and unresolved ancestry are specified without treating candidate values as a complete production population. The observer grants no disposal authority. | P14-NF-61's production owner-dead/complete-observation positive, P14-NF-64's complete-population/production-observer positives and P14-NF-66's complete unused-process join are **non-executable until `seam-response-assembly-followup.md` lands**; actuation also waits for the granted Eight/Ten effect and driver files. |
| GRANTED CONDITIONALLY read-only Part Ten worktree-observation operation in `seam-response-assembly-followup.md`, ledger #50 | Pure classifiers can preserve unknown for incomplete enumeration, worktree fields and activity coverage. A candidate value is not a complete production snapshot, and a git driver recheck is not the pre-selection observer. | P14-NF-61's production complete-worktree/owner-dead positive and P14-NF-66's production candidate-selection and action-time worktree-observation positives are **non-executable until the ledger #50 grant in `seam-response-assembly-followup.md` lands**. |
| GRANTED Part Eleven guard-and-repair pull operation in `seam-response-operator-followup.md` plus Part Ten production wiring in `seam-response-assembly-followup.md`, ledger #51 | Fourteen's facts-only fold, consumption-time query and pure rendering-unit fixtures remain implementable independently. They are not a real Eleven surface or production wiring result. | The authenticated Eleven pull-surface and production-wiring/lifecycle portions of P14-NF-20/22/24/37–39/48–50/55/59–67 are **non-executable until both ledger #51 grant files land**. |

The landed core therefore supports owner-port observations already named above, recorded-history
signal extraction, the facts-only fold, clocked query and refusal portions of this design. It does not support the
blocked live semantic classification, due-item, complete process/worktree population, real Eleven
surface or owner-dead observation, effect/binding/breaker/input cases listed above.
Owner review and landing are prerequisites, not implementation details. Every unavailable positive
remains `inhibited` or `diverged` as section 3 derives; no unavailable check may report PASS on this
HEAD. This document does not emulate a missing run transition, delegation/continuity record,
operation, due item, process inventory, breaker, binding or worker-input action in a private package
type. It also does not substitute a package renderer for Eleven's unlanded public surface.

**Rule — hostile-cut evidence crosses a real durability boundary.** Rules 26, 33, 34, 42 and 69;
**checks: P14-NF-45/46/53**. A **hostile cut** is a test-controlled stop of the responsible process
between two adjacent durable/effect steps, followed by reconstruction from owned history; it is not
a graceful shutdown or an in-memory exception.

**Rule — activation requires all three test tiers and a graduated evidence record.** Rules 34, 37,
43, 62, 65, 70, 72, 73 and 105; **checks: P14-NF-16/17/45/48–50**. Unit tests cover decoders,
facts-only fold purity, equal-vector/equal-clock rendering, later-clock freshness expiry,
classification floors, aggregation and budgets. Integration tests exercise public part-five through
part-nine ports with real persistence and every effect refusal. Live lifecycle tests use production
assembly, real adapters, named hardware, independent witnesses and the real operator channel for
any user-facing output. Each effect-capable binding begins with an `inhibited` Part Ten binding
admission and has an owner, deadline, graduation bar, rollback operation and retrospective review.
Inhibition does not determine the four-state label. A first-soak instance before its first required
observation is `diverged`. Only complete enrollment, fresh independent inhibition evidence, no later
execution and fresh passing evidence for every required observation can make an eligible soaking
instance `dry-run`; only the corresponding complete dark/retired case can be `off`. Missing, failed
or stale observation or inhibition evidence remains `diverged` under section 3.
No screenshot, mock, config, boot log, timer registration or document check establishes live status.
The typed-effect, worker-input, assembly-binding and breaker seam dependencies named above are
activation blockers, not future implementation details that this part may silently emulate.
The same is true of the granted-but-unlanded ledger #50 worktree-observation operation and ledger
#51 Eleven guard-and-repair pull operation plus Part Ten wiring. Fourteen's
unit fold/query result is not production worktree observation or a live operator surface.

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
| P14-NF-11 | semantics | Regex, timeout or unchanged frame blocks/classifies meaning; signal plus bounded judgment passes. The live semantic positive is non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land. |
| P14-NF-12 | fault | Judgment outage falls back to keyword success; provider swap or unresolved disposition passes |
| P14-NF-13 | review | False positives, misses, overrides or failures omitted from population; pinned complete population passes |
| P14-NF-14 | review | Original finding/effect is rewritten by later grade; separate retrospective record passes |
| P14-NF-15 | recurrence | Repeated self-heal closes as isolated success; owned root-cause obligation passes |
| P14-NF-16 | projection/query | A fold reads or persists Nine's posture, reads a clock, or a stored four-label field becomes authority. The positive folds only facts plus register generation, then at consumption calls Nine's public `posture(plan, clock)` resolver against the same pinned vector/generation and renders the four labels. Equal source vectors rendered at the same explicit clock agree across architectures. With those facts unchanged, a later clock at or beyond one passing arm's freshness end makes Nine return stale and Fourteen render `diverged`; that expiry is not rebuild divergence. |
| P14-NF-17 | fault | Corrupt/absent baseline becomes new green baseline or rebuilds are compared at different clocks; signed reconstruction at equal vector and evaluation clock exposes unknown/divergence, while the separate later-clock arm proves legitimate expiry |
| P14-NF-18 | timing | Fresh failed or never-run holder reads confirmed/dry-run; the same binding with a fresh passing independently witnessed result reaches its otherwise eligible state |
| P14-NF-19 | aggregation | One green arm hides stale/missing sibling or an off instance is mixed with an active one; complete all-on and declared on/dry-run populations reach their ordered labels |
| P14-NF-20 | projection | Truncated anomaly list reports all-clear; full count plus bounded details passes |
| P14-NF-21 | posture | Required dry-run/off arm is called protective; visible load-bearing gap passes |
| P14-NF-22 | load | Gap or event emits unbounded per-item notices; bounded view data and causal aggregate pass as unit contracts. The real authenticated Eleven pull-surface positive is non-executable until the ledger #51 grants in `seam-response-operator-followup.md` and `seam-response-assembly-followup.md` land. |
| P14-NF-23 | activation | Accepted risk/soak relabels a gap confirmed; explicit risk beside unchanged posture passes |
| P14-NF-24 | lifecycle | Gap disappears without evidence/disposition or self-heal attempt; owned due finding remains |
| P14-NF-25 | build | Harness registration omits a common stop mode or positive neighbor; full matrix passes |
| P14-NF-26 | timing | Elapsed terminal silence alone proves stuck; subject-specific progress evidence passes |
| P14-NF-27 | performance | A fabricated or unattributed reading is called measured, or one attributable load-average sample is treated as sufficient capacity evidence or reaping authority. A load average sampled on named hardware is admitted as limited telemetry; a capacity/reaping conclusion passes only with the declared core count, memory/pressure, workload, observation window and subject-specific progress evidence. |
| P14-NF-28 | process | Four candidate/grace cases run separately. A known waiter, helper, compiler or active worker remains kept. A worker that is briefly ready/idle but resumes or changes its frame during reap-pending aborts grace and resets candidacy. A worker with affirmative ready/idle evidence that stays unchanged through the observation count, confirmation window and grace becomes disposable only after one fresh full evaluation. Missing affirmative evidence remains kept. Production observation/effect positives are non-executable until `seam-response-assembly-followup.md` and `seam-response-effects-payloads.md` land; the pure classification and grace-abort neighbors remain executable. |
| P14-NF-29 | parser | Hand-typed or another adapter's bytes establish wedge; real captured adapter fixture passes |
| P14-NF-30 | process | Four actuation/disposition cases run separately. A stale/reused PID or pane-wide interrupt refuses. A current exact descendant may receive only the typed direct-target effect after the final full evaluation. An ordinary explained typed refusal keeps that target, leaves other candidates eligible and remains a refusal. An actuator exception or failed result without an explanation stops the reaper loop and inhibits its effect-capable binding until owner-visible repair/review. Production actuation is non-executable until `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land; explained-versus-unexplained disposition is executable separately. |
| P14-NF-31 | continuity | Transcript growth/spinner/new process proves compaction recovery; grounding and last-inbound accounting pass |
| P14-NF-32 | ownership | Recovery/reap acts without current run, lease, fence and conversation re-resolution; exact current authority passes |
| P14-NF-33 | continuity | A finished run or an open obligation with current attributable progress receives an untyped or wrong-class injection. The positive neighbor is one `recovery-injection` request under `P14-P8-P10-typed-worker-input-v1`, bound to the open owned obligation, exact worker/context, last-inbound grounding, immutable payload digest, no current progress/known wait, current lease, one-use claim and eligible recovery evidence; consumption is independently observed and no second identity is minted. |
| P14-NF-34 | dedupe | Parallel compaction triggers create multiple recoveries; one logical episode/effect identity passes |
| P14-NF-35 | lifecycle | Worker loss/reap terminates durable run; same run gains bounded recovery or queued revival |
| P14-NF-36 | multi-machine | Non-owner acts/speaks or remote health covers a missing local instance. With two machine-bound plans, only machine A executes: A may derive from its own plan while machine B remains `unknown`/`diverged`; distinct exact evidence for B and the current owner is the positive neighbor. A genuinely shared service has a third, separately enrolled plan, binding, governed subject and witness; its evidence may satisfy only that shared-service instance and leaves missing machine B unchanged. |
| P14-NF-37 | presence | Infrastructure notice counts as agent answer or carries agent provenance; separate attributable outcomes pass |
| P14-NF-38 | load | Presence/promise overflow vanishes or spawns without cap; visible overflow and layered bounds pass |
| P14-NF-39 | messaging | Status pushes before self-heal or per item; failed-heal-linked action/result aggregate passes |
| P14-NF-40 | crash-loop | Hard-coded count directly pauses critical work; pinned population and bounded judgment pass. The live bounded-judgment positive is non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land. |
| P14-NF-41 | review | Successful-only attempts or expected shedding count as crashes; complete typed population passes |
| P14-NF-42 | effect | Holder directly kills/spawns/swaps/pauses/notifies/edits; registered effect request passes |
| P14-NF-43 | load | New key/worker/machine/episode escapes action cap; hierarchical identity-stable budget refuses |
| P14-NF-44 | process | Generic cancellation text claims operator action; recorded true principal and observation pass |
| P14-NF-45 | fault | Lost effect receipt starts fresh attempt; original identity reconciliation passes |
| P14-NF-46 | settlement | Absence of local process/log proves non-occurrence/quiescence/charge; independent adapter evidence passes |
| P14-NF-47 | lifecycle | Attempt exhaustion disappears or loops forever; typed refusal, maximum exposure and owner pass |
| P14-NF-48 | fault/e2e | Watcher failure or empty inventory paints green; expired horizon and owned divergence pass |
| P14-NF-49 | wiring/e2e | Required port is null/no-op/mock or bypassed; production assembly and real delegation evidence pass. Any positive claiming the real Eleven guard-and-repair pull operation or its production binding is non-executable until the ledger #51 grants in `seam-response-operator-followup.md` and `seam-response-assembly-followup.md` land. |
| P14-NF-50 | evidence/e2e | Declared fixture with missing check-run, named hardware or independent witness emits no live/held claim; a current production assembly actually executes unit, integration and lifecycle tiers with current digests, named hardware and independent witnesses and becomes eligible for only the corresponding held/live claim. Its real Eleven-surface arm is non-executable until the ledger #51 grants in `seam-response-operator-followup.md` and `seam-response-assembly-followup.md` land. |
| P14-NF-51 | target guard | Raw path, symlink or ancestor resolution reaches a protected target, or canonical identity is unavailable, and the adapter refuses; a separately rooted disposable target with verified canonical ancestry is allowed |
| P14-NF-52 | target guard | Broad exception, target substitution or missing audit field is refused; one exact audited operation/target exception is allowed, and an adapter refusal is preserved unchanged through effect settlement |
| P14-NF-53 | storage fault | For a declared single-object atomic replacement or one compare-and-swap ref update, hostile cuts reconstruct only the old or new state for that exact scope. For recursive, cross-filesystem, working-tree or other multi-object mutation, a cut that leaves partial physical state must reconstruct preserved per-object evidence, a partial/uncertain outcome, maximum exposure and an owned reconciliation with no blind retry; false success or an all-or-nothing claim fails. |
| P14-NF-54 | projection | A never-enabled dark instance with fresh independent inhibition evidence reads `off`; its required never-run arm remains raw Nine `unknown`, and its current critical-outcome obligation remains a visible gap because the binding is not active. Missing/expired inhibition evidence makes the same instance `diverged`. A formerly healthy required arm whose binding is then deliberately inhibited may remain raw Nine `healthy` while its prior pass is fresh; the package derives `off` for an otherwise eligible dark instance or `dry-run` for an otherwise eligible soaking instance, but the obligation still has a gap because current intended-and-observed active binding is absent. A first-soak instance before its first required observation reads `diverged`; with every required observation fresh and passing plus a never-executed deliberately inhibited effect arm it reads `dry-run`. An unexpected inhibition and a fresh required-arm failure read `diverged`. Zero effect inhibitions with every binding active and fresh reads `on-confirmed`, not `dry-run`. Empty enrollment and mixed off/active instances read `diverged`. No Fourteen fixture requires Nine to relabel a required arm `inactive`. |
| P14-NF-55 | promise lifecycle | An attributable promise absent from the durable work source is ignored, or keywords create an obligation directly. Full-context judgment finds a supported missing registration and the ordinary Part Five path records or explicitly declines it; a matched existing obligation is not duplicated. The live semantic positive is non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land. |
| P14-NF-56 | input recovery | Model-suggested dim ghost text or an inconclusive/raced capture receives a keypress or an `ordinary-reply`. The positive neighbor re-observes the exact worker/session/pane, incarnation, context generation and same-pane presentation, then admits one `submit-authentic-pending-input` request under `P14-P8-P10-typed-worker-input-v1` with the intake/payload digest and consumption bar; ghost and inconclusive neighbors remain preserved, untouched and visible. |
| P14-NF-57 | recovery race | Provider-throttle and compaction recoveries run concurrently, reuse one another's payload, permit reaping, or retry a lost worker-input receipt under a fresh id. One Part Six exclusion key makes one defer, preserves its due work, keeps the reaper veto active and later admits only the recovery class's typed `neutral-continuation` or `recovery-injection`; lost receipt permits observation only until non-occurrence, quiescence and delayed-delivery exclusion are decisive. |
| P14-NF-58 | declaration | A recurring package feature or sentinel declares `repeats: no`, names an unresolved/unpaired bound, or schedules through a different loop policy. The positive neighbor declares `bounded` repetition by the exact live bound entry paired with the same registered Part Six `LoopPolicy` used by its plan schedule and production binding; the package parent budget is finite. |
| P14-NF-59 | budget halt | A confirmed autonomous-run budget overrun deletes run state, fabricates an operator stop, marks work complete/unreachable, or closes an unverified worker directly. The positive neighbor records the exact overrun, uses Part Five's durable safety-ceiling halt, Part Six's fence/resource closure and the requested typed Part Eight/Ten process effect only for an action-time verified worker; work stays open and any notice has infrastructure provenance. |
| P14-NF-60 | cadence observation | A moving-worker run is omitted because there is no new inbound input or open promise, or routine liveness status is pushed. The positive neighbor enumerates every current autonomous run, records the moving-but-user-silent case in view data and opens the ordinary Part Five cadence-repair path; only a separately eligible action-needed/result-bearing message may pass through Part Eight. Its real authenticated Eleven pull-surface arm is non-executable until the ledger #51 grants in `seam-response-operator-followup.md` and `seam-response-assembly-followup.md` land. |
| P14-NF-61 | orphaned work | A dirty worktree with no registered promise/run is omitted after its owner dies, dirty work with a live owner is seized, or incomplete evidence proves absence. The positive classification requires the complete fresh Part Ten worktree snapshot conditionally granted under ledger #50 and a complete fresh ledger-#40 process snapshot. Every relevant current-user process must have a known directory outside the canonical worktree or independent scope evidence proving it cannot own/edit the worktree, and every ownership join must resolve non-owner. Dirty/owner-dead with full quiet-window evidence opens one owned reconciliation finding. Dirty/live remains untouched. A complete process snapshot containing one otherwise relevant unregistered process with unknown directory/ownership makes owner-dead `unknown`; the otherwise identical snapshot with that process freshly proven outside and non-owner is the positive boundary. Missing, partial, failed, stale or denied process inventory remains unknown. Failed worktree enumeration or missing activity coverage remains unknown. Any unknown opens no finding and cannot authorize preservation. Pure classifier neighbors remain executable. The production owner-dead/complete-observation positive is non-executable until the ledger #40 process-inventory grant and ledger #50 worktree-observation grant in `seam-response-assembly-followup.md` land. An optional preservation commit additionally waits for `seam-response-effects-payloads.md` and the Part Ten driver, and does not close the finding. |
| P14-NF-62 | framework prompt | A missing authorization is auto-approved, an already-admitted operation remains silently stranded, or a blanket/ambiguous/unrecognized menu receives input. The positive re-resolves ledger #41's exact authorized call, signed `HarnessObservation` prompt-text and menu digests, current worker/incarnation, selected allow-once menu member, immutable payload digest and one-use claim. It requests only the granted Part Eight `worker-input` action `approval-prompt-response`; the Part Ten driver rechecks the same prompt and worker immediately before input. Missing authorization stays blocked, and persistent or unsupported menus remain untouched and visible after bounded attempts. This positive is non-executable until `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. |
| P14-NF-63 | dated reminder | A check-in is represented only by mutable `nextWake`, loses its promise relationship, duplicates on replay, fires before due or after closure/settlement, treats a date as message eligibility, takes a wrong route, omits required failed self-heal, bypasses Eight, or retries uncertain delivery. The positive neighbors are the seven separately stated assertions in section 6: registration/replay, timing, closure, date-only eligibility, eligible notice, routing and delivery uncertainty. Assertions 1–3 are non-executable until the ledger #39 grant in `seam-response-rungraph-followup.md` lands. Assertion 5's dispatch positive additionally waits for `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md`. |
| P14-NF-64 | process population | An untracked Instar CLI or leaked/reparented allowlisted MCP descendant is omitted, a partial scan reads empty/complete, a live-owned process or active child becomes disposable, an external/non-Instar terminal session is touched, unresolved ancestry becomes parentless, or inventory identity is reused as action-time proof. The positive neighbors consume one complete pinned Part Ten inventory. An old ownerless untracked Instar CLI and an old ownerless leaked/reparented allowlisted MCP descendant become assessment candidates. Otherwise identical live-owner, active-child, protected/minimal-plane and external-session cases remain kept. Hop-limit, missing-parent and cycle cases each produce unknown ownership and remain kept. Partial or failed enumeration remains unknown. Any selected process is freshly revalidated before a typed direct-target effect. Complete-population and production-observer positives are non-executable until the ledger #40 grant in `seam-response-assembly-followup.md` lands; the actuation positive additionally waits for `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md`. |
| P14-NF-65 | posture instability | Only the last posture is inspected, changing attempt/success references falsely flap, three posture changes in ten ticks falsely flap, four are missed because the last posture is healthy, missing/wrong-generation samples are invented as transitions, or the temporal result overwrites raw Nine posture. For one exact plan/generation/instance, equality compares only the plan-ordered arm tuples `(arm id, sourceStatus, posture)` and the overall posture. Four signature transitions across the most recent ten scheduled observations open one retrospective instability finding while preserving the last raw posture; three transitions open none. Ten distinct fresh successful executions whose attempt/success ids and evaluation times all change but whose selected signature fields remain equal produce zero transitions. Missing/incomparable evidence remains a gap, and a later stable window disposes the temporal finding without rewriting its history. |
| P14-NF-66 | clean-worktree reclamation | Four assertions run and report separately. (1) **Candidate selection — Fourteen consumes Ten.** Reclaiming a dirty, unmerged, detached, in-use, build-marked, activity-unknown or otherwise uncertain checkout fails. A complete current Ten worktree snapshot from the conditionally granted ledger #50 worktree-observation operation joined to the complete ledger-#40 process snapshot selects one clean, merged and unused checkout. The production positive is non-executable until the ledger #40 and #50 grants in `seam-response-assembly-followup.md` land. (2) **Restart due — Six.** A restart that clears the bounded initial due fails. Reconstructed due history that schedules the observation passes against the landed Part Six loop contract. (3) **Failure breaker — Six.** A failed removal that retries forever or loses pressure on restart fails. The same checkout entering the shared persistent breaker passes only after `seam-response-loop-breaker.md` lands. (4) **Mutation — Eight and Ten.** Direct git, stale enumeration or changed action-time branch/head, cleanliness, merge, owner/process/lock or marker state fails. One non-forced typed `git-mutation` after the granted Part Ten worktree-observation operation and the confined driver both produce a fresh all-clear passes only after the ledger #50 grant, `seam-response-effects-payloads.md` and the relevant Part Ten driver grant in `seam-response-assembly-followup.md` land. |
| P14-NF-67 | duplicate retirement | A stale/unchanged remote-liveness snapshot accrues confirmation; unknown/false remote liveness closes the local worker; a protected copy or copy holding a live build, helper, autonomous run or uncertain effect is held/fenced; every copy becomes held under an unreadable pool view; newer undivertable local inbound remains held; unobserved or partial drain permits close; timeout escalates to hard kill; or a new session resets recurrence pressure. The positive neighbors require advancing fresh remote-owner observations, preserve every contested/unknown case with one operator-visible item, release at least one hold toward reachability on mutual/unknown hold, release immediately for changed ownership/liveness or undivertable new inbound, inhibit new claims only for one uncontested losing copy, permit already-claimed work to settle, require corroborated consecutive drain observations and request exactly one typed graceful close while keeping the durable run owned. Policy/refusal neighbors are executable. The production close/driver positive is non-executable until `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. The shared recurrence-pressure positive is non-executable until `seam-response-loop-breaker.md` lands. |

---

## 14. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 45, 49, 53, 59, 64, 68, 69, 71, 87 and 88;
**checks: P14-NF-01/03–05/25/32/35/49/50/55–67**.

| Duty | Disposition |
|---|---|
| Rule 59 and part ten — enumerated stall coverage | **Held:** the common matrix, adapter additions, real parser fixtures and positive neighbors are required by P14-NF-25–30. |
| Part nine — fresh holder posture | **Held by consumption:** per-plan/arm/instance execution, independent witness, facts-only population fold and clocked four-label query are covered by P14-NF-05–24. Nine retains core posture and assessment authority. |
| Parts five/six — durable work and recovery | **Partial, activation-blocking:** holders detect and assess; five retains run closure; six owns leases, loops and recovery. P14-NF-31–36 refuses worker events as work completion. Delegation, visible-child accounting, compaction grounding/continuity and safety-ceiling halt positives remain non-executable until `seam-response-run-closure.md` and `seam-response-rungraph-followup.md` land. |
| Parts seven/eight — judgment and effects | **Partial, activation-blocking:** semantic classification uses Seven, but the real provider path is non-executable until the GRANTED ledger #23 files `seam-response-judgment.md` and `seam-response-effects-followup.md` land; this blocks live semantic positives P14-NF-11/40/55 and their P14-NF-49/50 wiring/lifecycle evidence. The landed Eight supports ordinary replies only; the granted typed recovery/action-result payload seam is non-executable until `seam-response-effects-payloads.md` lands, and Ten's matching granted drivers are non-executable until `seam-response-assembly-followup.md` lands. Affected bindings stay inhibited. |
| Part eleven — reachability and operator output | **Partial, activation-blocking:** Fourteen owns its facts-only fold, consumption-time query and bounded view data. Eleven owns authenticated rendering, reachability and the minimal plane, but no Eleven implementation/public export is landed. The guard-and-repair pull operation is GRANTED but unlanded in `seam-response-operator-followup.md`; its Part Ten production wiring is GRANTED but unlanded in `seam-response-assembly-followup.md`; ledger #51 records both. Real surface and production-wiring positives remain non-executable until both grant files land. Bounded action/result notices still route through Eight. |
| Rules 24/58 — recurrence and outcome review | **Held:** complete populations, reason/outcome separation and root-cause obligation P14-NF-13–15/41. Semantic accuracy remains judged, never mechanically guaranteed. |
| 1.x missing-promise, pending-input and throttle recovery distinctions | **Partial, activation-blocking:** `CommitmentSentinel` missing registration is held by P14-NF-55. `StuckInputSentinel` ghost/inconclusive exclusion and `RateLimitSentinel` compaction exclusion remain explicit under P14-NF-56/57, but their positive delivery actions are non-executable until the granted `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. Keyword authority, untyped keypresses and transcript-growth proof are deliberately excluded. |
| 1.x dated commitment reminders | **Retained with two activation blockers:** P14-NF-63 retains absolute due selection, terminal and already-settled suppression, bounded attempts and visible undelivered state. The GRANTED ledger #39 addendum in `seam-response-rungraph-followup.md` gives Five the distinct item, promise relationship and public `REGISTER`, `READ` and `CLOSE` operations that the landed single `nextWake` cannot express; those positives remain non-executable until the grant lands. The reminder holder observes; Eight owns eligibility, alerts routing and uncertain settlement. A date alone is pull-only, infrastructure notices go to the declared alerts destination, and an internal-issue notice requires failed eligible self-heal. Direct send is rejected. An otherwise eligible dispatch positive additionally waits for `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md`. |
| 1.x orphan process populations | **Retained with observer/effect split; activation-blocking:** P14-NF-64 retains untracked Instar CLI and leaked/reparented allowlisted MCP descendant populations, live-owner/active-child/protected-floor exclusions, external process/session no-auto-kill behavior and bounded rollout. The GRANTED CONDITIONALLY ledger #40 addendum in `seam-response-assembly-followup.md` gives Ten the read-only process-inventory observer returning one pinned snapshot that the landed known-launch observer lacks; complete-population and production-observer positives remain non-executable until the grant lands. It grants no disposal authority. Any later actuation also waits for the granted Eight/Ten process effect/driver seams and exact action-time revalidation. |
| 1.x clean-worktree reclamation | **Retained as a separate holder; activation-blocking:** P14-NF-66 owns `AgentWorktreeReaper`'s inverse-of-dirty population. Clean, merged and unused are all required; dirty, unmerged, detached, in-use, build-marked, changed and uncertain checkouts stay kept. Part Six owns restart-surviving first-observation debt and per-checkout failure pressure. The full unused-process join remains non-executable until the ledger #40 grant in `seam-response-assembly-followup.md` lands. The complete worktree, branch/head/merge, activity and action-time re-observation positives additionally wait for the conditionally granted worktree-observation operation in `seam-response-assembly-followup.md`, ledger #50, to land. Non-forced checkout removal is a typed `git-mutation`, non-executable until `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land; persistent breaker transitions also wait for `seam-response-loop-breaker.md`. P14-NF-61 covers dirty orphan reconciliation and does not discharge this clean reclamation duty. |
| 1.x guard-posture flapping | **Held retrospectively:** P14-NF-65 retains the more-than-three transitions in ten scheduled ticks threshold in the guard-posture tripwire's named retrospective arm. Equality uses only plan-ordered arm id/source-status/posture tuples plus overall posture; attempt/success references and evaluation time stay evidence but do not create transitions. The three-transition and ten-distinct-fresh-success/zero-posture-transition neighbors preserve the current raw Nine posture separately. |
| 1.x unregistered orphaned work | **Held as a stronger observation; reconciliation/effect split and activation-blocking:** P14-NF-61 requires positive quiet evidence across the settle window, the complete Ten worktree snapshot from the conditionally granted ledger #50 worktree-observation operation, and a complete fresh current-user process snapshot whose every relevant directory and ownership join is affirmatively excluded before owner-dead can be true. Dirty/live work stays kept. An unresolved directory/owner, failed worktree enumeration, missing activity coverage, or missing/partial/failed/stale/denied process inventory produces `unknown`. The conditionally GRANTED ledger #40 process observer in `seam-response-assembly-followup.md` supplies only the process half. The production owner-dead positive also waits for the ledger #50 grant in `seam-response-assembly-followup.md` to land. Five owns the resulting reconciliation. Any optional preservation commit is a separate typed Eight/Ten effect and additionally waits for `seam-response-effects-payloads.md` and the Part Ten driver. |
| 1.x session-reaper confirmation, failure and duplicate-retirement safeguards | **Retained with production observation/effect activation blockers:** P14-NF-28/30 require affirmative ready/idle evidence, byte-stable sustained candidacy, separate reap-pending grace, a full evaluation on every grace tick, abort on resumed/changed activity and a final full evaluation before termination. An explained typed refusal remains an ordinary refusal. An unexplained actuator failure stops the reaper loop and inhibits later reaper actuation pending owner-visible repair/review. P14-NF-67 separately retains fresh advancing remote-owner liveness, reachability on uncertainty, contested-work refusal, owner/inbound rechecks, observed drain before close and shared recurrence pressure. Nine owns observations. Five owns work/revival. Six owns cadence, ownership/fencing and pressure. Eight owns refusal, one-voice and close-effect semantics. Ten owns binding inhibition, worker/drain observation and action-time revalidation. Production positives are non-executable until the named `seam-response-assembly-followup.md`, `seam-response-effects-payloads.md`, `seam-response-effects-followup.md` and `seam-response-loop-breaker.md` dependencies land. |
| 1.x framework approval prompts | **Partial, activation-blocking:** P14-NF-62 distinguishes missing authorization from an already-admitted exact operation, preserves bounded detection and keeps unresolved menus visible. Ledger #41's exact `worker-input` / `approval-prompt-response` positive is non-executable until `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. Blanket prompt approval is rejected. |
| 1.x destructive target guards | **Partial, activation-blocking:** exact target verification, audited exceptions, refusal propagation and crash cuts are specified by P14-NF-51–53, but require the requested Eight/Ten typed drivers. Part eight remains the sole effect authority. |
| 1.x enforced autonomous-run termination | **Held at the observation/ownership split; actuation-blocking:** P14-NF-59 retains confirmed budget-overrun detection and delegates the durable halt to Five and admission/resource closure to Six. The halt positive is non-executable until `seam-response-rungraph-followup.md` lands. Worker closure uses Eight/Ten only after exact process verification. State deletion, synthetic operator-stop attribution and terminalizing unfinished work are rejected. The process-effect positive neighbor remains blocked by the same Eight/Ten dependencies above. |
| 1.x autonomous moving-worker silence heartbeat | **Held as observation, routine push rejected:** P14-NF-60 enumerates moving-but-user-silent autonomous runs even without inbound input or a promise, exposes them on Eleven's pull surface and assigns cadence repair to Five. Rule 87 forbids preserving a routine status push; only independently eligible action-needed/result-bearing output may use Eight. |

---

## 15. Operator decisions and honest limits

**Value — accepted-gap and soak question.** Which effect classes, if any, may remain deliberately
inhibited as visible load-bearing gaps during rollout, and for how long before graduation or
rollback? Options: no accepted soak gaps; a single fleet duration for named classes; or governed
per-class durations below a fleet ceiling. **Recommendation:** per-class durations below a short
fleet ceiling, each with an owner, deadline and rollback. Every such instance remains unprotected.
It is `dry-run` only while enrollment is complete, every required observation is fresh and passing,
and inhibition evidence is current; missing, failed or stale observation/inhibition evidence makes
it `diverged` until repaired. Only live evidence can make it `on-confirmed`.

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

**Value — process-inventory consumer question.** If this design is approved, how broadly beyond the
three required consumers should the conditionally granted read-only Part Ten process-inventory
observer in `seam-response-assembly-followup.md`, ledger #40, be exposed? The process-population
reaper, orphaned-work holder and clean-worktree reclamation holder are mandatory consumers because
P14-NF-61/64/66 require its complete snapshot. Options for genuinely additional consumers are:
neither; both the session-watchdog and session-reaper; or every holder that observes a process.
**Recommendation:** add the session-watchdog and session-reaper, producing five named consumers in
total: process-population reaper, orphaned-work holder, clean-worktree reclamation holder,
session-watchdog and session-reaper. The inventory grants observation only; it never grants disposal
authority. Every selected target or checkout still requires fresh action-time identity
revalidation through Eight and Ten. Clean-worktree reclamation also requires the conditionally
granted but unlanded worktree-observation operation in `seam-response-assembly-followup.md`, ledger
#50; the process snapshot does not replace it.

**Value — honest limits.** These holders can prove that registered observations ran and expose
known gaps. They cannot prove that every future stall shape is enumerated, that an opaque provider
reported truth, that a semantic judgment is wise, or that an observer survives total machine and
independent-witness loss. Those limits remain visible in coverage, source horizons and
retrospective populations rather than being converted into green posture.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90,
109 and 111; **checks: P14-NF-49/50** and the governed review process. This document claims no
deployment, actual measurement, live holder, independent convergence or operator approval.
An independent desk must converge and the operator must approve the exact governed content before
implementation. After implementation, activation becomes eligible only after the real three-tier,
hostile-cut, named-hardware, independent-witness, channel and reconstruction evidence exists.
Those executions provide runtime certification. The document check and successful build are
technical evidence only.

*Depends on: Parts one through eleven, especially Five (`docs/09-the-run-graph.md`), Seven
(`docs/11-the-judgment-doorway.md`), Eight (`docs/12-the-effect-doorway.md`), Nine
(`docs/13-the-verification-holders.md`), Ten (`docs/14-the-assembly.md`) and Eleven
(`docs/15-the-operator-surfaces.md`).*
