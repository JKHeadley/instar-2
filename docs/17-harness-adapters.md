**Status: draft, awaiting approval. Governed.**

# Part thirteen — the session harness adapters

**Value — purpose.** A Claude Code or Codex process should be a replaceable worker for durable
work, not the place where work becomes true. This part specifies the adapter packages that let
those real harnesses launch, receive admitted input, continue after a cut, expose honest evidence,
and stop without escaping the same authority, effect, verification, and recovery doors used by
every other worker. It also fixes the shape that Gemini, Grok, and later runtimes must satisfy.
No automatic check decides whether the supported modes are useful enough or whether their
confinement cost is acceptable; the operator retains those judgments.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91, 96, 110 and 115;
**checks: P13-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every paragraph, list,
and table belongs to its enclosing Rule or Value block. This part defines no new core type. A
contract check is a required future execution, not evidence that an implementation exists or ran.
Consumers re-resolve claims against current signed history. A holder is live only after fresh
running proof. Measured means recorded execution on named hardware and workload, never a target,
estimate, configured value, or successful-only sample. An **exact adapter tuple** is the complete
`(harness adapter package and artifact digest, registered model doorway and route, platform,
capability mode)` subject; no member may borrow another member's check result. A **runtime pin** is
an exact owner-resolved runtime selection bound to its source generation and validity horizon, not
a configuration hint or caller string. **Quiescence** is current owner-accepted evidence that the
original accepted attempt and every queued destination action can no longer execute; quiet output,
an absent worker, or a stopped local process is insufficient. **Model Context Protocol (MCP)** is
named here only as one possible runtime tool transport and never as an authority source.

---

## 1. Ownership and boundaries

**Rule — part thirteen defines no new core type.** Rules 1, 30, 49, 69 and 115; **checks:
P13-NF-01/03**. The adapter family implements Part Ten's public contracts and consumes the types
below from their single owners. Package-local launch drivers, event decoders, and opaque runtime
handles are implementation details. They do not become facts, permissions, or alternate schemas.

