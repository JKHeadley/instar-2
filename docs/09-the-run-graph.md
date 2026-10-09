# Part five — the durable run graph, delegation contracts, and the agent-transport port

**Status: draft, awaiting approval. Governed.**

**Value — work belongs to the record, not the worker.** A session can disappear while its
assignment remains. This design makes the assignment, its next step, its children, and its
unanswered obligations reconstructable. A replacement worker receives those records and checks
what happened before continuing. No automatic check enforces this preference itself; the Rules
below specify the observable behavior it chooses.

**Rule — this document's scope and evidence are explicit.** Rules 49, 69, 91, and 113.
**Check:** P5-NF-01 checks the ownership inventory, inherited-duty table, and seam table;
`node scripts/check-governed-docs.mjs docs` checks the governed body. This is a design contract,
not a claim that the runtime or its fixtures exist. P5 fixture identifiers name required future
automatic checks. Under part three, an unexecuted fixture supports only `declared`, never
`held*` or `held-reviewed`. No claim about the present behavior of Instar 1.x is made here.

---

## 1. What this part owns, and what it only names

**Rule — one owner per type and behavior.** Rules 1, 30, 69, and 114; big picture sections 4,
10, and 13. **Check:** P5-NF-01 rejects a duplicate schema owner, a private cross-part import,
or a port implemented by a protocol-specific branch in the work engine. The following inventory
is closed; field groups and variant names below are members of these types, not extra types.

| Defined here | Meaning and construction |
|---|---|
| `Run` | A durable assignment and its immutable opening facts; decoded at run admission. |
| `RunStep` | One proposed bounded action with a stable logical identity; decoded before admission. |
| `RunTransition` | A causally linked change in work state; decoded by transition admission and stored inside part two's envelope. |
| `RunBudget` | The resource and repetition limits shared by a run and the work it delegates; decoded from registered bounds and the permitted allocation. |
| `RunExit` | A proposed completion, demonstrated unreachable exit, or authorized cancellation; decoded at closure. |
| `DelegationContract` | The durable parent-child edge and the obligations on both ends; decoded at delegation admission. |
| `DelegationResult` | A child's final submission and its return destination; decoded at result intake. |
| `AwaitingAuthorization` | An owned request lifecycle with an explicit authorized arm and non-yes terminals; decoded from part four's routed request. |
| `ExhaustionRecord` | Evidence of a bounded investigation into a claimed blocker; derived from an exhaustion run. |
| `SessionGrounding` | The actual-start history and clock read, with coverage and current work references; produced by the grounding reader. |
| `ContinuityAccounting` | The first post-compaction reply's disclosure and accounting of the pre-pause inbound message; derived from grounding and the reply record. |
| `AgentTransportEnvelope` | A protocol-independent, authenticated message binding a delegation to a durable transport conversation; decoded at the port boundary. |
| `DeliveryEvidence` | A delivery-state claim, its exact message subject, and its authoritative witness; decoded from transport or receiving-agent evidence. |
| `AgentTransportPort` | The public interface whose operations and returned evidence are specified in section 7; an interface, not a stored fact schema. |

**Rule — imported meanings stay with their owners.** **Check:** P5-NF-01 compares this list with the
schema inventory and dependency graph. Types from part one are named and used, never redefined:
`VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Result`, `Success`,
`Refused`, `Measurement`, `Profile`, `Evidence`, `Decision`, `Authorization`, `Scope`,
`ActionFloor`, `Outcome`, `SecretRef`, `Provenance`, `Conflict`, and `UnresolvedInput`.
Part two owns the fact envelope, causal frontier, durability state, version chain, capture
status, and projection contract. Part three owns declarations, register generation, governed
ports, and check-run records. Part four owns conversation bindings, intake, operation
classification, authorization requests, and the resolution of identity and standing.

**Rule — this part states demands on neighboring parts, not substitute definitions.**
**Check:** P5-NF-01 and P5-NF-29 check the seam's ownership and realization contract. Part six owns
leases, fencing, the loop primitive, recovery, and the reference transport adapter. Part seven
owns `JudgmentRequest`, the judgment doorway, benchmark records, and refinement of `ask`.
Part eight owns the effect doorway and operation re-validation. Part nine owns verification
holders, probes, retrospective review, semantic coverage review, and outcome grading. Part ten
owns harness adapters and executable assembly. Part eleven owns operator surfaces and the
minimal communication plane. An unapproved neighboring design is not a settled premise:
part six must demonstrate feasibility against the demands here before joint convergence;
this document does not depend on six having been approved first.

**Value — a graph with a single accountable parent per child.** No check enforces the merit of
this choice. Each child has one owning delegation edge, so somebody unambiguously owns its
result and cancellation. Work may depend on many other runs through non-owning dependency
references. A coordinator, specialist groups, a single session, or several agents are all legal
placements. There is no mandatory orchestrator tier. P5-NF-06 enforces the chosen graph shape.

---

## 2. Durable assignments, steps, and transitions

**Rule — closed construction and shared history apply here too.** Rules 7, 28, 90, and 113.
**Check:** P5-NF-02 runs compile-negative construction fixtures, decoder failures, schema
migration fixtures, and canonical-byte comparisons for every stored type in section 1. No
constructor outside this part can assemble one. Constitutional fields go through part one's
decoders. Serialized values carry type and schema version. Unknown versions refuse at local
admission and follow part two's bounded hold on replication. Identity equality for these stored values is by id, version equality by type/schema/id and
canonical hash, and value equality by canonical fields within the declared comparison domain.
Every admitted record is immutable; a wait changing arms is a new transition fact, never an
edit to an earlier record. Pure decisions take clock measurements and register generation as arguments. No field holds secret bytes; large text
uses the existing capture store, its redaction and availability contract unchanged.

**Rule — a run is born with its duties, not an empty placeholder.** Rules 8, 46, 68, 83,
92, 93, 97, and 114. **Check:** P5-NF-03 rejects an opening missing any required field below;
P5-NF-04 kills the caller between intake admission and run creation and proves reconstruction
creates the same assignment once.

| `Run` opening field | Meaning |
|---|---|
| `id`, `opening` | Globally unique run identity and the intake or delegation fact that caused it. Root creation deduplicates by that cause, not by a session name. |
| `intent`, `directives` | References to the admitted `Intent` and its `under` lineage. A delegation preserves the originating lineage and adds the recipient's applicable directives. |
| `owner` | The accountable verified agent or system principal under recorded standing. A worker, process id, or machine name cannot fill this field. |
| `scope`, `authority` | Assigned scope and references to the grants and authority resolution supplied through part four. These are evidence of the basis at creation, not perpetual permission. |
| `parent` | Absent for a root; otherwise exactly one owning `DelegationContract` reference. |
| `exitTest` | Registered check or judgment point, exact subject and acceptance conditions, required evidence kinds and freshness. A changed test requires a recorded, standing-covered decision; it never edits the old test or proves the old assignment complete. |
| `budget` | `RunBudget`; the allocation whose ceilings include delegated work. |
| `cadence`, `nextWake` | Registered check-in cadence and first wake condition, each owned and bounded. Autonomous cadence defaults to one hour unless a governing charter supplies another. |
| `blockedOn` | `nothing`, or a specific pending step, authorization, judgment, child set, recovery, resource, or blocker reference with a responsible owner and next observation. Empty prose such as “waiting” refuses. |
| `resultDestination` | Durable return endpoint: a parent edge or a conversation's recorded route; never only a live session address. |
| `generation`, `createdAt` | The verified register generation and clock measurement at creation. |

**Rule — a run identity never changes its opening.** **Check:** P5-NF-02/05. All opening fields are
immutable; identity equality is by `id`, value equality by canonical fields. State evolves
through `RunTransition`, not edits to `Run`. Conflicting immutable openings for one run yield
part one's `Conflict`, not a timestamp winner. A replacement assignment has a new id and an
explicit causal relationship to its predecessor; it does not erase the original obligations.

**Rule — every step has an identity before anything may happen.** Rules 24, 26, 42, 63,
and 114. **Check:** P5-NF-07 rejects dispatch before the step's durable admission and rejects
reuse of a logical key with different content. A `RunStep` contains `id`, `run`, expected
predecessor transition, operation class, exact proposed-operation digest, evidence references,
current directive references, required judgment or authorization references, requested budget
allocation, part-six ownership reference, result destination, and the admitted register
generation. Its kind is one of `compute`, `judge`, `effect`, `delegate`, `collect`, `wait`,
`ground`, or `evaluate-exit`. All fields are immutable. Redelivery and recovery preserve
the logical step and existing operation identity; they do not authorize another invocation.
For judgment, section 3 binds each seven-owned attempt to one six-owned operation; a fresh
provider attempt under the same logical request needs a new mapping after reconciliation.
A changed operation is a new step and cannot bypass an unresolved predecessor's effects.

**Rule — the work graph is acyclic, but work can repeat.** Rules 55 and 114. **Check:**
P5-NF-06 refuses self-parentage, two owning parents, a dependency cycle, or a graph exceeding
its declared node, depth, or fan-out bound. The depth bound is a resource declaration, not a
fixed topology in the core. Sequential attempts append causally linked attempt evidence;
subsequent work windows use new steps through part six's loop primitive; they never create a cycle in the dependency
graph. Adding a dependency must name an existing admitted target; missing remote references
hold under part two's replication contract, never count as satisfied.

**Rule — transitions are records with preconditions.** Rules 31, 33, 63, 68, and 97.
**Check:** P5-NF-05/08/09. `RunTransition` contains `id`, run id, expected predecessor(s),
triggering fact, transition kind, responsible principal, admitted standing and part-six
ownership references, register generation, clock measurement, affected step or edge, outcome
and evidence references, and the resulting blocked-on/wake obligation. All fields are
immutable. Reconciliation may join several predecessor proposals only with the standing-covered
resolution of their `Conflict`. The projection reconstructs state from admitted transitions;
no caller can set state directly or select a head by wall clock.

**Rule — state is derived by the following transitions.** **Check:** P5-NF-08 enumerates every allowed
pair and rejects every omitted pair. `running` means an admitted attempt exists, not that
CPU use has been observed. Worker liveness is separately evidenced by part six.

| State | Permitted next state and required cause |
|---|---|
| `ready` | `running` on admitted ownership, resource allocation, actual-start grounding, and step intent; `waiting` on a named dependency; `halted` on an authenticated stop or safety ceiling; `closing` on an admissible exit proposal. |
| `running` | `ready` after a recorded step outcome allows another step; `waiting` for judgment, authorization, children, effect observation, or bounded retry; `recovering` when the worker loses ownership or disappears; `halted` on stop or ceiling; `closing` on an exit proposal. |
| `waiting` | `ready` only when the named dependency is proved satisfied under current authority; `recovering` on a recovery obligation; `halted` on stop or ceiling; `closing` on an admissible exit proposal. A timer makes work due; it does not satisfy authorization or prove success. |
| `recovering` | `ready` or `waiting` after part-six recovery evidence and reconciliation of pending operations; `halted` on stop or ceiling; `closing` only with closure evidence. |
| `halted` | `ready`/`waiting`/`recovering` only on a recorded, authorized resume that addresses the halt cause; `closing` on a valid cancellation or unreachable proposal. No automatic timer clears an operator stop. |
| `closing` | `completed`, `unreachable`, or `cancelled` once section 4's settlement requirements hold; `waiting` if closure needs observation; `halted` while a stop applies. |
| `completed`, `unreachable`, `cancelled` | No fresh execution in this run. Late evidence, corrections, result delivery, and dispute records remain appendable; follow-on work has a new run id with its own authority. |

