**Status: draft, awaiting approval. Governed.**

# Part ten — the assembly, native harness, remaining adapters, and local capabilities

**Value — purpose.** The parts become a system only when their real implementations meet.
A working adapter must carry evidence across that meeting without changing its meaning. A
native worker must use the same doors as every other worker. A capability built by an agent
must survive the next installation without becoming an invisible private edit. This design
chooses those properties and the operating costs they carry. No automatic check enforces
whether that is the best product; the Rules below name the behavior to test.

**Rule — reading convention and evidence honesty.** Rules 26, 49, 69, 91 and 113;
**checks: P10-NF-01/02**, plus `node scripts/check-governed-docs.mjs docs`. Every paragraph,
list and table belongs to its enclosing Rule or Value. A numbered fixture is a required future
automatic check, not a claim that code exists or a test ran. Contract dispositions below are
not production coverage: part three renders unexecuted fixtures declared, executed fixtures
held*, and only independently reviewed evidence held-reviewed at its actual generation.
This document makes no claim about present Instar 1.x behavior. Implementation waits for the
applicable part approvals; a document checker cannot grant them.

---

## Sections

The general assembly contract remains in this file. The fixed first installation profile is a
numbered companion section so it can take focused line comments without becoming a new part or a
general setup product. Both files are one governed Part Ten body under the existing assembly
declaration and this document's sibling changelog.

1. [The fixed single-machine installation contract](14-the-assembly/16-the-fixed-single-machine-installation-contract.md)

---

## 1. Ownership and the assembly boundary

**Rule — one owner per type and behavior.** Rules 1, 30, 49, 69 and 115;
**check: P10-NF-01** compares the following closed inventory with schemas, constructors and
imports. Interfaces are not stored facts. Every other type is an immutable, schema-versioned
payload under part one's construction, canonical encoding, migration and total-decoding
conventions. Identity is by id; value is canonical fields within the same type/schema after
migration. Different immutable content under one identity is Conflict. Transitions append;
they never edit admitted records. No constructor mints a constitutional value from raw fields.

| DEFINED here | Meaning and producer |
|---|---|
| AssemblyManifest | Exact component, artifact and public-port binding set proposed for an installation; assembly decoder. |
| AssemblyAdmission | Evidence and disposition of activating one assembly scope; admission recorder. |
| HarnessAdapterPort | Public worker launch, input and observation interface; implemented by harness adapters. |
| HarnessLaunchSpec | Exact admitted worker environment and context delivery specification; launch-spec decoder. |
| HarnessObservation | Evidence of a worker lifecycle or context-consumption event; observation decoder. |
| AdapterEvidenceContract | Per-stimulus identity, protocol and disclosure contract attached by reference to an adapter declaration; contract decoder. |
| AdapterConformance | Results and limitations of a specific adapter/artifact/platform contract run; conformance recorder. |
| ModelAdapterPort | Public provider formatting and admitted exchange interface beneath seven/eight; model adapters implement it. |
| PersistenceAdapterPort | Physical persistence realization interface beneath two's public fact port; persistence adapters implement it. |
| StoreCustodyPolicy | Governed physical storage, encryption, readers and key-custody requirements; policy decoder. |
| StorageAccessObservation | Scoped metadata about a storage-access attempt or key-maintenance result; storage recorder. |
| LocalCapabilityPackage | Immutable package manifest and content-addressed artifacts for a local capability; package decoder. |
| PackageTransition | One proposed, activated, inhibited, retired or recovered package-lifecycle step; lifecycle recorder. |
| GrowthPolicy | Finite measurement, threshold and follow-through contract; governed policy decoder. |
| GrowthObservation | A pinned workload's measured costs, omissions and threshold comparisons; instrument recorder. |

**Rule — imported meanings stay with their owners.** **Check: P10-NF-01** rejects a second
constructor or a copied competing policy for the following NAMED contracts. This inventory
also sets the subjects of the assembly's wiring tests.

| Owner | Names used without redefinition |
|---|---|
| One | VerifiedPrincipal, StandingGrant, Revocation, Intent, Directive, Result, Success, Refused, Measurement, Profile, Evidence, Decision, Authorization, Scope, ActionFloor, Outcome, SecretRef, Provenance, Conflict, UnresolvedInput. |
| Two | Fact envelope, append/admission, segment lineage, causal frontier, durability state, version chain, capture reference/status, projection, checkpoint, folded-through vector, retraction, correction, redaction and authority taint. |
| Three | Declaration, governed port, register generation, generation record, chain extract, check-run record, rule graph and honesty class. |
| Four | Intake port, conversation binding, event-id authority, operation classification, registered command surface, authorization request, operating standing and session-start substrate. |
| Five | Run, RunStep, RunTransition, RunBudget, RunExit, DelegationContract, DelegationResult, AwaitingAuthorization, ExhaustionRecord, SessionGrounding, ContinuityAccounting, AgentTransportEnvelope, DeliveryEvidence, AgentTransportPort. |
| Six | Lease, FenceToken, AdmissionReservation, operation identity, dispatch-claim, spend reservation, LoopPolicy, LoopRecord, RecoveryRecord, ThreadlineRoute, ThreadlineReceipt. |
| Seven | JudgmentRequest, JudgmentAttemptRecord, JudgmentResolution, AskRefinement, BenchmarkRecord, BenchmarkScenario, BenchmarkRunRecord, JudgmentHoldCost and provider receipt. |
| Eight | OperationDefinition, EffectRequest, EffectValidation, OperationObservation, EffectSettlement, OutboundMessage, OperationAdapterPort. |
| Nine | VerificationPlan, VerificationRequest, VerificationAssessment, ProbeRecord, RetrospectiveReviewRecord, SemanticReviewRecord, Grade, AssessmentClosure, FeedbackDisposition, BenchmarkEvaluation; verification bar and independent protected-artifact monitor. |
| Eleven | Operator surfaces, verified pairing/approval interaction, minimal-plane projection roster and live session, and the first vertical slice. |

**Rule — concrete bindings are the assembly's only special privilege.** Rules 30, 69, 115;
**checks: P10-NF-03/04**. Core services import public types and ports, never concrete
adapters. Only the executable assembly selects implementations. A binding names exactly one
implementation for a port instance and scope; a multi-adapter registry has one dispatcher
implementation with a closed, validated set of instance bindings. It is not permission for
several hidden implementations to race. Native has no private core imports, special standing,
extra effect method or direct provider call. Remaining conversation adapters implement four's
intake and eight's outbound contracts; remaining operation adapters implement eight's port;
other agent transports implement five's port and six's ownership/observation demands. This
part specifies their evidence and realization, not replacement doorway interfaces.

**Rule — sibling requirements remain conditional on their owners.** **Checks: P10-NF-02/04/40**
exercise five's run acceptance, six's reservation and read-only receipt lookup, seven's
changed-configuration benchmark execution gate, eight's three-part retry bar, and nine's
independent assessment. These are draft dependency contracts, not approved runtime foundations.
No assembly setting may weaken them to make startup green. Missing implementation produces
an affected-scope refusal and declared coverage, never a null/no-op holder. The operator
surfaces and whole first-slice definition remain eleven's; this part supplies the executable
components and lifecycle evidence that slice requires.

**Value — direct composition before distributed services.** No check mandates a process per
core responsibility. Pure services may share a process when their capabilities permit it.
Workers, raw credential custodians and independently administered protection must not share
an authority merely for convenience. Process placement follows the authority boundary and
measured load; a network service per conceptual box is not required.

---

## 2. An exact assembly that can be started and explained

**Rule — installation is an exact manifest, never a directory scan that executes files.**
Rules 5, 30, 44, 69, 90 and 113; **checks: P10-NF-03/05/06**. AssemblyManifest contains
id/schema; immutable package/artifact digests; runtime/toolchain and platform compatibility;
core public-port versions; per-scope port bindings and required dependency graph; anchored
register generation and declaration-source references; approved genesis anchor and installation
trust-root references; service principals and existing grants; custody/isolation policies;
finite ordinary and reserved repair/control resource policies; schema/migration compatibility;
required contract/lifecycle checks; and rollback compatibility. Environment discovery is an
observation input to admission, not an unrecorded edit of this manifest. Secret fields are
SecretRefs. Executable paths resolve to exact bytes and object identity before invocation.

**Rule — the manifest cannot vouch for its own permission.** **Checks: P10-NF-05/07**.
Decode the manifest against incumbent approved schemas, independently installed trust roots
and three's entering-force generation record. A self-consistent hash with no source approval
cannot activate governing material. Ordinary package artifacts use their actual existing
standing and test evidence; governed declarations still use the existing approval/version
path. Startup cannot mark pending-landing declarations authoritative or mirror a repository
extract into force without the spine checks three requires. Runtime overrides are classified
changes with their own admitted source; an environment variable cannot turn off a protected
check, change an account or grant a worker new capabilities.

**Rule — every scope has a recorded admission result.** **Checks: P10-NF-04/06/07/08**.
AssemblyAdmission contains id, manifest digest, machine and process incarnation, affected
scope, source generation/vector, actual artifact and environment evidence, port-binding
conformance references, isolation/custody/probe evidence, resource reservation, clock,
predecessor admission, and disposition: prepared, active, inhibited, draining, or retired.
Every disposition has a reason and required repair/closure owner. Active means that scope
has earned admission; a process listening on a socket or a configuration flag is not evidence.
A current admission's evidence expiring inhibits only the consumers that need it. Historical
admissions remain readable and are not new bearer permission.

**Rule — startup is ordered without a circular repair dependency.** Rules 14, 15, 31,
46, 60, 63, 95; **checks: P10-NF-04/06/08/09** kill startup at each boundary:

1. Verify the installation trust material and minimal genesis anchor independently of the
   stores they will authorize. Establish the storage custodian and finite minimal/control
   capacity before admitting ordinary workloads. Unlock only already-authorized key handles.
2. Wire the narrow two/four/six maintenance primitives enumerated by eight. Verify the minimal
   segment, generation and projection set specified by eleven. Open its independently admitted
   communication, stop and repair functions; no model availability is required to diagnose.
3. For each ordinary scope, verify segment watermark/checkpoint and register sources, physical
   custody, exact adapters and effect-boundary confinement. Rebuild the required views through
   two; a poison projection quarantines that scope, not unrelated readers.
4. Recover six's authority prefix, membership, reservations and due loops. Voter maintenance
   uses its own fixed grants and reserved resources, never a conversation lease it must create.
5. Reconstruct five's accepted work and eight's claims/verification obligations, including
   seven's unanswered attempts and nine's unfinished assessments. Admit bounded recovery;
   observe original operations before any retry. A lost wake callback does not lose work.