| Owner | Names consumed here | Availability relevant to this part |
|---|---|---|
| One | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Result`, `Success`, `Refused`, `Measurement`, `Profile`, `Evidence`, `Decision`, `Authorization`, `Scope`, `ActionFloor`, `Outcome`, `SecretRef`, `Provenance`, `Conflict`, and `UnresolvedInput` | Landed. `Profile` is only the constitutional consequence/reversibility/reach/surface/repetition value. It is not runtime configuration. |
| Two | fact envelope, causal frontier, durability state, capture reference, checkpoint, projection, correction, retraction, taint, and genesis replay | The landed fact, capture, and projection contracts used here are public. |
| Three | declaration, governed port, register generation, generation record, register feature profile, check-run record, rule graph, and honesty class | The landed registration and generation contracts used here are public. |
| Four | intake port, conversation binding, event-id authority, operation classification, authorization request, operating standing, and session-start substrate | The landed intake and binding contracts used here remain the authority source. |
| Five | `Run`, `RunStep`, `RunTransition`, `RunBudget`, `RunExit`, `SessionGrounding`; designed `ContinuityAccounting`, `DelegationContract`, `DelegationResult`, `AgentTransportEnvelope`, `DeliveryEvidence`, and `AgentTransportPort` | The single-root run and start/recovery/resume grounding slice is landed. Its validator cannot yet consume Ten's signed `HarnessObservation`; the additive Five consumer is granted by the dated 06:33Z addendum in `seam-response-rungraph-followup.md` and recorded as GRANTED in `SEAM-LEDGER.md` row 38, but is not landed on this HEAD. `ContinuityAccounting` is granted by `seam-response-run-closure.md`; compaction grounding, nonempty child grounding, delegation, and agent transport are separately granted by `seam-response-rungraph-followup.md`. Neither granted change is landed on this HEAD. `AwaitingAuthorization` and `ExhaustionRecord` are not consumed by this adapter contract. |
| Six | `Lease`, `FenceToken`, `AdmissionReservation`, operation identity, dispatch claim, spend reservation, `LoopPolicy`, `LoopRecord`, and `RecoveryRecord`; designed `ThreadlineRoute` and `ThreadlineReceipt` only where agent transport is enabled | Lease/reservation and a bounded observation slice are landed. The recurring breaker base is granted by `seam-response-loop-breaker.md`; full ordered escalation/recovery and retry admission are separately granted by `seam-response-loop-followup.md`. Neither grant is landed on this HEAD. |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `JudgmentResolution`, `BenchmarkRecord`, `BenchmarkScenario`, `BenchmarkRunRecord`, model route, and provider receipt | The listed records and a narrow injected-provider slice are landed. The public runtime-route resolver and provider preparation/receipt operations are granted by `seam-response-judgment.md` but are not landed on this HEAD. `AskRefinement` and `JudgmentHoldCost` are not consumed here. |
| Eight | `OperationDefinition`, `EffectRequest`, `EffectValidation`, `OperationObservation`, `EffectSettlement`, `OutboundMessage`, and `OperationAdapterPort` | The landed slice accepts only an ordinary outbound-message payload. The typed-effect base is granted by `seam-response-effects-payloads.md`; provider-call, retry-eligibility, harness-operation, and the fourth `worker-input` action `approval-prompt-response` arms are separately granted by `seam-response-effects-followup.md`. Neither grant is landed on this HEAD. |
| Nine | `VerificationPlan`, `VerificationRequest`, `VerificationAssessment`, `ProbeRecord`, `Grade`, `AssessmentClosure`, verification bar, and external protection broker | The listed record contracts are landed; live holder posture still requires its own execution evidence. |
| Ten | `AssemblyManifest`, `AssemblyAdmission`, `HarnessAdapterPort`, `HarnessLaunchSpec`, `HarnessObservation`, `AdapterEvidenceContract`, `AdapterConformance`, package lifecycle, isolation, and native-harness contract | The four-method harness port is landed. The capability-report reference, resolved runtime-configuration references, and confined driver for `approval-prompt-response` are granted by `seam-response-assembly-followup.md` but are not landed on this HEAD. The landed `AdapterConformance` identity and admission consumer are not route-bound; `design-harness-adapters-seam-request-part-ten-conformance-route.md` requests that additive Ten-owned seam and has no grant yet. |
| Eleven | registered operator surfaces, minimal-plane projection roster and live session, verified approval interactions, and the first vertical slice | The production composition seam is granted in `part-eleven-seam-response-assembly.md` and recorded `BUILT @07d02e3` in `SEAM-LEDGER.md`, awaiting Part Eleven integration. The required boot handles are absent on this HEAD, so no live minimal-plane result is claimed. |

**Rule — unbuilt owner capabilities are explicit activation prerequisites.** Rules 42, 49, 69
and 71; **checks: P13-NF-01/04/14/16/17/18/23/27/35/37/39/41/43/44/47/48**. The adapter does not recreate an earlier
owner's missing record. The following prerequisites remain unsupported cells in every conformance
record until the named owner exports the public contract and the acceptance condition executes.

| Prerequisite | Exact owner seam and present limit | Checks held until the seam lands |
|---|---|---|
| Production context-consumption evidence for Five's grounding gate | The dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, grants an additive production arm of Five's grounding-consumption validation for Ten's signed `assembly-HarnessObservation` and its referenced `HarnessLaunchSpec`, through an injected public `AssemblyHistoryReadPort`. The landed Five validator instead expects `worker`, `harness`, JSON-encoded `hashes`, and JSON-encoded `classes` directly in the fact body, while Ten stores its owned observation under `body.record` and derives classes from the launch manifest. The grant is not landed on this HEAD. | The production-consumption arms of P13-NF-14/16/17/18/23 and their governed live tuple cells are non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. The test-only flat consumption fact cannot satisfy them. |
| Runtime route, runtime configuration, and rich capability report | Seven's immutable provider/model/reasoning/billing selection is granted by `seam-response-judgment.md`. Ten's `HarnessRuntimeConfiguration`, expanded `HarnessLaunchSpec`, `HarnessCapabilityReport`, `describe` reference, and public resolvers are granted by `seam-response-assembly-followup.md`. The landed contracts expose neither additive surface. | The route arms are non-executable until `seam-response-judgment.md` lands. The runtime-configuration/capability-report arms are non-executable until `seam-response-assembly-followup.md` lands. |
| Route-bound conformance identity and activation | The landed `AdapterConformance` has no registered model-doorway or route reference; its logical key is only contract/artifact/platform/mode, and Ten's activation consumer checks adapter/artifact binding without proving which route passed. `design-harness-adapters-seam-request-part-ten-conformance-route.md` requests the additive Ten-owned tuple fields, logical identity, current owner resolution, and admission predicate. No existing grant covers them. | The route-independence and activation-positive arms of P13-NF-07/43/44/45/47/48 are non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`. Generic evidence strings and the runtime-configuration/capability-report grant do not satisfy this prerequisite. |
| Real model-provider effect path | Seven's preparation/receipt operations are granted by `seam-response-judgment.md`; Eight's versioned provider-call payload is granted by `seam-response-effects-followup.md`. The landed injected-provider doorway is expressly not the production Eight-owned effect path. | The Seven preparation/receipt arms of P13-NF-16/23/43/44/47 are non-executable until `seam-response-judgment.md` lands. Their Eight provider-effect arms are non-executable until `seam-response-effects-followup.md` lands. |
| Continuity-accounting record | Five's already-designed `ContinuityAccounting` record and owner boundary are granted by `seam-response-run-closure.md`. | P13-NF-27 is non-executable until `seam-response-run-closure.md` lands. |
| Compaction admission and visible delegated work | Five's compaction reason, nonempty child grounding, delegation records, transport port, readers, and consumers are separately granted by `seam-response-rungraph-followup.md`, which builds on the continuity record. | P13-NF-26/41 and their live tuple cells are non-executable until `seam-response-rungraph-followup.md` lands. |
| Recurring breaker base | Six's persistent breaker states, shared pressure identity, parent budgets, and public records are granted by `seam-response-loop-breaker.md`; the landed `LoopPolicy.breaker` remains `stub-closed`. | Breaker-state positive cells in P13-NF-35/47 are non-executable until `seam-response-loop-breaker.md` lands. |
| Full ordered escalation and recovery payload | Six's ordered escalation actions, quiescence demand, full `LoopRecord`, and full `RecoveryRecord` are separately granted by `seam-response-loop-followup.md`. | The full positive arms of P13-NF-35/37/38/47 are non-executable until `seam-response-loop-followup.md` lands; bounded observation/refusal remains executable. |
| Same-logical-request retry after decisive closure | Eight's owner-issued retry eligibility and Six's conditional retry admission are granted respectively by `seam-response-effects-followup.md` and `seam-response-loop-followup.md`. | Eight's eligibility arm of P13-NF-39 is non-executable until `seam-response-effects-followup.md` lands. Six's retry-admission arm is non-executable until `seam-response-loop-followup.md` lands; safe refusal remains executable. |
| Harness launch, delivery, control, compaction, and account-change effects | The typed-effect base is granted by `seam-response-effects-payloads.md`; the closed harness-operation arm and public Eight doorway path are separately granted by `seam-response-effects-followup.md`. | The typed-payload arms of P13-NF-14/19/20/36/38/40 are non-executable until `seam-response-effects-payloads.md` lands. Their harness-operation doorway arms are non-executable until `seam-response-effects-followup.md` lands. |
| Exact-call approval-prompt response | The dated 07:10Z addendum in `seam-response-effects-followup.md` grants the fourth `worker-input` action `approval-prompt-response`; the matching dated 07:10Z line in `seam-response-assembly-followup.md` grants its confined Ten driver. `SEAM-LEDGER.md` row 41 records both as GRANTED. | The prompt-response positives in P13-NF-35/46 and their dependent live tuple cells are non-executable until both `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. |
| Production minimal-plane composition | `part-eleven-seam-response-assembly.md` grants real production bindings and boot-returned handles; `SEAM-LEDGER.md` records the implementation built at `07d02e3` but awaiting Part Eleven integration. Test-only responders do not satisfy it. | P13-NF-42 and the minimal-plane arm of P13-NF-47 are non-executable until `part-eleven-seam-response-assembly.md` lands in the production assembly. |

**Rule — adapters are replaceable edges, not alternative owners.** Rules 1, 30, 63, 68 and
115; **checks: P13-NF-03/05/08**. Core services depend only on `HarnessAdapterPort`. The executable
assembly binds an exact adapter artifact and platform tuple. An adapter may translate a core
request into runtime-specific arguments, protocol messages, environment entries, and observations;
it may not reinterpret standing, mint authority, advance a run, settle an effect, choose a retry,
or hide a refusal. A harness-reported run, model, account, runtime configuration, or completion field is an
observation. Its consumer resolves the authoritative value from current signed facts.

**Value — terminal multiplexing remains optional.** A terminal multiplexer can preserve a
teletype-style terminal interface (TTY), support an operator view, and carry bytes to a runtime
through a pseudo-terminal (PTY), which is a software-created terminal endpoint. Those conveniences
do not make terminal state authoritative. A direct subprocess, local socket, or future runtime
protocol is equally eligible when it satisfies the same contract. Choosing among those conforming
drivers is an engineering decision inside the adapter package.

---

## 2. One adapter family and one conformance shape

**Rule — every harness implements the same four-method port shape.** Rules 30, 59, 68 and
115; **checks: P13-NF-03/04/06/07**. Each package implements the `describe`, `launch`, `deliver`,
and `observe` method set exactly as Part Ten specifies; the description's requested owner reference
is the explicit additive contract in section 1. Process stop, close, model change, account change,
compaction control, launch, and live-input delivery use the requested registered Part Eight harness-
operation payload. Those effect-positive paths are non-executable until
`seam-response-effects-payloads.md` and `seam-response-effects-followup.md` land. Reconnect and continuation ride Part
Six loops. Adding a runtime adds an adapter binding and conformance tuple, not a branch in Parts
Four through Nine. An absent capability is returned as unsupported with a stable reason. It is
never supplied by a family default or a different harness.

**Rule — supported mode is a conjunction of witnessed capabilities.** Rules 26, 34, 42, 59,
62 and 95; **checks: P13-NF-04/06/07**. `describe` reports the exact artifact digest, executable
identity, runtime and protocol versions, named platform, confinement mode, compatible input and
output modes, context-consumption witness, lifecycle witness, interruption operations, continuation
mechanism, hidden provider/tool-path posture, account and quota observability, and current
`AdapterConformance` references. The landed return fields already carry `artifact`, `platform`,
the five mode lists, and one conformance reference. The extra subjects are read only by resolving
the requested Ten-owned capability-report reference returned by `describe`; they are not informal
extra properties on a concrete adapter. Until that additive field, record decoder, and public
resolver in `design-harness-adapters-seam-request-part-ten.md` land, P13-NF-04 records the rich
description as unsupported and no governed-worker mode may activate. Governed worker mode is
supported only when every capability required by the admitted work is both declared and proved
for that exact tuple. An explicitly admitted advisory mode may lack the stronger model-context-
consumption witness and therefore may not be called a grounded governed worker. It must still
satisfy every applicable Part Eight effect, Part Six metering/recovery, credential-custody,
worker-isolation, and hidden-path confinement requirement. A mode with an unmediated provider,
tool, MCP, connector, shell, filesystem, message, credential, or other effect path is
unsupported; the advisory label grants no exception.

**Rule — parity is one suite applied to every complete tuple.** Rules 30, 34, 37, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45/47**. One contract suite takes a `HarnessAdapterPort`, the exact
harness package and artifact digest, one owner-resolved registered model doorway and route, one
platform, one capability mode, and only public core ports. It runs identical semantic cases for
every compatible complete tuple, including separate executions when one artifact/platform/mode is
compatible with more than one registered model doorway. Harness-specific fixtures may provide
protocol bytes and expected runtime events, but may not weaken the assertion. Every incompatible
combination remains enumerated with its stable unsupported reason. A family label, shared base
class, one model doorway's pass, or one mock result cannot establish parity for another complete
tuple. The landed `AdapterConformance` record and activation consumer cannot represent or enforce
that route distinction. Seven's owner-resolution arm is non-executable until
`seam-response-judgment.md` lands. The route-bound conformance and activation arms are separately
non-executable until Part Ten grants and lands
`design-harness-adapters-seam-request-part-ten-conformance-route.md`.
After it lands, each conformance record carries owner-resolved registered model-doorway and route
references in its logical identity, and assembly admission re-resolves and matches those exact
references to the active model binding before consuming the result.

**Rule — exact package binding prevents runtime impersonation.** Rules 44, 69 and 90;
**checks: P13-NF-05/07**. The assembly resolves the declared executable to exact bytes and object
identity before launch. The launched process and observer bind back to that artifact, platform,
adapter declaration, and `AssemblyAdmission`. PATH lookup, mutable aliases, auto-update, wrapper
fallback, and a runtime that reports another runtime's name cannot silently change the binding.
Changed bytes require a new conformance result and assembly admission for the affected scope.

---

## 3. Capability, account, quota, and launch pins

**Rule — capability is a fresh observation, not a configured promise.** Rules 13, 26, 41, 62,
75 and 95; **checks: P13-NF-04/09/10**. The adapter reports whether the executable is running,
which admitted account identity it can actually use, which model and reasoning settings the
runtime accepted, and which provider quota windows it can observe. A reasoning setting is the
registered provider or harness control that changes the amount or style of model reasoning; it is
not Part One's `Profile`. A harness configuration is a named vendor-runtime configuration bundle
whose exact arguments and nonsecret environment mapping are owned and resolved by Ten. Each report
names its source,
subject, artifact, machine, observed clock, freshness horizon, completeness limits, and capture or
receipt reference using existing `Measurement`, `HarnessObservation`, conformance fields, and the
requested Ten-owned capability report. A file, process label, configured account slot, provider
display name, or adapter self-report alone
is not authority. Missing, stale, partial, or permanently unavailable quota is `unknown`, never
zero, full headroom, or an inferred reset.

**Rule — consumers re-resolve every reported subject.** Rules 26, 28, 41, 49 and 69; **checks:
P13-NF-09/10/40**. Placement, admission, display, and recovery resolve current account, model,
reasoning setting, provider billing route, quota, grant, register generation, and artifact status
from signed history and the owning service. A provider billing route is the registered subscription
or metered account path against which usage and quota are attributed. Consumers compare that
result with the adapter observation. A mismatch inhibits the affected launch or next action and
records the conflict. It never lets the adapter's own `accountId`, model string, or
`supported: true` field override the current record.

**Rule — model, runtime configuration, reasoning, and account choices are exact launch subjects.** Rules 41,
56, 63, 75 and 96; **checks: P13-NF-11/12/13**. The Seven-owned model route, account selection,
named harness configuration, and allowed reasoning setting are not fields of constitutional `Profile`.
Seven's requested route resolver supplies the exact provider, model, reasoning setting, and billing
route. Ten's requested runtime-configuration resolver binds that selection to an approved account
and credential-custody reference, harness configuration, and exact argument/environment mapping;
the resulting references and resolved fields enter the expanded `HarnessLaunchSpec`. The adapter
records the resolved runtime arguments, nonsecret environment digest, and runtime acceptance
evidence. The current landed launch schema cannot express those pins, so the route positive is
non-executable until `seam-response-judgment.md` lands and the launch/configuration positive is
non-executable until `seam-response-assembly-followup.md` lands. A raw model string
from input cannot reach the launcher. An unavailable pin refuses or follows an explicitly admitted
policy owned by the earlier part; the adapter never silently substitutes a model, reasoning
setting, account, provider billing route, harness configuration, or runtime while keeping the old
label. Constitutional `Profile` remains available only to classify the consequences of the
feature or operation.

**Rule — a real model call crosses the public effect doorway.** Rules 31, 42, 55, 63, 68 and 75;
**checks: P13-NF-16/23/43/44/47**. Seven prepares and records the canonical bytes actually to be
submitted under its owner-resolved route. Eight admits the corresponding versioned provider-call
payload; Six reserves and consumes one claim; Ten's guarded executor verifies the submitted bytes
and digest before exactly one provider invocation. Seven records the provider receipt and actual
usage observations with the exact provider, account, and billing-route attribution; Eight records
the operation observation, Nine supplies the independent assessment, Eight settles from that
assessment, and Six applies accounting. The model-attempt lineage remains correlated to the
`HarnessObservation` and exact complete adapter tuple. A test-only provider, direct provider-client-library call, or
adapter-local receipt cannot satisfy the production boundary. Seven's preparation/receipt half is
non-executable until `seam-response-judgment.md` lands. Eight's provider-effect half is
non-executable until `seam-response-effects-followup.md` lands.

**Rule — credentials remain references and custody stays outside the worker.** Rules 28, 63
and 100; **checks: P13-NF-13/40**. The requested Ten runtime configuration and expanded
`HarnessLaunchSpec` carry only `SecretRef` and approved custodian references where credentials are
required; the landed schema cannot yet express that account binding and therefore keeps the mode
unsupported. Adapter descriptions, arguments, environment
digests, observations, captures, errors, conformance fixtures, and operator views contain no
credential value. Account identity is proved by the provider or credential custodian at use. A
credential slot label does not prove who occupies it. A credential or account change is a new
admitted operation and, where the runtime reads credentials only at start, a replacement worker.

---

## 4. Launching a worker for durable work

**Rule — the run exists before its harness worker.** Rules 31, 63, 68, 69 and 96; **checks:
P13-NF-14/15/17**. Part Five first records the `Run`, but it does not append a pending step before
grounding. The assembly derives and decodes the candidate ordinary `RunStep` so its stable id can
correlate the loading launch without yet admitting it. It then persists the `HarnessLaunchSpec`.
Part Eight records the loading-only launch intent and Part Six records the current `Lease`,
`FenceToken`, one-use `AdmissionReservation`, and consumed claim. Only then does the guarded Ten
executor invoke `HarnessAdapterPort.launch` exactly once. After that invocation, Ten persists the
resulting `HarnessObservation`, including an `uncertain` phase when the answer or receipt is lost.
It next admits and delivers the context/input operation and persists the resulting delivery and
`context-consumed` observations. The assembly then calls Five's `ground()`, which re-resolves the
consumption evidence and durably appends a separate `SessionGrounding` fact. It next submits the
ordinary `start` transition. Five re-resolves and revalidates that admitted grounding fact, then
durably appends the `RunTransition` containing the ordinary `RunStep` and grounding reference. No
`HarnessObservation` is fabricated before launch. A cut between any two records leaves the
original launch or delivery identity and maximum exposure pending for observation; it never
authorizes a second invocation. A cut after `ground()` appends grounding but before `start`
commits leaves no pending ordinary step; recovery re-resolves that grounding and current history
before retrying the same transition. The typed-payload half is non-executable
until `seam-response-effects-payloads.md` lands. The harness-operation doorway half is
non-executable until `seam-response-effects-followup.md` lands. Production consumption validation
is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`,
recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. The worker has only loading and
observation capabilities before grounding. A process id,
terminal name, provider conversation id, or resume token is never the durable run identity.

