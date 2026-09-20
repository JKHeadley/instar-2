# Part eight — the effect doorway and operation adapters

**Status: draft, awaiting approval. Governed. Documents only; the named checks are implementation obligations, not executed runtime proof.**

**Value — purpose.** An agent can propose an action without having permission to perform it.
A service can accept a request without proving it finished. A worker can disappear after the
world changed. This design keeps those distinctions intact at the one doorway through which
work reaches the world. It records what was permitted, what was attempted, what is known to
have happened, and what still needs looking into. No automatic check proves this is the most
useful division; the Rules below specify its consequences.

**Rule — claims and evidence have declared scope.** Rules 26, 49, 69, 91 and 113.
Every paragraph, sequence and table belongs to its preceding Rule or Value. Rules name the
automatic checks that enforce their contract; Values state choices no check enforces as
preferences. No claim about current Instar 1.x behavior is made. **Checks: P8-NF-01/02**
validate the ownership, rule/check and duty inventories; `node scripts/check-governed-docs.mjs docs`
checks body discipline. Neither proves semantic adequacy, sibling agreement or approval.
Under part three, unexecuted checks remain declared; executed checks remain held* until their
semantic review at the relevant generation.

---

## 1. What this part owns

**Rule — one owner per type and behavior.** Rules 1, 30, 49, 69 and 114; big picture
sections 6, 10 and 13. This part defines exactly the following seven types, built from the
existing constitutional values. The stored types are fact-body schemas on part two's spine;
field groups and variants are not extra top-level types. **Check: P8-NF-01** compares the
inventory to constructors, registered schemas and cross-part imports.

| Type DEFINED here | Meaning and sole producer |
|---|---|
| `OperationDefinition` | Governed contract for an operation: its exact shape, permitted targets, authority, durability and evidence demands. Produced by the governed definition decoder. |
| `EffectRequest` | Immutable proposal binding actual operation, inputs and cause before execution. Produced by request admission. |
| `EffectValidation` | Record of the exact checks and current source references used for a reservation or dispatch decision. Produced by the doorway's validation derivation. |
| `OperationObservation` | Attributable observation about an attempted operation, without permission to act or settle it. Produced by the observation decoder. |
| `EffectSettlement` | Evidence-backed resolution of execution and, separately, financial exposure; consumed by six and five. Produced only by eight's settlement derivation. |
| `OutboundMessage` | Exact message, speaker, audience and reporting obligations submitted as an effect. Produced by the outbound decoder. |
| `OperationAdapterPort` | Public interface translating an admitted operation and observations to an external service. An interface, not a stored fact schema. |

**Rule — imported meanings retain their owners.** **Check: P8-NF-01** rejects a duplicate
schema or substitute authority. This table enumerates the types and contracts only NAMED here.

| Owner | Names consumed, not defined |
|---|---|
| One | VerifiedPrincipal, StandingGrant, Revocation, Intent, Directive, Authorization, Scope, Provenance, SecretRef, Result, Success, Refused, Outcome, Evidence, Measurement, Profile, Decision, ActionFloor, Conflict, UnresolvedInput. |
| Two | Fact envelope, append/admission, causal frontier, durability state, version chain, projection, checkpoint, folded-through vector, capture reference/status, retraction, correction, redaction and provisional/contested taint. |
| Three | Declaration, register generation, generation record, governed port, check-run record, rule graph and honesty class. |
| Four | Conversation binding, intake port, operation classification, registered command surface, authorization request, agent operating standing, event-id authority and session-start evidence. |
| Five | Run, RunStep, RunTransition, RunBudget, RunExit, DelegationContract, DelegationResult, AwaitingAuthorization, ExhaustionRecord, SessionGrounding, ContinuityAccounting, AgentTransportEnvelope, DeliveryEvidence and AgentTransportPort. |
| Six | Lease, FenceToken, AdmissionReservation, operation identity/mapping, dispatch-claim, spend reservation, LoopPolicy, LoopRecord, RecoveryRecord, ThreadlineRoute and ThreadlineReceipt. |
| Seven | JudgmentRequest, JudgmentAttemptRecord, JudgmentResolution, AskRefinement, BenchmarkRecord, BenchmarkScenario, BenchmarkRunRecord, JudgmentHoldCost, provider attempt and provider receipt. |
| Nine | Verification holder, verification request, evidence acceptance, probe, retrospective review, grade, outcome grading and semantic review record. |
| Ten / eleven | Executable assembly, capability isolation and concrete adapters / operator surfaces and the independent protected-artifact enforcement surface. |

**Rule — current sibling contracts gate composition.** **Checks: P8-NF-01/42/45** exercise
part six's section-4 reservation and dispatch order, seven's attempt/receipt ownership, and
five's conditional result acceptance. These are proposed sibling contracts, not approved
foundations. Six supplies the gating lease/loop/recovery realization. Eight does not add a
second lease, budget ledger or retry engine. Nine must supply its evidence-acceptance contract
before automatic retry for an operation family can activate.

**Value — one doorway is a boundary, not a claim that every disk write calls itself.**
The effect doorway controls business effects and their adapter capabilities. The fact, custody
and voter primitives that make admission possible must be able to maintain their own record.
Their narrowly enumerated execution is specified in section 3. No check chooses this layering;
the boundary check prevents it becoming an unrestricted escape.

---

## 2. An external service becomes an operation

**Rule — an operation is governed before it is callable.** Rules 4, 30, 57, 66, 69,
90 and 103. Each callable operation has one `OperationDefinition` at an approved version and
one matching feature declaration in the existing register. The feature's stable id identifies
the operation; the definition fact names that feature and its governing version. The definition
is loaded from the spine, not stuffed into an undeclared register field. It inherits part
three's governed-port construction and part two's version-chain approval contract. No new
register kind is introduced. **Checks: P8-NF-03/04/05** reject unmatched, unapproved,
conflicted, retired or pending-only definitions and a definition whose executing principal can
amend its policy. A pending definition is reviewable but cannot grant dispatch permission.

| Required definition field | Meaning |
|---|---|
| id, schema version, feature reference, governed version | Stable operation identity and exact approved contract; supersession preserves old interpretations for historical attempts. |
| owner, standards, adapter port binding | Accountable operation family, governing rules and the port implementation supplied by assembly; no provider-name branch in core. |
| input schema and canonicalization | Closed parameters, required fields, normalization and canonical digest; ambiguous parsing refuses. |
| target derivation | Deterministic mapping from validated arguments to account, tenant, destination, resource and Scope; includes all resources a batch may touch. |
| profile | Part one's five-field Profile of the worst reachable failure before intervention; reversibility names the undo operation when one exists. |
| authority contract | Registered action kind, permitted grant/contract scope, required evidence, protected-artifact classification, authorization/step-up requirement and directive constraints. |
| artifact and base contract | How exact proposed bytes and current target state are identified; target-side condition that enforces a required base at mutation. An operation with no base requirement says why under its approved contract. |
| durability demand | Part-two local-durable or replicated(n), required fact/capture closure and the loss model it accepts; section 5 supplies the irreversible default. |
| resource contract | Finite maximum money/quota, bytes, time, concurrency and physical exposure; six's reservation domain and parent allocation references. |
| execution evidence contract | Nine-owned verification-bar reference/version, exact outcome subject, accepted evidence sources, freshness/consistency requirements, evidence needed to exclude delayed execution and charge. |
| idempotency and fencing capabilities | Destination key scope, key retention and collision semantics, payload binding, fence/conditional-write support, query behavior and their contract evidence. An unsupported capability is explicitly absent. |
| loop and failure contract | Six-owned retry/observation policy references; each consumer's failDirection; preserved-input location; terminal routing and bounded overdue action. |
| custody and disclosure | SecretRef requirements, capture policy, permitted destinations/readers, scrub rules and external disclosure scope. |
| observation and activation | Required parser fixtures, metrics, supervisor point where applicable, live probe, wiring/isolation evidence and supported operation modes. |

**Rule — classification is about what will actually execute.** Rules 28, 57, 82 and 103;
P4-NF-18. The doorway decodes the final parameters and derives action and scope through the
current OperationDefinition. A proposal labelled “inspect” that asks the adapter to delete,
change recipients, widen a path pattern or spend money cannot borrow an inspection approval.
Adapters cannot accept free-form tool names or shell commands outside this schema. A command
interpreter is itself an operation with the full reachable authority and resource exposure;
it cannot call an arbitrary command “read-only” by examining its first word.
**Checks: P8-NF-06/07** include harmless and consequential neighbors, quoted commands,
account/tenant substitution, expanded batches and path traversal.