6. Run real port challenges and required fresh probe checks for the intended modes. Record
   AssemblyAdmission, then permit five to start grounded workers under six's admission.
   Background work and each optional family become eligible separately.

A failed minimal anchor yields the independently administered recovery surface specified by
nine/eleven, with explicit unavailable agent identity. It never starts an unverified agent
voice. No claim promises availability when all hardware, its trust root or its reserved
resources are gone. Ordinary recovery cannot write the anchor whose verification failed.

**Rule — the minimal responder has explicit authority and dependency admission.**
Rules 14, 15, 28, 31, 43, 63 and 95; **checks: P10-NF-51/52/53**. The manifest binds
one registered minimal-plane Run to its own current system-principal grant, exact repair and
communication operations, six-owned serialized authority domains, and independently reserved
finite worker, memory, storage, queue, transport and effect budgets. For an attributable reply
in a conversation it also requires four's current binding and six's current exclusive
conversation lease/fence at dispatch. A local repair-domain lease cannot grant conversation
ownership. The responder neither resumes nor authorizes the ordinary run it describes.
A non-owner preserves and queues input or emits only an independently admitted infrastructure
receipt under its own registered operation; it cannot label that receipt an agent reply.

AssemblyManifest enumerates the following required dependencies, their exact implementations,
source horizons, freshness/loss policies and measured budgets. AssemblyAdmission records their
actual evidence separately; one healthy worker cannot stand in for the conjunction.

| Required dependency | Realization and admitted use | Loss consequence |
|---|---|---|
| Source and custody | Verified local-durable minimal segment; eleven's six projections rebuilt from that source; current anchored register/decoder generation, keys, clock and custody handles | No guessed identity, stale authority or invented preserved input; inhibit dependent operations and expose independently administered recovery where available |
| Authority | Current minimal system grant and operation scope; current binding and six's authoritative lease/fence for conversation service; required authority-prefix/membership evidence | Local repair stays within its own valid domain; missing conversation authority forbids attributable conversation dispatch |
| Intake and route | Four's actual authenticated intake, admitted conversation adapter, credentials and route; exact operation/semantic identity mapping | Preserve only where durable custody is available; an unavailable route is a minimal-path outage, not ordinary worker starvation |
| Effect and durability | Eight's real message operation, reservation, one-use claim and full causal evidence closure; two's matching durability receipts | Insufficient closure or required durability proof prevents dispatch even when reserved transport and money are free |
| Observation | Actual adapter query/receipt and independent witness for the demanded delivery stage, nine's bar and eight's settlement path | Available evidence may establish a weaker stage only; absent decisive evidence retains owned uncertainty, never proves delivery |

The reference reply demand is eight's **replicated(1)** whenever a second machine is enrolled:
local durability plus one distinct authenticated peer acknowledgment covering the required exact
facts and prefixes. This includes the grant/approval basis, governing references, run/attempt,
operation definition, reservation, dispatch-claim and reconstructable verification obligation
required by eight. A live lease quorum is not that acknowledgment, and a stored replication
receipt is not current ownership. The supported single-machine shape carries no peer dependency.
It consumes the one install-time P-08 acceptance of the fixed profile's closed local-durable
provider-call and reply-only Telegram operation set and its explicit loss model. The assembly does
not select local durability when an enrolled peer disappears, and an operation whose demand names
replication still requires the peer. Reserved capacity alone changes neither demand nor authority.
Local stop retains its existing admitted primitive and does not wait for an ordinary reply's
replication, but remote stop remains unconfirmed until its own evidence arrives.

**Rule — ordinary degradation and minimal-path loss have different outcomes.**
**Checks: P10-NF-51/52/54** cut each dependency alone and in combinations. Loss of an ordinary
model, benchmark, business effect or non-minimal projection leaves a limited response eligible
only if every dependency needed by that response remains admitted. Loss of a shared source,
required durability receipt, current ownership, adapter route or demanded evidence service is
loss of that minimal function, even if the first symptom appeared in an ordinary run. Admission
is derived from actual dependency edges, not a component label called optional.

The measured response bound is conditional on those exact sources, authorities, routes,
durability and observation capabilities, their finite recovery windows and the workload used to
prove it. Record start/end or open outage, missing dependency, preserved-input status, pending
operation and repair owner in AssemblyAdmission and existing run facts. An outage or timed-out
sample remains in the population and invalidates an unconditional bound; never replace it with
a successful sample's duration. Locally durable accepted input remains pending. If even that
custody is absent, no durable acceptance is claimed. The independent recovery surface can report
only when its own administrator, source and transport path remain available; total path loss
cannot promise a delivered notification. Restoration revalidates authority and observes original
claims before resuming. It never converts an uncertain send into a fresh limited-response send.

**Rule — stopping and upgrading preserve unresolved work.** **Checks: P10-NF-08/09/30**.
Stop new affected admissions, record drain intent, and ask six/five for current workers,
claims and pending observations. An old executor may still finish an already-claimed action;
retain its exact artifact/custody and observation path until settlement or a proved safe
handoff. Bound the drain attempt, not the truth of outstanding effects. Switching a binary
never resets epochs, attempts, resource debt, input identity or operator stop. Rollback starts
only a compatible prior artifact under fresh admission; an old reader unable to decode new
facts cannot become an authority merely because its executable used to pass.

---

## 3. Native harness and the shared worker contract

**Rule — a harness is a worker client, not another work engine.** Rules 29, 30, 47,
59, 68, 84, 96, 110, 115; **checks: P10-NF-03/10/11/12**. HarnessAdapterPort exposes:

| Method | Input and narrowly claimed output |
|---|---|
| describe | Exact harness artifact/platform → supported context, output, interruption, custody and observation modes with conformance evidence. No grant or launch. |
| launch | HarnessLaunchSpec and eight's admitted process operation with six's one-use claim → HarnessObservation of actual launch or unresolved attempt. |
| deliver | Admitted intake reference, immutable input digest and target incarnation through an admitted delivery operation → observation of acknowledgment, refusal or uncertainty. No direct anonymous keystroke method. |
| observe | Exact launch/delivery identity and admitted query → lifecycle/consumption evidence; absent process alone cannot settle an external effect. |

Stop, close and compaction commands that change worker state are registered process operations
through eight, not extra unauthenticated methods. Provider/library reconnect or continuation
uses six's loop. HarnessLaunchSpec contains id/schema, run/step, current principal and
incarnation, harness/artifact digest, machine, exact working scope, admitted process identity,
resource and port-handle references, minimal scrubbed environment, context/input manifest and
requested consumption mode. No process id is a durable run id. The launcher binds process id
to start identity and incarnation, so a reused process id never identifies the old worker.

**Rule — context delivery proves consumption at its actual boundary.**
**Checks: P10-NF-10/11/13**, with P5-NF-44/45/46/47. Five owns history/clock coverage and
SessionGrounding. Ten delivers those exact content classes to the actual worker; it records
HarnessObservation with id, launch/run/step/input identity, incarnation, source evidence,
context digests, generation, causal references, actual observed clock, finite freshness and
one phase: launched, input-accepted, context-consumed, output-observed, pause-observed,
exit-observed, or uncertain. These are observations, not run transitions. Context-consumed
requires evidence from the instrumented harness boundary that those bytes entered the model
request/context, not merely that stdin accepted them. Five records grounding against that
receipt before enabling ordinary actions. Worker start can occur in a context-loading state;
only its loading/observation ports work before grounding admission.

For Native the seven-owned submitted-input capture is the consumption witness: before model
dispatch seven and five validate the linkage to the actual-start read. Recorded read/formatting
proof makes grounding eligible; provider dispatch does not have to happen to authorize its own
context preparation. External harnesses need equivalent instrumented boundary evidence or
must declare context-consumption unsupported. A terminal scrape or an echo of the prompt is
not an equivalent proof. Such a harness can run a supported advisory mode, but cannot claim
grounded governed execution or delivered-to-worker under five's stronger contract.

**Rule — Native reasoning and tool use traverse the public doors.**
**Checks: P10-NF-03/12/14/40**. Native accepts five's admitted work, requests bounded
reasoning through seven, and renders the recorded output. Tools are proposals with registered
operation ids and scoped parameters; five/eight validate and admit them. Native cannot call a
provider, run shell, write authoritative files, change a grant or send a message directly.
A compatible registered model doorway is selected through seven's route rules. Compatibility
means the required actual-input capture, output schema, disclosure, finite charge, cancellation
and observation modes passed conformance, not a vendor-name whitelist. The full harness suite
runs for every compatible (harness artifact, model doorway, platform) tuple. Unsupported tuples
are enumerated and explained rather than silently omitted from parity.

**Rule — external harnesses disclose every hidden execution path.** Rules 30, 41, 55,
59, 75; **checks: P10-NF-12/14/15**. A harness with internal provider access or built-in
tools can earn governed mode only when those paths are disabled or routed through the same
admitted ports, with actual boundary evidence and metering. Hook text is not confinement.
Uncontrollable internal calls mean that mode is unsupported. Session resumption and compaction
preserve run identity, current context classes and five's ContinuityAccounting; a resumed
process never imports an obsolete grant as permission. An adapter cannot describe provider
charges it cannot observe as zero.

**Rule — every harness enumerates silent stops before activation.** Rule 59;
**checks: P10-NF-15/16** require a captured positive and failing case for every row. Detection
raises evidence; six owns bounded recovery and five owns the remaining assignment.

| Stall class | Actual evidence required | Permitted recovery |
|---|---|---|
| Launch rejected or launch answer lost | Exact launcher claim and incarnation query | Observe original launch; no second launch while unknown. |
| Input buffered but not consumed | Durable intake plus absent context-boundary receipt | Keep pending input, inspect harness through bounded query; no false worker delivery. |
| Prompt, approval dialog or tool wait | Instrumented wait reason with input preserved | Route existing authorized action or four's request; never click consent by timeout. |
| Provider unavailable, rate limit or account expired | Actual provider/wait receipt and usage status | Seven's eligible route/default; no hidden retry or fresh charge around uncertainty. |
| Worker exits, disconnects or process id is reused | Original incarnation and lifecycle observation | Six recovers admitted work after pending-effect reconciliation. |
| Worker alive without useful progress | Five's progress/cadence evidence, independent of heartbeat | Seven's bounded diagnostic judgment; process liveness alone cannot close the case. |
| Context compacted or limit reached | Boundary event and exact pre-pause inbound reference | Five's fresh grounding and continuity accounting before ordinary action. |
| Output partial, malformed or delayed | Actual framed response, offset and decoder result | Preserve partial evidence; incomplete frame is not a complete answer. |
| Stop, fence or resource loss | Current admission result, not a local active label | Inhibit new action; retain observer channel and unresolved accounting. |