**Rule — launch success is narrow.** Rules 26, 62, 68 and 95; **checks: P13-NF-14/15/29/33**.
Launched means the exact admitted process incarnation produced fresh runtime evidence under the
expected artifact and working scope. It does not mean context was consumed, the worker is ready
for ordinary action, a model request began, useful progress occurred, or the run succeeded. An
uncertain spawn answer remains an unresolved launch attempt. Recovery observes that attempt before
requesting another launch. Process-id reuse, an old terminal, or a sibling runtime cannot satisfy
the observation.

**Rule — actual-start grounding precedes ordinary action.** Rules 47, 68, 96 and 110; **checks:
P13-NF-14/16/17/18/23**. After actual launch, Part Five takes the fresh history, clock, binding,
directive, register, pending-operation, child, and receipt read required by `SessionGrounding`.
The adapter delivers the exact context/input manifest and observes its actual model-context
boundary. Only a matching `context-consumed` observation makes grounding eligible. Five's
granted additive consumer re-resolves the signed Ten fact, decodes the `HarnessObservation`
under its `body.record`, follows its signed `launch` reference to `HarnessLaunchSpec`, and checks
the run, candidate step, input, worker/execution context, harness, incarnation, register
generation, full ordered context digests, and required briefing classes against the current
grounding read. An observation must be admitted, untainted, unconflicted, fresh, causally include
that launch, and be in the `context-consumed` phase with resolvable boundary evidence. Adapter-local
assertions and the flat test-only consumption fact do not qualify. This production consumer does
not exist on this HEAD, so the production-consumption arms of P13-NF-14/16/17/18/23 and their
governed live tuple cells are non-executable until the dated 06:33Z addendum in
`seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands.

After the witness passes, `ground()` durably appends `SessionGrounding`. The separate landed
`transition(start)` call re-resolves that fact, repeats grounding, ownership, freshness, policy,
and new-inbound checks, and only then appends the transition containing the previously decoded
ordinary step. Until that transition commits, the candidate is neither pending nor executable,
and the worker may use only loading and observation paths. Its provider calls, tools, messages,
writes, and other ordinary effects remain blocked at the public doors. A cut after grounding but
before the start transition leaves the grounding fact durable and the step unadmitted. Recovery
must re-resolve current history and may retry the same start transition; it cannot dispatch the
candidate or construct a second step. If the launch answer or consumption observation is
uncertain, Eight retains the launch effect and Six's `RecoveryRecord` queries that original launch
identity; no second launch or pre-grounding step is created.

**Rule — the working scope and hidden paths are confined before launch.** Rules 30, 41, 60, 63
and 75; **checks: P13-NF-05/14/18/47**. The adapter realizes the exact work directory, file
scope, environment allowlist, resource handles, network posture, tool route, model route, and
process identity from `HarnessLaunchSpec`. Built-in provider, shell, tool, MCP, connector, auto-
update, retry, and credential discovery paths are disabled or mediated through the existing
doors. Hook prose is not confinement. If the runtime cannot close a required hidden path, the
affected governed mode is unsupported before live credentials or work are supplied.

---

## 5. Delivering live inbound and observing a turn

**Rule — inbound is durable before delivery.** Rules 29, 31, 63, 68 and 69; **checks:
P13-NF-19/20/24**. A live inbound message first enters Part Four, receives its stable source and
conversation identity, and becomes pending work in Part Five. Part Eight admits the exact delivery
operation under Part Six's current fence and one-use claim. `deliver` receives only that intake
reference, immutable digest, target launch, and target incarnation. The adapter cannot invent an
anonymous keystroke path, accept a message only into process memory, or clear durable custody
because a write call returned.

**Rule — delivery stages never collapse.** Rules 26, 42, 63 and 69; **checks:
P13-NF-20/21/23/24**. The adapter separately reports refusal, uncertain dispatch, input accepted by
the runtime, context consumed by the model boundary, output observed, and any later independently
witnessed delivery. An operating-system write, PTY success, terminal echo, prompt disappearance,
provider request start, or transport acknowledgment proves only its actual stage. `deliver`
returning without error is not `context-consumed`. A lost answer leaves the original operation
pending with its maximum possible exposure until observation closes it.

**Rule — busy-session input is serialized by durable identity.** Rules 55, 60, 63 and 68;
**checks: P13-NF-19/20/22/24**. If the harness cannot accept another input during an active model
exchange, the adapter refuses or leaves the admitted input queued under its existing operation and
step identity. It does not type into a composer, overwrite a pending draft, concatenate two
messages, or claim future automatic submission. A capable harness may accept more than one input
only when its conformance evidence preserves order and maps every acceptance and consumption event
to the exact immutable input. Backpressure uses Part Six resources and loops rather than an
unbounded process-local queue.

**Rule — turn evidence is bound to existing work identity.** Rules 26, 49, 68 and 69; **checks:
P13-NF-21/23/31/32**. A turn is not a new core record here. It is the adapter's correlated span of
observations for one admitted `RunStep`, launch incarnation, input digest, and any Seven/Eight
attempts and operations it causes. Runtime event ids, stream positions, and opaque conversation
handles are recorded as source evidence on `HarnessObservation`. They do not replace the owning
step, request, or operation identity.

---

## 6. Resume, continuation, and compaction

**Rule — four continuation cases remain distinct.** Rules 47, 68, 69, 96 and 110; **checks:
P13-NF-25/26/28/38**. The adapter distinguishes reconnecting to the same live incarnation,
resuming a runtime conversation in a new incarnation, continuing after context compaction, and
launching a replacement worker with no usable runtime conversation. Each case preserves the same
durable run and unresolved logical operations while recording a new launch or pause observation
where required. A runtime conversation handle is opaque source evidence. It confers no lease,
standing, grant, register generation, or proof that its recalled context is current.

**Rule — every cut triggers fresh authority and actual-start reads.** Rules 31, 47, 63, 68, 96
and 110; **checks: P13-NF-25/26/27/28**. A replacement process requires the current lease/fence,
a fresh worker incarnation and corresponding ownership admission. Reconnect to a surviving process
retains its incarnation. Compaction inside that surviving process also retains its incarnation,
because a worker incarnation is one process lifetime; it instead creates a new grounding and
context-consumption boundary. Every case reads current signed history, current clock, current run
graph, pending effects, current directives and register generation. Runtime-restored history is
supplemental input, not the grounding source. A stale, missing, rejected, or ambiguous runtime
handle cannot authorize fallback. Part Six recovery and the assembly choose whether to attempt a
fresh grounded replacement under an admitted policy.

**Rule — compaction preserves classes and discloses the seam.** Rules 47, 69 and 110; **checks:
P13-NF-26/27**. The adapter delivers the same required governing-context classes after compaction
as at initial start, subject to the current generation, and records the new consumption boundary.
Part Five owns the designed `ContinuityAccounting` for the first reply: the pre-pause inbound,
explicit compaction disclosure, and `addressed`, `superseded`, or `pending` disposition. Its landed
decoder does not yet accept compaction grounding or export continuity accounting, so governed
post-compaction action remains unsupported. P13-NF-27 is non-executable until
`seam-response-run-closure.md` lands the record; P13-NF-26 is independently non-executable until
`seam-response-rungraph-followup.md` lands compaction admission, grounding, and public consumption.
The adapter cannot infer that the model remembered a message, suppress the disclosure, or declare
substantive adequacy from an output phrase.

**Rule — continuation never repeats an uncertain effect.** Rules 42, 55, 57, 63 and 68;
**checks: P13-NF-24/28/38/39**. On resume, the worker receives the exact pending attempt,
reservation, receipt, charge, and verification references from the run graph. The adapter observes
the original launch, delivery, provider call, tool, and outbound operations through their owners.
Neither a blank runtime transcript nor a missing process permits a new attempt. A new operation is
never admitted while occurrence, delayed execution, or charge remains uncertain. Even after
decisive non-occurrence, quiescence, and charge closure, the landed Six/Eight slice still safely
refuses the same request or semantic-message identity and reports `retryEligible: false`. An actual
retry becomes a required positive only after `seam-response-effects-followup.md` and
`seam-response-loop-followup.md` land. Those owner seams
must preserve the original logical request and digest and link a new attempt to the settled
predecessor; changing semantic identity is never a retry mechanism. The actual-retry positive is
non-executable until `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land.