**Rule — classification cannot quietly change after approval.** **Checks: P8-NF-06/08**
require an immutable canonical plan before authorization. Formatting, encoding, attachment
resolution and recipient expansion that affect meaning happen before that digest is fixed.
A later change requires a new request and re-validation. The adapter's resolved dispatch must
match the admitted account, target, artifact, base and parameter digest; redirects cannot move
credentials or effects to an unapproved account or destination. Provider-generated ids may
appear as observations, never as a retroactive change to the request.

**Value — adapter capability is granular.** A service may support safe creation but lack a
safe conditional update or decisive cancellation query. This design chooses to enable only
modes the adapter proves, rather than certifying an entire service with one green badge.
No check chooses the useful set of modes; P8-NF-05/09 enforces the declared set.

---

## 3. The boundary and its primitive floor

**Rule — every effecting capability has one admission path.** Rules 1, 30, 41, 60, 63,
66, 75 and 115. Messages, provider calls, file/process operations, grants, vault writes,
releases, external reads that disclose data or consume quota, and adapter probes use registered
operations. Pure computation has no effect capability. Internal fact admission and projection
maintenance use the explicit primitive floor below; a business request to issue a grant or
change a governed file still passes the doorway. **Checks: P8-NF-10/11/42** enumerate
imports and entry points, deny direct provider/socket/process/filesystem capabilities to
ordinary workers, and test runtime isolation in part ten's assembly. A static import graph
alone does not prove confinement against dynamic code, plugins or privileged host access.
That remaining enforcement boundary is rendered partial under P3-NF-29.

**Rule — primitive execution is closed and cannot delegate business power.** Rules 1,
4, 55, 60, 66, 100; **checks: P8-NF-11/12**. The following table is exhaustive for
bootstrap/record maintenance. Each path remains registered, authenticated, finite and tested
under its owning part; this table does not redefine its API or permit arbitrary calls under
its principal. A new primitive requires governed review and boundary/isolation fixtures.

| Existing primitive owner | Allowed maintenance | Forbidden escalation |
|---|---|---|
| Two: append, replication and fold | Admit/sign/store own facts, verify replica receipts, update disposable indexes/checkpoints under the approved append contract | No business effect from a projection; no second mutable policy/authority store |
| Four: receive/custody and emergency stop | Preserve incoming bytes in their proper custody before interpretation; append authenticated local-durable stop and inhibit local admission | Capture cannot send a message or spend a stored secret; stop cannot launch ordinary work or widen its reach |
| Six: voter/control and scheduling | Bounded authenticated promise/vote/commit traffic, own control records, pre-reserved protocol credits and due-work discovery | No provider, user send, business worker, grant expansion or unilateral membership change |
| Ten: realization of these exact primitives | Install only their scoped I/O capabilities under approved genesis/assembly policy | No worker inheritance of raw service credentials or unrestricted control-principal capability |

**Rule — recording an effect cannot require another effect reservation for the record.**
**Check: P8-NF-12** constructs request, reservation, dispatch, observation and settlement
with provider access disabled and proves bounded completion using the append primitive.
Recording a verification obligation also uses append; executing a world-facing verification
query is a separately admitted operation. Its own receipt can satisfy its narrow query contract
without demanding another world query merely to prove that receipt was stored. Thus neither
logging nor verification recursively dispatches itself. Critical business supervision uses
seven; admission of that supervisor's call uses exact governed-state checks, not a second
model approving its own invocation.

---

## 4. Requests, observations and settlement records

**Rule — construction and identity are closed.** Rules 7, 28, 90 and 113;
**checks: P8-NF-01/13**. The six stored types use private construction, total decoders,
canonical encoding and schema migration. Every admitted payload is immutable. Identity is by
record id; canonical value comparison is within type/schema after migration. A reused logical
identity with incompatible immutable content produces Conflict, never a clock winner.
Successor observations have fresh fact ids and explicit prior references. No stored payload
contains secret bytes; bounded free text and capture references follow two's admission.

**Rule — the request names its complete cause and exact proposal.**
**Checks: P8-NF-06/13/14** enforce these EffectRequest fields.

| Field group | Required contents |
|---|---|
| Identity | Record id, schema, six-owned logical operation reference/mapping and canonical request digest; an operation mapping can be explicitly pending during proposal, never at dispatch. |
| Cause | Five's run, step and expected predecessor; original Intent/directives; delegation contract if any; seven's request/attempt/resolution/Decision where relevant. Background work names a system-owned run. |
| Actor and audience | Invoking VerifiedPrincipal, actual executing principal, affected Scope, account/tenant/resource/destination and current binding references for conversation effects. |
| Operation | Exact OperationDefinition version, register generation, validated arguments, target/artifact/base digest and immutable prepared-payload capture. |
| Basis | Grant/authorization references, current evidence and their causal frontier, custody/disclosure requirements, declared demand and six's requested resource allocation. |
| Follow-through | Result destination, accountable reconciliation owner, six-owned observation loop reference or creation requirement, nine-owned verification-bar reference and required evidence closure. |

**Rule — validation is a recorded comparison, not a reusable permission token.**
**Checks: P8-NF-15/16/17**. EffectValidation carries id, request/operation/digest, phase
(reservation or dispatch), current definition/generation, actual artifact/base, source fact
references and frontier, current clock, evidence/capture status, authority taint, achieved
per-reference durability, grant/binding/authorization verdicts, fence/stop/predecessor
references, resources, and the resulting constitutional Result for validation. Success means
those checks passed for that comparison. Only six's matching conditional dispatch-claim
permits invocation. Neither a stored validation Success nor its clock reading is a bearer grant.

**Rule — an observation records evidence without promoting it.** Rules 26, 28, 42 and 89;
**checks: P8-NF-18/19/20**. OperationObservation contains id, exact operation and dispatch
reference, request/destination/digest, observer identity and Provenance, captured source
reference and hash, observation clock and causal predecessors, Evidence with source/strength/
freshness, observed provider identifier, and separately reported execution and charge claims.
It distinguishes an actual returned response, partial bytes, timeout, transport rejection and
query failure. Missing fields of external knowledge remain explicitly unknown. A signature by
the recording machine proves who recorded it; it does not prove the service performed it.
For model operations, the original receipt belongs to seven: this observation references that
JudgmentAttemptRecord and capture, never creates a second provider-receipt authority.

**Rule — EffectSettlement is the only operation-settlement producer.** Rules 24, 26,
33, 42, 60 and 75; **checks: P8-NF-19/21/22/23**. It carries:

| Field group | Required contents |
|---|---|
| Identity/binding | Settlement record id, operation/request/digest, reservation and dispatch-claim, destination, definition version and predecessor settlement/observations |
| Execution | Part one's Outcome: happened, did-not-happen or uncertain; exact external subject and the nine-owned evidence-acceptance references supporting that verdict |
| Delayed execution | Evidence acceptance proving the original claim cannot still execute, or explicitly unresolved; no process-name or socket-status shortcut |
| Charge | Known final exact money/quota liability with unit/account/window and evidence, or unresolved with its reserved upper exposure; money uses exact decimal/integer arithmetic |
| Authority to assess | Reconciliation principal, current assessment-bar version and standing, generation/frontier, source freshness, capture status and taint |
| Consequences | Eligibility for six to account/close/retry, with reasons; five's result destination; still-open verification/dispute obligations and their owner |

The charge and execution fields are independent. An answer can have happened while its bill is
unknown. A zero-cost rejection can establish no execution only when its service contract proves
that claim and excludes a delayed invocation. `uncertain` is retained as an explicit unresolved
assessment; it cannot carry a release/retry eligibility that requires final settlement.
The latest causally valid assessment refines knowledge; contradictory accepted assessments
produce Conflict and inhibit new use, not last-writer-wins. Corrections and withdrawals use
part two's existing machinery and preserve every previous accounting action as history.

**Rule — Result says which operation succeeded.** Rules 40 and 42;
**checks: P8-NF-18/21/24**. A validation refusal is Refused for validation. A successful
observation query is Success for obtaining its observation, possibly about an uncertain effect.
It is not Success for the business effect. A known pre-dispatch refusal or conclusive provider
refusal preserves the corresponding Refused under one's closed reasons: decode, standing,
floor, stale-base, lease, budget-exhausted, integrity or policy. An ambiguous timeout never
constructs Refused's claim that the operation did not happen. The consumer receives recorded
observation/settlement values through one's Result/Outcome consumption functions; no new
Outcome arm or alternate result union is introduced here. Business success requires the
operation's actual success predicate and evidence; query success and capacity enforcement
cannot stand in for it.

---