**Value — a common contract can expose real parity gaps.** No check makes an opaque harness
instrumentable. Native supplies the reference client and self-hosting path; other harnesses
must prove the same required modes. Honest unsupported modes are preferable to naming every
harness compatible while trusting invisible execution. Which external clients deserve adapter
investment is product judgment, not an excuse to bypass the contract.

---

## 4. Capability isolation that the assembly can prove

**Rule — runtime confinement complements import checks.** Rules 1, 30, 60, 63, 100, 115;
**checks: P10-NF-03/17/18/19** execute adversarial worker/package programs on every supported
platform. Workers run as separate restricted identities in an enforced process/container/VM
boundary. They receive authenticated handles to public ports, a disposable working area and
explicitly scoped read material. They receive no general network, host credential directory,
authoritative store mount, host process-control socket, unrestricted IPC, debugger access or
writable core/protection artifact. Child processes inherit the same or less power. All I/O
needed for useful development is performed through registered file/process/network operations.
A local shell operation is confined to its admitted workspace and resource scope; its tests
cannot gain the installation's production credentials or mounts.

**Rule — handles are scoped requests, not inherited ambient authority.**
**Checks: P10-NF-17/18/20** bind each handle to authenticated service identity, installation,
run/contract, incarnation, allowed methods, scope, resource references and finite validity.
The receiving service revalidates the relevant live grant, generation, stop and fence at use;
copying a handle into another worker or an environment variable does not transfer standing.
A read or observation handle has no write/create-if-missing arm. Only eight's executor can
use a dispatch capability, and only for its bound target/digest. Credential resolution occurs
inside the narrowly scoped adapter custodian; worker-visible results contain permitted data,
not secrets. An adapter compromise is a named trust-boundary failure, not something worker
isolation claims to prevent.

**Rule — a protection test attacks the boundary from inside the worker.**
**Checks: P10-NF-18/19** attempt direct socket/provider calls, arbitrary filesystem reads,
symlink/hardlink escapes, inherited descriptors, environment and process-memory inspection,
raw device/snapshot access, process-control/debug endpoints, dynamic imports and child
escape, forged/cross-incarnation handles, core replacement and credential enumeration. Positive
controls perform the same permitted task through the admitted port. An unsupported platform
or a failed negative case refuses that governed mode before real credentials are provisioned.
There is no automatic unconfined fallback. Conformance identifies the exact host boundary,
configuration and artifact hashes tested and retains any residual dynamic path in three's
enforcement-boundary report.

**Rule — ten instantiates nine's independently administered reference monitor.**
**Checks: P10-NF-19/21/40** require nine's external protection policy, enforcement receipt
and attack-test evidence before a runtime/dashboard class can claim protection. Nine owns
that monitor and its assessment; eleven owns how a person completes approval. Ten wires its
public interface and verifies the agent's executing identities cannot change the monitor,
its launch configuration, policy, keys or storage, or acquire its administrative privileges.
The ordinary assembly cannot replace the monitor with a local mock and certify itself.
Updates to the independently administered boundary use its separate existing approval path.

**Value — the administrator remains a trust root.** No automatic check proves safety against
the administrator who can replace the kernel, broker, key service or isolation configuration.
This design's guarantee covers unprivileged agent/worker/package identities, unrelated local
users and copied storage media. An agent granted host administrator authority is outside that
prevention claim. Mandatory separation is a deployment cost; tests measure it and the posture
reports it. Detection of later compromise is nine's job and is not retroactive prevention.

---

## 5. Remaining adapter evidence contracts

**Rule — every live adapter specifies what its evidence actually authenticates.** Rules 28,
29, 36, 89, 105; **checks: P10-NF-22/23/24**, with P4-NF-02/03/28/29. An
AdapterEvidenceContract contains id/schema, adapter/artifact and parser declaration references,
stimulus class, original authenticated byte fields, authentication method and key/credential
binding, sender and conversation identity namespaces, stability/reuse rules, forwarding and
impersonation treatment, churn detector and revocation response, event-id authority and replay
retention/fallback policy, ackPolicy, disclosure scope, captured positive/negative fixtures,
probe references, the effect-evidence capability matrix below and contract version. Parser
required facts remain three/four's fields;
this fact provides their per-family details by reference, not a new register kind.

**Rule — identity and acknowledgment are declared per mode.** **Checks: P10-NF-22/23/24**
apply this starting contract matrix. These are requirements for future adapters, not claims
that today's named services expose a particular signature or identifier. An implementation
must capture its real evidence and satisfy the row, or refuse the unsupported mode.

| Family/mode | Identity evidence and provenance ceiling | Event identity, forwarding/churn and acknowledgment |
|---|---|---|
| Bot/workspace conversation | Authenticated platform account, tenant, conversation and sender ids; unsigned received/fetched bytes are channel-attested. Display names, usernames, quoted authors and forwarded-message labels never select a principal. | Provider-minted event id scoped to installation/tenant/channel and authenticated sender where sender-controlled ids exist. Preserve origin separately from forwarder. Credential/key or stable-account reassignment invalidates affected selections. Bound direct conversation defaults bound-only; group ambient reading defaults never. |
| Device-backed conversation | Authenticated device/account service and actual sender/conversation evidence; device-local database access alone does not make the sender package-verified. Unauthenticated imports remain UnresolvedInput. | Provider/device-service durable event identity for state-changing stimuli; phone/address reuse requires a new verified binding, never inherits old standing. Forwarded content is quoted data. Default bound-only. |
| Web conversation | Package-minted, scope-bound session evidence or a registered independently verifiable source, cross-checked to actual channel/sender/action. Anonymous input remains authority-inert. | Server-minted action/event id, request digest and replay record. Session expiry/revocation and account switch are explicit; client-selected ids cannot suppress another sender. Default bound-only. |
| External webhook/service callback | Host signature verified against registered material proves only signed fields; authenticated fetch without a re-checkable signature is channel-attested. Service identity never becomes the human author mentioned in payload. | Provider-minted id required for state-changing stimuli; fingerprint fallback only for declared informational/idempotent classes, with may-collapse warning. Credential/tenant changes break compatibility. Transport response follows declared protocol; no conversational ack, policy never. |
| Scheduler/recovery/local IPC | Package-minted token or signed system/agent source, never merely loopback, uid text or process proximity. | Four's job/instant or incident identity; caller-bound replay scope. Observation/control input cannot impersonate a user. Admission record is the receipt, conversational ack never. |
| Model provider | Verified only for fields covered by provider-origin evidence the decoder can recheck; ordinary fetched/returned unsigned response is channel-attested observation, model conclusion remains inference. | Seven's request/attempt plus provider response identity and capture digest; streams bind ordered chunks to one attempt. Account/model identity changes invalidate compatibility; no invented human sender. Ack never. |
| Host review | Only original authenticated review evidence covering request digest, approver, artifact and base can support verified explicit yes; fetched records alone cannot. | Provider event id plus exact review/request identity; edits/retractions are new evidence. Forwarding preserves original signature without increasing its class. Ack never beyond protocol receipt. |
| Non-Threadline agent transport | Five's complete authenticated envelope and locally verified peer/key binding; discovery endpoint or relay receipt cannot prove peer authority. | Preserve five's semantic key and six's separate delivery-attempt/effect references; lookup has no create-if-missing. Bound-only authenticated protocol receipt. Threadline remains six's owned realization. |

All rows preserve before interpretation using four's custody path. A conversation with no
verified binding selects no operator. Authority-conferring acts require their own verified
provenance; channel-attested directives can only select within the already-verified binding.
Credential compromise reaches the union of that transport's selectable bindings, bounded by
their grants, never by a conveniently smaller claim of one affected conversation. Key/account
churn triggers recorded re-verification; silence is not evidence an old binding still belongs
to the same person. Other acknowledgment choices require an explicit parser declaration and
conformance cases for resolved, unresolved, bound, unbound and group stimuli.

**Rule — adapter evidence capabilities are explicit, including permanent absence.**
Rules 26, 42, 63 and 69; **checks: P10-NF-53/55/56**. Each concrete operation/mode in
AdapterEvidenceContract declares every row below as supported with a precise source, predicate,
subject binding, consistency/completeness horizon, finite observation budget and captured/live
conformance reference, or unsupported with its reason. Unknown or untested support cannot pass
activation for a claim requiring it. Identity attestation, receiver acknowledgment, factual
delivery and effect settlement are separate capabilities. This adds fields to ten's contract,
not a new evidence grade or an alternative to eight's OperationDefinition or nine's bar.

| Capability | What a supported implementation must actually expose | Unsupported or insufficient evidence |
|---|---|---|
| Stable operation and receipt lookup | Original semantic operation, attempt, account/destination and immutable digest survive takeover; read-only lookup cannot create missing work | New key, SDK resend or reconstructed payload cannot recover a lost receipt |
| Application and delivery stage | Authentic exact-operation evidence specifying accepted, persisted, delivered or consumed, as applicable; an independent witness for the claimed stage | Transport success alone cannot prove consumption; a send-only API with no receipt/query leaves application unknown after a lost answer |
| Decisive non-occurrence | Authoritative complete history or destination rejection covering the original operation and the relevant execution horizon | Eventual search miss, timeout and expired lookup history do not establish absence; declare non-occurrence unsupported if nothing stronger exists |
| Exclusion of delayed execution | Destination-enforced fence/cancellation or authoritative quiescence covering all accepted/queued attempts, with its observed horizon | Local process death or cancellation accepted without a completion guarantee leaves delayed execution possible; unsupported adapters say so |
| Final charge | Final accounting tied to the original attempt and residual liability, including evidenced zero charge for a genuinely uncharged mode | Missing usage, a cost estimate or cancel request is not final accounting; opaque billing explicitly cannot close charge exposure |
| Prerequisite durability | Two's receipts for exact local and required peer durable prefixes; adapter limitations and custody dependencies preserved | Platform delivery receipt, reserved capacity and lease quorum cannot satisfy replicated(1) |

A bot, device, webhook, provider or other adapter with no authoritative negative query declares
non-occurrence unsupported. A mode lacking destination quiescence declares delayed-execution
exclusion unsupported. A billed mode lacking final accounting declares final-charge evidence
unsupported. Such a mode may perform otherwise admitted work under an explicitly declared
uncertainty policy, but cannot qualify for bounded completion after a cut requiring those
predicates. Family membership never supplies missing proof. AdapterConformance records the
actual available and unsupported rows for each artifact/account/protocol mode; missing evidence
is not deferred to nine to invent. Nine assesses only what exists, eight settles its proved
portions, and six retains unresolved exposure. Neither an idempotency key nor supported positive
lookup permits resubmitting an uncertain effect.