---

## 7. Honest liveness, progress, and completion

**Rule — liveness, progress, and completion are different predicates.** Rules 26, 39, 59, 62
and 68; **checks: P13-NF-29/30/31/32/33**. Liveness requires fresh proof that the bound process
incarnation or runtime protocol endpoint is running. A **work-progress transition** is an admitted
change in an existing owner record that moves the exact `RunStep`, Seven model attempt, Eight
operation, or bounded output stream from its previously recorded work state to a later work-
bearing state. Its deduplication identity is the owning logical subject plus predecessor, phase,
or contiguous output range and content digest; a fresh adapter event id is never that identity.
Progress requires such a transition and records it once against the exact step. A heartbeat,
repeated health or liveness observation, unchanged phase, duplicate output, republication of the
same range, and event-id churn prove no progress. Turn completion requires a correlated harness
lifecycle event plus closure or explicit pending status for its streams and admitted child
operations. Run completion remains Part Five's accepted `RunTransition` and `RunExit`. No one
predicate substitutes for another.

**Rule — pane narration is diagnostic only.** Rules 26, 39, 62 and 95; **checks:
P13-NF-29/30/31/32**. Prompt glyphs, spinners, status footers, model labels, rendered acknowledgments,
completion phrases, terminal silence, scrollback changes, and terminal disappearance may be
captured for an operator or diagnosis. They cannot prove readiness, input consumption, model
selection, useful work, operator action, compaction completion, or success. PTY transport remains
eligible only when a separate structured, correlated witness proves the required state. An
unreadable witness yields unknown and follows the owning operation's safe failure direction.

**Rule — output is a bounded captured observation.** Rules 26, 36, 39, 42 and 69; **checks:
P13-NF-31/32/34**. The observer binds ordered output chunks, final output when present, runtime
event ids, byte counts, truncation, malformed or partial state, source clock, and capture digest to
the launch and step. Duplicate chunks do not become new progress. A partial stream, late event,
parser failure, lost final marker, or output after local disconnect remains visible and cannot be
promoted to a complete `Result` by the adapter. Part Five and Nine decide whether the evidence is
adequate for acceptance and verification.

**Rule — process exit is an observation, never a success mapping.** Rules 26, 59, 68 and 95;
**checks: P13-NF-32/33/38**. Exit evidence records the exact incarnation, exit source, status when
available, last correlated event, unresolved operations, and observation horizon. Exit zero,
terminal closure, a generated final sentence, or a runtime's own success label does not complete
the run. A missing process can mean clean exit, crash, eviction, kill, disconnection, or probe
failure; the adapter reports only what its source proves.

---

## 8. Interruption, kill, and recovery

**Rule — every silent-stop class has an explicit row before activation.** Rules 59, 62 and 95;
**checks: P13-NF-35/43/44/45**. Each exact adapter tuple extends Part Ten's stall matrix with its
real sources and supported recovery for: launch rejection; lost launch answer; accepted but
unconsumed input; permission, approval, trust, update, or selection wait; provider unavailable;
rate or quota wall; account expiry or identity mismatch; disconnected protocol; process exit;
process-id reuse; alive without proved progress; compaction or context limit; partial, malformed,
or delayed output; hidden tool wait; child work still live; stop requested but unconfirmed;
resource or lease loss; and observation failure. Missing decisive evidence is a declared gap, not
a heuristic detector.

The same matrix includes two required non-stall neighbors from 1.x: a registered bounded wait for
external check or merge state that is quiet inside its declared horizon, and a standard-input-consuming
pipeline stage whose registered producer or governed child is still live. Five's step and child
state plus Eight's operation observations supply the work identity; Six owns the bounded observation
and recovery episode. If classification still requires judgment, Seven asks the registered stall
question inside an `ActionFloor` whose conservative default is continue observing. The decision
names its horizon and evidence. Pane text may be captured as diagnostic input but cannot create a
protected-wait fact, a producer identity, or interruption permission. A genuinely stuck neighbor
has the same registered operation but no fresh wait/producer evidence after the bound and reaches
the separately admitted escalation path. The matrix also pairs a framework prompt for an exact
already-authorized call with a scope-widening or unverifiable menu: only the exact already-authorized
call may be cleared, while an “always,” session-wide, or machine-wide approval is a separate
authority-changing operation and an unverifiable menu remains pending for bounded diagnosis.
The granted action binds the existing authorized call, Ten's signed prompt observation and its
worker, incarnation, prompt-text digest and menu digest, the current matching worker and
incarnation, one selected allow-once menu member, the immutable payload digest, and one one-use
claim. It refuses a changed prompt or menu, a different or restarted worker, an unauthorized or
superseded call, a wider approval, uncertainty about the blocked call, and claim reuse.
The `approval-prompt-response` positive is non-executable until the dated 07:10Z addenda in
`seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as
GRANTED in `SEAM-LEDGER.md` row 41, land.

**Rule — interruption and kill are admitted effects.** Rules 42, 55, 60, 63 and 68; **checks:
P13-NF-36/37/40**. Operator stop retains the earlier fast local path. Every other interrupt,
graceful close, descendant signal, process termination, or harness conversation mutation is a
registered Part Eight operation under Part Six's current lease, fence, one-use claim, resource
reservation, and bounded loop. The landed Eight slice has no harness-operation payload, so these
effect-positive paths are non-executable until `seam-response-effects-payloads.md` and
`seam-response-effects-followup.md` land. The operation targets the exact process start identity and
incarnation at action time. It records principal, operator-initiated status, signal or protocol
action, response, and uncertainty. Generic runtime text such as “aborted by user” cannot attribute
an autonomous interruption to the operator.

**Rule — escalation is finite and policy-owned.** Rules 55, 59, 60 and 61; **checks:
P13-NF-35/37/47**. A supported adapter declares its available graceful request, protocol cancel,
targeted signal, hard termination, and quiescence evidence. Part Six's registered `LoopPolicy`
sets order, waits, attempt count, elapsed ceiling, resource cost, breaker, and exit test. The
adapter executes one admitted action and reports its observation. It cannot add retries, broaden a
target, send pane-wide control input, or turn an elapsed threshold into proof that the process or
provider stopped. The landed `LoopPolicy` has only a `stub-closed` breaker and the landed
`RecoveryRecord` cannot carry this full action/evidence sequence. Breaker-state positives are
non-executable until `seam-response-loop-breaker.md` lands. The full ordered escalation and
recovery positives are separately non-executable until `seam-response-loop-followup.md` lands; the
current executable positive is bounded observation ending in `stopped-at-bound` without an
unauthorized interrupt.

**Rule — recovery observes and adopts; it does not recreate history.** Rules 31, 42, 55, 63,
68 and 95; **checks: P13-NF-24/25/28/38/39**. The designed `RecoveryRecord` names the original
run, step, incarnation, operations, lease state, observations, and unresolved exposure after
`seam-response-loop-followup.md` lands. The current record preserves only the operation/episode, one observation,
and waiting or stopped-at-bound disposition; it supports safe observation and refusal, not the full
positive. The full recovery positive is non-executable until `seam-response-loop-followup.md`
lands. Recovery queries the exact available identities, accepts late evidence through Part Four, and lets the owners settle it. A
replacement launch receives a new incarnation and current fence only after exclusion or declared
uncertainty policy permits it. It preserves logical operation identity and never resends provider,
tool, filesystem, or outbound effects merely because the worker vanished.

**Rule — child work and the live-session minimal plane remain independent.** Rules 15, 59, 60,
68 and 114; **checks: P13-NF-41/42/47**. Visible delegated work uses Part Five child runs and Part
Six resource ownership. A runtime's opaque background agent or tool path is unsupported for
governed mode unless it can be identified, bounded, observed, stopped, and recovered through the
same doors. Five's landed single-root slice rejects nonempty children, so visible delegated mode
and P13-NF-41 are non-executable until `seam-response-rungraph-followup.md` lands; an adapter cannot substitute its
own child registry. Ordinary harness workers cannot consume Eleven's reserved minimal-plane capacity or
credentials. Their crash, quota wall, compaction, or kill does not remove the minimal responder's
ability to preserve admitted input, state honest limitations, and execute independently admitted
stop and repair operations while its own exact prerequisites remain live. P13-NF-42 and the
minimal-plane arm of P13-NF-47 are non-executable until
`part-eleven-seam-response-assembly.md` lands in the production assembly; the ledger's built
integration branch and any test-only responder are not activation evidence.

---

## 9. Claude Code, Codex, and future runtime mappings

**Rule — the mapping is concrete without granting brand exceptions.** Rules 30, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45**. The rows below are required adapter responsibilities, not claims
that a current vendor build exposes each witness. Activation records the exact supported and
unsupported cells for the tested artifact. A runtime update re-runs affected cells.

| Concern | Claude Code adapter | Codex adapter | Gemini, Grok, or later adapter |
|---|---|---|---|
| Launch | Translate the admitted launch specification into an exact Claude Code process, environment, work scope, and confinement mode; bind actual process start and Claude conversation evidence | Translate the same specification into an exact Codex process, named harness configuration, sandbox, work scope, and confinement mode; bind actual process start and Codex thread evidence | Supply the same exact translation and binding without adding a core framework literal |
| Model/runtime configuration/reasoning | Resolve the Seven route and Ten runtime-configuration references into the exact supported launch or admitted runtime-control fields; observe actual acceptance independently of configured state | Resolve those same owner-issued references into exact Codex model, named harness configuration, and reasoning controls; observe actual acceptance | Declare every pin supported or unsupported for the exact complete tuple; never approximate a tier silently. The route positive is non-executable until `seam-response-judgment.md` lands; the runtime mapping positive is non-executable until `seam-response-assembly-followup.md` lands |
| Live inbound | PTY or protocol delivery may carry bytes, but a correlated harness-origin input event and model-context witness establish acceptance and consumption | The same rule applies even when a busy composer visually retains text or Enter timing varies | Define exact transport, queue semantics, event identity, and context witness before governed activation |
| Liveness | Fresh exact-incarnation process or runtime-protocol proof | Fresh exact-incarnation process or runtime-protocol proof | Same predicate and freshness contract |
| Progress and completion | Correlated lifecycle, model, tool, and output events; no prompt/footer or final phrase authority | Correlated lifecycle, model, tool, and output events; no composer/spinner or final phrase authority | Same semantic events; unsupported if only screen scraping exists |
| Continuation | Runtime conversation continuation is supplemental; a replacement process gets a new incarnation while an in-process compaction keeps the current incarnation; both require the applicable fresh grounding and context witness | Runtime thread continuation is supplemental under the same process-lifetime distinction | Opaque handles remain evidence only; fresh grounded replacement is the safe supported fallback when continuation is absent |
| Account and quota | Prove the account at use through the approved custodian/provider source; record real readable quota windows and unknown gaps | Prove the account at use and record provider-origin quota windows with their reported lengths rather than positional assumptions | Declare observable windows, freshness, and permanent absence; no usage surface means unknown |
| Stop and recovery | Execute only admitted exact-target process/protocol operations and report quiescence limits | Execute only admitted exact-target process/protocol operations and report quiescence limits | Same registered operation and Part Six loop contract |

**Rule — Claude Code activation requires real boundary evidence.** Rules 34, 41, 47, 59 and 75;
**checks: P13-NF-16/23/35/43**. The conformance run must show actual submitted context,
correlated lifecycle and output events, model/account evidence, hidden provider and tool mediation,
and every stall row under the exact Claude Code artifact and each compatible registered model
doorway. The real provider-boundary arm is non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land. The grounding-consumption arm is non-executable until
the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in
`SEAM-LEDGER.md` row 38, lands. A hook firing proves only the event and fields it authenticates.
Missing strong context-consumption evidence may leave only a confined advisory mode. If provider
submission, built-in tools, or any other effect path cannot be confined to the public doors, the
tested mode is unsupported; advisory supplies no Claude-specific waiver.

**Rule — Codex activation has the identical bar.** Rules 34, 41, 47, 59 and 75; **checks:
P13-NF-16/23/35/44**. The conformance run must show actual submitted context, correlated lifecycle
and output events, model/runtime-configuration/reasoning and account evidence, sandbox and hidden path
confinement, and every stall row under the exact Codex artifact and each compatible registered
model doorway. The real provider-boundary arm is non-executable until
`seam-response-judgment.md` and `seam-response-effects-followup.md` land. The grounding-consumption
arm is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`,
recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. A rollout file, composer state,
or terminal render is accepted only for the precise observation its authenticated structure and
subject binding prove. Missing strong consumption or completion evidence keeps those capabilities
unsupported.