**Rule — incompatible concurrent transitions expose a conflict and inhibit execution.**
**Check:** P5-NF-09 permutes concurrent transitions and injects late segments. Identical semantic requests
collapse; independent observations accumulate. Two incompatible successors of one predecessor
produce `Conflict` and the narrower executable state. No one chooses an ordering merely to
make the fold deterministic. A stop's inhibition is monotone until an authorized resume causally
acknowledges it. Facts admitted with provisional, contested, or unavailable-evidence taint
propagate it under part two; none can manufacture a clean execution head.

---

## 3. What ownership, resources, and recovery must realize

**Rule — run responsibility and permission to execute are different.** Rules 63, 68, 83,
and 114. **Check:** P5-NF-10/29. The durable `owner` is accountable for the assignment;
part six supplies the current permission held by a worker or machine. Losing that permission
cannot complete the work, cancel it, erase a child, or transfer the accountable owner. A
responsibility transfer is an explicit, standing-covered handoff with the receiving owner's
recorded acceptance; the original owner remains accountable until that acceptance is durable.

**Rule — authority is checked at admission, not merely at worker launch.** **Check:** P5-NF-10 tests
an old worker running after replacement; P5-NF-29 must pass against part six's realization.
Part six must supply an operation that admits at most one executable successor of an expected
run predecessor under current ownership, and fences a former holder at every session start,
step admission, resource allocation, and conversation effect. A read-then-append sequence
without exclusion at the point of action does not meet this demand. An exact operation reservation under that fence must bind the operation key and digest;
checking ownership and later calling an arbitrary adapter is insufficient. The effect
executor must consume that admission without allowing a stale worker to replay it as a new
invocation. No implementation is chosen here: six must state its failure assumptions and
how it achieves fencing. If exclusion
cannot be established during a partition, that execution scope closes; a stale label or a
notification to the old worker is not an alternative authority mechanism.

**Rule — record before dispatch, settle before advancement.** Rules 26, 42, 63, 68, and
114. **Check:** P5-NF-07/11/12 kills the worker at each numbered boundary:

1. Part four preserves and admits intent with an owner and blocked-on state.
2. Run admission records the run or finds its existing creation from the same cause.
3. Part-six ownership and resource admission validate the expected run predecessor, stop
   state, current grants, current generation, and proposed step; no external action occurs yet.
4. If a worker starts or resumes, the grounding reader records section 8's actual read.
5. The step intent and any owning delegation edge become durable before dispatch. The required
   durability is at least local-durable and also meets the operation's part-eight demand.
6. Judgment and effects use their public doorways. An effect's authoritative outcome is recorded
   by part eight before the graph consumes it; the graph never infers it from process exit.
7. Transition admission consumes that outcome once, records next state and next wake, and only
   then enables dependent work or advertises a completed result.

**Rule — five adopts the composed judgment order.** Rules 41, 55, 60, 63, 75, and 114.
**Check:** P5-NF-59 checks this specialization of record-before-dispatch across five, six,
seven, and eight, including a crash at every boundary:

1. Persist the pending step and seven's logical judgment request, durably linked by five.
   Seven retains ownership of the request. This preparation grants no execution permission.
2. Six grants ownership.
3. Admission validates the expected predecessor, stop, current standing and generation,
   and resources; five records actual-start grounding before the worker acts.
4. Seven persists its attempt identity; six persists the exact operation identity mapping.
5. Six conditionally admits and durably reserves that operation under the current fence
   and enforceable spend bound, meeting eight's durability demand.
6. Eight's effect boundary consumes the reservation's single dispatch-claim and dispatches
   to the registered model adapter. The run cannot call the provider directly.
7. Seven records the provider receipt, part one's `Outcome` and `Result`, and the decoded
   answer/`Decision`, preserving the evidence eight needs for execution and charge settlement.
8. Five conditionally accepts the recorded answer against the pending run predecessor.
9. Five advances from that accepted reference. A later business effect has its own operation
   identity, authorization checks and admission; judgment acceptance is not effect permission.

**Rule — the judgment seam has one named owner per record.** **Check:** P5-NF-59/60
verifies the joins and refuses competing authorities. These are references to owned records,
not additional outcome, result, decision, reservation or acceptance types:

| Record | Sole owner | Binding consumed by five |
|---|---|---|
| Logical judgment request | Seven | `JudgmentRequest.logicalKey` and request id, bound to the pending run/step and exact input digest |
| Attempt | Seven | Stable attempt id within that request; one provider invocation proposal |
| Operation identity and reservation | Six | Immutable, injective mapping from `(request id, attempt id)` to one operation id and its exact request digest and reservation |
| Provider receipt | Seven | Original response/usage evidence and decoded part-one `Outcome`, `Result`, and `Decision` references; eight owns their effect settlement |
| Spend reservation | Six | Credits in the same fenced operation admission; seven's usage observations are not an allocator |
| Run-acceptance reference | Five | The conditional `RunTransition` linking the pending step/request to the accepted answer and its attempt, operation, reservation and receipt references |

**Rule — recovery preserves the attempt mapping; a fresh attempt earns admission.**
**Check:** P5-NF-60. Transport redelivery and recovery retain the same request, seven-owned
attempt and six-owned operation mapping. A changed digest under that mapping is `Conflict`;
duplicate evidence cannot allocate another reservation or invoke the provider again. An
uncertain operation permits only observation, including read-only retrieval of stored receipts
or results, not resubmission with the same key. A genuinely new provider attempt gets a new
seven-owned attempt id and six-owned operation id linked to its predecessor only after six's
recovery reconciles the prior execution and charge uncertainty using eight's settlement.
A proposed attempt may be recorded while waiting but cannot dispatch. Extra budget, a fresh
lease, another provider or a changed route cannot bypass the hold. Six retains maximum
unresolved exposure and alone converts or releases its reserved credits from eight's settlement;
a never-dispatched prepared reservation can close only with conditional proof no dispatch-claim
exists. Seven records usage evidence without changing those credits.

**Rule — recorded judgment is not yet run acceptance.** **Check:** P5-NF-59/60.
Five's accepting `RunTransition` references the pending step and logical request, exact input
digest, seven's attempt/receipt/decoded answer, six's operation/reservation, and the current
predecessor, standing, generation, fence and stop checks. It consumes part one's `Result`,
`Outcome` and floor-bound `Decision`, never a socket return or unvalidated answer. Conditional
admission accepts at most one answer for the logical request in that step; an identical
duplicate returns the existing acceptance. A different answer cannot replace it silently.
A stale predecessor, stale authority or stop blocks new acceptance and advancement while the
receipt, late answer and charge evidence remain preserved. Missing charge evidence does not
erase a recorded answer or release capacity: eight's settlement remains independently pending,
and any dependent work must satisfy the run's pending obligations and its own admission.


PREVIEW-S2 adds the fixed `acceptedReplyPreviewText` projection over owner-validated same-store
facts. It reads the signed acceptance's decoded Decision, requires conclusion subject
`preview-stage2-answer`, predicate `answer-text` and a nonempty string value, and uses that value directly as the reply text.
It escapes `&`, `<`, `>` in that order, rejects unsupported controls and rendered UTF-8 overflow,
and neither repairs nor truncates a Decision. The helper grants no authority; current accepted
answer consumption and grounding remain mandatory. The original raw-answer path remains valid.

**Rule — restart observes pending work; it does not repeat unknown effects.** **Check:** P5-NF-11/12.
Part six must enumerate every nonterminal run with a missing worker, preserve its pending
operation identity across machine changes, establish new ownership, and query the authoritative
operation outcome. `Outcome.uncertain` remains a wait for observation, even when no external
lookup exists. Recovery is read-only with respect to that uncertain effect: even an idempotent
same-key resubmission is forbidden. A retry requires evidence of `did-not-happen`, proof that
the old dispatch-claim cannot still execute, and settlement of any charge. A missing record,
timeout or fresh lease supplies none of that proof. Six owns
recovery attempts; this part owns the unfinished assignment they service. During permanent
loss of an unreplicated tail, missing evidence remains missing: no claim of lossless recovery
is made beyond the recorded durability state.

**Rule — every live obligation is scheduled or visibly inhibited.** Rules 8, 46, 64, 68,
83, and 92. **Check:** P5-NF-13 walks the run projection after every crash cut and at boot:
a nonterminal run has either a current worker, a durable due-work item, or a named inhibit
(stop, resource ceiling, authority conflict, authorization, or settled blocker) with an owner,
next observation, and pull-visible reason. A lost wake notification is repaired by scanning
this state, not remembered by a session. Six realizes the bounded scheduling/recovery machinery.
Missing or overdue progress and cadence proofs are measured; busy CPU or a heartbeat alone
cannot satisfy progress. Recovery can be unavailable without pretending the run was completed.

**Rule — resource limits compose through the entire delegation tree.** Rules 55, 60, 61,
and 114. **Check:** P5-NF-14/15. `RunBudget` contains its id, governing bound references,
parent allocation reference (absent for a root), resource quantities as subject-bound
measurements, concurrent worker/process/memory ceilings, outstanding-node/depth/fan-out limits,
spend and token ceilings, retry/backoff/breaker requirements supplied to part six, work safety
ceiling, and the owner of exhausted-capacity handling. Fields are immutable; an increased
allocation needs a new admitted allocation fact under sufficient standing. Budget zero means
zero. Child reservations plus parent's retained capacity never exceed the parent's allocation;
all descendants debit their ancestors, so splitting into children cannot multiply a cap.

**Rule — a reservation survives uncertain execution.** **Check:** P5-NF-14/15/29. Part six must realize
exclusive allocation or disjoint bounded allocations sufficient to uphold the inequality under
partition. An unresolved start, uncertain spend, missing remote report, or fenced former holder
keeps the maximum reserved charge unavailable. Expiry of a lease alone never frees spend or
physical capacity that might still be used. Release requires settlement evidence or a
conservative accounting write-off that counts the maximum as spent; neither enlarges the cap.
A replacement may need separate capacity until the old process is proved stopped. If that
cannot be obtained, repair remains pending and visible. Transport discovery cannot reserve
resources by advertising them.

**Rule — every repeat carries part six's brakes.** **Check:** P5-NF-16 rejects an unregistered loop,
missing backoff/cap/breaker, retry with a new budget to evade a ceiling, or a poll implemented
outside the loop port. The graph supplies a stable repetition identity, cause, due condition,
bound reference, and outcome; it does not define part six's loop type. Expected capacity
enforcement uses `Success.capacity: applied` for the operation that applied the bound, while
the assignment remains incomplete. It never turns a capped run into successful work.