**Rule — acknowledgment policy survives packaging and composition.**
**Checks: P10-NF-24/25** enumerate every parser instance from the assembly and local package
set and compare its effective ackPolicy, authenticationClass, eventIdAuthority and five-field
profile to the declared generation. Missing instance, default substituted by a wrapper, bridge
that widens attestation, or family-level test hiding an untested instance fails activation.
Ordinary conversational responses remain eight's governed effects; ackPolicy is not a switch
that suppresses the agent's reply. Duplicate acknowledgment does not prove duplicate work.

**Rule — conformance records identify the implementation they tested.**
**Checks: P10-NF-22/25/40**. AdapterConformance carries id, exact adapter/package/platform
and mode, port and schema versions, register generation, captured fixture digests and source
provenance, check-run references for each required stage, positive/negative cases, probe/bar
references, observed limitations, tested time and freshness. Missing tests are missing, never
passes. Nine owns live canary/authentication verdicts; a fixture replay proves regression
conformance only. A new adapter must declare a new method through the existing register
shape/term process where necessary, not insert an unregistered string into provenance.

---

## 6. Model and persistence adapters beneath the existing doors

**Rule — a provider adapter cannot become a tool executor.** Rules 30, 41, 57, 75;
**checks: P10-NF-12/14/26**. ModelAdapterPort exposes describe, prepare and exchange.
Describe returns exact compatible model/route evidence. Prepare deterministically translates
seven's request into bounded application-visible provider bytes and a transformation manifest;
it performs no provider call. Seven records that exact input. Exchange accepts only eight's
admitted provider operation and six's claim, submits those exact bytes, and returns captured
provider observations to seven's receipt recorder. It never executes proposed tools, releases
credits or derives business settlement. Asynchronous provider callbacks enter four. External
observation/cancellation requests are separately admitted eight-owned operations, not hidden
SDK helpers. Client automatic retries are disabled. One exchange consumes one valid claim
for at most one provider invocation; a known rejection does not authorize another invocation
under that claim. The adapter returns the actual observation and yields control to the owners.
Before any new invocation, nine assesses the required evidence, eight settles the prior
execution and final charge with delayed execution excluded, and six persists the owning attempt
mapping and grants fresh conditional admission/reservation under current authority. Eight's
executor then consumes a new valid one-use claim. Counting attempts, rotating a provider or
accurately reporting duplicate charges cannot replace that sequence. An uncertain invocation
remains observation-only and cannot be retried to reconstruct a missing answer.

**Rule — retry tests distinguish bookkeeping from permission.**
**Checks: P10-NF-26/57** run the real adapter/executor boundary with a retrying SDK. After a
known rejection, an automatic second provider invocation under the original exchange/claim must
fail even when both attempts are reported accurately and budget remains. After an uncertain
timeout, the same automatic retry must fail with original exposure retained and zero subsequent
provider invocation. The permitted neighbor first establishes the required non-occurrence,
quiescence and final charge through nine/eight, durably maps and conditionally admits a new
attempt through six, then consumes a new valid claim through eight. It produces exactly one
provider invocation for that new attempt. A client whose retries cannot be disabled fails
activation for the mode; a counter or after-the-fact admission cannot make it conform.

**Rule — provider compatibility is granular and benchmark-gated.**
**Checks: P10-NF-14/26/27** test finite input/output and charge ceilings, actual submitted
content, structured-output decoding, partial streams, wrong account/model, cancellation,
usage unknown, attachment mutation and redirects. Unsupported modes remain explicit. A
prompt, context-assembly, floor, model or relevant setting change obeys seven's P7-NF-53:
the exact affected-suite execution record is required before service, even if the route
is labelled unmeasured. Benchmark-purpose execution can produce that record but cannot
serve live work or execute its proposed business actions. Cold start keeps seven's distinct
permitted unmeasured path. Assembly does not choose or grade the winning model.

**Rule — physical persistence does not replace the fact contract.** Rules 7, 31, 32, 33,
90; **checks: P10-NF-28/29**. PersistenceAdapterPort is accessible only to two's admitted
maintenance service and its confined implementation. Its operations are describe, appendExact,
readExact, and flushEvidence. AppendExact takes already-admitted immutable canonical bytes,
owner/segment position, expected physical head and custody policy; an equal replay returns
its original durable receipt and differing bytes at the position refuse. ReadExact retrieves
bounded segments/captures under mediated access. FlushEvidence proves the exact bytes and
prefix survived the required local durable boundary. An ordinary worker cannot call these
methods; two remains the sole public fact writer and replication admission owner. Projection
replacement and lawful capture removal use two's separately confined maintenance capabilities,
not a delete arm on the fact-store port. Encryption/key wrappers are physical representation,
never edits to signed canonical facts.

**Rule — the same persistence suite runs for every physical backend.**
**Checks: P10-NF-28/29/33** kill at write/flush/ack/checkpoint boundaries; test torn writes,
wrong-prefix receipts, duplicate positions, corruption, restored tail and permission denial.
Only verified durable bytes earn local-durable. Two alone interprets authenticated peer
receipts as replicated(n); a socket flush, replicated directory label or six's quorum is not
that proof. Consensus persistence recovers six's promises and accepted/committed evidence
from its own admitted facts; no hidden mutable authority journal can replace them. Different
storage engines must produce the same canonical facts and equal-vector views after recovery.

---

## 7. At-rest access for every replicated store

**Rule — readable replicas are an explicit trust decision.** Rules 28, 32, 33, 100;
**checks: P10-NF-20/31/32/33**. Full replication means each enrolled machine receives the
whole permitted shared fact record. Only machines admitted through the existing verified
machine/key and storage-custody policy receive it. Possessing a copy does not grant every
local process or remote API client permission to read it. The storage custodian runs under a
separate confined service identity; workers have no path to its files, keys, backups or raw
query endpoints. Application reads use existing StandingGrant action/scope checks through
a mediated read service. Requester standing by itself never means whole-agent history access.
The service returns only the fields and capture classes within the resolved scope.

**Rule — the storage policy is complete before opening a store.**
**Checks: P10-NF-31/32/34**. StoreCustodyPolicy contains id/schema and governed version;
registered store and all derived/backup locations; permitted custodian service identities;
read operation and disclosure scopes; existing grant references and staleness policy;
encryption suite/version and approved implementation evidence; local wrapping-key SecretRefs;
per-store data-key identifiers and epochs; independent recovery custody and restore procedure;
rotation procedure and resumable migration bound; plaintext cache/swap/dump restrictions;
metadata exposure; audit/rate/resource bounds; and compromise response. The policy's executing
principal cannot amend its own reader/grant/encryption rules. A missing policy refuses that
store's use. Only metadata, never key values, enters governing facts.

**Rule — every persistent copy is encrypted, including inconvenient copies.**
**Checks: P10-NF-31/33/34** require authenticated encryption using a reviewed implementation
and governed algorithm/version. Each encrypted physical chunk binds store identity, schema,
key epoch, segment or object identity and position as authenticated associated data; nonce
uniqueness is enforced across crashes/restores under a key. Canonical plaintext is verified
by two after decryption. Per-store keys are wrapped to the authorized local custodian's key
service; the wrapping capability is not stored beside the replica and is not exportable to
workers. Copying the disk or backup alone must not permit decryption.

The inventory covers segments, captured replicated payloads, pending replication buffers,
refusal metadata, projections, checkpoints, indexes, transaction logs, temporary files,
crash dumps, swap, exports and backups. No plaintext durable staging is allowed. Backups
contain encrypted data plus a signed inventory of exact bytes and epochs, with recovery keys
held separately. A platform whose paging/dump/cache controls cannot protect plaintext must
use an enforceable stronger boundary or declare that mode unsupported; enabling ordinary
store access with a warning is not the contract. Local judgment captures and secret custody
receive the same physical protections, while keeping their stricter original access/replication
rules. Encryption never permits raw judgment capture network serving.

**Rule — a read is checked at use and fails closed for disclosure.**
**Checks: P10-NF-20/32/35** test local unrelated users, another worker/run, a peer using the
wrong agent identity, a stale grant, a copied token, a forged raw-storage endpoint and an
operator with a valid scoped read. The custodian resolves current authenticated caller,
operation, data scope, policy generation and required source currency before opening a stream,
and checks again on each bounded chunk. Revocation stops subsequent chunks when observed;
bytes already released cannot be recalled. A stale authority view refuses new disclosure.
Informational status may still show a permitted, labelled view; fail-open communication never
means fail-open private history. StorageAccessObservation records id, store/object class,
requester/service provenance, grant/policy/generation, operation identity, clock, byte count,
Result and custody-safe refusal reference. It includes no plaintext query/body or secret.

**Rule — replication reads have only replication power.**
**Checks: P10-NF-31/32/35**. A receiver proves its enrolled machine identity and current
replica role to the sending service; it receives only permitted shared classes through two's
verified replication path. It cannot use that role to export raw local model captures or
secret values. The sender owns the delivered segment as two requires. Application read
filters do not redact or reorder the canonical replication stream; filtered user views are
separate scoped reads, so privacy filtering cannot manufacture a missing segment position.
Each receiving custodian encrypts its own physical copy with its own wrapped key. Revoking a
machine stops further admitted transfers; it cannot cryptographically erase copies or keys
that a compromised machine already extracted.

**Rule — rotation and restore cannot delete history by losing a key.** Rules 7, 44, 90;
**checks: P10-NF-33/34/36**. Record a key-maintenance intent with old/new nonsecret key ids
and the exact inventory, provision new custody through verified authority, rewrite only the
physical encryption wrappers into encrypted staging, verify all canonical hashes and restart
recovery cuts, then atomically switch the inventory pointer through an admitted operation.
Keep both required key epochs and old encrypted copies until every active/retained backup
reference has a verified readable path. Routine key destruction is not redaction and cannot
bypass two's memory/tombstone rules. A crash resumes or observes that same migration; no
fresh segment or new fact signature is generated simply to re-encrypt bytes.

Restore runs in quarantine: recover keys through the separately authorized custody path,
verify backup inventory and canonical fact chains, resolve current policy/key/grant state,
then let two/six establish a new segment epoch and recover authority as required. Old backup
grants never become current permission. Unknown current authority keeps mutation/disclosure
closed while independent diagnosis remains. A lost unique decryption key is an explicit
unrecoverable-data incident, not a successful restore. A deployment without separately
recoverable keys cannot claim recoverable encrypted backups.

**Value — the exact residual of duty 10.1.** Physical encryption protects copies without
keys; mediated access protects against processes lacking service authority. It cannot protect
against a compromised authorized custodian, host administrator, or reader who already copied
plaintext. Full replicas therefore keep the enrolled machine in the trust boundary. Object
sizes, transfer timing and opaque storage identifiers may remain visible outside encryption;
content and ordinary metadata payloads may not. These residuals make the duty partial in its
full threat scope, while its promised encryption and access-control mechanisms are specified
and mandatory. No check proves the residual acceptable; the operator decides that trade.