## 5. Which durability an irreversible effect demands

**Value — reference policy: peer-backed by default when a peer exists, locally durable when it
does not.** This design chooses `replicated(1)` as the default demand whenever a second machine is
enrolled for every ordinary irreversible operation: a sent message, external disclosure, paid
model call, destructive unrecoverable write, authority change or release. The append owner must
already have local durability; part two's n counts acknowledged peers, not the owner. This
protects the prerequisite record against loss of the originating machine under the declared
independent-peer failure model. It does not promise survival of all copies failing or copies
sharing one failed disk. No check chooses the availability/storage trade. An operation can demand
replicated(n) for larger n. A single-machine installation is supported without a peer dependency
for the fixed profile's accepted closed `local-durable` operation set. Discovery or loss of a peer
never changes an installed demand automatically.

**Rule — the installed shape selects the local demand before dispatch.** Owner: the operator
owns the P-08 installation policy; Ten owns the fixed profile; Eight owns the operation demand;
and Two owns its durability evidence. **Checks: P8-NF-25/26/27**. The single-machine shape makes
`local-durable` available only to the profile-enumerated installed provider call and reply-only
Telegram `ordinary-reply` send after one operator acceptance binds that complete set and the
permanent-machine-loss model for the installation. The operator does not list those operations
again by hand. Each exact local prefix covers authorization, preparation, disclosure,
maximum-charge reservation, reply preparation, observations and later settlement predecessors
available at dispatch. Missing or stale policy, an operation outside the profile set, a partial
prefix, a same-machine process presented as a peer, or automatic fallback after peer loss refuses.
The positive neighbors are a complete local receipt in an admitted single-machine profile and a
real peer receipt when a second machine is enrolled. `replicated(1)` remains required whenever the
operation demand names replication; that operation refuses in the single-machine shape. No state
called `replicated(0)` exists.

**Rule — the chosen demand is enforced, without redefining the states.** Rules 26, 31,
33, 63 and 90; P2-NF-63. **Checks: P8-NF-25/26** enforce a known positive peer count
for replicated(n), distinct authenticated durable peer acknowledgments and an approved
installation-profile loss model covering the exact operation. Local-durable meets only the local
demand. Replicated(m) meets replicated(n) only when m is at least n, the referenced bytes and
acknowledgment semantics match, and the local append is durable. A lease quorum, socket ack,
replica configuration or projection label is not part two's durability receipt. The reference
default/explicit override is enforced as governed policy, not introduced as an extra
constitutional permission wall.

**Rule — demand covers the evidence closure, not just a request-shaped shell.**
**Checks: P8-NF-25/26/27**. Before dispatch the required closure includes the request and
pending run/attempt identity, actual operation definition/version, grant and explicit approval
basis where required, relevant governing causal references, reservation, dispatch-claim and
reconstructable verification obligation. Each required fact must satisfy the operation's demand;
a receipt for an unrelated head is insufficient. Causal predecessors covered by a verified
durable segment prefix may share its acknowledgment proof. Referenced captures required to
reconstruct or authorize the action must be in custody with their declared availability and
loss behavior, not assumed replicated because their referring fact is replicated.

For seven's machine-local model input/output captures, this does not authorize raw replication.
Shared digests, request/attempt, reservation and claim can meet replicated(1) while raw captures
stay on their origin. The model operation must explicitly declare the resulting loss limit:
permanent origin loss may make content reconstruction impossible and leave execution/charge
unknown until external evidence is obtained. It is then observer-only recovery, not permission
to regenerate a prompt and re-dispatch. An operation whose verification bar requires surviving
raw capture bytes cannot claim that demand met under this custody policy; its affected mode
stays unavailable. Both successful admission of the declared limited mode and refusal of the
incompatible stronger mode are P8-NF-27 cases.

**Rule — settlement cannot outrun its durable evidence.** **Checks: P8-NF-23/25/39**.
Observation receipts, nine's evidence acceptance, settlement and the causal references needed
to reconstruct their conclusion meet at least the original operation's demand before six
releases credits or admits a retry, or five consumes them as settled effect evidence. A
subsequently strengthened governing demand also applies to new consequential use. Six's
accounting/close acknowledgment must preserve that same proof obligation before released
credits can fund another operation. Missing replication after a successful external effect
therefore delays settlement consumption; it never licenses repeating the effect. A receipt
stored only locally can still be preserved and displayed at its honest horizon. Model-capture
custody and its explicit loss limits remain unchanged. The fault fixture kills the origin
after each evidence, settlement and accounting append and verifies no unsupported release.

**Rule — stop and maintenance keep their already-owned durability contract.**
**Checks: P8-NF-12/28**, with P4-NF-14. Four's authenticated emergency stop appends
local-durable and inhibits local admission without waiting for replication or quorum. It
cannot acquire an ordinary irreversible-operation requirement from this default. The primitive
floor uses its original part's durability contract. Reversible/costly ordinary operations have
at least local-durable demand, strengthened where their declared loss consequences require it.
A compensation is a new operation with its own demand; it never weakens the first operation's.

**Rule — enough copies do not cleanse authority.** Rules 28, 31, 63, 95 and 104;
P2-NF-73/76. **Checks: P8-NF-29/30** reject irreversible dispatch whose authority depends
on provisional, contested, retracted or evidence-unavailable inputs, even if every machine
stored them. The fold's taint is read transitively through grants, approvals, classifications,
judgments and derived views. Only two's reconciliation/standing-covered conflict resolution
can clear its authority status; eight cannot erase a marker. A cleared marker requires a new
validation against the current horizon. Partition-local admissibility of a fact is usable for
recording, never automatically spendable.

**Rule — currency is independent of both replication and quorum.** **Checks: P8-NF-16/30**
apply two's known-lineage set, staleness bounds and narrower conflict answer, plus three's
anchored generation checks. A healthy quorum with a stale relevant authority view still refuses
ordinary dispatch. An appender clock cannot resurrect a revoked grant: causal authority and
freshness come from their owners, and one's explicit clock argument checks expiry. No claim
is made to know global instantaneous state through an indefinite partition. The remaining
within-horizon unseen-revocation window is part two's declared consistency limit; replication
count and a “just checked” timestamp do not eliminate it.

---

## 6. Re-validation where the effect leaves

**Rule — the composed order cannot be skipped.** Rules 4, 28, 42, 60, 63, 82, 95,
98, 100 and 104; P4-NF-18. **Checks: P8-NF-14/15/16/17/31/42** kill or alter
state between each pair of steps and assert no unrecorded permission.

1. Preserve the proposal and custody-safe input. Five persists pending work and the expected
   predecessor; seven persists its request/attempt for judgment. Six assigns the stable logical
   operation mapping. A duplicate digest joins that identity; a collision is Conflict.
2. Load the current anchored generation and operation definition. Decode the actual parameters,
   account, target, scope, artifact and base. Reject undeclared adapter behavior. Classification
   comes from this actual operation, never from the ask's wording or a model's “approved” field.
3. Invoke four/one's current standing and binding resolution. Enforce live directives, delegated
   action/scope intersections and the agent's operating standing. Check required Authorization
   against the exact request, artifact and current base, including approver, verified explicit
   yes, live grant and waiver precedence. A necessary new approval routes through four/five;
   no direct invocation occurs and no unnecessary approval is added to standing-covered work.
4. Consume current Evidence through its freshness function. Verify subjects, sources, capture
   availability, taint, profile-specific floor/supervision, disclosure/custody and durability.
   Append reservation-phase EffectValidation. Six conditionally checks current predecessor,
   fence, stop, resources and remaining parent credits, then commits the prepared reservation.
5. Persist the verification obligation before dispatch: exact operation, accepted observation
   question/bar, accountable owner and six-owned bounded wake. Its readiness is conditioned on
   a dispatch-claim or observation; an unused prepared request can close it with a proved
   no-dispatch disposition. A crash cannot fall between the external action and inventing its
   follow-through duty.
6. Immediately before the executor handoff, repeat steps 2–4 for the final payload. Six's
   conditional dispatch-claim binds this validation, digest and expected authority predecessor,
   rechecks fence and stop, and commits one claim. A changed local source version or expired
   validation rejects and returns to validation. Wait for the claim and required closure to
   meet the same durability demand. Re-check local stop/expiry after that wait; if invalid,
   do not invoke and reconcile the claim. No queued validation snapshot becomes fresh by waiting.
7. The confined executor consumes that claim once and calls only the bound adapter/mode. It
   passes the admitted operation identity, digest, and destination fence/conditional base where
   supported. No hidden client-library retries or provider fallback execute here.