**Rule — a future adapter arrives through declarations and evidence.** Rules 30, 44, 49 and 115;
**checks: P13-NF-08/45**. The builder adds a registered package, exact assembly binding,
`AdapterEvidenceContract`, tuple-specific conformance record, stall matrix, and the shared suite's
captured/live evidence. No core switch statement, copied run state, new standing vocabulary,
unregistered provenance string, or generic “command-line-interface-compatible” assertion is permitted. An adapter may
support fewer modes than Claude Code or Codex and remain honest; it may not report parity for a
case it cannot witness.

---

## 10. What Instar 1.x does today and what carries forward

**Value — source-audit scope.** The read-only audit used Instar 1.x source at commit
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`. It covered `SessionManager`,
`PendingInjectStore`, `ModelTierEscalation`, `ModelSwapService`, `CompactionSentinel`,
`SessionWatchdog`, `HelperWatchdog`, `SubscriptionPool`, `QuotaPoller`, `ProactiveSwapMonitor`,
`SwapAntiThrash`, `SwapWorkGate`, `SessionRefresh`, `PermissionPromptAutoResolver`,
`AccountSwitcher`, and the incident notes in `CLAUDE.md`.
These observations describe that source tree only. They are not evidence for a 2.0 runtime.

**Rule — incident-earned behavior is preserved through core-owned mechanisms.** Rules 31, 42,
55, 59, 63 and 68; **checks: P13-NF-24/35/37/38/40/46**.

| 1.x behavior that must survive | Incident that earned it | 2.0 disposition |
|---|---|---|
| Initial input survives a server cut and any loss is loud | `PendingInjectStore` records the 2026-06-06 Codex boot window in which the TTY survived but the process-local pending inject vanished and the operator waited more than 50 minutes | Part Four/Five durable custody precedes Part Eight delivery; uncertainty remains pending and Part Six recovery observes the original operation |
| Recovery is deduplicated, verified, bounded, and cannot race a zombie kill | `CompactionSentinel` records three independent triggers, silent inject loss, and a 15-minute killer racing recovery; later guards also stopped interruption of long active turns | One `LoopRecord`/`RecoveryRecord` per incident, fresh structured evidence, current fence, and no kill while the owning recovery/execution remains admitted |
| Slow process probes do not freeze the server or turn timeout into death | `SessionWatchdog` records synchronous `ps` probes blocking health and restart; `SessionManager` later adds bounded asynchronous tri-state tmux probes | Bounded observation operations return unknown on probe failure; unknown cannot become process death or kill permission |
| Healthy quiet external waits are not interrupted merely for producing no output | `SessionWatchdog.classifyProtectedWait` exempts bounded safe-merge and GitHub check watchers, and re-evaluates the evidence within a two-hour ceiling | Five/Eight register the exact waiting operation and expected external condition; Six bounds re-observation; Seven may judge only inside a continue-observing default. Expiry removes the exemption but does not itself authorize kill |
| A quiet standard-input consumer is protected while its producer remains active | `SessionWatchdog` gives consumers a longer threshold and checks live pipeline siblings before escalation, because interrupting the consumer can abort the producer's whole turn | The producer is a registered operation or visible child with fresh liveness evidence; its consumer remains non-stalled while that evidence is current. Missing or stale producer evidence yields unknown or the separately judged stuck case, never pane-derived authority |
| An exact already-authorized framework call may clear its low-level approval prompt without silently widening authority | `PermissionPromptAutoResolver` recognizes bounded registered menu shapes, re-captures before sending, chooses an allow-once key by meaning where needed, caps attempts, audits static pattern names, and raises one defect for persistent or unrecognized menus; `CLAUDE.md` records that such prompts otherwise strand remote sessions | Four and Eight first establish that the exact call is already authorized; only Eight's granted `worker-input` action `approval-prompt-response`, executed through Ten's granted confined driver, may clear that one prompt. “Always,” session-wide, or machine-wide approval is a separate authority-changing request and is never inferred. An unverifiable or uncleared menu retains the work and enters bounded Six-owned diagnosis/recovery; pane text is a candidate signal, never authorization. This positive is non-executable until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land. |
| Interruption escalates by exact target and carries attribution | `SessionWatchdog` records targeted descendant checks and the misleading Codex “aborted by user” text | Part Eight operations bind process start/incarnation and record the actual principal; Part Six owns finite escalation |
| Background helpers are covered instead of hiding behind an idle parent | `HelperWatchdog` exists because parent-session monitoring missed spawned helpers | Visible helpers become child runs and resources; opaque helpers block governed activation |
| Model identifiers are framework-specific, closed, and server-resolved | `ModelTierEscalation` records drift where a new framework was checked against Claude's model list; `ModelSwapService` added exact lookup, idle protection, cost admission, and independent confirmation | Seven's requested route resolver selects the exact model/reasoning/billing route and Ten's requested runtime-configuration resolver selects the concrete harness/account mapping; the adapter only translates them |
| Quota uses measured windows, preserves unknown, and never crosses frameworks | `QuotaPoller` records a live Codex weekly window arriving in the positional primary field; `SubscriptionPool` and `QuotaTracker` record unknown being mistaken for zero headroom | Provider-origin windows retain their reported duration and freshness; consumers re-resolve account/framework and preserve unknown |
| Proactive account optimization does not kill busy or unknown work | `ProactiveSwapMonitor` records the 2026-06-09 untagged wall and the 2026-07-02 day of 36 swaps in eight waves that repeatedly killed six build helpers; `SwapAntiThrash` and `SwapWorkGate` defer proactive swaps | Part Seven placement policy may propose a better route; Five keeps the run where it is and Six defers or drops the bounded optimization episode when work is busy or unknown. Minimum residence time since the prior move, resource limits, and fresh quota prevent thrash |
| Ordinary interactive refresh refuses while work is busy unless a separately authorized interrupt is requested | `SessionRefresh` consumes `SwapWorkGate.probe`, returns the structured busy refusal and work summary, and attaches mitigation only for an explicit force request. `SwapWorkGate` itself is the stateless busy predicate | Four preserves the request and Eight refuses the replacement operation while Five reports busy/unknown. A separately authorized exact interrupt is a new admitted operation with its own consequences and cannot be inferred from the original refresh |
| Reactive continuity at an unusable account waits briefly, then mitigates instead of stranding forever | `SessionRefresh` consumes `SwapWorkGate.probe`, rechecks it during bounded grace, and then proceeds with mitigation for reactive swaps; the probe reports unknown as busy, while `SessionRefresh` owns the caller policy and grace deadline | Five records the account wall and pending work; Six owns bounded re-observation. Quiescence permits clean replacement. At the grace ceiling, elapsed time proves only that grace ended: replacement or interruption proceeds only through an already registered Eight operation policy, current fence, and exact target, while pending effects remain unreplayed and the grounded successor receives the recorded mitigation context |
| Recovery may replace a genuinely wedged worker, but may not inherit a caller-tag exemption over healthy busy work | `SessionRefresh` applies the unconditional `recovery` caller-class exemption before consulting `SwapWorkGate.probe`, then performs kill and respawn; the stateless gate defines no recovery exemption. This avoids deadlocking recovery on a broken pane but cannot distinguish a truly wedged recovery from a healthy busy session | The unconditional exemption does not carry forward. Independent current evidence must establish the exact recovery as wedged and an owner-controlled policy must admit the exact replacement or interrupt operation. A healthy or indeterminate busy worker remains protected; a timer or caller label alone cannot grant replacement permission |
| Pane-level tmux operations use the exact pane target | `CLAUDE.md` records tmux 3.6a silently failing pane commands without the trailing colon | A tmux-backed implementation always targets the exact admitted pane using `=session:`; conformance also proves that a syntactically successful call affected the intended incarnation |

**Rule — 1.x mechanisms are re-expressed rather than copied.** Rules 1, 26, 30, 31, 49, 55,
63 and 68; **checks: P13-NF-03/19/24/29/38/40/46**. `SessionManager` no longer owns durable work,
delivery truth, completion, or retry. `PendingInjectStore` becomes unnecessary because inbound
custody and effect identity already live in Parts Four, Five, Six, and Eight. `CompactionSentinel`,
`SessionWatchdog`, and `HelperWatchdog` contribute observations to core-owned loops instead of
performing independent recovery. Subscription swap becomes placement and replacement-worker
policy over existing leases and run facts. A terminal multiplexer becomes one transport
implementation. Runtime transcripts become captured evidence tied to exact identities, not a
newest-file oracle. Pane views remain useful for people and diagnosis only.

**Rule — 2.0 forecloses the 1.x failure shapes.** Rules 26, 42, 49, 55, 62, 63, 68 and 95;
**checks: P13-NF-15/21/24/29/30/32/38/39/46**. No process-local map may be sole custody for an
accepted input, recovery, dedup key, minimum-residence state, or continuation obligation. No terminal phrase,
prompt, footer, echoed command, newest transcript, process label, or exit code may settle a run or
effect. No adapter can kill first and reconcile state afterward, retry because a process vanished,
update a model/account record from its own claim, write credentials directly, or hide a framework
fallback under the requested label. Uncertain observations retain the original owner and exposure.

---

## 11. Non-functional checks and activation

**Rule — activation is tuple-specific and evidence-gated.** Rules 34, 37, 49, 62, 72, 73 and
115; **checks: P13-NF-02/07/35/43/44/45/47/48**. Each check below runs at unit, integration, and
end-to-end lifecycle tier where the row applies. Unit tests exercise decoder and decision
boundaries with real dependencies. Integration tests traverse the public Parts Four through Ten
ports. End-to-end tests start the production assembly, real adapter artifact, real worker, and
required external witness. Wiring tests reject null, no-op, private, or test-only bindings. An
artifact/model-doorway/platform/mode tuple remains declared until its complete suite executes, held until the owning
bars pass, and held-reviewed only after independent review at the exact generation. The switch
from advisory or observation-only to governed worker mode is a new `AssemblyAdmission`, never an
environment flag interpreted by the adapter. Because landed Ten cannot yet bind a conformance
record or admission to the model doorway/route member, the route-specific parity and activation
positives remain non-executable until `seam-response-judgment.md` lands and Part Ten grants and
lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`.