---

## 8. A host without signed reviews is refused as an approval anchor

**Rule — unsigned evidence cannot anchor a protected artifact.** Rules 28, 42, 82, 90,
98 and part two's inherited duty 10.2; **checks: P10-NF-37/38/39**. The host adapter
preserves the original review evidence through four, supplies it to one's Provenance decoder,
and records its actual class. An authenticated fetch, matching body hash, agent signature
on the fetched bytes, successful merge, green CI, or branch-rule presence does not make an
unsigned host review verified. It remains channel-attested. Offering it as protected
approvedIn or explicitYes produces the existing `Refused` with reason standing, the protected
anchor decoding site, failDirection closed and a custody-safe preserved reference. A valid
signature missing signed approver/request/artifact/base binding likewise cannot construct
Authorization; structural absence follows one's decode reason. No new Refused reason is added.

**Rule — refusal is propagated through every consumer.** **Checks: P10-NF-37/38/40**.
Two cannot admit the governing version as approved; three cannot activate it as a real
generation; nine cannot certify its protection; eight cannot dispatch its protected mutation;
ten cannot activate a package that requires it. The attempted work and refusal remain
recorded with an owned four/five authorization or repair disposition. Read-only inspection
and unrelated standing-covered ordinary work remain available. There is no setting named
accept-unsigned, no timeout-to-yes and no warning-only promotion of the same record.

**Rule — another verified surface creates a different act, not a stronger old record.**
**Checks: P10-NF-38/39**. Where nine/eleven support an independently verified approval
surface, four may route the exact request there under existing governance. A fresh verified
Authorization must bind the actual artifact and current base and the enforcing target must
support that class. It does not turn the host's unsigned review into a repository anchor.
Moving to a host/mode that supplies complete verified review evidence requires a new matching
review, current target condition and independent enforcement proof. An adapter may not sign
host-origin fields with an agent-controlled key and call that an independent alternative.

**Value — availability has a constitutional boundary here.** No check chooses the preferred
hosting provider or approval surface. The design accepts that some repository-protected modes
cannot run on some hosts. Changing the verified-origin requirement belongs to constitutional
approval, not a reversible adapter convenience. Ordinary green work gains no new approval
requirement merely because protected work on the same host is unavailable.

---

## 9. Local capability packages and self-hosting

**Rule — a local extension is an exact package, not executable discovery.** Rules 2, 5,
30, 44, 49, 69, 78, 84, 90, 113, 115; **checks: P10-NF-05/25/30/41/42**.
LocalCapabilityPackage contains id/schema, namespace owned by an existing principal, content
and source digests, parent/upstream lineage, version and prior package reference, public-port
requirements, exact dependencies, entrypoint artifacts, declared feature/parser/store/holder
ids, data/custody scopes and required grants, finite resources, platform/mode compatibility,
migration and rollback compatibility, required unit/integration/lifecycle checks, maturation
and probe references, and generated awareness source. Documentation and triggers derive from
the same declarations under three; a hand-maintained parallel capability list cannot satisfy
registration. A package cannot replace core ids or another namespace's declarations.

**Rule — package metadata and build scripts start inert.**
**Checks: P10-NF-17/18/41/42**. Read/validate manifest and archive entries without executing
code. Refuse path traversal, links escaping staging, mutable remote dependencies, duplicate
ids and mismatched hashes. Build/test code runs as untrusted confined work through five/eight,
without production credentials or mounts. An installer hook cannot run with installer authority.
Dependencies pin content, public contracts and applicable grants; installation never supplies
missing permission from a package author's declaration. Recursive dependencies are finite and
acyclic, with shared resource limits rather than a new budget per dependency.

**Rule — lifecycle transitions have durable predecessors and observable effects.**
**Checks: P10-NF-08/30/41/43/44**. PackageTransition carries id, exact package/manifest
and prior active digest, machine/scope, cause and responsible principal, current grants and
generation, test/migration/probe evidence, six/eight operation references, observed artifact
state, successor disposition and outstanding work. Allowed lifecycle:

| State | Next action and recorded condition |
|---|---|
| staged | Decode inert package and complete dependency/custody/isolation validation; failing package remains staged/refused with evidence. |
| validated | Run bounded unit, full-port integration and production-equivalent isolated lifecycle; required governing changes use the existing version/approval flow. |
| eligible | All required evidence and grants resolve to exact package and current compatibility; prepare activation under six/eight, never execute directly. |
| activating | Fence new affected starts, drain or preserve old claims, apply approved replay-safe migrations, persist activation intent, switch exact active artifact, observe it. |
| active | Record successful actual switch and fresh admission; new runs pin this package while old obligations retain their original interpretation. |
| inhibited | Stop new affected execution on failed/stale evidence or incompatible upgrade; bounded repair/observation remains owned. |
| retired | Remove new placement eligibility only after dependency and responsibility disposition; facts, schemas, source lineage and required replay material remain. |

Maturation status remains three's live/dark/soaking/retired feature fact, not this lifecycle's
replacement. A switch crash queries the active digest and original claim; a missing response
is not failure and cannot authorize a second migration. Conflicting concurrent activations
are excluded by six's scope admission or recorded Conflict, never sorted by timestamp.

**Rule — updates preserve local capabilities and old obligations.** Rules 44, 45, 68,
90, 112; **checks: P10-NF-30/43/44**. The upstream installer enumerates registered local
packages and checks all public-port/schema dependencies before switching. Compatible packages
remain installed with their namespace, provenance and custom declarations. Incompatible ones
retain artifacts and data with a specific inhibited mode and owned repair; ordinary upstream
updates never overwrite them with a default. Migration must account for every declared
consumer and preserve canonical old facts; projections rebuild through two. Rollback chooses
an artifact that understands the facts already written or leaves the affected family inhibited.
It cannot delete those facts to make an old version fit. Retirement cannot remove a provider
observation decoder while an old admitted call still needs it.

**Rule — self-hosting is demonstrated with a real capability.** Rule 2 and 115;
**checks: P10-NF-12/42/43/45**. A release inventory enumerates tools used to inspect,
design, build, test, review, package, install, migrate and repair Instar, including checker and
fixture runners. Each maps to a shipped feature and its supported harness contract. In an
isolated installation, Native builds a useful local capability through public ports, runs its
three tiers, installs it, exercises its actual operation, upgrades the platform, changes the
package with migration, kills during activation, recovers and verifies its retained behavior.
The case's observations and rollback become facts. Governance still applies to any protected
checker/declaration change; the self-hosting proof is not permission to self-approve it.
Other compatible harnesses run the same lifecycle, with unsupported modes in the parity matrix.

**Value — local does not mean private core modification.** No check makes packaging the best
extension mechanism for every experiment. A versioned package keeps local development useful
without upstream adoption. Proposing it upstream is separate work with its own authorization;
installation never sends source, captures or messages to another service automatically.

---

## 10. Growth instruments with owners and actions

**Rule — all inherited measurement subjects have concrete producers.** Rules 8, 13, 39,
46, 60 and duty 10.3; **checks: P10-NF-46/47/48**. GrowthPolicy names id/version, store
and projection scope, every required subject and producer, units, finite sample cadence and
freshness, workload sizes, soft/hard thresholds, replay time/memory ceiling, loop/cap/breaker,
notification budget and an accountable run owner. Missing numerical deployment values refuses
instrument activation; declaring a producer without a functioning sample refuses the live
claim. The following table is exhaustive for two's inherited subjects; additional consumers
may register more through the same machinery.

| Subjects | Producer and sampling contract |
|---|---|
| sequence-length, segment-bytes, append-rate | Custodian counts verified physical/canonical bytes and committed positions per segment over an explicit window; distinguish compression/encryption overhead and duplicate receipt traffic. |
| genesis-replay-duration, checkpoint-replay-duration | Budgeted replay runner uses two's pure fold at a pinned vector; record projection/schema, starting checkpoint, facts/bytes processed, peak memory and full/partial completion. |
| boot-rebuild-duration | Assembly measures boot and per-scope admission milestones from actual process start; minimal versus ordinary readiness are separate subjects. Eleven supplies its actual minimal projection set. |
| replication-lag | Two's receipt/position instrumentation per lineage/peer; record positions, bytes outstanding and age with clock provenance, including unobserved registered lineages. No sample means unknown. |
| refusal-rate, unattributable-wrap-rate | Two/four's boundary counters, counts and source/window aggregates; include saturation/coalescing, not just surviving detailed rows. |
| retraction-count, conflict-backlog-age | Two's admitted retractions and unresolved conflict facts, deduplicated by semantic subject; corrections retain original history. |
| pending-set-depth | Two's bounded hold inventory, oldest held age and refused-new holds per peer, including schema and reference holds. |
| known-segment-set-size, machine-key-count | Two's governed lineage/key record and closed-through summaries at a stated vector; count active and retained historical material separately. |
| historical-encoder-count | Three's schema/encoder inventory; execute canonical re-encoding fixtures for every retired version, not only decoding tests. |

**Rule — observation records retain their workload and missing data.**
**Checks: P10-NF-46/47/49**. GrowthObservation carries id, policy generation, machine,
subject scope, pinned vector, exact assembly/backend/hardware profile, start/end clock and
uncertainty, workload sizes, Measurement references, sample count and denominator, timeouts,
partial scans, unavailable inputs and comparison results. It distinguishes policy bounds,
measurements and projections/estimates. Unknown cross-machine clock differences cannot become
exact latency. A capped replay records a lower-bound elapsed cost and incomplete status,
never a fast successful replay. Observations are shared facts; sensitive raw profiles follow
custody policy and permitted metadata rather than leaking addresses or keys.

**Rule — a breached replay threshold opens owned work once.** Rules 8, 24, 55, 61;
**checks: P10-NF-47/48/49**. Compare measured genesis/checkpoint replay against the
predeclared replay-duration threshold and per-machine resource envelope. Breach or repeated
incomplete runs open one five-owned investigation per (policy, scope, breach episode), with
six-owned re-surfacing and finite diagnostic resource budget. Missing/stale samples open an
instrument-health obligation, not a below-threshold success. A later quiet sample does not
close an episode: closure needs a recorded measured workload meeting its declared exit test
or a separately authorized policy disposition. The threshold detector cannot rewrite its
own bar. Growth investigation may propose checkpoints, storage replacement or two's existing
verified on-demand suffix interface; it cannot compact/delete facts or erase capture pins.