8. Record returned observations, including uncertainty, through the owning receipt recorder.
   Query/transport success alone does not settle business success. Wake verification from the
   already-durable obligation. Nine assesses evidence; eight appends EffectSettlement; six
   conditionally accounts/closes its reservation using that settlement reference.
9. Five consumes the applicable recorded outcome/answer once against its current predecessor,
   stop and ownership. It owns run advancement and terminal races. Verification, late billing
   and disputes remain discoverable even if that run has stopped or its worker has died.

**Rule — the check-to-call race has an honest boundary.** **Checks: P8-NF-17/31/32**.
The final claim serializes admission under six; it is not an atomic transaction with a remote
service. A stopped or fenced executor paused after its claim may still perform that admitted
attempt. The successor retains it as in flight. Destination fencing rejects an old epoch at
mutation where supported. Otherwise the guarantee is one admitted invocation and no blind
successor replay, not instantaneous revocation of the world. A local inhibit narrows the window
but does not prove that a delayed packet was undone.

**Rule — a repeated handoff cannot invoke the adapter twice.** Rules 26, 63 and 68;
**checks: P8-NF-14/31/35/42**. The six-owned claim binds one authenticated executor
incarnation as well as the attempt and digest. Eight requires that binding from six; it
does not define a second claim. Inside that incarnation a single atomic consume gate admits
the first matching handoff and records an OperationObservation of local executor acceptance
before invoking the adapter. The observation proves only local acceptance, never remote
occurrence. Duplicate deliveries return the existing observation/disposition and do not call
invoke again. After any executor restart the incarnation changes and no old claim can enter
this gate, even if its acceptance observation is missing: recovery treats the committed claim
as uncertain. The successor must reconcile it, not reconstruct a callable handle from a
stored claim. A crash between consume, acceptance append and invocation may therefore produce
zero invocations and an unresolved obligation, never permission for two. This is tested with
simultaneous duplicate handoffs and kills at all three cuts, not just sequential retries.

**Rule — a bound base needs a condition at the target.** Rules 26, 82 and 109;
**checks: P8-NF-08/32/33**. For an action whose permission is bound to a base, the adapter
must use an atomic target-side compare-and-apply or an independently enforced target-side
admission bound to that exact base/artifact. Read-current-base then unconditional write is not
conformance. For files this includes resolved object identity and path/symlink races; for a
repository action it includes the actual target head, not a cached branch label. A service
without such a mode reports unsupported and that mode cannot activate. An operator yes cannot
make an unconditional mutation atomic. A changed base returns to four/five's exact re-issue
path; it never silently moves an approval.

**Rule — evidence after loss of ownership is still receivable.** **Checks: P8-NF-19/34**.
A fenced worker can submit an observation under separately scoped observer standing, bound to
its original claim and capture. Observation admission cannot claim a dispatch, change a run,
settle charges or release successor resources. If that observer lacks current submission
standing, custody preserves the evidence for an authorized recovery reader; absence of the
old worker's execution grant is not proof that its already-issued effect did not happen.

---

## 7. The adapter port and its proof obligations

**Rule — adapters translate; the core grants, settles and retries.** Rules 30, 36, 42,
55, 63 and 75; **checks: P8-NF-09/10/18/35**. OperationAdapterPort has these operations.
Construction requires its declaration id and scoped capabilities; invoking it directly from a
feature is an architecture failure. Protocol failures return constitutional Results for the
narrow requested port operation. A timeout after dispatch returns an observation of uncertainty,
not Refused for the unknown business effect.

| Port operation | Input and output |
|---|---|
| describe | Registered operation/mode and target → bounded capability evidence and contract version; no execution permission. |
| invoke | Exact request, current one-use dispatch-claim, prepared payload and admitted credential handles → captured operation observations, including uncertain or partially observed outcomes. |
| observe | Original operation/key/digest/target, previous observations and an admitted bounded query → observations answering the specific verification question. |

Cancellation, compensation, credential rotation and repair that change the world are registered
operations passed to invoke, with their own claims. There is no unmetered cancel or probe method
that can perform an arbitrary write. Callback input enters through four's authenticated intake
and then the observation decoder, never directly mutates the settlement view.

**Rule — unsupported guarantees are declared, not simulated with labels.**
**Checks: P8-NF-09/20/35/36** demand the following contract evidence per supported mode.

| Capability | Required proof and limit |
|---|---|
| Idempotent submission | Same account/key/digest repeated under concurrency produces one semantic application; different digest under that key refuses; retention and restart semantics are explicit. A generated request id alone proves nothing. |
| Destination fencing | The actual mutation rejects obsolete admitted epochs; loss notification to the client is not this proof. Absence of support leaves the already-claimed in-flight limit. |
| Decisive lookup | Query binds original account/key/target/digest and states consistency horizon. Not-found on an eventually consistent listing is inconclusive. |
| Final non-occurrence | Service rejection/cancellation/no-effect evidence plus proof a delayed executor/packet cannot still apply; all charge components are final. |
| Charge ceiling/settlement | Enforceable finite maximum including fees, overhead, quota and provider retry behavior; final receipt or governed conservative treatment, never guessed zero. |
| Batch/partial completion | Finite sub-operation set, stable item identities and per-item observations/charges; an adapter cannot collapse partial application into whole-batch failure. |
| Authentication/fixture honesty | Real captured service bytes, provenance class actually supported, endpoint/account binding, malformed and forged responses refused without inventing provider proof. |
| Target condition | Real concurrent target change fails the old base/artifact-bound invocation; no read-then-unconditional-write substitute. |

**Rule — multi-effect adapters expose their internal boundary.** **Checks: P8-NF-07/36**.
A service call with multiple independently applicable items is either proven atomic at that
service, or split into a finite admitted set whose item mappings and resource bounds precede
execution. Partial results leave the unresolved items owned. “Undo” is a separately authorized
compensating effect; a refund does not prove the charge never happened, and deleting a sent
message does not undo disclosure. A worker cannot create fresh item keys to escape unresolved
items after a batch timeout.

**Value — initial retry policy is deliberately narrower than possible idempotency.**
Five permits eight to prove safe identical-key resubmission. Six and seven require reconciliation
of an unresolved call before a new attempt. This design's initial operation modes choose
observation until decisive settlement, even where a provider might support replaying a key to
recover a response. This is compatible with the stricter composed contract and costs availability.
No check chooses that preference; P8-NF-22/35 refuses any invocation path advertised as a query
unless its registered contract proves it cannot create or charge a new application.

---

## 8. Verification, uncertainty and charge reconciliation

**Rule — eight owns unresolved effects until a recorded disposition.** Rules 8, 24,
26, 42, 55 and 68; **checks: P8-NF-21/22/37/38**. Eight owns operation enumeration,
observation requests, evidence binding, EffectSettlement and its delivery to six/five. Six owns
LoopRecord, wake claims, reservation state and credits. Nine owns the verification question/bar,
independent evidence assessment, probes and grading. The absence of nine's holder is not an
adapter success default. Missing or inconclusive acceptance leaves Outcome uncertain and
prevents automatic retry; the recorded obligation and missing dependency remain visible.

**Rule — the verification seam specifies an acceptance requirement, not nine's type.**
**Checks: P8-NF-20/21/38/42** require nine's own evidence-acceptance output to bind the
original operation/claim, target/digest, question, observation captures, assessed predicate,
bar version, observer/assessor provenance, time/freshness, current taint and permitted scope.
It must distinguish evidence of occurrence, decisive non-occurrence, unresolved occurrence,
remaining late-execution possibility, and settled versus unknown charge. It must identify
contradictory or insufficient evidence without selecting a convenient observation by timestamp.
These are consumer requirements on nine's output, not a field layout or constructor owned here.
Nine's independent assessor cannot be the adapter merely renaming its own receipt “verified.”
The bar determines which authenticated mechanical witnesses suffice and which cases need a
judgment through seven. A model's confidence alone cannot prove an external negative.

**Rule — retry requires three independent closures.** **Checks: P8-NF-22/23/35/38**.
Before six can admit another invocation for unfinished work, eight's evidence-backed settlement
must establish (1) did-not-happen for the intended effect, (2) the old claim cannot later
execute, and (3) all charge/exposure is settled. Current standing, floor, target, demand,
remaining budgets and stop state must then pass again. The logical business operation retains
its identity and digest; a new six-owned attempt claim is linked to that settled predecessor.
For model work, seven owns a genuinely new provider attempt and six maps it to its operation
only after the old attempt reconciles. New provider, payload, child, run, account or budget
cannot be used as a replacement retry while that same intended work remains uncertain.
The work owner records the lineage explicitly; inference of disguised semantic equivalence
is a part-nine review residual, not something an id comparison can guarantee.