**Value — initial operational bounds are configurable, finite, and measured.** No check
chooses the best numbers. The starting profile proposes 1,024 outstanding run nodes per root,
32 direct children per step, depth 16, and at most 3 automatic attempts per failed operation.
Backoff and breaker timing are supplied by a registered part-six policy before execution;
missing policy refuses admission. Operator/charter changes can alter these finite limits
without changing the graph topology rules. Compute, money, and memory allowances are supplied
by the actual environment, never inferred from these defaults. Section 11 states the checks
that test enforcement and measure the cost rather than promising universal throughput.

---

## 4. Finishing, cancelling, and carrying a blocker

**Rule — a terminal claim names its evidence and settles its children.** Rules 20, 22,
26, 68, 71, 97, and 99. **Check:** P5-NF-17/18/19. `RunExit` contains its id, run and
expected transition head, proposer, current standing reference, causal evidence frontier,
clock reading, settlement manifest of every owning child edge and pending operation, and
exactly one arm:

- `completed`: the exact exit-test version, its passed check or bounded judgment record,
  subject-matching fresh evidence, and result reference;
- `unreachable`: an `ExhaustionRecord`, the unsatisfied exit-test clauses, the smallest
  external dependency, and a required recheck date with its owned observation obligation;
- `cancelled`: an authenticated, scope-covering cancellation or directive supersession,
  the remaining unsatisfied work, and disposition of outstanding effects and child results.

**Rule — a stop and a completed assignment are different records.** **Check:** P5-NF-17/20.
Worker death, context compaction, elapsed time, budget exhaustion, and “needs a judgment” cannot
construct `completed` or `unreachable`. A safety ceiling halts execution and keeps the
assignment and its directive open. A scope-covering operator cancellation may end this run's
execution without asserting the requested work was achieved. It does not close a `Directive`
by a third method: part one's supersession/completion arms remain exclusive. If a cancellation
withdraws a directive, part four supplies the superseding directive; otherwise its outstanding
obligation remains visible and inhibited. Automated rechecks may observe, but never undo an
operator stop or resume cancelled work without new authorization to do that work.

**Rule — closure is a settlement, not the disappearance of a process.** **Check:** P5-NF-18/19/21.
Every owning edge must have a collected terminal result, a confirmed cancellation with its
outstanding operations settled, or a durable transfer to a receiving owner that has accepted
responsibility. A parent cannot drop its edge or call a transferred child “completed.” Unknown
remote effects keep closure waiting; the run can be halted immediately while settlement
remains open. Completed, unreachable, and cancelled are terminal for execution, not permission
to discard incoming facts. A late result goes to the durable destination, is marked late,
and receives a collection or dispute record even when the original parent worker is gone.

**Rule — cancellation ordering is causal and scope-bound.** **Check:** P5-NF-20/21/29 tests both
orders and genuine concurrency. Receipt of a valid stop inhibits further execution locally
before ordinary scheduling, following part four's local-durable stop fact. A child’s
cancellation relationship transmits that inhibition through the existing owning edges;
part six must fence downstream execution where authority can be established. A partitioned
peer is not claimed stopped merely because the sender queued a cancel. Until its evidence
arrives the edge is `cancellation-unconfirmed`; bounded recovery keeps observing it.

**Rule — cancellation never unsends an effect or deletes completion evidence.** **Check:** P5-NF-21.
Completion causally preceding cancellation remains a completed fact; cancellation still stops
any remaining work within its scope. Cancellation causally preceding a proposed completion
forbids admitting that new successful closure unless the proposal only records already-admitted,
pre-cancellation completion evidence. Effect observations received after cancellation are
recorded honestly without enabling new work. Incompatible concurrent terminal proposals yield
`Conflict`; execution stays inhibited while a current, standing-covered reconciliation records
which effects occurred and how the assignment closes. No wall-clock last-writer choice applies.

**Rule — a judgment gap becomes work before it can become a stop.** Rules 22 and 102.
**Check:** P5-NF-22 refuses an exit justified by an answerable design choice without a journaled
`Decision` or an admitted judgment step. A boundary discovered mid-run is checked against the
recorded governance that actually applies. Within existing standing the agent records its
choice and continues; beyond standing it uses section 5's request. The decoder checks references
and action floors, not whether a question is intellectually easy. Semantic misclassification
is a named review duty in section 12, never a claimed type guarantee.

**Rule — an exhaustion claim comes from a real bounded investigation.** Rules 20, 21, 23,
88, and 99. **Check:** P5-NF-23/24. An exhaustion run is an ordinary `Run`, identified by
its registered exit test, not a new execution engine. Its `ExhaustionRecord` has immutable
id, parent run and blocker claim, applicable scope and grant references, current capability
and owned-identity read references, the exact proposed goal, a finite avenue set, decision
records explaining that set, an evidence disposition for every avenue, resource charges,
observed dependencies, smallest required outside action, conclusion and separate reason,
and a finite recheck date. Each avenue is `tried` with step/outcome evidence, `outside-standing`
with the governing constraint or missing grant, or `inapplicable` with a recorded decision and
its evidence. “Unavailable” supported only by a missing symbol or failed keyword search refuses.

**Rule — uncertain avenues cannot prove impossibility.** **Check:** P5-NF-24 rejects a record claiming
all avenues failed when any outcome is unknown, omitted, stale, or untried without its lawful
disposition. At a safety cap the exhaustion run records what it attempted and waits for a
bounded recovery/resource decision; hitting the cap is not an unreachable proof. A claimed
human-only dependency must name its actual boundary and smallest action. A routed approval
for a known protected operation does not require experimenting with prohibited alternatives:
the exhaustion record may contain only already-known lawful avenues, each evidenced. Thus
rule 23 prevents unnecessary escalation without making a constitutional approval itself
something to evade. An internal-issue alert must cite the failed self-heal/exhaustion record;
the effect doorway still governs whether that notice should be sent.

**Value — finite exhaustion is evidence, not omniscience.** No automatic check proves that
all conceivable approaches were imagined or that a model's reason is sound. The mechanical
bar proves every enumerated avenue has a justified disposition, actual attempts are recorded,
and the conclusion is rechecked. Independent review tests the quality of the avenue set.
A demonstrated wall is provisional knowledge with a recheck, never a claim that future models
or tools cannot change the answer.

**Rule — work-window boundaries preserve responsibility.** Rules 8, 68, 83, 92, and 97.
**Check:** P5-NF-17/22/25. A posted boundary review automatically creates a due continuation
obligation for any remaining authorized work, through the same deduplicated opening path.
The new window can run only within live authority, remaining resource allowances, and an
uninhibited stop state. A scheduling ceiling delays execution visibly; it never acts as an
exit test or silently grants a fresh budget. If the exit test passes, no filler run is created.
A completed result or necessary-action notice may satisfy the cadence; routine churn remains
on the pull surface under the effect doorway's notification rules.

---

## 5. Awaiting authorization without approval from silence

**Rule — this is part four's request, carried durably, not a second authorization door.**
Rules 46, 79, 82, 83, 98, and 104. **Check:** P4-NF-20 and P5-NF-26/27. The following
`AwaitingAuthorization` fields are mandatory: id, run, blocked step, part-four request
reference and canonical digest, requester and resolved approver references, classified
operation and scope, artifact and base, current grant-resolution reference, owner, creation
clock, finite wait bound, re-surface cadence, and terminal receipt destination. The exact
request contents are immutable. Changing the operation, artifact, approver, or base closes
this request as expired and requires a new routed request linked to it, with the preserved
original ask. Coalescing in part four groups attention, not authorization identity: one yes
never approves every request sharing a classification.

**Rule — the lifecycle has one yes arm and only explicit evidence can enter it.**
**Check:** P4-NF-20 compiles a negative timeout-to-yes fixture; P5-NF-26 tests every arm below.

| Arm | Required cause and resulting work |
|---|---|
| `pending` | A durable routed request with an owner and due condition. There is no assumed answer. |
| `authorized` | A part-one `Authorization` matching the exact request digest and current scope, artifact, base, live standing, and verified explicit-yes provenance. The step becomes eligible for fresh effect-doorway re-validation, not directly executable. |
| `declined` | A preserved, authenticated explicit no matching the request from the selected approver, represented by the request's `Refused` and its receipt obligation. No grant is produced. |
| `expired` | The wait bound elapsed, the bound content/base moved, or the request was withdrawn by an authorized cancellation; cause and receipt obligation required. No grant is produced. |

**Rule — expiry drains the request and keeps any remaining directive honest.**
**Check:** P5-NF-27 tests expiry followed by a late yes and by the next scheduled wake. The expired
request never reopens; its receipt is durable work until delivery evidence or an explicit
undeliverable disposition exists. A live directive retains an owned blocked obligation or a
justified unreachable exit, never an automatic completion. A timer cannot mint a repeated
approval request merely to keep asking. A new request needs a changed admissibility condition
or a recorded within-standing decision that re-opening is useful; the previous expiry and
part four's coalescing/rate budget remain in its causal history. Candidate standing grants
stay part four's exact-subset, recurrence-only workflow. This type does not expand them.

**Rule — authorization races use the existing authority boundary.** **Check:** P5-NF-28 tests yes
versus cancellation, yes versus expiry, and yes versus base movement. Causally prior closure
of a request prevents a late yes from reopening it. A concurrent yes and closure exposes a
conflict and inhibits the blocked step until reconciled under current authority; a fresh
Authorization may be requested if necessary. An approver's time stamp cannot select the
winner. A request that briefly entered `authorized` still yields no effect if cancellation,
revocation, or a changed base invalidates it before the effect doorway checks.

---

## 6. Delegation binds both ends

**Rule — a delegated assignment is a registered durable edge.** Rule 114, with rules 27,
28, 57, 60, 63, and 83. **Check:** P5-NF-06/14/30/31 validates every edge at creation and
at receive, locally and across agents. `DelegationContract` has immutable id and schema version;
parent and child run identities; originating intent/directive references; accountable parent
and receiving agent principals; bounded task and question capture; assigned scope; delegated
`StandingGrant` references and permitted actions; budget allocation and ancestor allocation
references; exit test; required evidence; placement decision; transport entry and durable
conversation identity; result destination; cancellation relationship; child-delegation limit;
collection obligation and cadence; contract digest; creation clock and register generation.

**Rule — no child is created before its owning edge is durable.** **Check:** P5-NF-30 kills the
parent before edge append, after append, after dispatch, and after recipient acceptance.
The child identity is reserved by the parent’s admitted edge and is repeated unchanged in
all offers; the recipient maps it to its own run identity in its durable acceptance. That
mapping is immutable. A second, different recipient acceptance for the same exclusive edge
is a conflict, not a second success. Replacing the worker does not replace the child. Choosing
a different receiving agent creates a new edge only after the original is proved non-executing,
settled, or transferred through a standing-covered handoff. Unknown delivery cannot justify
parallel speculative execution under a fresh edge.