**Rule — instrumentation cannot consume the repair plane it measures.**
**Checks: P10-NF-46/48/50**. Sampling is paged, cursor-persisted and loop-governed; cheap
incremental counters run separately from rare full replay/sweep. Their own measurements are
included in append-rate and storage cost, not omitted to make the curve attractive. Per-peer
catch-up, key rewrap and genesis scans share finite maintenance credits, with ordinary work
and reserved communication/control capacity isolated. Disk-pressure handling refuses new
optional capture work before capacity is exceeded and keeps existing evidence; emergency
space is pre-reserved and bounded, not a promise of infinite intake. Every inability to
preserve input has an honest unaccepted/unknown receipt, never an acknowledgment that claims
durability. Exhaustion of the minimal reserve is surfaced through eleven's independent path.

**Value — thresholds are deployment policy, growth is not permission to delete.** No check
chooses acceptable replay latency, sample cadence or spare disk for every machine. Finite
values are supplied before activation and recorded with evidence. Full-copy cost and the
smallest authorized replica's capacity remain visible. This part does not amend the permitted
redaction reasons or resolve routine-age retention by destroying encryption keys; nine owns
that policy reconciliation. Honest incomplete measurements are more useful than invented
universal performance promises.

---

## 11. Cross-part behavior and four fault traces

**Rule — every interaction has six fields and a real wiring fixture.** Rules 33, 45, 69,
95 and 113; **checks: P10-NF-01/04/40** map imported and exported ports to the rows
below. These are assembly obligations, not assertions that sibling authors approved them.
The separate coordination record contains the same declarations outside governed documents.

| Producer | Consumer | Authoritative record | Transition order | Fail direction | Closure owner |
|---|---|---|---|---|---|
| Two/three | Loader and injected components | Signed facts, entering-force generation, exact manifest | Verify anchor → decode → construct → prove wiring → admit scope | Close affected activation; preserve independent diagnosis | Two/three source integrity; ten activation |
| Five/six | Harness and five grounding | Pending run, launch reservation/claim, SessionGrounding, consumption observation | Persist → reserve → load fresh context → one-use launch/delivery → witnessed consumption → run acceptance | No stale launch or stdin-as-consumption; preserve input | Ten observations; five work/grounding; six recovery |
| Harness | Seven/five/eight | Judgment records, proposed run step, admitted effect | Ground → judge → record proposal → effect admission → observation → settlement | No private provider/tool route; unsupported mode refuses | Seven question; eight effect; five work |
| Channel/service adapter | Four/nine | Original evidence, parser contract, intake fact | Capture → provenance → binding/standing → admit → declared ack | Hold unresolved authority; preserve permitted user delivery | Four intake; ten adapter repair; nine assessment |
| Seven/eight | Model adapter and seven recorder | Submitted bytes, six claim, seven provider receipt | Prepare → reserve/claim → exchange → capture → record → assess | Unknown remains unknown; no hidden retry | Seven receipt; eight settlement; six credit |
| Two maintenance | Persistence/custody | Canonical bytes, custody policy, admitted grants | Authorize → encrypt/flush → acknowledge → decrypt/verify → admit/fold | No plaintext fallback or unauthorized raw read | Ten custody; two integrity |
| Host review adapter | One/two/nine/eight | Original review, verified Authorization or Refused | Preserve → verify origin/binding → decode → external target check → effect | Unsigned review refuses protected authority | One/two anchor; nine enforcement; eight effect; ten repair |
| Eleven/nine | Isolated assembly | Verified approval, independently pinned monitor policy/evidence | Verify separation → wire scoped handles → attack-test → activate class | Unproven protection unavailable; independent repair open | Nine monitor; ten realization; eleven surface |
| Package builder and source authorities | Installer/three/six/eight | Exact package, PackageTransition, approval/generation | Stage inert → validate/test → fence/drain → intent → switch → observe → record | Keep compatible incumbent; unknown switch observed | Ten lifecycle; eight switch; six fence; three generation |
| Instruments and two/three source facts | Nine/five | GrowthObservation, GrowthPolicy, owned loop/Decision | Measure → compare → coalesce episode → investigate → measured close | Missing unknown; breach visible; no deletion | Ten measurement; five work; nine adequacy |
| Nine holders | Activation and seven route | Exact-subject assessment/probe/check-run evidence | Record → assess independently → consume fresh evidence → admit | No no-op/stale grade certifies live; unrelated scopes continue | Nine evidence; ten activation; seven route eligibility |
| Eleven required path; two/four/six/eight | Minimal responder and eleven posture | AssemblyAdmission, current grant/binding/lease, exact durable closure | Verify source/domain → reserve → verify ownership/route → record claim → meet demand → consume claim → witness | Ordinary cuts preserve admitted reply; minimal cuts record outage and inhibit affected action | Ten realization; six authority; eight effect; eleven posture |
| Concrete adapter capabilities | Nine/eight/eleven | AdapterEvidenceContract/AdapterConformance and exact observations | Declare supported/unsupported predicates → exercise → assess → settle or retain pending | Missing decisive proof retains owner/exposure and zero replay | Ten capability proof; nine assessment; eight settlement; six credit; eleven slice |

**Rule — all four traces run through production implementations.**
**Checks: P10-NF-08/13/20/30/33/38/40/43** exercise a launch, message, provider call,
package switch and replicated write, with local and remote workers and duplicate callbacks.

| Trace | Assembly answer and authoritative closure |
|---|---|
| Crash after effect, before record | Six's exact claim and eight's verification obligation already exist. Query original launch/switch/write identity; preserve unknown outcome and maximum exposure. Retrieve stored receipts without recreating work. A received provider answer remains seven's receipt. Nine assesses; eight settles; six accounts; five advances. Ten records only its realization's observed result. |
| Duplicate delivery | Four owns event dedup, five semantic message/collection, six delivery-attempt and operation admission. Ten preserves these distinct references. Equal digest returns the original observation/receipt; changed digest conflicts. Encrypted-write retry cannot fork a segment; package replay cannot rerun migration; lost result ack cannot launch a child. |
| Cancellation racing completion | A local-durable authenticated stop inhibits new claims. Previously claimed effects may finish; record their late output and charge without reviving work. Five owns causal terminals, six fences, eight settles the world. Concurrent incompatible terminals remain Conflict. Package rollback is a new admitted action, never deletion of successful history. |
| Stale authority | Revalidate caller incarnation, scope, generation, grants and relevant fence at port use. Custody refuses stale disclosure, launch refuses old claims, and protected target refuses moved base. Observer-only evidence can remain receivable under its own standing. Missing isolation proof refuses the affected mode; a still-running process is not permission. |

**Rule — crash-cut proof admits owned uncertainty as a distinct result.**
**Checks: P10-NF-54/55/56**, joined to P11-NF-43–51, execute the actual production boot path
at every adjacent durable boundary from intake through model/send claims, effects, observations,
settlements and rebuild. The positive completion case pins concrete model and outbound adapters
with the required application or decisive non-occurrence evidence, delayed-execution exclusion
and final accounting, and finite recovery windows for source, authority, peer, route and evidence
services. Ten supplies their real bindings and witnesses; eleven owns the whole-slice verdict.
A claim-before-invocation crash is observationally uncertain when available durable evidence
cannot distinguish it from invocation-before-record. No fixture resolves that by its test-only
knowledge of where it killed the worker.

For an opaque or still-unavailable adapter, the required neighbor is the same original operation,
durable accountable owner, pending observation obligation, retained maximum exposure, and zero
replay or replacement invocation. A query can complete while the business effect remains
uncertain indefinitely. Each execution's genesis/checkpoint rebuild reproduces its own actual
facts at one vector, including pending uncertainty; different executions are compared by stable
logical identities, truthful evidence, no ownerless obligations and at most one application,
not by equal clocks, model prose or fabricated completed outcomes. After restoration, fresh
admission cannot bypass unresolved original exposure. Only six/eight/nine's existing bar permits
further effect execution; no completion fixture weakens it.

**Rule — receipt retrieval and effect retry remain different operations.**
**Checks: P10-NF-20/26/40** reproduce six's lost-ack trace: child/effect/provider invocation
counts stay unchanged while bounded lookup-attempt count increases. Lookup has no create-if-
missing capability. A miss, stale index or unavailable capture does not prove non-occurrence.
Eight's retry eligibility requires non-occurrence, exclusion of delayed execution and final
charge, independently assessed by nine. New route, run, package or budget cannot evade it.

---

## 12. Declarations, stores and non-functional checks

**Rule — assembly records use existing kinds and the existing spine.** Rules 7, 32, 33,
45, 69, 90; **checks: P10-NF-01/05/25/29/49**. Manifests/policies are versioned facts
linked to feature/store/parser declarations, not new top-level register kinds. Governing
changes retain the existing approval path. AssemblyAdmission, conformance, observations and
package transitions are shared fact schemas. All new projections explicitly fold or ignore
each registered kind and consume only facts plus generation. Correction/taint and unavailable
capture handling are two's, not replaced by status strings.

| Store/view | Growth / memory / machine scope | Agreement and retention |
|---|---|---|
| Assembly/package/admission view | deletes / no / machine-local, disposable fold | Exclusive-singleton activation heads; causal transitions and set-union evidence. Keep active, unsettled and immutable conflict/replay identities; equal-vector rebuild from spine. |
| Adapter parity view | deletes / no / machine-local, generated | Set-union exact tuple evidence, conflicting conformance exposed. No omitted unsupported tuple; generation/expiry visible. |
| Storage audit view | deletes / no / machine-local, disposable | Fold shared access metadata; custody-local raw material never copied into it. Aggregate only by declared retention, with access-denial counts preserved. |
| Growth/episode view | deletes / no / machine-local, disposable | Set-union samples and exclusive episode identity; corrected measurements, explicit closures. Missing producers remain in denominator. |
| Installed package and historical artifact custody | unbounded / yes / shared permitted artifacts | Digests agree with package/source facts; unknown old obligations pin required decoder/artifact. No automatic upstream overwrite or delete. Sensitive local-only captures are never packaged. |
| Encrypted backing stores and key service | Existing registered stores with unchanged growth/memory rules; local key handles justified as machine-local custody | Physical wrappers reconstruct original bytes; data-key metadata and rotation facts shared, plaintext keys never on spine. Every physical derivative covered by StoreCustodyPolicy. |

**Rule — blocking sites declare their exact power.** Rules 4, 66, 86, 95;
**checks: P10-NF-05/07/17/25/31/37**. Assembly activation, adapter-mode admission,
package activation, scoped storage access and protected-anchor refusal are blocking-site
entries: authority block; decidesAlone governed-state; enforces the approved manifest/schema,
existing grant/custody policy or protected approval contract with its named decoder;
preservesInput the existing scrubbed capture/refusal custody; inspectedBy the corresponding
P10 checks. Their principals cannot amend their enforced policy. Secrets/caps/stop use the
existing ruled-three holders rather than a new invented heuristic. Each declares closed for
unsupported execution/disclosure/protection and open only for independently admitted
communication and diagnosis. The read-denial record cannot leak the input it protected.