**Rule — happened closes repetition, not every obligation.** **Checks: P8-NF-21/23/37**.
Decisive occurrence evidence prevents repeating that effect even if it failed the broader run's
exit test. Final charge evidence lets six convert its reserved amount into actual charge and
release only the proven unused remainder. The update is idempotent by operation and settlement
reference and cannot be applied by seven's meter or eight's recorder. Unknown charge retains
the maximum exposure. If the provider actually charged above its enforced declared maximum,
record the full amount, expose a cap violation and close new affected admissions; do not clip
the observation or raid another reservation to conceal it. Part-five's conservative maximum
write-off may account the full reservation as spent, but it is not evidence of non-occurrence
and cannot unlock a forbidden replay.

**Rule — output availability does not release effect liability.** Owner: Eight for the provider
settlement consumer, Seven for `ProviderAnswerAcceptance`, Six for accounting and Five for run
use. **Checks: P10-SI-17/24**. Eight may expose one exact complete model output to Five when
Seven's acceptance binds Nine's response assessment and the exact Eight settlement and Six
accounting, the route has an enforced finite maximum charge, maximum exposure remains held and
retry eligibility is false. It returns `chargeSettled: false` while accounting is unresolved and
does not claim old-executor quiescence. Five keeps the provider step and accounting obligation
pending. Five may bind that one use to one separately admitted reply run under the current
predecessor, stop, standing, fence and original conversation obligation. That reply run receives
its own grounding, authority, budget, durability and Eight outbound dispatch claim; it cannot call
the model or complete the original provider run. Missing assessment, mismatched settlement hash,
reduced exposure, changed predecessor or stop, duplicate use or any repeat path refuses. The
positive neighbor is a response-observed complete answer used once for one real reply with unknown
charge still reserved; restart reuses that reply operation, and the existing zero-unresolved
consumer remains the positive path that may report charge settled.

**Rule — uncertainty has no expiry into truth.** **Checks: P8-NF-22/37/39**. Observation
episodes have finite cap/backoff/breaker and duration; hitting a bound stops that episode and
retains the operation's unresolved obligation, exposure and next permitted observation or
named inhibit. A run may halt immediately on stop while settlement remains open. No timer,
absent callback, deleted cache or expired provider lookup window converts uncertain to
happened or did-not-happen. An operator's explicit acceptance of risk is recorded as that
decision, never fabricated evidence; any separately permitted action still passes governance
and cannot silently relabel the unresolved operation.

**Rule — recovery does not rely on scheduling a callback after success.**
**Checks: P8-NF-14/37/39/42**. At boot and on bounded cadences, the effect index enumerates
requests, prepared reservations, claims, observations, settlements and unmatched six/five
consumption references. A claim lacking response or settlement awakens its existing obligation.
A prepared operation closes without invocation only when six conditionally proves it has no
claim and cannot gain one. A settlement lacking its accounting acknowledgment is redelivered;
a receipt missing its settlement is reassessed without invoking the provider. Ownership changes
preserve these identities. Retention of acceleration indexes cannot erase the permanent replay
keys, evidence disputes or obligations in the fact record.

**Rule — evidence withdrawal reopens knowledge honestly.** **Checks: P8-NF-21/23/30/39**.
Later retraction, contradictory billing or compromised witness evidence propagates from two
into the assessment and dependent claims. Eight records a dispute and asks nine to reassess.
Six stops new affected allocations if the supported balance is now inadequate/unknown; it
records corrective accounting under its authority. Already-spent funds and already-sent
messages do not disappear. Five receives the dispute without retroactively pretending an
admitted business action never happened. Nine grades and re-derives the affected conclusions.

---

## 9. Messages, secrets and protected artifacts

**Rule — a message is an attributable operation with a finite audience.** Rules 52,
53, 54, 87, 88, 89 and 106; **checks: P8-NF-40/41**. OutboundMessage carries id,
request/operation reference, exact rendered text and attachment digests, bounded authenticated
recipients and conversation route, speaker VerifiedPrincipal and provenance, purpose (requested
result, required action, ordinary reply or infrastructure receipt), originating work, referenced
Result/Outcome and Evidence, disclosure scope, notification bound/coalescing key, and any
ContinuityAccounting or pre-filled authorization-surface reference. Infrastructure cannot sign
as the agent; the agent cannot sign as the operator. Channel adapters translate formatting
without changing meaning, audience or speaker, and preserve the verifiable origin record.

**Rule — advisory review does not acquire blocking power.** Rules 4, 14, 54, 67, 86,
87 and 95; **checks: P8-NF-40/41/43**. Pre-send coherence/style review uses seven with
the conversation, bounded rounds and a latency budget. Its objections are signals; unavailable
review follows the registered deliver-with-flags default for otherwise authorized communication.
The final sender records surviving objections. It still checks exact credentials, recorded
authority, stop, ownership, budget and operation durability. An advisory outage therefore cannot
silence a healthy channel; missing valid authority is not an advisory outage. An unavailable
ordinary owner uses the separately authorized infrastructure/repair surface specified by
six/eleven, never a second agent voice borrowing stale authority.

**Rule — outbound policies act on structured evidence.** **Checks: P8-NF-40/41**.
System notices aggregate into the declared alerts destination; no per-item conversation is
created. A request for internal repair action cites the failed self-heal/ExhaustionRecord,
while ordinary requested results do not pretend to be failures. Cadence alone does not
classify a churn notice as a result. Counters and coalescing are six's resource admission;
expected coalescing records capacity applied for that operation, never “delivered” for an
unsent message. Links are complete and scoped to the recipient's surface; localhost and
machine-only paths cannot pass as a remote user's usable link. Missing verified delivery leaves
five's reply obligation owned. Whether prose is coherent or a message deserves attention is
nine's semantic review responsibility, not proven by the presence of a purpose field.

**Rule — custody precedes credential use.** Rules 86 and 100; **checks: P8-NF-11/44**.
The executor resolves only admitted SecretRefs inside the credential adapter's custody scope.
It verifies the stored-secret/credential record, permitted destination and expiry before use;
raw values never enter the worker, ordinary capture, request or settlement. Credential-bearing
outbound text is refused by the exact secret gate and preserved as custody-safe metadata,
not copied into a refusal log. Four's intake-custody primitive remains the path for newly
arriving secrets. Its best-effort shape-scan residual remains: an unrecognized secret in prose
can escape detection, requiring rotate/retract/record and review, not a claim of complete
semantic secret detection. Reminder/rotation operations use the same bounded effect path.

**Rule — a protected artifact needs the external anchor its protection claims.** Rules
82, 94, 98, 101 and 109; **checks: P8-NF-33/44/45**. Exact verified approval, non-agent
approver, request/base digest, applicable prior waiver and target condition are checked at
dispatch. A host-fetched record with a matching hash remains channel-attested; it cannot
replace one's verified explicit-yes requirement. Hook bypass is an operation requiring the
operator's explicit authorized scope and a contemporaneous disclosure record. A release's
side-effects/rollback review reference must resolve; its existence is checked, its quality is
reviewed by nine. Nine/eleven's independent monitor remains necessary for protected runtime
or dashboard artifacts; eight's own validation cannot certify protection against an actor
able to rewrite that validator. The affected claim stays partial and the protected mode cannot
be advertised as enforced without the external witness and isolation proof.

---

## 10. The four failure traces

**Rule — shared traces cross the real owner implementations.** Rules 24, 26, 31, 33,
42, 63, 68 and 114; **checks: P8-NF-31/34/35/37/42/45**. Run each with a message,
a paid model call and a conditional artifact mutation, locally and across worker takeover.

| Trace | Eight's answer | Closure and residual |
|---|---|---|
| Crash after effect, before record | Durable claim and verification obligation precede the effect. Replacement observes the same account/key/digest, retains unknown execution and maximum charge, gets nine's assessment, records settlement and redelivers it once. A missing receipt cannot justify fresh invocation. | Eight closes operation reconciliation; nine assesses; six accounts and closes its claim; five advances/settles work. Without decisive external evidence, uncertainty remains owned indefinitely. |
| Duplicate delivery | Exact semantic key/digest joins the existing operation even when event/fact ids differ. Conflicting digest is Conflict. Duplicate callback/settlement cannot count an effect or release a credit twice. Permanent record survives cache pruning. | Six owns operation mapping and single claim/accounting; eight owns evidence/settlement dedup; five owns one run consumption. A service's own duplicate behavior is tested, never inferred from our key field. |
| Cancellation racing completion | Stop before claim prevents admission. A prior claim may still execute; late observations and bills remain facts, never revive the run. Eight reports what happened without selecting five's terminal winner. Concurrent incompatible claims stay contested. | Four authenticates stop; six inhibits/fences; eight settles in-flight consequences; five handles causal terminal ordering. Delayed external execution is not instantaneous global cancellation. |
| Stale authority | Recompute actual scope, grants/binding/directives, evidence/taint, anchored generation, target/artifact/base and demand at dispatch; six compares exact current fence/stop/predecessor. Replayed validation or copied token cannot authorize. | Source owners resolve stale/conflicted authority; eight refuses affected invocation. Already-claimed calls retain their stated in-flight limit. Stale workers may supply evidence only through observer admission. |