**Rule — delegated authority never grows by being delegated.** **Check:** P5-NF-31 tests scope and
action-set inclusion at every depth, grant expiry/revocation, and a recipient with wider
ordinary standing. The effective action space for this assignment is the intersection of the
contract, live delegated standing, the receiving agent's applicable governance and action
floors, and the remaining resource allocation. A remote agent remains its own principal.
It cannot invoke its wider ordinary operating grants to escape an accepted bounded contract.
Receiving the task is not consent to perform it: it may return a preserved refusal. A parent
can sub-delegate only where existing org intent/grants permit it; graph recursion alone
confers nothing. Minting a needed grant goes through part four and part one's verified act,
never by copying the parent's principal or forwarding a chat selection as an authorization.

**Rule — dispatch contains the question and method constraints, not a demanded verdict.**
Rule 27. **Check:** P5-NF-32 verifies the dispatch schema has separate question, permissible
scope, evidence requirements, and completion criteria; a check for expected-answer fields
and a recorded dispatch-review judgment run before a verification task is sent. An explicit
expected verdict cannot occupy the question field in the negative fixtures. Detection of a
subtly leading question is a semantic residual owned by review; the mechanical check's scope
is declared `partial`, not a promise to read meaning with keywords.

**Rule — placement is capability-aware and does not grant authority.** Rules 30, 60, 63,
and 114. **Check:** P5-NF-33 tests stale advertisements, unsupported capture/verification
requirements, absent capacity, revoked trust, and a model/harness mismatch, with supported
positive cases. The placement field references a `Decision` naming chosen agent, machine,
harness, registered model doorway, and transport; required versus advertised capabilities;
advertisement evidence and freshness; resource-admission evidence; and the reason for the
choice. Capability and trust facts are inputs, not grant records. Compatibility must be
rechecked by the receiving admission before worker start. A later placement change records a
new decision and the handoff evidence; it never silently modifies the contract's destination.

**Rule — child results survive every worker involved.** Rules 42, 68, 83, and 114.
**Check:** P5-NF-34/35. `DelegationResult` has immutable id, edge and child identities,
contract digest, child terminal transition and `RunExit`, a `Result` for the assigned work,
separate `Outcome` references for effects, evidence/capture references and availability,
actual resource-accounting references, unresolved/disputed observations, receiving-agent
`Provenance`, and the original durable result destination. A remote signature proves who
submitted the result; it does not prove the task succeeded. Completion at the parent requires
its own declared exit conditions and verification bar. A `Refused` remains recorded through
result collection; no success-report conversion is added here.

**Rule — collection is exactly once as a logical graph transition, with durable evidence.**
**Check:** P5-NF-35 re-delivers results with distinct message and fact ids while the parent is dead.
The collection key is (owning edge, accepted child terminal identity). Equal content returns
the existing collection; differing content for that key records `Conflict`. Progress updates
are not terminal results and cannot discharge the collection obligation. The parent's
collection record becomes durable before the return receipt is sent; a lost receipt is
replayed from that record. A receipt only releases the sender's delivery obligation, not
its append-only history. Cancelling a parent never removes the durable return endpoint.

---

## 7. The agent-transport port and honest delivery

**Rule — the core interface is independent of the carrying protocol.** Rules 30, 42,
89, and 114. **Check:** P5-NF-36/37 runs the same port suite against a local transport and
part six's reference adapter, with no protocol/harness/model names in work-engine branches.
`AgentTransportPort` exposes the following operations. Every response is a `Result`; a
transport's positive response names the narrow operation that succeeded, never successful
completion of the delegated task. Transport uncertainty is represented inside delivered
`DeliveryEvidence`, not falsely encoded as `Refused`, which means the operation did not happen.

| Port operation | Required input and honest output |
|---|---|
| `describe` | Authenticated peer identity and required capability set → bounded capability observations with provenance and freshness, or a preserved refusal. No grant is produced. |
| `send` | A durable `AgentTransportEnvelope` and current send admission → evidence for the specific message key. The message kind is `offer`, `progress`, `result`, `cancel`, or `receipt`. |
| `observe` | Exact transport conversation, message key, prior evidence references, and minimum already-observed position → current `DeliveryEvidence`, or a refusal to perform the query. A query failure leaves prior uncertainty unresolved. |
| `receive` | Authenticated external bytes → part-four intake reference and evidence of its acceptance or hold. It never types directly into a session. |

**Rule — transport envelopes preserve identity and bounded delegation.** **Check:** P5-NF-36/38.
`AgentTransportEnvelope` contains immutable message id; semantic key (sending agent, edge,
message kind, sequence number); canonical payload digest; sender and recipient verified
agent references; authentication evidence for the complete signed envelope; parent and child
run identifiers and accepted recipient mapping when available; durable transport conversation
id and adapter declaration; contract digest; scope and delegated grant references; allocation
references; evidence references; cancellation relationship or named cancellation fact;
result destination; causal references; schema version and register generation; and clock
measurement. All authority-relevant fields are covered by the authenticated digest. A result
or cancellation names its original offer. Sequence numbers identify messages, not time or
permission to skip predecessors. Retry changes transport attempt metadata only, not this key
or payload. Observations must identify both the message and its digest.

**Rule — another agent's message enters as evidence under its own identity.** **Check:** P5-NF-38/39.
The receiving adapter supplies authentication evidence to part one's decoders and part four's
intake. External agent keys must resolve through the registered trust/authentication contract;
unknown identity holds without authority. A foreign grant reference is not locally exercisable
until part four resolves its provenance, scope, delegation chain, and applicable local
standing. The envelope’s generation is the sender’s evidence horizon; the receiving
admission pins its own current generation and records schema/capability compatibility.
A remote generation never replaces local governing state. Remote fact references can be
captured as signed evidence through intake; they are
not imported as if the sender owned a segment in this agent's machine registry. Cross-agent
transport is distinct from part two's intra-agent replication. A supplied destination never
permits a redirect of private evidence outside the admitted contract scope.

**Rule — delivery state names the party that can prove it.** **Check:** P5-NF-37/40/41 rejects a
state without its witness, and runs a negative fixture for each unwarranted promotion.
`DeliveryEvidence` contains immutable id, envelope key and digest, transport conversation,
claimed state, witness `Provenance`, authoritative capture/fact reference, causal predecessors,
observed clock, finite freshness, and any uncertainty's unresolved question. Its states are:

| State | Required authority and meaning |
|---|---|
| `accepted-by-transport` | The sending transport's acceptance receipt. It accepted bytes; no disk durability or receiving worker is proved. |
| `durably-queued` | The identified queue custodian's durable receipt, naming message key, digest, durability state, and obligation to deliver or return an honest terminal. A memory buffer cannot claim this state. |
| `delivered-to-worker` | The receiving agent's admitted worker-consumption fact for that envelope and contract, under its worker admission. Relay forwarding, process spawn, and bytes written to a terminal do not qualify. |
| `answered` | The receiving agent's durable terminal `DelegationResult`, authenticated and bound to the contract. It proves a submission exists, not that its claims passed the parent's exit test. |
| `refused` | The authority responsible for the refused operation supplies its preserved `Refused` and says what did not happen: transport send, receiving admission, or delegated work. A task refusal does not erase an earlier successful delivery. |
| `uncertain` | The observing component records which stronger claim it cannot establish, its attempted query, and the last established evidence. A timeout never proves non-delivery or non-occurrence. |

**Rule — knowledge refines through evidence, not a numeric state rank.** **Check:** P5-NF-40/41.
A witnessed answer may arrive before intermediate receipts and directly establish `answered`;
the missing receipts stay unclaimed. A transport refusal before delivery is legal. A later
query timeout cannot erase a previously proven answer, although unavailable/expired evidence
must be labelled as such. Incompatible signed claims for the same logical message become
`Conflict`; stale or conflicted proof cannot authorize new execution. A task-level refusal
is retained beside transport success rather than being overwritten by it.

**Rule — deduplication has three different subjects.** **Check:** P5-NF-35/39/42 tests them separately:
part four deduplicates authenticated input events; part two collapses repeated fact ids;
this part deduplicates semantic offers, cancellations, results, and collections even when
re-deliveries generated different event/fact ids. Same semantic key and digest returns the
recorded disposition. Same key and different digest records a conflict with preserved input.
Closing a run does not remove the compact identity/digest tombstone needed to recognize its
replays. A bounded transport queue may shed no accepted item without handing back a durable
terminal or responsibility transfer. Overflow refuses new acceptance with honest backpressure;
recovery uses part six's bounded read-only receipt/result lookup with the existing semantic
key. A lookup miss cannot create work or resubmit an uncertain offer; duplicate submissions
already in flight still pass semantic deduplication.

**Rule — a peer's silence needs proof it had a chance to answer.** Rule 98 and P4-NF-23.
**Check:** P5-NF-43. Only a declared peer-review request that reached `delivered-to-worker`
can support peer-silence concurrence. The receiving admission must record the declared
deadline and prove it leaves at least the governed minimum response interval after delivery;
the local clock check includes the adapter's declared clock-uncertainty bound. Unbounded
clock uncertainty, delayed delivery leaving too little time, or merely queued bytes yield
no concurrence. An extension is an explicit new delivered deadline, not a hidden timer reset.
Concurrence is limited to that review decision; it can never stand in for `Authorization`,
a child's answer, an effect outcome, or proof a cancelled peer stopped.

---

## 8. Grounding at actual start, including compaction

**Rule — the worker cannot spend an admission-time history read at a later start.**
Rules 47, 96, and 110; part four's sequence 7. **Check:** P5-NF-44 starts a worker long
after intake, advances the clock and history meanwhile, and refuses grounding that reused
the intake snapshot. The actual-start gate applies to a new worker, a recovered worker,
a harness resume, and every post-compaction continuation. It takes a fresh clock measurement
and reads the recorded conversation history and current run graph before enabling its next
ordinary action. Emergency stop keeps part four's fast path and never waits for this read.

**Rule — coverage is explicit enough to test, not merely a hash called “grounded.”**
**Check:** P5-NF-44/45. `SessionGrounding` contains immutable id, run/step, worker and harness instance,
start reason, fresh start clock, previous activity clock reference and derived elapsed-time
measurement, authenticated principal and intake reference, conversation binding/directive
references, register generation, history frontier and known-lineage set, coverage threshold,
covered message ranges, exact read capture digests, rolling-summary references and their
covered ranges/freshness, last inbound id at this read, pre-pause inbound id when resuming,
and the run's pending operations, children, and unresolved receipts. The reader records what
it actually loaded into the worker, not only what a history index says exists. Across machines,
elapsed-time derivation uses part one’s explicit cross-instance measurement operation and
records clock uncertainty; incomparable clocks yield an unknown gap requiring observation,
never an invented duration.

**Rule — below the threshold read the full history; above it account for every range.**
**Check:** P5-NF-45 constructs missing middle messages, overlapping or gapped summary ranges, stale
summaries, unavailable captures, and an inbound arriving between snapshot and start. Full
messages cover the recent suffix through the declared frontier; current rolling summaries
cover every older range beyond the generous declared threshold. No summary substitutes for
messages still within that threshold. The threshold is a registered per-harness capacity
policy and is recorded in the receipt; secretly shrinking it to skip a read fails. A message
arriving after the read is a new intake fact, durably pending for the worker, and cannot be
claimed covered by the earlier receipt. If grounding evidence is incomplete, ordinary work
waits on an owned repair obligation. The independently grounded minimal plane remains able
to receive, explain the limitation, and stop work; there is no global wait for this run's
history repair.