**Rule — features have profiles, metrics, supervision and live witnesses.**
**Checks: P10-NF-25/40/45/50**. Assembly/native/package execution features declare
control/costly/agent/none/bounded by actual launch/loop resources; user-facing harness entries
carry their actual chat or device surface and user reach. Custody declares security/irreversible/
agent/none/bounded; host approval identity/irreversible/operator/dashboard/bounded; growth
instrumentation data/reversible/agent/none/bounded with a separate control profile for its
admission gates. Derived significant/critical/user-facing properties select required tests
and probes. Critical install/recovery pipelines use seven's bounded step supervisor; its own
call admission stays nonrecursive. Nine owns semantic adequacy and live freshness. Metrics
come from the following table and section 10, never an empty declaration.

**Rule — manual preparation ends where automated critical execution begins.** Owner: the
operator owns manual administration; Ten owns pipeline composition; Seven owns bounded step
supervision. **Check: P10-SI-11/12** classifies manual preparation only when an
operator-administered identity places or selects already approved bootstrap bytes,
pre-provisioned secret handles, storage location and package inputs without key creation,
history append, migration, recovery, network effect, retry loop or activation claim. Any
automated critical install or recovery stage requires a finite admitted step list and a current
Seven supervisor before dispatch; absence is a named hold. The positive neighbors are manual
placement followed by read-only verification, and a bounded supervised import performing only
its predeclared writes. Prepared files alone never claim readiness.

**Rule — non-functional claims have runnable bars and failure actions.** Rules 13, 34,
38, 39, 43, 46, 55, 60, 62, 113; **checks: P10-NF-40/45/46/48/50**. Every numerical
bound below is a finite deployment declaration supplied before activation, with hardware,
workload, sample count and observed failures. No measured performance of an unbuilt system
is asserted. Correctness invariants have zero tolerated violations.

| Property and measurement | Automatic workload/check | Bar and consequence |
|---|---|---|
| Startup and scoped availability | Kill each startup phase; remove every dependency in turn; saturate ordinary resources | Zero premature scope activations; minimal plane opens within its declared budget for every non-minimal defect while its explicit section-2 dependencies remain admitted. Report real outage/overrun, never call a socket listen readiness. |
| Worker isolation and identity | Run every section-4 escape attempt and its permitted port neighbor on each platform; child and copied-handle variants | Zero unauthorized access or private effects; failed mode cannot receive credentials or run governed work. |
| Harness context and stop | Delayed start, compaction, stdin-only receipt, stale incarnation, saturated worker and concurrent stop | Zero ungrounded ordinary actions or fabricated consumption; local stop within six's declared bound. Remote halt remains unconfirmed until evidence. |
| Provider usage and replay | Streams, lost response/ack, account switch, missing usage and changed configuration | Zero unrecorded calls or liability releases; exact affected-suite execution required before changed service, with separate grade eligibility. |
| At-rest confidentiality and recovery | Copy disk/backup without key; unrelated uid/cross-scope reads; rotate/restore at every write cut; inspect WAL/temp/dump artifacts | Zero plaintext outside declared custody and zero silent lost canonical records; key loss/disallowed host boundary refuses affected mode. |
| Package survival | Install real local capability; upgrade upstream; kill migration/switch; rollback after new facts; two-machine concurrent activation | Zero erased local packages/history/obligations or duplicated migration effects; incompatible modes retained and inhibited. |
| Growth and maintenance cost | Retained-history workloads at 1, 10 and 100 times a recorded baseline, active work fixed; late segment and failed full replay | Correct equal-vector replay; complete cost/timeout records; bounded maintenance cannot borrow repair reserve. Threshold breach opens one owned investigation. |
| Fairness and capacity | Flood one adapter/replica/package with failures; boundary and boundary-plus-one admissions; zero cap | Zero oversubscription; healthy eligible peer served within declared fair round; refusal and unknown exposure remain visible. |
| Live wiring and protection | Real production initialization, actual registered operation and independent witness, wrong/no-op adapter substitution | Zero live/protected claims from no-op or self-attestation. Unit, full-port integration and real lifecycle tiers required before live. |
| Attention and observability | Many simultaneous failures plus missed samples; rebuild all informational views | Episode aggregation under eight's notification policy, zero per-item topics; missing evidence never becomes a green count. |

---

## 13. Contract fixtures

**Rule — each fixture tests the forbidden case and a permitted neighbor.** Rules 26, 34,
36, 37, 69; **check: P10-NF-02** maps every Rule block to this inventory and verifies
its execution record before counting it held. Captured protocol bytes are real fixtures;
synthetic fault schedules test failures, never pretend to be real benchmark provenance.
Unit tests test decoders/derivations, integration uses real public owners, lifecycle uses
production initialization and actual confined adapters. Naming all three is not running them.

| Identifier | Stage | Failure to expose; permitted neighbor |
|---|---|---|
| P10-NF-01 | build/arch | Duplicate type owner, missing seam/term/store/declaration; closed inventory with resolved owned imports passes. |
| P10-NF-02 | build | Rule lacks check, duty still deferred here, unexecuted check labelled held; declared/held*/reviewed remain distinct. |
| P10-NF-03 | arch | Native/feature private imports, direct providers or multiple hidden port bindings; public-port composition passes. |
| P10-NF-04 | wiring/lifecycle | Null/no-op/wrong concrete implementation, unused decoder or missing owner; real challenge traverses all expected owners. |
| P10-NF-05 | decode/activation | Missing/mutable digest, fabricated generation, incomplete policy or declaration; exact anchored manifest passes. |
| P10-NF-06 | lifecycle | Scope opens before dependencies, full replay blocks independent minimal plane; verified scoped startup passes. |
| P10-NF-07 | access/arch | Activation principal edits enforced policy or ambient override grants authority; separate approved policy remains usable. |
| P10-NF-08 | fault | Kill startup/drain/switch loses admitted work, or rollback cannot read new facts; compatible recovery preserves obligations. |
| P10-NF-09 | lifecycle | Bootstrap needs its own lease/model, or reserve is borrowed; finite independently grounded repair/control starts. |
| P10-NF-10 | contract | Launch/input lacks identity/incarnation/claim, or reused pid trusted; exact observed launch passes. |
| P10-NF-11 | contract | Stdin write or prompt echo counts as consumption; actual model-context-boundary evidence passes. |
| P10-NF-12 | lifecycle | Native bypasses public ports or a compatible doorway omitted; every compatible tuple executes same suite. |
| P10-NF-13 | fault | Compaction/delayed launch reuses stale context or loses pre-pause inbound; fresh grounding/accounting passes. |
| P10-NF-14 | contract | Hidden model/tool call, unobserved usage reported zero, opaque harness certified; proved supported mode passes. |
| P10-NF-15 | onboarding | Missing stall class/captured case, marker-only detection; actual lifecycle/wait evidence passes. |
| P10-NF-16 | fault/load | Stall recovery loops unboundedly or treats heartbeat as progress; owned bounded diagnosis preserves run. |
| P10-NF-17 | isolation | Worker inherits credential/network/store/control capability; admitted scoped port task succeeds. |
| P10-NF-18 | platform attack | Filesystem/IPC/debug/descriptor/child escape, or unsupported boundary silently downgraded; confined neighbor runs. |
| P10-NF-19 | isolation/lifecycle | Agent can replace monitor/keys/launch policy and still claim protection; independent boundary rejects it. |
| P10-NF-20 | access/fault | Copied/stale handle authorizes, observer creates work, lookup resets original effect; scoped read-only retrieval passes. |
| P10-NF-21 | wiring | Ten redefines nine's monitor or operator surface, fake external evidence accepted; real independent broker interface passes. |
| P10-NF-22 | captured contract | Evidence promotes unsigned data, names or forwarding into authority; authentic class-preserving input passes. |
| P10-NF-23 | identity test | Missing/reused event ids, tenant collision, identity churn inherits binding; exact scoped replay and verified rebinding pass. |
| P10-NF-24 | contract | ackPolicy lost in wrapper or public unresolved ack bypasses declared policy; bound/unbound/group matrix passes. |
| P10-NF-25 | generation/activation | Package parser or unsupported tuple omitted, shape extension hidden in undeclared facts; complete parity/declaration set passes. |
| P10-NF-26 | provider fault | Prepare calls provider, exchange executes tools/retries, wrong submitted bytes or unbounded charge; exact admitted exchange passes. |
| P10-NF-27 | activation | Changed prompt/context serves on unmeasured label or incomplete rerun; exact P7-NF-53 execution then separate evaluation gates pass. |
| P10-NF-28 | persistence | Non-durable/wrong-prefix ack, forked append or alternative mutable authority; exact durable append/replay passes. |
| P10-NF-29 | rebuild | Physical encryption changes signed bytes, ambient fold input or unequal-vector comparison; equal-vector canonical rebuild passes. |
| P10-NF-30 | upgrade | Upstream overwrites local package, drops old decoder or debt/stop, unsafe rollback; compatible preservation/inhibition passes. |
| P10-NF-31 | custody | Store opens without encryption/policy or plaintext derivative/backup appears; all physical copies match inventory. |
| P10-NF-32 | access | Unrelated uid/worker/peer/requester obtains whole store, stale grant streams more chunks; current scoped reader passes. |
| P10-NF-33 | storage fault | Torn encrypted write, nonce reuse, restored tail or copied backup yields plaintext/false durability; verified recovery passes. |
| P10-NF-34 | key lifecycle | Key stored with replica, rewrap loses historical readability, last key destroyed as retention; separately recoverable epochs pass. |
| P10-NF-35 | replication/access | Replica role exports local raw capture/secret, filtered stream hides segment gap or revocation implies erasure; permitted shared replication passes. |
| P10-NF-36 | restore | Backup grant restores authority, unknown head becomes current or missing key called recovered; quarantined then verified restore passes. |
| P10-NF-37 | approval decode | Unsigned/fetched/local-signed/merge evidence anchors protected artifact; complete genuine verified review passes. |
| P10-NF-38 | integration | Refused anchor becomes warning/success in any downstream consumer; same Refused stays visible through activation/dispatch. |
| P10-NF-39 | approval contract | Missing signed request/base, replayed yes or alternate surface launders old review; new exact verified act in supported class passes. |
| P10-NF-40 | cross-part lifecycle | Any four-trace violates five/six/seven/eight/nine ownership, no-op assessment or missing evidence; real owner chain preserves outcomes and uncertainty. |
| P10-NF-41 | package decode | Mutable dependency, namespace collision, traversal or installer hook executes privileged; inert exact staging passes. |
| P10-NF-42 | self-hosting | Development tool not shipped/registered, native lifecycle uses private helper; real package built/tested through public features passes. |
| P10-NF-43 | package fault | Lost switch acknowledgment reruns migration, concurrent activation chooses clock winner or rollback deletes facts; observed exact switch recovers. |
| P10-NF-44 | migration | New schema has missing consumer, local provenance lost or old call unobservable; complete compatible migration retains custody. |
| P10-NF-45 | live proof | Feature claims live without three tiers/real operation/supervision/probe; exact admitted capability lifecycle and independent witness pass. |
| P10-NF-46 | measurement | Inherited producer missing, stale sample green, historical encoder untested; complete measured subject roster passes. |
| P10-NF-47 | measurement | Wrong subject/unit, omitted timeout/open backlog, estimated cost called measured; pinned workload including incomplete runs passes. |
| P10-NF-48 | load | Scan/catch-up/key rotation exceeds budget, resets episodes or borrows repair reserve; bounded fair maintenance passes. |
| P10-NF-49 | episode/rebuild | Replay breach creates no owner or many episodes, timer closes it or permits deletion; one measured closure and retained history pass. |
| P10-NF-50 | activation/load | Absent numeric bounds, zero treated default, plaintext reserve spill or no-op critical holder; concrete zero/bound-plus-one and scoped failure pass. |
| P10-NF-51 | wiring/lifecycle | Minimal run borrows ordinary authority or local repair lease speaks for conversation; actual separately granted run plus current conversation ownership passes. |
| P10-NF-52 | fault | Healthy reserved responder dispatches without the installed durability receipt, binding or fence; all valid prerequisites permit the limited response and local stop keeps its own primitive. |
| P10-NF-53 | contract | Adapter omits unsupported predicate or delivery ack substitutes for durability/consumption; exact capability matrix and genuine stage-specific witnesses pass. |
| P10-NF-54 | load/fault | Minimal dependency loss counted as ordinary degradation, failed sample omitted or unconditional response bound asserted; finite admitted-path response and explicit measured outage remain distinct. |
| P10-NF-55 | crash/lifecycle | Claim-before-call cut uses test-only certainty or opaque adapter earns completed slice; original owned uncertain operation and zero replay survive every boot/rebuild cut. |
| P10-NF-56 | integration | Eventual miss, local kill, lost billing or dedup permits replay; actual complete absence, destination quiescence and final charge are separately assessed through six/eight/nine. |
| P10-NF-57 | adapter/executor integration | SDK retries known rejection or uncertain timeout under old exchange/claim, even with accurate counters; both fail. Independently reconciled prior attempt, durable mapping, fresh conditional admission and new consumed claim permit exactly one new invocation. |