---

## 11. Declarations, storage and multi-machine posture

**Rule — existing kinds enumerate the implementation.** Rules 4, 32, 33, 38, 39,
43, 66, 69 and 113; **checks: P8-NF-03/04/10/42/46**. Entries below become live only
with implementation evidence. Each operation feature has its five-field profile and actual
paired bounds; critical/significant/user-facing properties are derived. A bound without its
construct and probe fails P3-NF-19. OperationDefinition facts are registered schemas, not a
new register kind or a hand-maintained parallel capability list.

| Entry/kind | Required declaration and subject |
|---|---|
| Effect doorway and per-operation features | Metrics in section 12; default doorway profile external/irreversible/world/none/bounded by actual admission limits; operation-specific profiles replace none surface with actual chat/dashboard where appropriate. Activation names all three test tiers and real outcome proof. |
| Request/dispatch/settlement blocking sites | authority block; governed-state rungs enforce approved definition/schema, standing/authorization/evidence contracts with named decoders; ruled-three for secrets, cap and stop. Executing principal cannot amend those governed policies. Inputs preserved in existing capture/refusal custody. |
| Per-consumer fail directions | Closed for mutation, disclosure, spend, false settlement and unsupported release; open for permitted advisory delivery and preserving incoming/late evidence. Each applies to its named operation, never global success. |
| Adapter parsers | Captured service fixtures, authenticationClass, eventIdAuthority and ackPolicy appropriate to their stimulus class; actual decoder invocation proved by wiring. |
| Critical outcomes / observation duties | Single admitted invocation, truthful outcome/charge, real delivery, target-condition enforcement and uncertainty progress; nine-owned probes/assessments with cadence, freshness and closure records. |
| Loops and operator actions | Six's bounded verification/retry episodes and persistent operation obligation; four/five's pre-filled authorization and eleven's phone surface, never a new approval lifecycle. |

**Rule — no new authoritative database.** Rules 7, 32, 33, 45 and 90;
**checks: P8-NF-39/46/47**. Requests, validations, observations, settlements and messages
are shared spine facts. Definitions use two's governed version chain. Their views declare
folds/ignores for all fact kinds and read only facts plus register generation. Two's correction,
taint, availability and pinned rebuild rules apply before these folds.

| View/custody | Growth, memory and machine scope | Agreement and merge class |
|---|---|---|
| Effect/settlement index | deletes disposable rows; no agent memory; machine-local rebuildable projection | Exclusive-singleton logical request/settlement heads with causal refinement; observations set-union; contradictory assessments Conflict. Keep permanent identity/digest/dispute references. |
| Verification due index | deletes disposed view rows; no agent memory; machine-local scheduling view | Set-union obligations plus explicit closure facts; any unresolved claim stays discoverable with its owner and inhibit/wake. |
| Effect accounting display | deletes disposable rows; no agent memory; machine-local informational view | Fold six's reservations/applied settlement facts and seven's usage observations, corrected and cap-checked; never issue credits from this display. |
| Outbound obligation view | deletes disposable rows; no agent memory; machine-local | Message identities exclusive-singleton, delivery observations set-union; “sent” requires actual supporting evidence; unsent coalesced items retain disposition. |
| Captures and credential custody | Existing two/four/ten stores and scope; no new growth permission | Required references resolve or expose unavailable status. Seven's raw captures remain machine-local; secret bytes stay in vault custody. |

**Rule — a partition is recorded, not interpreted as permission.** **Checks: P8-NF-25/29/30/31/47**.
Ownership admission is six's serialized domain. Fact histories remain two's causal partial
order. Different horizons label different knowledge; equal-vector reconstruction yields equal
views on two architectures. A partition can prevent replicated demand, current authority,
verification or final charge and thus inhibit the affected operation. Unrelated admitted
families and the minimal repair plane remain available within their own valid authority.
No view, newest timestamp, peer count or restored local cache can create execution rights.

---

## 12. Non-functional checks and activation

**Rule — bounds have a subject, workload and failure action.** Rules 13, 34, 38, 39,
43, 46, 55, 60, 62 and 113; **checks: P8-NF-42/46/48/49**. Before activation every
operation declares finite limits for request/capture bytes, concurrent dispatch and observation,
maximum charge/quota, dispatch/observation timeout, queue age, fair scheduling cadence and
loop policy. Deployment values and workload evidence are recorded, not universal latency
promises. Zero means zero. Measured durations include failures, open waits and outages;
unknown cross-machine clock gaps remain unknown rather than silently subtracted.

| Property / measurement | Automatic check and workload | Bar and failure action |
|---|---|---|
| Durability at effect | Remove or delay peers after request, reservation and claim; acknowledge wrong hash, memory-only receipt and duplicate peer | Zero invocations below declared demand; retain prepared/claimed obligation and report unmet demand. |
| Authority at dispatch | Revoke grant, move base, change target/scope/generation, fold taint and stop between every admission boundary | Zero new claims under rejected authority; target-side condition prevents stale-base mutation. Record already-claimed residual honestly. |
| Effect/accounting uniqueness | Duplicate events, claims, callbacks and settlements across two workers with lost receipts and replay-cache eviction | One admitted invocation per claim and one applied accounting transition per settlement; any duplicate or lost liability fails, never a percentile allowance. |
| Physical/financial ceiling | Concurrent requests at bound and bound-plus-one, nested allocations, unknown fees, partial streams and slow observations | Reserved/actual exposure never hidden; excess request refused before allocation. Provider violation recorded and scoped admission closed. |
| Uncertainty follow-through | Kill at every dispatch/record/wake/settlement/accounting boundary; permanently inconclusive adapter | Zero ownerless unresolved operations or timer-to-success transitions. Healthy eligible work offered within the configured six-owned scheduling bound; overdue work remains visible. |
| Fairness and attention | Flood one tenant/adapter with failed observations while another has valid work; many internal errors in one window | Separate finite observation resource allocation, one fair scheduling round within its declared bound, notification ceiling/coalescing honored; no per-error topic. |
| Reconstruction cost | Increase permanent history by factors of ten with fixed active requests; lost index/checkpoint and late segment | Equal-vector byte equality; ordinary scans use paged active indexes and bounded suffixes, not genesis each tick. Exceeded time/memory limit is a surfaced budget defect. |
| Privacy and custody | Unauthorized raw-capture read, wrong recipient/redirect, secret-shape leak and missing required capture | Deny forbidden access; no raw secret in ordinary record. Scan residual and local-capture loss remain explicit, never certified perfect. |
| Live capability and scoped failure | Real initialized ports, authenticated channel response, bounded chargeable call and target-condition operation; disable one non-minimal dependency | No null/no-op implementation as proof; affected family refuses honestly while independent repair/stop remains reachable. |
| Supervision and verification life | Required step supervisor through seven; nine's live bar/assessment/probe plus signed fresh run evidence | Missing evidence prevents its held/live claim and affected unsafe action; no recursive supervision call or global advisory outage gate. |

**Value — concrete deployment limits are selected from measurements.** No check selects the
right observation interval, latency target or reserve size for every account and machine.
This design requires the numbers before activation and tests their boundaries; it does not
invent a measured response time for an unbuilt adapter. Bounded observation effort cannot
promise bounded resolution time when the external service never provides evidence.

**Rule — three test tiers prove the actual path.** **Checks: P8-NF-42/45/49** require
unit tests for decoding, validation, evidence binding and settlement; full-port integration
with actual persistence and six/nine owners; and production initialization exercising a real
permitted external operation and its evidence. The lifecycle includes authenticated intake,
five's work/grounding, seven's bounded model question through six/eight, attributable response,
verification, then reconstruction after each crash cut. Mocks are suitable unit controls,
never the lifecycle's proof that the feature is alive. Runtime capability isolation and
independent monitor evidence cannot be replaced by the author declaring a dependency wired.

---

## 13. Negative contract fixtures