**Rule — the first post-compaction reply accounts for the last inbound before the pause.**
**Check:** P4-NF-11 and P5-NF-46. `ContinuityAccounting` contains immutable id, grounding reference,
pre-pause inbound id and capture reference, first reply operation/digest, explicit compaction
disclosure, and a disposition: `addressed` with the durable answer/work reference,
`superseded` with the admitted superseding input/directive, or `pending` with the owned work
and reason still open. The reply must expose the disclosure and honest disposition, and its
send record must reference this accounting. A deterministic gate checks those fields and
links before the first reply; it does not use a phrase list to judge whether an answer is
substantively good. An unavailable pre-pause capture is disclosed as unavailable and pending,
never guessed from recollection. The accounting itself claims no approval to send.

**Rule — startup and compaction inject the same governing context classes.** Rule 47.
**Check:** P5-NF-47 compares the generated briefing class manifest at first start and after
compaction under the same register generation. When governance changes, the new receipt
records the changed generation and current directives; parity compares required classes,
not obsolete bytes. Harness adapters must return a consumption receipt for those classes.
Part ten realizes that adapter contract without a harness-specific path in the graph.

**Value — a read receipt cannot prove attention.** No check proves the model understood the
history, reasoned correctly about elapsed time, or answered the last message well. The design
proves delivered context, recorded coverage, disclosure, and referential accounting. Part
nine's semantic review holds quality; the rule-graph entries retain that partial scope.

**Rule — installed governance is a reference mapping, never serialized behavior.** Owner: Five
for `InstalledRunGovernanceReference` version 1 and its public loader; Three owns the verified
register and Two owns capture. **Check: P5-NF-61** requires the installed mapping to name the
current generation, `rungraph.contract`, `rungraph-core`, `rungraph.bound`, the six exact
gate/decoder pairs, Two's capture declaration, and the selected grounding policy values. The
loader resolves those references into the existing `RunGovernance` interface using current owner
ports. A serialized callback, caller-built register, missing gate, wrong decoder, stale
generation or mutable threshold refuses. The positive neighbor resolves every reference in one
verified register and constructs the existing interface without storing a function or parallel
policy fact.

**Rule — a usable provider answer does not settle its accounting obligation.** Owner: Five for
answer consumption, with Seven's `ProviderAnswerAcceptance`, Eight's settlement and Six's
accounting as required inputs. **Check: P5-NF-62** permits one exact decoded answer to supply the
run's result/reply input while Six reports unresolved accounting only when the acceptance binds
the current request, attempt, response, operation, digest, Nine assessment, Eight settlement and
Six accounting; the route has an enforced finite maximum charge; maximum exposure remains held;
and retry eligibility is false. The provider step and accounting obligation remain pending and
cannot transition that provider run to ready or complete. Five's public
`openAcceptedProviderReply` conditionally records one standard `Run` v1 opening keyed by the exact
acceptance fact after rechecking the original current predecessor, stop, standing, lease-derived
fence and conversation obligation. That separate reply run references the accepted answer and
obtains its own grounding, authority, budget, durability and Eight dispatch claim. It cannot call
the model or complete the original provider run. Restart reuses the same reply run and outbound
operation. Missing joins, changed predecessor or stop, released exposure, a second use or a
disguised repeat refuses. The positive neighbor uses one complete assessed answer once for one real
reply while showing unknown charge and held capacity; the existing fully settled path may
additionally close the original step.

---

## 9. The behavioral seams, with closure named

**Rule — a cross-part interaction declares all six fields.** Rules 33, 45, 69, 95, 113,
and 114. **Check:** P5-NF-48 maps every imported port and exported consumer to a row below;
a missing interaction or empty field fails. P5-NF-29/49 exercises these rows through the
real production assembly. These are behavior requirements, not claims of agreement from
another lane. “Closed” below always preserves the input and the owned obligation; “open”
for user communication never grants mutation authority.

| Seam | Producer | Consumer | Authoritative record | Transition order | Fail direction | Closure owner |
|---|---|---|---|---|---|---|
| S1: intake to work | Part four | Run admission | Intake/admission fact, owner, blocked-on state, and run opening causally bound to it | Preserve → resolve → admit intent → create/find run by cause → schedule | Close authority on invalid input; preserve or hold intake; no lost acknowledged intent | Four closes intake admission; five closes assignment and its receipts |
| S2: ownership and resumption | Six's leases/recovery; five supplies pending run state | Run/session admission and eight's effect admission | Six's ownership/fencing record; five's transition head; eight's operation outcome, each for its own question | Durable work → current ownership → expected-head/resource/stop admission → actual-start grounding → step intent → action → outcome → advance; recovery observes pending keys first | Close execution on stale/lost/contested ownership; preserve observations; minimal communication stays independently available | Six closes recovery/fencing attempts; five closes work; eight settles effects |
| S3: resource and repeats | Five's budget/step requests; six's allocation and loop machinery | All run/child admissions | Budget allocation and charge facts under six's admission, linked to five's ancestor budgets | Reserve within ancestors → admit action → meter/settle → release only proved unused capacity; wake through bounded loop | Close new allocation/retry; keep unresolved maximum charge and visible repair | Six closes allocations/loop attempts; five owns remaining assignment and exhausted-capacity decision |
| S4: delegation over transport | Parent run and transport adapter; remote receiving intake | Remote run; parent collection | Contract/offer, recipient acceptance/mapping, delivery witnesses, child terminal, collection receipt | Edge durable → send → receiver intake/admission → worker consumes → child outcome/result durable → parent collects → receipt | Close unverified/out-of-scope execution; queue or preserve uncertain delivery; never promote an ack | Five owns edge and collection; receiving agent owns accepted child; six owns adapter delivery/recovery |
| S5: judgment and refined ask | Five's pending step; seven's request/attempt/answer; six's admission | Eight's model dispatch, then five's acceptance; four's classification | Seven's request/attempt/receipt and part-one Outcome/Result/Decision; six's operation/spend reservation; five's RunTransition acceptance; eight's settlement | Adopt section 3: persist step/request → own → validate/ground → persist attempt/operation → fenced durable spend reserve → effect dispatch → record receipt/Outcome/answer → conditional acceptance → advance; later effect separately admitted | No dispatch on stale/unreserved operation or unresolved prior execution/charge; doorway default stays within floor; stop/stale predecessor blocks acceptance | Seven closes question/answer; six owns ownership/reservation/recovery and credit release; eight settles effect; five owns run acceptance/wait; four closes classification |
| S6: effects | Five's admitted proposal | Eight's effect doorway; five consumes result | Eight's operation record, `Result`, `Outcome`, authorization validation and verification obligation | Step intent durable at demanded level → eight validates current scope/base/lease → effect → eight records outcome → five consumes once | Close unsafe/stale mutation; uncertainty routes to observation; user communication applies its own declared consumer direction | Eight settles operation and schedules verification; five advances work; nine grades evidence |
| S7: authorization lifecycle | Four's routed request; eleven's verified response; four's decoder | Five's wait and eight's effect validation | Exact request digest and part-one `Authorization` or preserved decline/expiry; run wait transition | Request durable → owned wait → surface response through intake → exact match/current validation → eligibility → effect re-validation | Silence never yes; expired/declined receipt drains; conflict inhibits action | Eleven owns response surface, four owns authority decoding/standing candidates, five owns wait/receipts, eight owns final eligibility |
| S8: grounding and continuity | Four's history substrate, three's generated briefing, harness read receipt | Five's actual-start gate and reply accounting | `SessionGrounding`, `ContinuityAccounting`, original inbound and reply fact | Fresh clock/history/current graph → delivered-context receipt → ordinary work; compaction accounting → first reply send | Close affected ordinary execution on ungrounded input; independently grounded repair/stop remains available | Five owns grounding/accounting; ten realizes consumption; nine reviews substantive adequacy |
| S9: evidence and exit | Checks/judgments/effect observations and nine's verification | Run exit admission; nine's grading | Exit-test result, `Evidence`, `ExhaustionRecord`, settlement manifest, canonical `RunExit` | Capture/record → check subject/freshness/taint → settle obligations → terminal transition → independent review | Close unsupported success/unreachable claims; retain contested results and recheck obligation | Five owns run closure; nine owns evidence adequacy, probes, grading, and semantic review |
| S10: history and register | Two's fact/capture/read ports; three's generation/declarations | Every run decoder, fold, and gate | Signed facts and entering-force generation records; disposable views carry horizon/taint | Verify generation/evidence → decode → append → fold → pinned rebuild comparison | Close authority on stale generation or corrupt required scope; labelled read views and unaffected scopes remain available | Two owns fact admission/reconciliation; three owns generation/graph; five owns declared run projections |
| S11: conversation service and surfaces | Four's input; five's durable conversation route and result/attention obligations | Six's serving admission, ten's harness, eleven's surfaces, eight's send | Binding, current conversation ownership, admitted run, outbound operation/receipt | Intake preserved → owner forwards/queues → admitted worker → durable reply → governed send → delivery evidence | Close unauthorized starts/sends; keep pull-visible backlog and the separate minimal communication plane; never claim an unreachable peer silent | Five owns run/route/receipt; six owns transport and one-owner admission; eleven owns minimal-plane live reachability |

**Rule — the graph does not widen shared authority to keep chat available.** Rules 14,
15, 63, 77, and 95. **Check:** P5-NF-49 partitions an ordinary run's dependency while the
minimal plane receives another authenticated message and an emergency stop. Non-owners
forward or durably queue ordinary conversation work; they do not start a second worker on
its behalf. A minimal-plane response identifies its narrower evidence and uses its own
registered authority/ownership path. It cannot authorize the stalled run from a stale view.
The global live-session guarantee remains part eleven's explicit responsibility, not a
claim that this graph can conjure capacity during loss of the minimal plane itself.

---

## 10. Four failure traces, worked through the seams

**Rule — fault traces test causes and records, not just final labels.** Rules 26, 31,
33, 42, 63, 68, and 114. **Check:** P5-NF-50 runs each trace below for a local child and
a remote child, then for a child with a child. P5-NF-29 requires part six's production
realization to supply the witnesses; a mocked “lease held” boolean cannot pass wiring proof.