**Rule — resource and timing evidence includes failures.** Rules 13, 39, 60, 61 and 64;
**checks: P13-NF-09/22/29/35/37/47/48**. Conformance records named hardware, operating system,
runtime artifact, account class, workload, sample population, clocks, failures, timeouts,
distribution, memory, CPU, file descriptors, queue depth, input/output bytes, model tokens, money,
attempt count, observation lag, launch time, grounding time, turn latency, stop latency, and
recovery time. Each queue, poller, disposable projection, and loop has a finite size, cadence,
retention, and exhaustion outcome. Signed facts remain permanent. Capture bytes follow Part Two's
closed tombstone reasons, operator standing, delay, and protected-reference checks; routine age
does not remove them. Open recovery, authorization, conflict, judgment, or effect uncertainty pins
its evidence. At capture capacity the adapter refuses new affected capture work while preserving
existing pinned and unpinned facts and bytes. An unpinned capture is merely eligible for an
otherwise lawful tombstone; it is not eligible for age deletion. A target or estimate is labelled
as such and cannot satisfy a measured gate. A timeout remains a timed-out sample rather than
disappearing from the population.

**Rule — negative fixtures are executable contracts.** Rules 34, 37, 49 and 59; **checks:
P13-NF-01–48**. The next table is the complete Part Thirteen check list. Every negative is paired
with a realistic positive neighbor through the same public path. A declared fixture without a
check-run record at the named tuple and generation proves nothing.

---

## 12. Negative contract fixtures

**Rule — the complete suite tests the safe side and its neighbor.** Rules 34, 37, 49, 59, 62,
63 and 95; **checks: P13-NF-01–48**.