**Rule — every check has a valid neighbor.** Rules 26, 34, 36, 37 and 69;
**check: P8-NF-02** maps every Rule to the rows below and requires execution records at
its stated stage before held*. Each row tests the failure and the adjacent permitted case.
Captured protocol fixtures use real bytes; fault schedules may be synthetic. A design check
passing does not mean these implementation tests ran.

| Identifier | Stage | Must refuse or expose; valid neighboring case |
|---|---|---|
| P8-NF-01 | build/arch | Missing or duplicate type owner, private cross-part import; exact seven-type inventory and owned interfaces pass. |
| P8-NF-02 | build | Rule/fixture/duty missing, unexecuted test counted held; complete declared map and real execution evidence remain distinguishable. |
| P8-NF-03 | decode/build | Unknown operation or unmatched feature/definition, secret undeclared field; anchored approved definition with existing-kind declarations passes. |
| P8-NF-04 | build/arch | Gate principal can amend enforced policy, named decoder never called; separate governed authority and invoked decoder pass. |
| P8-NF-05 | activation | Pending/retired definition or unsupported adapter mode callable; approved compatible mode activates with proof. |
| P8-NF-06 | integration | Approval for inspection used for delete, changed tenant/recipient/scope/batch; unchanged actual approved operation passes. Covers eight's P4-NF-18 arm. |
| P8-NF-07 | decode/contract | Command prefix or partial batch hides reachable effects; finite exact operation/sub-operation set is admitted within bounds. |
| P8-NF-08 | contract | Adapter formatting/redirect/resolution changes approved artifact, destination or base; matching prepared request remains eligible. |
| P8-NF-09 | contract | Claimed dedup/fence/query/cost capability lacks its real witness; proven individual mode works while unsupported mode stays explicit. |
| P8-NF-10 | arch/isolation | Direct provider/file/process/socket access from a worker or plugin bypasses doorway; confined port-only caller passes and residual coverage stays labelled. |
| P8-NF-11 | isolation | Maintenance/credential principal invokes business service or worker reads secret; finite scoped primitive and custody-only use pass. |
| P8-NF-12 | build/integration | Reservation append or verification recursively requires another paid effect; bounded primitive record flow and admitted external query terminate. |
| P8-NF-13 | compile/decode | Open constructor, unknown schema, missing required field, immutable collision or changed encoding unversioned; migrated historical record decodes. |
| P8-NF-14 | fault | Dispatch before durable pending identity/verification obligation, or crash strands follow-through; every cut reconstructs owned work. |
| P8-NF-15 | integration | Stored validation Success reused as capability or source version changes between validation/claim; matching current conditional claim proceeds. |
| P8-NF-16 | integration | Stale/unknown authority horizon, revoked grant, invalid binding or fabricated generation enables effect; current untainted basis passes. |
| P8-NF-17 | fault | Stop/expiry after durability wait ignored or claim treated as atomic with remote world; inhibited call is reconciled and admitted in-flight limit recorded. |
| P8-NF-18 | contract | Timeout encoded as clean Refused or query Success as business success; narrow Result and uncertain Outcome coexist honestly. |
| P8-NF-19 | decode/contract | Observation for wrong operation/claim/account/digest or self-signed proof inflation; correctly bound honest-strength observation passes. |
| P8-NF-20 | contract | Empty eventually consistent listing or process disappearance proves non-occurrence; decisive bound witness with no-late-execution proof is accepted by nine. |
| P8-NF-21 | integration | Settlement without nine's acceptance, contradictory evidence silently selected or withdrawn evidence still clean; supported settlement/dispute follows causal facts. |
| P8-NF-22 | fault | Uncertain effect retried on timeout/new key/run/provider/budget, or unknown charge bypassed; no-effect plus quiescence plus final charge permits fresh bounded admission. |
| P8-NF-23 | integration | Duplicate settlement frees credits twice, seven/eight edits spend ledger, charge clipped or maximum write-off proves non-occurrence; six applies exact supported accounting once. |
| P8-NF-24 | integration | Capacity/coalescing Success falsely reported as delivered or completed business action; preserved source Result and honest disposition pass. |
| P8-NF-25 | integration | Any required fact below operation demand permits irreversible dispatch; local-durable/replicated boundary matrix including satisfied exact demand passes. Implements P2-NF-63. |
| P8-NF-26 | contract | Duplicate peer, volatile ack, wrong digest, quorum certificate or config counts as replicated(n); distinct two-owned durable prefix receipts pass. |
| P8-NF-27 | custody/fault | Replicated referring hash implies local raw capture survives origin loss, or raw judgment bytes replicated to satisfy demand; compatible declared loss mode works, unsupported reconstruction mode refuses. |
| P8-NF-28 | lifecycle | Ordinary replication demand delays authenticated emergency stop; local-durable stop inhibits before peer acknowledgment. |
| P8-NF-29 | integration | Replicated provisional fact or its derived authority funds irreversible effect; two's genuine clearing followed by fresh valid recheck permits it. Implements P2-NF-73. |
| P8-NF-30 | rebuild/integration | Taint/retraction/capture unavailability stripped through a judgment, grant or view; dependency taint propagates and clean independent inputs remain usable. |
| P8-NF-31 | multi-machine | Old worker claims after fencing, takeover repeats unresolved operation, delayed packet claimed undone; new owner observes original claim before action. |
| P8-NF-32 | contract | Read-base then unconditional mutation passes authorization bar; atomic target condition rejects concurrent change and accepts unchanged target. |
| P8-NF-33 | contract | Unsigned/fetched approval or self-controlled monitor certifies protected change; independently anchored exact approval/condition passes for supported class. |
| P8-NF-34 | integration | Late observer changes run/credits or loses authentic evidence solely because execution ended; observer-only receipt persists without progress authority. |
| P8-NF-35 | fault/contract | Hidden SDK retry, query that creates work or expired provider key replay duplicates charge/effect; bounded observational query and settled retry pass. |
| P8-NF-36 | contract | Partial batch failure retries already-applied items or compensation erases occurrence; stable item evidence and separate compensation pass. |
| P8-NF-37 | lifecycle | Lost timer/callback or bounded episode ends unresolved obligation; durable claim/obligation reconstructs with owner/wake/inhibit. |
| P8-NF-38 | wiring | Nine absent/no-op, inadequate acceptance binding, adapter self-certifies evidence or auto-retry activates without bar; real assessor tests decisive and inconclusive witnesses. |
| P8-NF-39 | rebuild/fault | Cache eviction loses replay key, settlement lacks accounting recovery, evidence withdrawal disappears; permanent facts reconstruct obligations and disputes. |
| P8-NF-40 | contract | Wrong speaker/recipient, no source Result, per-item alerts topic, unusable remote link or missing continuity accounting; bounded attributable message passes. |
| P8-NF-41 | load/integration | Advisory sentinel blocks on outage, notification cap exceeded or unsent coalesced item called delivered; authorized delivery-with-flags and honest coalescing pass. |
| P8-NF-42 | wiring/lifecycle | Six/five/seven/nine dependency null/no-op, shared order/ownership mismatch or failure trace only mocked; real production ports support all four traces. |
| P8-NF-43 | lifecycle | One non-minimal failure closes unrelated repair or stale non-owner speaks as agent; independently admitted infrastructure response remains available. |
| P8-NF-44 | access/contract | Raw secret escapes custody, expiry/destination ignored, waiver after act or undisclosed unauthorized hook bypass; valid stored ref and applicable prior authorization pass. |
| P8-NF-45 | lifecycle | Live/protected claim lacks actual adapter, external anchor or isolation evidence; supported mode's independently observed result passes, unsupported claim remains partial. |
| P8-NF-46 | build/load | Missing bound/profile/metric/probe or zero becomes default; finite complete declarations and exact zero refusal pass. |
| P8-NF-47 | rebuild | Ambient view input, clock-selected conflict or unequal bytes at equal vector across architectures; pure declared fold passes. |
| P8-NF-48 | load/measurement | Omitted timeout/open wait, false cross-clock duration, unfair observation traffic or silent resource overshoot; complete subject-bound measurements and bounded fair progress pass. |
| P8-NF-49 | activation/e2e | Significant family lacks unit/full-port/lifecycle tier, paid supervision omitted or recursion added; actual bounded supervisor and real operation evidence pass. |