| Trace | Durable facts before failure | What this part does | What remains open, and who closes it |
|---|---|---|---|
| Crash after effect, before record | Root R owns edge E to child C; step S and exact operation key K were admitted and durable. The effect occurs, but the worker dies before recording its response. | R and C remain. Recovery finds pending S/K, obtains current ownership, then observes K through eight. Positive occurrence evidence records the outcome and advances once; proved non-occurrence plus old-executor quiescence and settled charge permits a newly admitted bounded attempt; judgment uses section 3's new attempt/operation mapping. No answer leaves `uncertain` and permits only read-only observation, never same-key resubmission. A new worker or new key cannot turn the unknown into fresh work. | Six closes recovery admission; eight settles K. Five holds C, E's collection, R's exit, and the maximum uncertain resource charge until their evidence permits settlement. Permanent evidence loss is visible, not successful recovery. |
| Duplicate delivery | E's offer or C's result has a semantic key and digest; the prior attempt may already have been consumed, while its receipt was lost. | Four preserves and deduplicates events; five looks up the semantic key even if the retry has a new fact id. Equal digest replays the original disposition/collection receipt; changed digest records Conflict and admits no new child/result. Rebuild retains the tombstone needed after closure. | Five owns the single collection transition. Six retrieves stored receipts/results in read-only lookup mode; missing evidence cannot create work or resubmit the uncertain offer. Neither “lease obtained twice” nor “fact ids differ” justifies executing twice. |
| Cancellation racing completion | Stop X names R's scope; completion proposal Y names C's exit evidence and expected predecessor. Delivery order may differ across machines. | X inhibits new admission locally when received. If Y causally precedes X, preserve achieved work and cancel only remaining work. If X precedes Y, accept late observations without new execution/success authority. If incompatible X/Y are concurrent, expose Conflict, inhibit execution, and reconcile the pending operation evidence. Queueing cancel to C does not prove C stopped. | Five owns run/edge terminal resolution; six fences and proves cancellation delivery/admission; eight accounts for effects already admitted. Parent closure waits for child/effect settlement or an accepted responsibility transfer. |
| Stale authority | Worker W has an old ownership reference or a grant/generation view that is stale, provisional, or contested; a new holder has been admitted. | Refuse W's next session/step/effect/resource admission even if W never receives a loss notification. Authenticated observations may still enter under W's separate observer standing, subject to intake verification; they cannot advance the graph themselves. Current holder adopts only verified evidence and observes any pending key before advancing. | Six proves fencing at the execution boundary; four resolves standing, three generation, two taint; eight settles effects. Five keeps the run and its blocked-on owner, not W's claimed authority. |

**Rule — “at most once” has an exact subject and stated limit.** **Check:** P5-NF-35/50 checks
one logical result collection and one admitted logical operation under the declared
failure model. It does not claim universal exactly-once behavior from an arbitrary external
service. While the effect remains uncertain, automatic replay is refused even with an
external idempotency guarantee. Conclusive non-occurrence, proof the old claim cannot still
execute, and settled charge are required before a new execution attempt. Six/eight must
document how a delayed already-admitted external call is bounded; fencing prevents new admissions, not the physical
undoing of a packet already accepted elsewhere. This distinction is part of the contract,
not an exception quietly invented during recovery.

---

## 11. Declarations, projections, and non-functional checks

**Rule — new work state lives in existing spine facts; every view is disposable.**
Rules 7, 32, 33, 45, 69, 90, and 113. **Check:** P5-NF-51/52/53. The types above are
registered fact-body schemas, not new top-level register kinds. Runtime run/edge/wait
instances register through part three's governed ports; their generated loop entries carry
owner, cadence, due date, and closed-by evidence. They are not a build-time family whose
instance list depends on runtime state. All facts are shared. The following stores are
machine-local disposable projections for the reason stated; each has `growth: deletes`,
`holdsAgentMemory: no`, and `status: live` only when its implementation and evidence actually
qualify. The facts retain the history when a view is rebuilt or trimmed.

| Entry | Inputs and merge classes | Retention and tested agreement |
|---|---|---|
| `run-view` | Run openings and incompatible transition heads: exclusive-singleton; causal continuation chains; observations: set-union; stop inhibition: set-union until a causally valid resume. Part-two taint/correction handling applies before this fold. | Active detail can leave after settled terminal/receipt obligations. Immutable identity, content digests, unresolved conflicts, and replay keys remain in a compact index. Pinned rebuild against spine, including late terminal observations, P5-NF-51/52. |
| `delegation-view` | Edge/recipient mapping/terminal collection: exclusive-singleton; progress and delivery witnesses: set-union; incompatible statements become Conflict. | Keep dedup tombstones and contract mappings; trim payload detail only when captured references remain resolvable or honestly unavailable. Agreement with run and receipt facts, P5-NF-35/52. |
| `run-due-view` | Wake/receipt/recheck obligations: set-union with explicit closure causes; due time derived from facts, compared with clock only by the scheduler outside the pure fold. | A due obligation disappears only on its closure fact; rebuild repairs lost in-memory wake notifications, P5-NF-13/53. |
| `run-budget-view` | Allocations: exclusive-singleton; disjoint charges/reservations: cap-checked aggregate; observations: set-union. | Keep unsettled maximum exposure and lifetime charged totals. Oversubscription records aggregate violation and closes new admission; agreement with six's actual resource admission, P5-NF-14/15. Detection alone is not cap prevention. |
| `authorization-wait-view` | Requests/terminal choices: exclusive-singleton; delivery/receipt evidence: set-union. | Pending requests and receipts stay; terminal key/digest remains after payload trimming. Agreement with authorization and run facts, P5-NF-26/28/53. |

**Rule — projections do not read each other's storage.** **Check:** P5-NF-51 applies part two's
pure-fold/import checks: only facts and the explicitly decoded generation enter a fold.
Cross-view agreement compares independent folds at the same vector, never copies a value
from a supposedly authoritative cache. Authority-answering views carry part two's known
lineages, folded-through vector, staleness bound, and taint. Informational views label their
horizon. A quarantined poison fact closes only consumers requiring that scope and opens an
owned repair obligation, not a global graph shutdown.

**Rule — every gate declares its power and preserves what it refuses.** Rules 4, 66,
86, 95, and 103. **Check:** P5-NF-54 instantiates the following blocking-site declarations
through the governed port and verifies each decoder is actually called. Common required
facts are `authority: block`; `inspectedBy: P5-NF-54` and the corresponding behavior suite;
`preservesInput`: part two's scrubbed capture and refusal records; and criticality derived
from the declared worst-case profile. `enforces` refers to the approved schema/constraint
and its exact decoder, not a self-authored mutable policy. P3-NF-27 checks that each executing
system principal cannot author that governed schema/constraint without the operator. Runtime
facts are inputs to those rules; a worker may propose them but cannot alter the admission rule.

| Site | Exact power / `decidesAlone` | Enforced record and decoder | Per-consumer fail direction |
|---|---|---|---|
| Run/step/delegation admission | `governed-state` | Approved run/edge schemas, graph limits, grant constraints; run/step/contract decoders; six's ownership admission | Closed for starts, allocation, execution; input retained and communication routed independently |
| Run stop | `ruled-three` | Part-four authenticated stop fact and reach; stop admission decoder | Open toward inhibiting the named work, never broader than authenticated reach |
| Exit admission | `governed-state` | Approved exit schema, exit-test contract and settlement requirements; `RunExit`/exhaustion decoders | Closed for unsupported success/unreachable/cancellation claims; observations retained |
| Authorization consumption | `governed-state` | Approved wait/authorization schemas and current authority constraints; wait decoder plus part-one validity function | Closed for permission; expiry/decline/receipt and communication remain explicit |
| Transport state/collection admission | `governed-state` | Approved envelope/evidence/collection schemas; transport and result decoders | Closed for unproved state promotion or duplicate execution; uncertainty and captured input retained |
| Actual-start/continuity admission | `governed-state` | Approved coverage and continuity schemas; grounding/accounting decoders | Closed for ungrounded ordinary run action; independent minimal-plane explanation/stop open |

**Rule — features, bounds, and holders are declared with their actual duties.**
**Check:** P5-NF-54/55 checks the run-graph, delegation, authorization-wait, and grounding feature
entries. Each declares `Profile` for worst-case control loss: consequence `control`,
reversibility `costly`, reach `user`, surface `chat` (authorization also has a dashboard
surface entry), repeats `bounded` by its concrete resource/notification entries. Derived
critical/significant/user-facing classifications therefore require three test tiers,
step supervision through seven, and live proof. Metrics below are nonempty feature facts.
Critical-outcome entries name probes for admitted-work survival, single execution admission,
result collection, stop reach, and grounding. Bounds themselves have live probes, as part
three requires. Duties of observation name the semantic review of dispatch, exhaustion,
continuity, and reported result truthfulness; those belong to nine and are not replaced
by a deterministic shape check. No feature is labelled live merely by this document.

**Rule — non-functional requirements have runnable bars and failure actions.** Rules 13,
34, 38, 39, 43, 46, 55, 60, 61, 64, and 92. **Check:** P5-NF-55/56 runs the table below.
Every measurement has a registered subject, unit, producer, sample clock, and workload. The
build records the named policy generation and machine profile. Missing bounds/probes fail;
no blanket performance claim is inferred from a single machine's result.

| Property and measurement | Automatic check and workload | Bar and response when missed |
|---|---|---|
| Accepted work survival; admission-to-worker and oldest-due age | Kill between each admission/dispatch/result boundary; restart with 1,024 outstanding nodes, then repeat with partition and unavailable capture | Zero silently lost accepted assignments. Every node reconstructs as active, due, or owned inhibited work; due age exceeding its declared scheduling bound opens repair, never fictitious completion. |
| Resource safety; reserved/charged versus available, active processes and memory | Concurrent nested fan-out on at least two machines with delayed charges, lost workers, and simultaneous reservations | No admitted allocation exceeds any ancestor cap. Maximum unknown charge remains reserved; all observations retained. Overshoot is failure, not a tolerated percentile. |
| Loop convergence; attempts, backoff, breaker openings, self-action rate | Persistent provider failure, flapping transport, and lost wake acknowledgments | Declared cap/backoff/breaker honored with zero unbounded bypasses. Stop or capacity ceiling cannot generate a new retry identity or recursive respawn storm. |
| Recovery cost; startup-to-minimal-plane and checkpoint/genesis rebuild duration | Grow retained history by factors of ten while holding active node count fixed; kill checkpoint writer and reinsert a late segment | Match part-two pinned rebuild bytes. Incremental boot respects a predeclared per-machine time/memory envelope; timeout is a budget defect, not divergence. Minimal plane need not wait for full run-history replay. |
| Delivery integrity; outstanding receipt age, uncertain-operation age, conflict age | Reorder/drop/duplicate offer, result, cancel, and receipt; same key/different bytes; parent absent throughout | Zero unsupported delivery promotions and zero duplicate logical collections. Any exceeded observation window produces an owned, visible recovery/blocker state, never loss or assumed success. |
| Grounding cost and coverage; bytes/tokens read, start latency, summary age | Delayed launch, compaction, midnight/day-long clock gap, new inbound during read, stale/missing summary | Complete coverage to the chosen frontier and actual clock read. Exceeding the declared start budget opens a scoped repair; no token-saving skim is counted as full coverage. |
| Stop containment; local recognition-to-inhibition and remote unconfirmed age | Stop during fan-out, effect call, parent crash, and network partition | No new admission after a committed stop is seen by its authority. Local inhibition fits the registered stop-latency budget; remote stop stays unconfirmed until evidence. No instantaneous partition-wide promise. |
| Supervision and audit cost; per-step judgment usage, benchmark references, meter gaps | Critical transitions through the real doorway with provider loss and spend cap pressure | Every required supervisory step has seven's record or a declared fail-direction outcome. Zero private model calls. Unavailable supervision does not block the deterministic emergency stop. |
| Cadence and human attention; time since substantive check-in, pushed-message count | Long wait, many children failing, repeated expiry, one correction to a false claim | Missed run cadence is visible. Outbound requests/results aggregate under the registered notification cap; a due tick is not permission to flood or re-ask for the same approval. |