---

## 14. Inherited duties and the rules they discharge

**Rule — each inherited duty has its final disposition here.** Rules 8, 49, 69, 71;
**checks: P10-NF-01/02**, including P3-NF-24's landing check. Held means specified
contract with a can-fail fixture; actual implementation remains declared until executed.
A partial row names the actual residual instead of leaving the promised machinery absent.

| Inherited duty | Disposition and residual |
|---|---|
| 10.1 — replicated-store at-rest access, part two | **Partial:** mandatory physical encryption, complete derivative/backup inventory, independent key custody, scope-mediated reads, revocation/rotation/restore and failure fixtures P10-NF-20/31–36. Residual: authorized custodian/administrator compromise, metadata sizes/timing and previously disclosed plaintext. Full replicas remain enrolled trusted machines; no absent access-control mechanism and no erasure claim. |
| 10.2 — unsigned host reviews cannot anchor protected artifacts, part two | **Held contract:** explicit preserved standing refusal, downstream propagation and no fetched/local-signature downgrade, P10-NF-37/38/39. Another verified act is a new supported approval, not reinterpretation of the unsigned review. |
| 10.3 — growth instruments, part two | **Held contract:** every inherited producer/subject, retired encoder fixtures, finite activation policy, pinned workload and incomplete-sample accounting, owned threshold episode, P10-NF-46–50. Threshold suitability is a labelled Value, never an unmeasured success. |
| Four follow-on — all remaining identity-evidence families and ackPolicy in bundle/contract enumeration | **Held contract:** per-mode matrix, full evidence record, wrapper/package enumeration and parity tests P10-NF-22–25. Six keeps Threadline ownership. Evidence cannot manufacture vendor capabilities absent from captured fixtures. |
| Five — harness actual-start and compaction consumption | **Partial:** real delivered-context evidence, public-port start and P10-NF-10–16. Five owns coverage/accounting; no receipt proves comprehension, and opaque unsupported harness modes remain unavailable. |
| Six/eight — executable capability isolation | **Partial:** real restricted execution, no raw worker credentials, platform attack matrix, P10-NF-17–21. Administrator/custodian compromise is outside worker confinement; nine owns independent protected enforcement. |
| Big picture — native/self-hosting/local evolution | **Held contract:** same-port native, exact local packages, development-tool inventory and install/upgrade/crash lifecycle P10-NF-12/30/41–45. No built or independently converged runtime is claimed. |
| Eleven — minimal-path realization and crash-cut evidence | **Partial:** explicit authority/dependency/durability admission and concrete evidence capability proof, P10-NF-51–56. Required durability, ownership, route or evidence loss defeats a response/completion bound; opaque effects remain owned uncertain with zero replay. Ten owns realization, eleven the conditional surface/slice verdict. |

**Rule — parent rule coverage is scoped to the automatic checks.**
**Check: P10-NF-02** walks the big picture's adapter, startup, dependency and self-hosting
obligations against these rows; a missing rule cannot hide in a blanket citation.

| Rules | Coverage here |
|---|---|
| 1/2/5/30/69/78/84/115 | Port boundaries, declaration/parity generation, native and shipped development tools: P10-NF-01/03/12/25/42/45. Semantic usefulness remains a Value. |
| 28/29/36/89/105 | Honest authenticated adapter identity, actual captured bytes, input and provenance carriage: P10-NF-22–25; four resolves standing and eight governs sends. |
| 7/31/32/33/44/45/90/112/113 | Shared immutable facts, encrypted readable history, migration/consumer completeness and declared local views: P10-NF-28–36/43/44/49. Captures keep original lawful removal constraints. |
| 14/15/20/21/27/37/42/46/55/59/60/61/64/68/77/88/95/99 | Scoped assembly, bounded recovery, preserved refusal/work and measured maintenance: P10-NF-06–09/15/16/40/48/50. Five owns exhaustion and dispatch quality; eleven owns global live reachability; nine owns semantic review. No whole-system availability proof from a boot flag. |
| 13/34/38/39/43/49/62/65/70/72/73/74/75/76/107/111 | Exact test/measurement evidence, actual activation/probes, supervisor and package lifecycle: P10-NF-02/25/26/40/45–50. Nine judges adequacy/convergence and release-review quality. Dark/soaking/live transitions retain three's deadlines and eight's change policy. |
| 47/96/110 | Actual context-consumption/compaction parity: P10-NF-11/13; five owns full history and disclosure, nine judges meaning. |
| 52/53/54/79/81/82/86/87/94/98/100/101/103/104/106 | Isolation, custody and exact approval refusal: P10-NF-17–24/31–39. Eight's messages/waivers/bypass checks and eleven's mobile/link/UX surfaces remain their owned obligations. Assembly offers no alternate approval or notification route. |
| 56/57/58/114 | Seven's compatibility/rerun gate and five/six/eight delegation/effect identities survive adapters: P10-NF-12/20/26/27/40. Nine grades; no assembly choice expands a floor or delegated grant. |

---

## 15. Terms and operator decisions

**Rule — new terms resolve through the same register.** Rules 49, 69, 90;
**check: P10-NF-01** converts these definitions to structured term references on approval.
Imported nouns retain their owning part's definition; field groups introduce no secret type.

| Term | Meaning |
|---|---|
| Assembly scope | A component/mode dependency set that earns activation or inhibition independently. |
| Assembly manifest | Exact artifacts, public-port bindings and governing-source references proposed for an installation. |
| Assembly admission | Recorded evidence and disposition of one scope at one manifest/environment. |
| Governed harness mode | A worker mode whose actual reasoning, tools, context and observations obey the shared port/isolation contract. |
| Context consumption | Witnessed entry of specified bytes into the instrumented model-context boundary, distinct from transport or stdin acceptance. |
| Adapter evidence contract | Versioned per-stimulus specification of authenticatable fields, identities, replay, acknowledgments and limitations. |
| Custodian | Confined service identity holding raw storage/credential capabilities and serving only admitted scope-checked operations. |
| Store custody policy | Governed requirements for physical copies, encryption, readers, key recovery and access observation. |
| Local capability package | Exact versioned artifacts and declarations installed against public ports under existing standing. |
| Package activation | An admitted, observable switch of the active package digest, separate from declaring or testing it. |
| Growth policy | Finite sampling, workload, threshold and owned follow-through requirements for retained-state cost. |
| Growth episode | One durable investigation of a measured threshold breach or unavailable instrument, closed by explicit evidence. |

**Value — operator questions belong to approval, not an idle design run.** No check chooses
these policy tradeoffs. The concrete proposed choices are ready for review:

1. Accept separate administration of protection and key custody, with host administrator and
   already-authorized plaintext extraction outside the prevention guarantee?
2. Accept governed-mode refusal for opaque/unconfined harnesses and unsupported protected host
   modes, while retaining independently admitted communication and supported ordinary work?
3. Approve the requirement for finite per-installation replay/maintenance/resource thresholds
   and independently recoverable encryption keys before the corresponding live claims? The
   deployment selects the actual values within governance and records its measurements.

Routine capture deletion or weaker approval provenance would amend earlier governed contracts;
this part proposes neither. Technical choices within those contracts—separate custodian,
per-store encrypted wrappers, exact package pinning and observed activation—are recorded and
reversible through compatible new admissions. They do not add user permission prompts to
ordinary standing-covered work.

**Value — costs are explicit.** Confinement may exclude convenient harness modes. Mediated
reads and encrypted replicas consume resources. Unknown effects retain liability and old
artifacts. Full-history storage can reach the smallest machine's capacity. The growth and
lifecycle evidence make those costs reviewable; no automatic check proves them preferable in
every installation.

**Rule — design completion is distinct from implementation and approval.** Rules 26, 65,
82, 90, 109; **check: P10-NF-02**. The governed document check tests body discipline only.
Part-one through part-nine public contracts, the independent review desk and the operator's
exact-content approval are not replaced by that check. Live claims require actual scoped
wiring, confinement, three-tier tests and nine's appropriate evidence. Eleven owns the full
operator experience and first vertical slice; this part supplies their assembly, never a
second definition of them.