**Rule — inherited fixture identities remain resolvable.** Rules 45 and 69;
**check: P8-NF-02** requires the test manifest to expose P2-NF-63 as the shared case
P8-NF-25, P2-NF-73 as P8-NF-29, and the effect-consumer half of P4-NF-18 as P8-NF-06.
They are aliases of the same executed cases, not duplicated passing counts. P2-NF-63 varies
one required predecessor at a time below/equal/above demand, and P2-NF-73 varies direct and
transitive provisional sources before/after genuine reconciliation, including a new revocation
between clearing and dispatch. A fixture that tests only a malformed request does not cover
these realistic decision boundaries.

---

## 14. Inherited duties and the parent's rules

**Rule — no assigned duty remains deferred to eight.** Rules 8, 49, 69 and 71;
**check: P8-NF-02**, with P3-NF-24. Held below is contract coverage with named tests,
not an implemented holder. The shared remainder is partial with a named owner and activation
gate. Existing rule deadlines and generated owned loops apply; this document neither invents
operator consent to a new deadline nor extends an existing one.

| Duty | Disposition and exact coverage |
|---|---|
| 8.1: P4-NF-18, point-of-effect re-validation | **Held** at this contract: actual target/action/scope, exact approval, fresh grants/evidence/generation and final conditional claim; P8-NF-06/15/16/17/32. Intake's classification producer stays four's. External already-claimed race is explicitly limited. |
| 8.2: name the irreversible durability demand | **Held** at the policy contract: replicated(1) default whenever a second machine is enrolled, stronger declared demands, supported governed single-machine local-durable arm and inherited stop primitive; P8-NF-25/26/27/28. Two alone owns the durability states. |
| 8.3: P2-NF-63 insufficient durability fixture | **Held** here as P8-NF-25, with manifest alias and required-closure boundary matrix. Quorum cannot substitute, P8-NF-26. |
| 8.4: P2-NF-73 provisional authority before reconciliation | **Held** here as P8-NF-29 with transitive taint, legitimate clearing and recheck neighbors, P8-NF-30. Eight cannot clear two's marker. |
| Shared eight/nine: verification and uncertainty reconciliation | **Partial**, explicitly claimed: eight owns durable follow-through, query binding, uncertainty lifecycle, settlement and retry/credit handoff, P8-NF-20/21/22/23/37/38. Nine owns versioned bars, independent assessment of actual evidence, live probes and grading. No automatic retry activation without that implemented seam. |
| Six section 4: ownership/idempotency, uncertainty and observe-before-retry | **Held at eight's consumer contract**: one six-owned identity/reservation/claim, original-attempt observation and no replay on unknown execution/charge, P8-NF-14/22/31/35/42. Six's authority/loop implementation is tested through wiring, not recreated. |
| Six/seven: a chargeable model call is an effect | **Held at settlement boundary**: seven's attempt/receipt; six's mapping/spend; eight's dispatch/settlement; five's acceptance, P8-NF-19/22/23/27/42/49. Meter observations cannot release funds. |

**Rule — every parent rule has a scoped answer.** **Check: P8-NF-02** compares the
big picture section-6 list to this table. No broad citation claims a semantic or external
protection absent from the named checks.

| Rules | Coverage here |
|---|---|
| 4/66/86/95/103 | **Held contract** for exact registered gates, power separation, preserved refusal and per-consumer direction; P8-NF-03/04/18/43. Prose-secret detection has the stated partial residual. |
| 14/77 | **Partial**: advisory failure cannot silence otherwise authorized delivery, P8-NF-41/43; live global reachability remains eleven's minimal-plane proof. |
| 18/21 | **Partial**: action scope and owned-account/standing evidence are enforced; whether an issue needs human judgment remains mind/work-owner responsibility, not inferred from account names. P8-NF-06/16/40. |
| 28/35 | **Held contract** for principal/target/standing checks and production identity isolation. P8-NF-06/11/16/44 plus one's provenance and production-store test-identity gate; test identities may not enter production facts or destinations. |
| 42 | **Partial**: narrow Result/Outcome preserved, P8-NF-18/24/40; detection of independently worded lying reports belongs to nine. |
| 52/53/54/87/88/89/106 | **Partial**: outbound audience, provenance, aggregation, actual source/self-heal evidence and usable link shapes, P8-NF-40/41; semantic usefulness and truthful narrative are nine's review. |
| 60/63 | **Held contract** at six/eight admission/settlement seam, P8-NF-14/23/31/42/46; host isolation remains ten's required proof. |
| 74/79/82 | **Partial**: side-effects review reference, exact protected approval and pre-filled mobile action linkage, P8-NF-33/40/45; review quality is nine's, phone usability eleven's, independent runtime protection nine/eleven's. |
| 94/98/100/101/104 | **Held contract** for prior applicable waiver, explicit yes, custody-first secret use and authorized disclosed bypass; P8-NF-06/16/33/44. Candidate standing-grant review stays four's; eight adds no new consent arm. |
| 113 | **Held contract** for declared shared facts, local disposable views and fault/loss posture; P8-NF-25/30/31/47. |

**Rule — production identity separation is tested at the real destination.** Rule 35;
**check: P8-NF-44** includes a test principal/account/capture offered to a production operation
and asserts refusal before dispatch and production append. The positive case uses a properly
registered production identity under permission. A sandbox endpoint label is not sufficient
unless its authenticated account and actual target match the admitted environment.

---

## 15. Terms and the operator's decision surface

**Rule — new load-bearing words resolve once.** Rules 49, 69 and 90;
**checks: P8-NF-01/03** carry these definitions into part three's term conversion. Imported
terms retain their existing meaning.

| Term | Kind | Definition |
|---|---|---|
| effect doorway | noun | The single admission and adapter-invocation boundary for operations that change the world or consume/disclose resources, above the enumerated maintenance primitives. |
| operation definition | noun | Approved contract for one registered feature's exact callable operation and supported modes. |
| effect request | noun | Durable exact proposal with its cause, actor, target, authority basis and operation mapping. |
| effect validation | noun | Recorded current-source comparison at reservation or dispatch; never a reusable grant. |
| operation observation | noun | Attributable evidence about an attempted operation, without settlement or execution power. |
| effect settlement | noun | Eight-owned evidence-backed assessment of occurrence, delayed execution and charge, consumed by their existing owners. |
| durability demand | field | Operation's required part-two append state for its prerequisite closure, with an explicit loss model. |
| target condition | noun | Atomic external comparison of the admitted artifact/base/identity at the mutation point. |
| late-execution exclusion | noun | Accepted evidence that the prior admitted claim can no longer apply, separate from observing no present result. |
| outbound message | noun | Exact attributed message and finite audience, with purpose, source result and attention/disclosure obligations. |

**Value — operator decisions, frontloaded for review.** No automatic check selects these
tradeoffs. Technical completion of this document does not request an interruption of ordinary
work; these are the policy questions for its approval surface.

1. **Durability versus single-machine availability.** Support a no-peer installation whose one
   install-time policy accepts the fixed profile's closed local-durable operation set and
   permanent-machine-loss model. Use replicated(1) by default whenever a second machine is
   enrolled and for every operation whose demand names replication. Stops retain their approved
   local-durable fast path.
2. **Indefinite uncertainty.** Accept blocked automatic repetition and retained exposure when
   an external service cannot provide decisive evidence, with finite observation effort and
   an owned unresolved record? This follows six/seven and does not authorize timeout-to-truth.
3. **Supported operation modes.** Accept that base-bound changes remain unsupported on
   services lacking a target-side conditional mechanism, rather than claiming an approval
   snapshot protects an unconditional mutation? Eight proposes no waiver of exact approval.

**Value — costs and replacement.** Durable preparation adds latency; stronger peer demands
reduce availability; local model captures limit reconstruction after machine loss; independent
assessment costs resources; unknown charges tie up usable budget. No check proves these costs
worthwhile for every deployment. Replacing an adapter or relaxing a declared policy follows
its governing approval and preserves old requests, identities, claims, evidence and obligations.
Existing admitted calls settle under their exact original contract with current assessment of
its evidence; a new adapter cannot reinterpret unknown history as permission. Rollback stops
new affected admissions and keeps observation/accounting recovery alive, rather than deleting
the evidence that made the change reviewable.

**Rule — technical completion does not claim independent convergence.** Rules 65, 82,
90 and 109; **checks: P8-NF-02/45** keep design validity, implemented checks, semantic
review and operator approval distinct. Missing part-nine evidence acceptance, part-ten
confinement or the nine/eleven external anchor remains an explicit scoped activation gap.
The owner of each gap is named; no no-op can make it green.

*Rule dependency references: approved docs/01-the-rules.md through docs/08-the-intake.md;
big-picture part eight. Behavioral contracts consumed: parts five, six, seven, nine, ten
and eleven. Reference and ownership checks: P8-NF-01/02/42.*