**Value — scaling tests measure the curve before choosing a storage optimization.** No
check enforces which optimization is best. Large captured payloads remain outside small run
facts; active views can be trimmed, but replay tombstones and identity conflict indexes grow
with admitted work. That cost is intentional and measured. Compression or a different storage
adapter may later reduce it only while preserving the same replay and rebuild proofs.

---

## 12. Inherited duties, discharged explicitly

**Rule — an inherited duty lands as held, partial, or an honest gap.** Rules 49 and 69;
part three's P3-NF-24. **Check:** P5-NF-57 compares the upstream references with this table
and rejects a missing disposition or an unchanged deferral to this part. Here `held` means
the behavior contract has a named can-fail check; implementation coverage remains `declared`
until that check executes. `partial` states exactly what remains outside that check. No row
claims an unbuilt holder already ran.

| Origin and rule / fixture | Disposition in this part and remaining limit |
|---|---|
| Part four rule list, 23; big picture section 4, 20; rules 21/88/99 | **Partial:** exhaustion run, avenue dispositions, smallest external action, attempted self-heal, and recheck machinery held by P5-NF-23/24. The semantic completeness of avenues is an honest gap in deterministic enforcement; named review duty below. |
| Part four sequence 8 and rule list, 83 / P4-NF-12 | **Held:** minted owner and blocked-on responsibility survive all worker losses, waits, delegation and transfers, P5-NF-03/04/10/13/18. Minting stays four's; carriage lands here. |
| Part four sequence 7 and rule list, 96 | **Partial:** actual-start clock/history read and exact coverage evidence, P5-NF-44/45. Receipt cannot prove comprehension; semantic review is the named limit. |
| Part four, 110 / P4-NF-11, with rule 47 | **Partial:** compaction disclosure, pre-pause inbound id, first-reply disposition and injection parity, P5-NF-46/47. Whether the reply truly accounts for intent is a review judgment. |
| Part four beyond-standing routing, 98 / P4-NF-20 | **Held:** closed `AwaitingAuthorization` shape, no timer-to-yes, receipted declined/expired outcomes, and request races, P5-NF-26/27/28. Surface verification remains eleven's realization of imported Authorization. |
| Part four multi-machine posture and big picture section 4, 31/63/113 | **Partial:** run half of conversation ownership/resumption is a precise demand, P5-NF-10/29/49/50. Six must realize exclusive admission and transport; graph inspection alone cannot prove fencing. No lease type is claimed here. |
| Big picture section 4, 8/46/68/71 | **Held:** recoverable due obligations, nonterminal inhibits, no lost collection, no session event closing work, P5-NF-04/13/17/18/25/53. Realization is tested through the seam contract, not assumed from a queue label. |
| Big picture section 4, 22/102 | **Partial:** journaled decision or admitted judgment work instead of an unsupported exit, P5-NF-22. Recognizing a subtle answerable question requires semantic judgment. |
| Big picture section 4, 24/26 | **Partial:** stable pending operation, observation before replay, evidence-bound exit, P5-NF-07/11/12/17. Cross-case recurrence fingerprinting and truth of observations are not provided by this graph. |
| Big picture section 4, 27 | **Partial:** distinct question/constraints schema and recorded dispatch review, P5-NF-32. Subtle expected-answer leakage is a semantic review duty. |
| Big picture section 4, 55/60/61 | **Partial:** required brakes, ancestor reservation inequality, uncertainty charge retention and no reset-by-child, P5-NF-14/15/16. Physical cap and loop realization is six's tested obligation; imported policy values must be concrete before execution. |
| Big picture section 4, 64/92 | **Held:** progress/cadence records distinct from heartbeat and due-age surface, P5-NF-13/25/55. A notice still passes the effect doorway, so a missed cadence does not confer permission to flood. |
| Big picture section 4, 93 | **Held:** directive lineage persists, no timer closure, cancellation distinguishes the run from its directive, P5-NF-17/20/27/44. Current interpretation is consumed from four/seven, not reinvented here. |
| Big picture section 4, 97/99 | **Partial:** exact exit bar, no clock-as-done, bounded true-blocker recheck and automatic next authorized window, P5-NF-17/23/24/25. Ultimate impossibility is not mechanically provable from a finite investigation. |
| Big picture section 4, 114 | **Held at the contract:** recursive owned edges, authority subsets, budgets, placement, return path, cancellation and transport witnesses, P5-NF-06/14/30–43/50. Adapter implementations must pass the same suite before live use. |
| Part four, peer-delivery half of 98 / P4-NF-23 | **Held:** peer worker-consumption witness, declared deadline and minimum response interval; concurrence never authorization, P5-NF-43. |
| Part four P4-NF-18; part two P2-NF-63/73 | **Partial at this consumer:** preserve exact operation, durability demand and taint through the run, P5-NF-07/10/28/51. These effect checks remain eight's ownership and are not counted as five's completed implementation. |
| Part one, Result report limit / 42 | **Partial:** canonical Result preserved before collection/report, P5-NF-34/35. Detecting an independently worded lying report remains nine's declared semantic duty. |

**Rule — semantic residuals have a closure owner and a calendar ceiling.** Rules 8, 9,
69, and 71. **Check:** P5-NF-57 validates observation-duty entries for dispatch neutrality
(27), exhaustion adequacy (20/21/23/99), continuity comprehension (96/110), and outcome-report
truthfulness (42). Each names part nine's semantic review as closure owner, the per-case
review evidence and run/capture references it needs, and an owned loop until the holder exists.
At this part's landing these duties render partial with explicit gaps, not held and not still
deferred to five. Proposed initial calendar ceiling is 2026-10-05, with daily pull-visible
resurfacing; adopting or changing that ceiling follows governing approval. A passed ceiling
fails the appropriate deadline check; it cannot silently extend itself. External protection
of runtime artifacts and minimal-plane live reachability remain the explicitly shared nine/
eleven and eleven obligations of the approved parents, not new protections invented here.

**Value — semantic holding remains intelligent work.** No check enforces the best avenue
set, the clearest answer, or the correctness of a model's reason by examining a field's
presence. These remain binding review responsibilities with measurable evidence of looking.
Their quality and the initial gap ceiling are choices for governing review, not claims of
mechanical certainty.

---

## 13. The negative contract fixtures

**Rule — the identifiers below are the resolvable automatic-check contract.** Rules 34,
36, 37, and 69. **Check:** P5-NF-58 maps every Rule block to one or more rows, verifies every
row has implementation evidence at its stated stage before it can count as held, and checks
references in both directions. `compile` means a negative program must fail to build;
`decode` means typed refusal; `build`/`arch` inspect structure; `contract` exercises an adapter
boundary; `test` exercises state; `lifecycle` uses the real production initialization. Every
behavioral row includes its valid complementary case, not just malformed inputs. A future
implementation must run unit, integration through real ports, and live lifecycle tiers for
these significant features; no code or runtime test result is claimed by this design.