| Check | Tier | Negative fixture | Realistic positive neighbor |
|---|---|---|---|
| P13-NF-01 | build | Part Thirteen defines or constructs a core type, or imports a concrete core implementation | Owner inventory is complete and the adapter imports only public types and ports |
| P13-NF-02 | governance | A body history marker passes, or a check is described as runtime evidence | Governed-doc check passes and every claim stays inside a Rule or Value block |
| P13-NF-03 | wiring | Adapter advances a run, settles an effect, reinterprets standing, or exposes a fifth private method | Four-method port delegates to the owning public door and returns observations only |
| P13-NF-04 | contract | `describe` claims support from configuration, family default, stale conformance, or concrete-only extra properties | Existing mode fields and conformance resolve. The rich report arm is non-executable until `seam-response-assembly-followup.md` lands; then its returned owner reference decodes runtime/protocol versions, executable identity, account/quota observability, witnesses, sources, gaps, and current conformance refs |
| P13-NF-05 | security | PATH alias, wrapper, auto-update, or executable replacement changes the runtime after admission | Exact bytes/object identity match the admitted assembly and process observation |
| P13-NF-06 | lifecycle | Missing consumption, stop, or observation support silently falls back to another governed mode, or an advisory label permits an unmediated provider/tool/effect path | The affected governed mode refuses with a stable unsupported reason. A confined advisory tuple lacking only the stronger consumption witness remains explicit and obeys applicable effect, metering, custody, isolation, and hidden-path controls; an otherwise identical tuple with one unconfined provider/tool/effect path refuses as unsupported |
| P13-NF-07 | parity | One compatible registered model doorway passes for an artifact/platform/mode and that result is credited to another doorway, two route executions collide under one logical identity, or one platform result covers another | Seven's route-resolution arm is non-executable until `seam-response-judgment.md` lands. Route-bound identity and activation are separately non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`; then the same public suite executes independently for two compatible registered model doorways, both route-bound conformance records coexist under distinct logical identities, and neither record activates the other route; limitations and unsupported cells remain separate for every complete tuple |
| P13-NF-08 | build | Adding Gemini/Grok requires a core runtime switch or copied run state | New declared adapter/package/binding passes unchanged port and suite |
| P13-NF-09 | observation | Missing/stale/partial quota becomes zero usage or full headroom | The capability-report arm is non-executable until `seam-response-assembly-followup.md` lands; then a fresh provider-origin window is measured and an unavailable window remains unknown with freshness/source |
| P13-NF-10 | security | Adapter-reported account/model/runtime configuration overrides conflicting signed history | Route re-resolution is non-executable until `seam-response-judgment.md` lands. Runtime-configuration re-resolution is non-executable until `seam-response-assembly-followup.md` lands. After both grants land, a mismatch with current signed owner resolution inhibits the affected action, while a fresh unconflicted owner-resolved selection and matching observation permit that action |
| P13-NF-11 | integration | Raw inbound model string or unsupported reasoning value reaches the command line | The route arm is non-executable until `seam-response-judgment.md` lands; the launch-mapping arm is non-executable until `seam-response-assembly-followup.md` lands. Then owner-resolved exact model, reasoning, billing route, account, and harness-configuration pins map to validated launch fields and acceptance evidence |
| P13-NF-12 | integration | Requested model/account/runtime fails and adapter silently substitutes while retaining label | Route resolution is non-executable until `seam-response-judgment.md` lands. Runtime alternative mapping is non-executable until `seam-response-assembly-followup.md` lands; then explicit owning policy admits and labels a permitted alternative, or launch refuses |
| P13-NF-13 | security | Credential bytes appear in command-line arguments, environment capture, logs, fixture, error, or worker-readable store | The launch-binding positive is non-executable until `seam-response-assembly-followup.md` lands; then a `SecretRef`/custodian handle supplies use and only redacted identity evidence leaves custody |
| P13-NF-14 | e2e | Process launches without a recorded run, persisted `HarnessLaunchSpec`, current loading-launch intent/reservation/claim, or exact scope; a `HarnessObservation` is fabricated before invocation; or a pending step is admitted before grounding | The typed payload is non-executable until `seam-response-effects-payloads.md` lands. The harness-operation doorway is non-executable until `seam-response-effects-followup.md` lands. The production consumption bridge is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. Then production persists the specification and admitted intent, invokes once, persists the resulting observation, delivers and witnesses context, calls `ground()` to append `SessionGrounding`, and separately calls `transition(start)` to revalidate that fact and append the transition containing the ordinary step. A crash after grounding and before the start transition leaves the step unadmitted and all ordinary actions disabled; every cut retains the original uncertain identity |
| P13-NF-15 | fault | Reused process id, terminal name, or sibling process is accepted as the prior worker | Start identity plus fresh incarnation binds the exact process and rejects reuse |
| P13-NF-16 | integration | PTY echo or prompt disappearance is accepted as context consumption, or a direct provider-client-library call bypasses the governed provider effect | The production-consumption arm is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands; then the instrumented model-context boundary emits a correlated `context-consumed` observation that Five re-resolves through Ten's signed record and launch manifest. Provider preparation/receipt is non-executable until `seam-response-judgment.md` lands. Provider effect execution is non-executable until `seam-response-effects-followup.md` lands |
| P13-NF-17 | lifecycle | Delayed/resumed start reuses intake-time history and clock | The production consumption binding is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands; then a fresh actual-start read covers current history, clock, graph, and the re-resolved Ten consumption observation before `ground()`, and `transition(start)` rechecks freshness and any new inbound before admitting the step |
| P13-NF-18 | security | Ungrounded worker invokes provider, tool, message, or file-write path | The production grounding-consumption arm is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands; then loading/observation remains available before `transition(start)` commits while every ordinary public effect refuses, including across the crash cut after durable grounding |
| P13-NF-19 | fault | Server dies after accepting inbound but before or during live delivery and input disappears | Durable intake/step/operation remains pending and recovery resumes exact custody. The typed payload is non-executable until `seam-response-effects-payloads.md` lands. The delivery doorway is non-executable until `seam-response-effects-followup.md` lands |
| P13-NF-20 | security | Delivery targets stale incarnation or cross-conversation worker | The typed payload is non-executable until `seam-response-effects-payloads.md` lands. Guarded delivery is non-executable until `seam-response-effects-followup.md` lands; then current fence, exact launch/incarnation, intake identity, and digest accept the neighbor |
| P13-NF-21 | integration | PTY write, return-without-error, or echo is labelled consumed or completed | Exact observations retain accepted, consumed, output, and completed stages separately |
| P13-NF-22 | load | Busy runtime accumulates unbounded memory queue, overwrites a draft, or merges inputs | Bounded durable backpressure preserves each operation and ordered capable runtime accepts exact inputs |
| P13-NF-23 | live | Synthetic hook, screen scrape, test-only provider, or direct adapter-local provider-client-library call satisfies governed context delivery and provider submission | Production context delivery is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands; then Five re-resolves Ten's signed `context-consumed` observation and launch manifest. Provider preparation/receipt is non-executable until `seam-response-judgment.md` lands. Provider effect execution is non-executable until `seam-response-effects-followup.md` lands; then the exact-artifact witness correlates the actual submitted bytes/digest, Eight effect lineage, exact provider/account/billing-route attribution, provider receipt and usage, and model request on named hardware |
| P13-NF-24 | fault | Cut at every delivery boundary causes silent loss or blind duplicate | Original operation is observed, remains pending when unknown, and only closed evidence permits next action |
| P13-NF-25 | lifecycle | Resume creates a new run, inherits an old lease/grant, or changes incarnation while the same process survives | Same durable run reconnects with the surviving process incarnation, or a separately owned replacement process receives a new incarnation; each uses current authority and fresh grounding |
| P13-NF-26 | lifecycle | Post-compaction context omits a required governing class, claims obsolete byte parity, or mints a new incarnation in the surviving process | Non-executable until `seam-response-rungraph-followup.md` lands; then current-generation required classes match and new consumption/grounding evidence is recorded under the surviving incarnation |
| P13-NF-27 | integration | First post-compaction reply omits disclosure or pre-pause inbound disposition | The record arm is non-executable until `seam-response-run-closure.md` lands; the compaction consumer arm is non-executable until `seam-response-rungraph-followup.md` lands. Then owner-decoded `ContinuityAccounting` binds disclosure, inbound, reply, and honest disposition |
| P13-NF-28 | fault | Missing/stale runtime handle authorizes blind fallback or effect replay | Grounded replacement is separately admitted after original observations and current history |
| P13-NF-29 | observation | Config file, process label, old heartbeat, pane, or probe timeout is called live/dead | Fresh exact-incarnation proof yields live; unreadable probe yields unknown |
| P13-NF-30 | semantic | Prompt, spinner, footer, model label, completion phrase, or terminal silence changes authoritative state | Same pane is available diagnostically while structured evidence alone drives state |
| P13-NF-31 | integration | Duplicate output, scrollback growth, unrelated transcript write, fresh heartbeat, repeated health observation, unchanged work phase, or event-id churn counts as step progress | A fresh correlated heartbeat records liveness only. A genuinely advancing admitted model-attempt, operation, output-range, or `RunStep` transition changes the prior work state for the exact subject and records progress once under the owner subject plus predecessor/phase or contiguous-range-and-digest deduplication identity |
| P13-NF-32 | semantic | Final phrase, runtime success label, or process exit completes turn/run with pending children or stream | Correlated lifecycle evidence plus explicit pending closure reaches owners for acceptance |
| P13-NF-33 | lifecycle | Exit zero maps directly to successful `RunExit`, or missing process maps to clean exit | Exit observation preserves status/evidence/unknowns and Part Five alone accepts success |
| P13-NF-34 | fault | Partial, malformed, delayed, reordered, or duplicated output becomes a complete result, or age deletes its capture | Ordered bounded capture records exact limitations and late evidence without promotion; pinned and unpinned captures both survive age, and only an eligible permitted tombstone removes bytes |
| P13-NF-35 | coverage | One enumerated silent-stop class lacks a source, detection limit, recovery, or positive/failing case; quiet time interrupts a bounded external wait/live producer pipeline; or an approval menu is silently wedged, changed, bound to another worker/incarnation, answered with a broader grant, or answered by a reused claim | The exact complete-tuple matrix distinguishes a genuinely stuck operation from current registered wait evidence, a current producer/consumer pair, an exact already-authorized allow-once prompt bound to the matching current worker/incarnation, prompt/menu digests, immutable payload digest and fresh one-use claim, and a changed, scope-widening, reused-claim or unverifiable prompt that remains pending. The `approval-prompt-response` positive is non-executable until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land. Breaker positives are non-executable until `seam-response-loop-breaker.md` lands; full escalation is non-executable until `seam-response-loop-followup.md` lands |
| P13-NF-36 | security | Interrupt/kill targets by substring, stale process id, pane-wide control key, or expired fence | The typed payload is non-executable until `seam-response-effects-payloads.md` lands. The harness-operation doorway is non-executable until `seam-response-effects-followup.md` lands; then exact process start/incarnation and current one-use claim admit one scoped operation |
| P13-NF-37 | fault | Stop loop retries forever, skips quiescence evidence, or treats elapsed wait as stopped | Landed bounded observation stops at its bound without unauthorized interrupt. Breaker behavior is non-executable until `seam-response-loop-breaker.md` lands; ordered finite escalation is non-executable until `seam-response-loop-followup.md` lands and then reports unresolved stop honestly |
| P13-NF-38 | recovery | Worker disappearance immediately relaunches and repeats original launch/delivery/effect | The full recovery-record arm is non-executable until `seam-response-loop-followup.md` lands. The replacement payload is non-executable until `seam-response-effects-payloads.md` lands. Its harness-operation doorway is non-executable until `seam-response-effects-followup.md` lands. Then recovery queries original identities, adopts late evidence, and conditionally admits replacement |
| P13-NF-39 | effect | Resumed worker repeats an uncertain operation, changes semantic identity, or treats decisive settlement as present retry permission | Safe same-request refusal after closure is executable now. Eight's retry eligibility is non-executable until `seam-response-effects-followup.md` lands. Six's retry admission is non-executable until `seam-response-loop-followup.md` lands; then one new attempt preserves logical identity and cites the fully settled predecessor |
| P13-NF-40 | security | Account change writes credentials directly, crosses framework, mutates a live label without proof, applies one busy policy to every caller, or a `recovery` label kills healthy busy work | Proactive optimization defers/drops and ordinary interactive refresh refuses. A distinct reactive positive records an account wall, waits the bounded grace, then proceeds only under the exact current owner policy and exact-target admission with recorded mitigation; unresolved effects remain retained and none are replayed. A recovery-class replacement is separate: it additionally requires independent current wedge evidence and an owner-admitted exact action, while healthy or indeterminate busy recovery stays protected. Route resolution is non-executable until `seam-response-judgment.md` lands. Runtime mapping is non-executable until `seam-response-assembly-followup.md` lands. The account-change payload is non-executable until `seam-response-effects-payloads.md` lands. Its doorway is non-executable until `seam-response-effects-followup.md` lands |
| P13-NF-41 | lifecycle | Opaque runtime helper survives untracked or is killed as if no child work existed | Non-executable until `seam-response-rungraph-followup.md` lands; then a governed child run/resource is visible and recoverable, while opaque-helper/delegated mode refuses |
| P13-NF-42 | load/e2e | Ordinary harness saturation, crash, quota wall, or kill consumes the reserved live-session responder, or a test-only responder is credited as production | Non-executable until `part-eleven-seam-response-assembly.md` lands in the production assembly; then the real minimal plane preserves input and serves honest stop/repair while exact prerequisites remain |
| P13-NF-43 | live | Claude Code pane fixtures, fake hooks, a test-only provider, or one model doorway's result earn production governed activation | Each compatible registered model doorway executes independently with the real Claude artifact on named hardware. Route-bound conformance identity and admission are non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`. Production grounding-consumption cells are non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. Provider preparation/receipt cells are non-executable until `seam-response-judgment.md` lands; provider/harness effect cells until `seam-response-effects-followup.md` lands; exact-call `approval-prompt-response` cells until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land; typed payload cells until `seam-response-effects-payloads.md` lands; runtime-pin cells until `seam-response-assembly-followup.md` lands; continuity-record cells until `seam-response-run-closure.md` lands; compaction/child cells until `seam-response-rungraph-followup.md` lands; breaker cells until `seam-response-loop-breaker.md` lands; and full escalation/recovery cells until `seam-response-loop-followup.md` lands |
| P13-NF-44 | live | Codex rollout/pane fixtures, fake events, a test-only provider, or one model doorway's result earn production governed activation | Each compatible registered model doorway executes independently with the real Codex artifact on named hardware. Route-bound conformance identity and admission are non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`. Production grounding-consumption cells are non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. Provider preparation/receipt cells are non-executable until `seam-response-judgment.md` lands; provider/harness effect cells until `seam-response-effects-followup.md` lands; exact-call `approval-prompt-response` cells until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land; typed payload cells until `seam-response-effects-payloads.md` lands; runtime-pin cells until `seam-response-assembly-followup.md` lands; continuity-record cells until `seam-response-run-closure.md` lands; compaction/child cells until `seam-response-rungraph-followup.md` lands; breaker cells until `seam-response-loop-breaker.md` lands; and full escalation/recovery cells until `seam-response-loop-followup.md` lands |
| P13-NF-45 | parity | Future runtime is marked compatible from command-line interface shape, vendor family, or a different registered model doorway's pass | Every compatible complete tuple executes the unchanged full suite; incompatible combinations and limitations are recorded as unsupported. Route-bound conformance identity is non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`. Route-pin cells are non-executable until `seam-response-judgment.md` lands. Runtime-map cells are non-executable until `seam-response-assembly-followup.md` lands |
| P13-NF-46 | regression | A named 1.x incident returns through process-local custody, pane authority, blind retry, quiet-wait/pipeline interruption, caller-class collapse, swap thrash, blanket permission-prompt approval, silent prompt wedging, or an unconditional recovery-swap exemption | Each incident trace reaches the 2.0 owner and its distinct safe outcome: exact allow-once prompts clear without wider authority, unverifiable prompts stay owned and loud, genuinely wedged recovery can receive an admitted exact replacement, and healthy/indeterminate busy recovery cannot be killed by caller label or timer. The `approval-prompt-response` positive is non-executable until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land |
| P13-NF-47 | wiring/load | Null/no-op holder, test-only boot/provider, direct provider-client-library bypass, unbounded poll/capture/queue/loop, age-based evidence deletion, or ordinary worker uses reserve | Route-specific conformance consumption is non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`. The grounding-consumption binding is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. Provider preparation/receipt is non-executable until `seam-response-judgment.md` lands. Provider effect execution is non-executable until `seam-response-effects-followup.md` lands. Exact-call `approval-prompt-response` wiring is non-executable until the dated 07:10Z addenda in `seam-response-effects-followup.md` and `seam-response-assembly-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 41, land. Breaker state is non-executable until `seam-response-loop-breaker.md` lands. Full loop/recovery is non-executable until `seam-response-loop-followup.md` lands. Minimal-plane composition is non-executable until `part-eleven-seam-response-assembly.md` lands. Then production bindings delegate to real doors and finite limits hold on named hardware |
| P13-NF-48 | activation | Declared fixture, estimate, successful-only sample, stale review, route-agnostic conformance record, or incomplete tuple marks a family governed | Seven's route-resolution arm is non-executable until `seam-response-judgment.md` lands. Route-bound identity and activation are separately non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`; then complete check-run evidence bound through owner-resolved references to the exact package/artifact, registered model doorway/route, platform, capability mode, generation, and independent review precedes new assembly admission; two routes sharing artifact/platform/mode remain independently activatable and incompatible tuples remain enumerated unsupported |