| Identifier | Kind | The thing that must fail the check | What the rule protects |
|---|---|---|---|
| P5-NF-01 | build / arch | Missing ownership entry, duplicate owner of a type, imported private realization, or a cross-part duty without a seam/disposition | 1/30/49/69/114: one owner, complete boundaries |
| P5-NF-02 | compile / decode | Open constructor, missing schema version, unknown local version, changed canonical bytes without versioning, secret-valued field, or immutable identity mismatch silently accepted | 7/28/90/100/113: trusted types and stable history |
| P5-NF-03 | decode | Run opening lacks owner, scope, exit test, budget, cadence, wake or explicit blocked-on state | 8/83/92/97: no ownerless assignment |
| P5-NF-04 | lifecycle | Kill after accepted intake and before run creation loses the assignment or creates two roots for one cause | 46/68/83: accepted work survives |
| P5-NF-05 | test | State changed without a transition, wrong expected predecessor admitted, or immutable run opening overwritten | 31/33/68: causal durable work |
| P5-NF-06 | decode / test | Cycle, two owning parents, nonexistent dependency counted satisfied, or configured graph bound exceeded | 55/60/114: bounded recursive agency |
| P5-NF-07 | test | Dispatch/effect before durable step identity or before demanded durability; new operation key used to bypass unresolved work | 24/26/63/114: no invisible operation |
| P5-NF-08 | test | Any state pair outside section 2 admitted; due timer used as evidence of a satisfied dependency | 68/97/98: explicit transitions |
| P5-NF-09 | test | Permuting concurrent incompatible transitions picks a clean winner rather than Conflict and inhibited execution | 31/33/63: no authority from fold order |
| P5-NF-10 | lifecycle | Former worker starts/advances/allocates/effects after fencing, despite loss notification being withheld; tainted authority used cleanly | 28/63/68: admission enforces current ownership |
| P5-NF-11 | lifecycle | Crash after external effect but before recorded response causes any uncertain-effect resubmission, including same-key/idempotent replay, or a fresh operation identity | 24/26/42/68: observe unknown effects |
| P5-NF-12 | test | Inconclusive absence query treated as non-occurrence; conclusive occurrence advances twice; permanent evidence loss described as recovered | 26/42: honest uncertainty |
| P5-NF-13 | lifecycle | Nonterminal run has no live worker, durable due obligation, or owned inhibition; heartbeat alone counted as progress | 8/46/64/68/83/92: no silent abandonment |
| P5-NF-14 | test | Concurrent parent/child allocation exceeds an ancestor cap, uses wrong measurement subject, or treats zero as a default | 13/60/61/114: compositional limits |
| P5-NF-15 | lifecycle | Lost worker/lease expiry releases unresolved spend or physical capacity without settlement, or hides remaining maximum exposure | 60/61: uncertainty cannot mint capacity |
| P5-NF-16 | build / test | Repeat bypasses loop port, lacks a brake, resets identity at cap, or labels bound-applied success as completed work | 40/55/61/97: repetition with brakes |
| P5-NF-17 | decode / test | Completed/unreachable exit rests only on worker exit, time, budget, missing evidence or a changed exit bar | 20/68/97: done means the exit test passed |
| P5-NF-18 | test | Parent terminal loses an unsettled child/receipt or transfers responsibility without durable recipient acceptance | 68/71/83/114: closure retains responsibility |
| P5-NF-19 | lifecycle | Late child result after parent death/cancellation has no durable receiving/collection path | 46/68/114: results outlive workers |
| P5-NF-20 | test | Stop timed out into resume, cancellation closes Directive by a third method, requester stop acts as operator, or scope expands | 4/28/93/97: real brakes and durable directives |
| P5-NF-21 | test | Cancel/completion race chosen by timestamps; late observations dropped; cancel queued reported as remote stopped | 26/31/33/63/114: causal and honest cancellation |
| P5-NF-22 | test | An answerable question ends work without journaled decision/judgment work, or an invented boundary passes without governance | 22/102/103: the gap becomes work |
| P5-NF-23 | decode / test | Escalation lacks stored attempts/current capability and owned-identity reads, smallest action, or blocker recheck date | 20/21/23/88/99: self-unblock and revisit |
| P5-NF-24 | test | An omitted/stale/uncertain avenue or mere budget cap supports exhaustive impossibility; lawful approval requires a prohibited experiment | 20/23/26/99: bounded honest exhaustion |
| P5-NF-25 | lifecycle | Boundary review loses remaining authorized work, creates filler after success, resets budget, resumes a stopped run, or cadence floods notifications | 8/52/68/83/92/97: autonomous continuation with brakes |
| P5-NF-26 | compile / test | AwaitingAuthorization has timeout/default-to-yes, mismatched digest approval, or missing declined/expired receipt | 46/82/98; P4-NF-20: silence never yes |
| P5-NF-27 | test | Expiry drops a directive or receipt, resurrects the same request, or timer alone repeatedly asks for approval | 46/83/93/104: waiting drains honestly |
| P5-NF-28 | test | Late/conflicting yes reopens a closed request, or moved base/revoked grant still enables an effect | 28/82/98/109: exact current approval |
| P5-NF-29 | contract / lifecycle | Six's real ownership/resource/recovery realization cannot satisfy scoped exclusion, exact operation reservation, observer-only stale submissions, or record-before-advance | 31/55/60/63/68/114: demands tested against realization |
| P5-NF-30 | lifecycle | Child starts without durable edge, duplicate offer creates new child, or unknown delivery allows speculative replacement | 68/83/114: durable parent-child ownership |
| P5-NF-31 | decode / contract | Child or grandchild acts outside live delegated subset, borrows its wider ordinary grants, or sub-delegates without permission | 28/57/103/114: no authority amplification |
| P5-NF-32 | build / test | Dispatch lacks separate question/constraints or review record; expected-answer field passes negative fixture | 27: question without a demanded verdict, partial semantic coverage |
| P5-NF-33 | test | Stale capability, incompatible harness/model, unsupported evidence requirement or missing resource admission permits placement | 30/60/114: evidence-based placement |
| P5-NF-34 | decode / test | Child terminal submission omits contract/exit/accounting/provenance or converts a refusal into success | 42/68/114: attributable honest results |
| P5-NF-35 | lifecycle | Distinct message/fact ids for the same terminal produce two collections, a lost receipt reruns work, or a closed parent drops a result | 42/46/114: single logical collection |
| P5-NF-36 | arch / contract | Core branches on transport identity, transport injects directly into worker, or local and remote delegation mean different things | 29/30/114: replaceable transport |
| P5-NF-37 | contract | Adapter claims any delivery state without the row's witness, or accepted bytes count as worker delivery/answer | 26/42/114: delivery-state truthfulness |
| P5-NF-38 | decode / contract | Modified identity/scope/grant/budget/destination escapes signed-digest checks; foreign grant or segment blindly trusted | 28/29/89/114: authenticated bounded cross-agent work |
| P5-NF-39 | contract | Same semantic key/different digest collapses silently or unknown peer gains execution authority | 28/31/33/114: replay without laundering |
| P5-NF-40 | test | State rank substitutes for witnesses, timeout erases a proven answer, or conflicting witnesses produce clean permission | 26/42: knowledge distinct from execution |
| P5-NF-41 | contract | Transport acceptance masks a task refusal, or unavailable evidence is presented as current proof | 26/42/95: narrow honest success |
| P5-NF-42 | test | Closed-run tombstone lost, queue overflow silently sheds accepted work, or replay grants a new execution budget | 46/60/114: bounded custody without loss |
| P5-NF-43 | test | Peer concurrence without worker delivery, declared deadline, minimum response opportunity and bounded clock uncertainty, or concurrence used as Authorization/result | 98; P4-NF-23: heard silence only |
| P5-NF-44 | lifecycle | Delayed start reuses intake clock/history or resumes without fresh directives/graph reads | 93/96: actual-start grounding |
| P5-NF-45 | test | History coverage gap, stale summary, unavailable capture, threshold skim, or post-frontier inbound claimed already read | 26/96: full recoverable history |
| P5-NF-46 | lifecycle | First post-compaction reply lacks disclosure, pre-pause inbound id or honest accounted disposition | 110; P4-NF-11: provable continuity accounting |
| P5-NF-47 | contract | Compaction omits a required start briefing class or silently pins obsolete governing content | 47/84/90: context parity |
| P5-NF-48 | build | Imported/exported cross-part interaction absent from the six-field seam table or has no closure owner | 33/45/69/95/114: behavior beyond type ownership |
| P5-NF-49 | lifecycle | Non-minimal run defect stops independent communication/stop, or a non-owner borrows stale conversation authority to stay available | 14/15/63/77/95: scoped failure |
| P5-NF-50 | lifecycle | Any four-trace answer fails with local, remote, and nested children; exactly-once claimed without external evidence | 26/31/33/42/68/114: failures compose |
| P5-NF-51 | arch / test | Projection reads another view/ambient clock, strips taint, silently resolves conflict, or differs on equal-vector rebuild | 31/32/33/45/95: facts remain authority |
| P5-NF-52 | test | View trimming removes replay/conflict identity, capture status, or the only copy of work history | 7/33/90: disposable views, preserved knowledge |
| P5-NF-53 | lifecycle | Lost wake/receipt queue cannot reconstruct from facts, or due time changed without a causal fact | 8/46/68: recovery does not rely on notification delivery |
| P5-NF-54 | build / arch | Missing declaration/profile/consumer decision, gate can author its enforced governance, or decoder named but never invoked | 4/66/69/86; P3-NF-27: visible real checks |
| P5-NF-55 | build / lifecycle | Significant feature lacks a test tier, bound/probe/metric/supervision record, or a non-functional workload exceeds its declared bar without failure | 13/34/38/39/43/60/62: cost and liveness measured |
| P5-NF-56 | lifecycle | Production assembly supplies null/no-op ports, feature returns unavailable instead of its live contract, or real-surface first slice cannot survive crash cuts | 34/43/62/114: feature actually alive |
| P5-NF-57 | build | Inherited duty missing or still deferred to five; partial duty hides its residual; gap lacks owner, due loop, evidence requirement or calendar ceiling | 8/9/49/69/71; P3-NF-24: honest closure of inheritance |
| P5-NF-58 | build | Rule has no check, fixture reference has no row, row has no protected rule, or an unexecuted fixture is counted held | 1/26/34/37/69: references and coverage cannot inflate |
| P5-NF-59 | contract / lifecycle | Composed judgment order skips a durable boundary, calls provider before fenced spend reservation, accepts undecoded/stale/stopped output, duplicates acceptance, or treats paid judgment as business-effect permission; valid recorded answer advances once | 41/42/60/63/68/75/114: composed dispatch and conditional run acceptance |
| P5-NF-60 | contract / lifecycle | Attempt maps to multiple operations, digest collision replaces a mapping, recovery re-invokes provider, unsettled execution/charge permits a new attempt, or five/seven releases six's credits; settled predecessor permits a newly admitted linked attempt, and read-only retrieval preserves original mapping and collection | 24/26/33/55/60/63/75/114: single owners, stable retry mapping and no uncertain resubmission |

---

## 14. The terms this part introduces

**Rule — these definitions are the term entries this part proposes.** Rules 49, 69,
and 90; part three's resolver contract. **Check:** P5-NF-01/54 verifies each term is linked
from the rules and fact schemas that use it; the rendering and structured references share
one definition. Existing terms in parts one through four retain their definitions.

| Term | Kind | Definition |
|---|---|---|
| durable run | noun | An owned assignment recorded independently of every worker that may execute it. |
| run graph | noun | Runs and their owning delegation edges plus non-owning dependencies, acyclic and reconstructable from admitted facts. |
| run step | noun | One bounded proposed action with a stable logical identity and an admitted expected predecessor. |
| transition head | noun | The causally justified current run transition, or an explicit set of incompatible contenders whose conflict prevents clean execution. |
| accountable owner | noun | The principal responsible for work and its waits until completion or accepted transfer, distinct from the temporary holder of execution permission. |
| blocked-on state | field | A named unmet dependency, its responsible owner, and the next observation that can move work; `nothing` is the explicit empty case. |
| exit test | noun | Versioned acceptance conditions and their registered checking doorway, subject and required evidence. |
| settlement manifest | noun | The enumerated disposition and evidence of every owned child, pending operation, resource charge and receipt required for closure. |
| exhaustion run | noun | An ordinary bounded run that tests a claimed blocker against current capabilities and lawful avenues. |
| delegation contract | noun | The durable owning parent-child edge binding task, principals, permitted authority, resources, exit evidence, placement, cancellation and return destination. |
| semantic message key | noun | Sending agent, delegation edge, message kind and sequence identifying one logical transport message across retries and distinct fact ids. |
| collection | noun | The parent's durable single consumption of a child's terminal result under its original edge and contract. |
| delivery witness | noun | Authenticated evidence from the actor responsible for the specific delivery stage, bound to the exact message key and digest. |
| uncertainty | noun | An unresolved outcome or delivery question that absence or timeout cannot answer, carried until evidence permits refinement. |
| resource reservation | noun | Accounted capacity withheld before admitted work and unavailable for reuse while its actual consumption remains unknown; its realization belongs to six. |
| continuity accounting | noun | The first post-compaction reply's recorded disclosure and supported disposition of the last inbound received before the pause. |

---

## 15. Decisions that belong to the operator

**Value — preserve uncertainty even when it delays a result.** No automatic check chooses
the right patience for a person's work. The proposed policy keeps unknown effects, unresolved
remote cancellation, and unsettled maximum spend visible rather than declaring completion or
replaying blindly. The operator question is whether that availability cost is acceptable;
technical implementation must still satisfy the existing no-unknown-retry and authority rules.
A new policy cannot silently weaken those constitutional constraints.

**Value — finite starting limits and review deadlines need an accepted policy.** No automatic
check chooses optimal node/depth/fan-out limits, retry count, or the calendar ceiling for
semantic holding gaps. Section 3 proposes initial limits and section 12 proposes 2026-10-05.
The operator question is whether those starting values fit the intended workload. Testable
constraints and measured exhaustion remain mandatory whichever finite values are selected.

**Value — the shape of delegation favors one accountable return path.** No automatic check
proves a single owning parent is the best topology. The proposal supports many dependencies
but exactly one owning edge per child, with explicit accepted transfer. The operator question
is whether shared ownership is ever a product requirement; if it is, it needs an explicit
joint-accountability design rather than several parents each assuming another collected.

**Rule — approval is separate from technical completion.** Rules 65, 82, 90, and 109.
**Check:** P5-NF-58 keeps design checks distinct from runtime evidence; the existing governed
review state and exact-content approval process control acceptance. Part six's feasibility
challenge, the independent review desk, and operator approval are not replaced by the author
running a document checker. This document makes no claim of independent convergence.