---

## 13. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 59, 68, 69 and 115; **checks:
P13-NF-01/07/24/35/42/43/44/45/48**.

| Duty | Disposition |
|---|---|
| A session is a worker for Part Five durable work | **Held as an ordered contract, with Five/Eight prerequisites:** identity, grounding, output, exit, and replacement retain the run/step owners. Production grounding consumption is non-executable until the dated 06:33Z addendum in `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 38, lands. The real launch and delivery effect-positive arms of P13-NF-14–20 are non-executable until `seam-response-effects-payloads.md` and `seam-response-effects-followup.md` land. |
| Claude Code and Codex can become real 2.0 workers | **Held by a conditional contract:** exact adapter mappings and live tuple gates P13-NF-43/44; unsupported evidence cannot be waived, and this document claims no current artifact has passed |
| Gemini, Grok, and later runtimes have a stable entry shape | **Held:** package/declaration/assembly route plus unchanged shared suite P13-NF-08/45 |
| Live inbound survives cuts and reaches the actual context boundary honestly | **Held for custody and evidence semantics; prerequisite for delivery execution:** stage separation, exact incarnation and cut outcomes are fixed by P13-NF-19–24. Actual delivery is non-executable until `seam-response-effects-payloads.md` and `seam-response-effects-followup.md` land. |
| Resume and compaction preserve durable work and the last inbound | **Held for reconnect/replacement; prerequisites split by owner grant:** process-lifetime incarnation, current authority and fresh grounding are P13-NF-25/28. P13-NF-27 is non-executable until `seam-response-run-closure.md` lands; P13-NF-26 is non-executable until `seam-response-rungraph-followup.md` lands. |
| Liveness, turn completion, model pins, account, and quota are honest | **Held for observation semantics; prerequisite for pins:** no pane authority and unknown quota are fixed. Route positives are non-executable until `seam-response-judgment.md` lands; runtime configuration and capability-report positives are non-executable until `seam-response-assembly-followup.md` lands. |
| Kill and recovery use Part Six leases and loops | **Partial:** registered effects, current fences, bounded observation, original-operation recovery and no blind repeat are required now. Breaker positives are non-executable until `seam-response-loop-breaker.md` lands; full escalation/recovery is non-executable until `seam-response-loop-followup.md` lands; actual retry is additionally non-executable until `seam-response-effects-followup.md` lands. |
| A live ordinary session cannot take down Rule 15 reachability | **Held for reserve separation, with explicit production prerequisites:** P13-NF-42/47 minimal-plane execution is non-executable until `part-eleven-seam-response-assembly.md` lands. P13-NF-41 child recovery is non-executable until `seam-response-rungraph-followup.md` lands. |
| Harness parity is measured without lowest-common-denominator claims | **Held as a conditional contract:** one suite, complete package/artifact/model-doorway/platform/mode subjects, explicit unsupported cells, three tiers, and activation evidence P13-NF-07/43–45/48. Every compatible registered doorway executes independently. Seven's route-resolution arm is non-executable until `seam-response-judgment.md` lands. The route-bound result identity and activation consumer are separately non-executable until Part Ten grants and lands `design-harness-adapters-seam-request-part-ten-conformance-route.md`; no tuple can pass governed mode while that or another required owner seam is absent. |

---

## 14. Operator decisions and honest limits

**Value — confined advisory boundary.** When an exact Claude Code or Codex artifact cannot expose
model-context consumption but still confines every provider, tool, MCP, connector, shell,
filesystem, message, credential, and other effect path through the applicable public doors,
should that tuple remain available as an advisory worker or be disabled entirely? Options are
confined advisory-only with prominent grounding limitations, or disabled. **Recommendation:
confined advisory-only**, because it preserves useful human-directed work without borrowing the
grounded governed-worker claim. A tuple that cannot confine an applicable effect path is already
unsupported under Parts Eight and Ten and is not an operator option in this part.

**Value — supported account-change posture.** Should account changes prefer replacing the worker
at a grounded boundary, or permit a runtime's proven in-session account switch? Options are
replacement-by-default with a separately conformed in-session exception, or in-session-by-default.
**Recommendation: replacement-by-default**, because it makes credential, model, quota, and process
identity coincide at one observable boundary.

**Rule — activation scope and process driver are already settled.** Rules 30, 34, 49 and 115;
**checks: P13-NF-07/43/44/45/48**. Activation is mandatory per exact harness package and artifact
digest, registered model doorway and route, platform, and capability mode; one complete tuple never
activates its family or another doorway. The builder chooses tmux, another PTY
driver, a direct subprocess, or a structured protocol as an interchangeable package implementation
and proves the same contract. Neither item is an operator policy choice in this part.

**Value — diagnostic capture scope.** How much runtime content may the adapter preserve for
diagnosis when structured lifecycle evidence is already available? Options are content-minimized
structured events only, or those events plus bounded pane snapshots under the same access and
tombstone rules. **Recommendation: structured events only by default**, enabling pane snapshots
only for an exact incident class whose debugging value and privacy cost are reviewed.

**Value — routine-age removal requires an earlier-owner amendment.** Should the operator open a
separate amendment to Parts Two, Seven, Nine, and Ten to add a governed routine-age reason for
capture-byte removal? Options are no amendment, retaining existing bytes and refusing new affected
capture work at capacity, or a separately reviewed amendment that defines the reason, pins, delay,
tombstone, and evidence-unavailable consequences. **Recommendation: no amendment for initial
activation.** This document neither grants nor assumes routine-age deletion.

**Value — residual-limit acceptance.** For each exact mode, should the operator accept the stated
inability to prove model understanding, indefinite provider conversation preservation,
administrator non-interference, or absence of a later opaque charge? Options are accept that named
residual for the exact advisory/governed product scope, or keep the affected mode unsupported.
**Recommendation: keep the affected mode unsupported** until concrete evidence for its exact tuple
makes the named residual explicit enough for the operator to accept deliberately. Any acceptance
then applies only to that exact mode, never to a harness family.

**Value — honest limits.** No adapter can prove that a model understood supplied context, that a
provider will preserve a conversation forever, that an administrator cannot replace the runtime
or observer, or that an opaque vendor billing surface has no later charge. The design can prove
exact delivery boundaries, captured behavior, confinement within the tested host boundary, and
retained uncertainty. The operator decides whether those residual limits are acceptable for each
mode.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P13-NF-02/47/48** and the governed review process. This document claims no deployment,
runtime measurement, independent review convergence, or operator approval. Independent design
convergence and exact-content operator approval are the design gate that permits implementation.
After an implementation exists, executed three-tier, wiring, confinement, hostile-cut,
stall-matrix, resource, and live-hardware evidence for the exact Claude Code, Codex, or future
tuple, followed by the applicable runtime evidence review, are the separate activation gate. No
implementation may be called active or live before the second gate passes.

*Depends on: Parts One through Eleven, especially Part Five (`docs/09-the-run-graph.md`), Part Six (`docs/10-the-transport-and-leases.md`), Part Seven (`docs/11-the-judgment-doorway.md`), Part Ten (`docs/14-the-assembly.md`), and Part Eleven (`docs/15-the-operator-surfaces.md`).*
