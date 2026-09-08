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
estimate, configured value, or successful-only sample.

---

## 1. Ownership and boundaries

**Rule — part thirteen defines no new core type.** Rules 1, 30, 49, 69 and 115; **checks:
P13-NF-01/03**. The adapter family implements Part Ten's public contracts and consumes the types
below from their single owners. Package-local launch drivers, event decoders, and opaque runtime
handles are implementation details. They do not become facts, permissions, or alternate schemas.

| Owner | Names consumed here |
|---|---|
| One | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Result`, `Success`, `Refused`, `Measurement`, `Profile`, `Evidence`, `Decision`, `Authorization`, `Scope`, `ActionFloor`, `Outcome`, `SecretRef`, `Provenance`, `Conflict`, and `UnresolvedInput` |
| Two | fact envelope, causal frontier, durability state, capture reference, checkpoint, projection, correction, retraction, taint, and genesis replay |
| Three | declaration, governed port, register generation, generation record, profile, check-run record, rule graph, and honesty class |
| Four | intake port, conversation binding, event-id authority, operation classification, authorization request, operating standing, and session-start substrate |
| Five | `Run`, `RunStep`, `RunTransition`, `RunBudget`, `RunExit`, `DelegationContract`, `DelegationResult`, `AwaitingAuthorization`, `ExhaustionRecord`, `SessionGrounding`, `ContinuityAccounting`, `AgentTransportEnvelope`, `DeliveryEvidence`, and `AgentTransportPort` |
| Six | `Lease`, `FenceToken`, `AdmissionReservation`, operation identity, dispatch claim, spend reservation, `LoopPolicy`, `LoopRecord`, `RecoveryRecord`, `ThreadlineRoute`, and `ThreadlineReceipt` |
| Seven | `JudgmentRequest`, `JudgmentAttemptRecord`, `JudgmentResolution`, `AskRefinement`, `BenchmarkRecord`, `BenchmarkScenario`, `BenchmarkRunRecord`, `JudgmentHoldCost`, model route, and provider receipt |
| Eight | `OperationDefinition`, `EffectRequest`, `EffectValidation`, `OperationObservation`, `EffectSettlement`, `OutboundMessage`, and `OperationAdapterPort` |
| Nine | `VerificationPlan`, `VerificationRequest`, `VerificationAssessment`, `ProbeRecord`, `Grade`, `AssessmentClosure`, verification bar, and external protection broker |
| Ten | `AssemblyManifest`, `AssemblyAdmission`, `HarnessAdapterPort`, `HarnessLaunchSpec`, `HarnessObservation`, `AdapterEvidenceContract`, `AdapterConformance`, package lifecycle, isolation, and native-harness contract |
| Eleven | registered operator surfaces, minimal-plane projection roster and live session, verified approval interactions, and the first vertical slice |

**Rule — adapters are replaceable edges, not alternative owners.** Rules 1, 30, 63, 68 and
115; **checks: P13-NF-03/05/08**. Core services depend only on `HarnessAdapterPort`. The executable
assembly binds an exact adapter artifact and platform tuple. An adapter may translate a core
request into runtime-specific arguments, protocol messages, environment entries, and observations;
it may not reinterpret standing, mint authority, advance a run, settle an effect, choose a retry,
or hide a refusal. A harness-reported run, model, account, profile, or completion field is an
observation. Its consumer resolves the authoritative value from current signed facts.

**Value — terminal multiplexing remains optional.** A terminal multiplexer can preserve a TTY,
support an operator view, and carry bytes to a runtime that has no structured interactive input
port. Those conveniences do not make terminal state authoritative. A direct subprocess, local
socket, or future runtime protocol is equally eligible when it satisfies the same contract.

---

## 2. One adapter family and one conformance shape

**Rule — every harness implements the four-method port unchanged.** Rules 30, 59, 68, 84 and
115; **checks: P13-NF-03/04/06/07**. Each package implements `describe`, `launch`, `deliver`, and
`observe` exactly as Part Ten specifies. Process stop, close, model change, account change, and
compaction control are registered Part Eight operations. Reconnect and continuation ride Part
Six loops. Adding a runtime adds an adapter binding and conformance tuple, not a branch in Parts
Four through Nine. An absent capability is returned as unsupported with a stable reason. It is
never supplied by a family default or a different harness.

**Rule — supported mode is a conjunction of witnessed capabilities.** Rules 26, 34, 42, 59,
62 and 95; **checks: P13-NF-04/06/07**. `describe` reports the exact artifact digest, executable
identity, runtime and protocol versions, named platform, confinement mode, compatible input and
output modes, context-consumption witness, lifecycle witness, interruption operations, continuation
mechanism, hidden provider/tool-path posture, account and quota observability, and current
`AdapterConformance` references. Governed worker mode is supported only when every capability
required by the admitted work is both declared and proved for that exact tuple. A tuple missing
context consumption or effect confinement may serve an explicitly admitted advisory mode, but it
cannot be called a grounded governed worker.

**Rule — parity is one suite applied to every tuple.** Rules 30, 34, 37, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45/47**. One contract suite takes a `HarnessAdapterPort`, an exact
artifact/platform tuple, and only public core ports. It runs identical semantic cases for Claude
Code, Codex, and each later adapter. Harness-specific fixtures may provide protocol bytes and
expected runtime events, but may not weaken the assertion. Unsupported cases remain enumerated
and fail activation for modes that require them. A family label, shared base class, or mock passing
for one tuple does not establish parity for another.

**Rule — exact package binding prevents runtime impersonation.** Rules 5, 44, 69 and 90;
**checks: P13-NF-05/07**. The assembly resolves the declared executable to exact bytes and object
identity before launch. The launched process and observer bind back to that artifact, platform,
adapter declaration, and `AssemblyAdmission`. PATH lookup, mutable aliases, auto-update, wrapper
fallback, and a runtime that reports another runtime's name cannot silently change the binding.
Changed bytes require a new conformance result and assembly admission for the affected scope.

---

## 3. Capability, account, quota, and launch pins

**Rule — capability is a fresh observation, not a configured promise.** Rules 13, 26, 41, 62,
75 and 95; **checks: P13-NF-04/09/10**. The adapter reports whether the executable is running,
which admitted account identity it can actually use, which model/profile/thinking settings the
runtime accepted, and which provider quota windows it can observe. Each report names its source,
subject, artifact, machine, observed clock, freshness horizon, completeness limits, and capture or
receipt reference using existing `Measurement`, `HarnessObservation`, and conformance fields. A
file, process label, configured account slot, provider display name, or adapter self-report alone
is not authority. Missing, stale, partial, or permanently unavailable quota is `unknown`, never
zero, full headroom, or an inferred reset.

**Rule — consumers re-resolve every reported subject.** Rules 26, 28, 41, 49 and 69; **checks:
P13-NF-09/10/40**. Placement, admission, display, and recovery resolve current account, model,
profile, thinking setting, quota, grant, register generation, and artifact status from signed
history and the owning service. They compare that result with the adapter observation. A mismatch
inhibits the affected launch or next action and records the conflict. It never lets the adapter's
own `accountId`, model string, or `supported: true` field override the current record.

**Rule — model, profile, thinking, and account choices are exact launch subjects.** Rules 41,
56, 63, 75 and 96; **checks: P13-NF-11/12/13**. The admitted `Profile`, Seven-owned model route,
account selection, and allowed thinking mode are translated into the exact `HarnessLaunchSpec`
environment and context/input manifest fields already owned by Part Ten. The adapter records the
resolved runtime arguments, nonsecret environment digest, and runtime acceptance evidence. A raw
model string from input cannot reach the launcher. An unavailable pin refuses or follows an
explicitly admitted policy owned by the earlier part; the adapter never silently substitutes a
model, profile, thinking level, account, provider, billing lane, or runtime and keeps the old label.

**Rule — credentials remain references and custody stays outside the worker.** Rules 28, 36, 63
and 100; **checks: P13-NF-13/40**. `HarnessLaunchSpec` carries only `SecretRef` and approved
custodian handles where credentials are required. Adapter descriptions, arguments, environment
digests, observations, captures, errors, conformance fixtures, and operator views contain no
credential value. Account identity is proved by the provider or credential custodian at use. A
credential slot label does not prove who occupies it. A credential or account change is a new
admitted operation and, where the runtime reads credentials only at start, a replacement worker.

---

## 4. Launching a worker for durable work

**Rule — the run exists before its harness worker.** Rules 31, 63, 68, 69 and 96; **checks:
P13-NF-14/15/17**. Part Five first records the `Run`, pending `RunStep`, and required grounding.
Part Six admits the exact launch operation under a current `Lease`, `FenceToken`, and one-use
`AdmissionReservation`. Part Eight validates and dispatches that process operation. Only then may
the adapter call `launch`. The resulting `HarnessObservation` binds the run, step, launch,
machine, adapter artifact, process start identity, and fresh worker incarnation. A process id,
terminal name, provider conversation id, or resume token is never the durable run identity.

**Rule — launch success is narrow.** Rules 26, 62, 68 and 95; **checks: P13-NF-14/15/29/33**.
Launched means the exact admitted process incarnation produced fresh runtime evidence under the
expected artifact and working scope. It does not mean context was consumed, the worker is ready
for ordinary action, a model request began, useful progress occurred, or the run succeeded. An
uncertain spawn answer remains an unresolved launch attempt. Recovery observes that attempt before
requesting another launch. Process-id reuse, an old terminal, or a sibling runtime cannot satisfy
the observation.

**Rule — actual-start grounding precedes ordinary action.** Rules 47, 68, 96 and 110; **checks:
P13-NF-16/17/18/23**. After actual launch, Part Five takes the fresh history, clock, binding,
directive, register, pending-operation, child, and receipt read required by `SessionGrounding`.
The adapter delivers the exact context/input manifest and observes its actual model-context
boundary. Only a matching `context-consumed` observation makes grounding eligible. Until Part Five
records grounding, the worker may use only loading and observation paths. Its provider calls,
tools, messages, writes, and other ordinary effects remain blocked at the public doors.

**Rule — the working scope and hidden paths are confined before launch.** Rules 30, 41, 60, 63,
75 and 101; **checks: P13-NF-05/14/18/47**. The adapter realizes the exact work directory, file
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
and 110; **checks: P13-NF-25/26/27/28**. A new process or post-compaction action requires the current
lease/fence, a fresh worker incarnation, current signed history, current clock, current run graph,
pending effects, current directives and register generation, and a new context-consumption
observation. Runtime-restored history is supplemental input, not the grounding source. A stale,
missing, rejected, or ambiguous runtime handle cannot authorize fallback. Part Six recovery and
the assembly choose whether to attempt a fresh grounded replacement under an admitted policy.

**Rule — compaction preserves classes and discloses the seam.** Rules 47, 69 and 110; **checks:
P13-NF-26/27**. The adapter delivers the same required governing-context classes after compaction
as at initial start, subject to the current generation, and records the new consumption boundary.
Part Five owns `ContinuityAccounting` for the first reply: the pre-pause inbound, explicit
compaction disclosure, and `addressed`, `superseded`, or `pending` disposition. The adapter cannot
infer that the model remembered a message, suppress the disclosure, or declare substantive
adequacy from an output phrase.

**Rule — continuation never repeats an uncertain effect.** Rules 42, 55, 57, 63 and 68;
**checks: P13-NF-24/28/38/39**. On resume, the worker receives the exact pending attempt,
reservation, receipt, charge, and verification references from the run graph. The adapter observes
the original launch, delivery, provider call, tool, and outbound operations through their owners.
Neither a blank runtime transcript nor a missing process permits a new attempt. A new operation is
admitted only after Parts Six, Eight, and Nine establish the earlier operation's required closure.

---

## 7. Honest liveness, progress, and completion

**Rule — liveness, progress, and completion are different predicates.** Rules 26, 39, 59, 62
and 68; **checks: P13-NF-29/30/31/32/33**. Liveness requires fresh proof that the bound process
incarnation or runtime protocol endpoint is running. Progress requires a new correlated
harness-origin event, model attempt, admitted operation observation, output record, or other
registered evidence for the exact step. Turn completion requires a correlated harness lifecycle
event plus closure or explicit pending status for its streams and admitted child operations.
Run completion remains Part Five's accepted `RunTransition` and `RunExit`. No one predicate
substitutes for another.

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

**Rule — interruption and kill are admitted effects.** Rules 42, 55, 60, 63 and 68; **checks:
P13-NF-36/37/40**. Operator stop retains the earlier fast local path. Every other interrupt,
graceful close, descendant signal, process termination, or harness conversation mutation is a
registered Part Eight operation under Part Six's current lease, fence, one-use claim, resource
reservation, and bounded loop. The operation targets the exact process start identity and
incarnation at action time. It records principal, operator-initiated status, signal or protocol
action, response, and uncertainty. Generic runtime text such as “aborted by user” cannot attribute
an autonomous interruption to the operator.

**Rule — escalation is finite and policy-owned.** Rules 55, 59, 60 and 61; **checks:
P13-NF-35/37/47**. A supported adapter declares its available graceful request, protocol cancel,
targeted signal, hard termination, and quiescence evidence. Part Six's registered `LoopPolicy`
sets order, waits, attempt count, elapsed ceiling, resource cost, breaker, and exit test. The
adapter executes one admitted action and reports its observation. It cannot add retries, broaden a
target, send pane-wide control input, or turn an elapsed threshold into proof that the process or
provider stopped.

**Rule — recovery observes and adopts; it does not recreate history.** Rules 31, 42, 55, 63,
68 and 95; **checks: P13-NF-24/25/28/38/39**. A `RecoveryRecord` names the original run, step,
incarnation, operations, lease state, observations, and unresolved exposure. Recovery queries
those exact identities, accepts late evidence through Part Four, and lets the owners settle it. A
replacement launch receives a new incarnation and current fence only after exclusion or declared
uncertainty policy permits it. It preserves logical operation identity and never resends provider,
tool, filesystem, or outbound effects merely because the worker vanished.

**Rule — child work and the live-session minimal plane remain independent.** Rules 15, 59, 60,
68 and 114; **checks: P13-NF-41/42/47**. Visible delegated work uses Part Five child runs and Part
Six resource ownership. A runtime's opaque background agent or tool path is unsupported for
governed mode unless it can be identified, bounded, observed, stopped, and recovered through the
same doors. Ordinary harness workers cannot consume Eleven's reserved minimal-plane capacity or
credentials. Their crash, quota wall, compaction, or kill does not remove the minimal responder's
ability to preserve admitted input, state honest limitations, and execute independently admitted
stop and repair operations while its own exact prerequisites remain live.

---

## 9. Claude Code, Codex, and future runtime mappings

**Rule — the mapping is concrete without granting brand exceptions.** Rules 30, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45**. The rows below are required adapter responsibilities, not claims
that a current vendor build exposes each witness. Activation records the exact supported and
unsupported cells for the tested artifact. A runtime update re-runs affected cells.

| Concern | Claude Code adapter | Codex adapter | Gemini, Grok, or later adapter |
|---|---|---|---|
| Launch | Translate the admitted launch specification into an exact Claude Code process, environment, work scope, and confinement mode; bind actual process start and Claude conversation evidence | Translate the same specification into an exact Codex process, profile, sandbox, work scope, and confinement mode; bind actual process start and Codex thread evidence | Supply the same exact translation and binding without adding a core framework literal |
| Model/profile/thinking | Resolve only the Seven/Profile-owned pins into supported launch or admitted runtime-control fields; observe actual acceptance independently of configured state | Resolve only the same owned pins into supported Codex model, profile, and reasoning controls; observe actual acceptance | Declare every pin supported or unsupported for the exact artifact; never approximate a tier silently |
| Live inbound | PTY or protocol delivery may carry bytes, but a correlated harness-origin input event and model-context witness establish acceptance and consumption | The same rule applies even when a busy composer visually retains text or Enter timing varies | Define exact transport, queue semantics, event identity, and context witness before governed activation |
| Liveness | Fresh exact-incarnation process or runtime-protocol proof | Fresh exact-incarnation process or runtime-protocol proof | Same predicate and freshness contract |
| Progress and completion | Correlated lifecycle, model, tool, and output events; no prompt/footer or final phrase authority | Correlated lifecycle, model, tool, and output events; no composer/spinner or final phrase authority | Same semantic events; unsupported if only screen scraping exists |
| Continuation | Runtime conversation continuation is supplemental; new incarnation, current lease, fresh grounding, and context witness remain mandatory | Runtime thread continuation is supplemental under the same requirements | Opaque handles remain evidence only; fresh grounded replacement is the safe supported fallback when continuation is absent |
| Account and quota | Prove the account at use through the approved custodian/provider source; record real readable quota windows and unknown gaps | Prove the account at use and record provider-origin quota windows with their reported lengths rather than positional assumptions | Declare observable windows, freshness, and permanent absence; no usage surface means unknown |
| Stop and recovery | Execute only admitted exact-target process/protocol operations and report quiescence limits | Execute only admitted exact-target process/protocol operations and report quiescence limits | Same registered operation and Part Six loop contract |

**Rule — Claude Code activation requires real boundary evidence.** Rules 34, 41, 47, 59, 75
and 101; **checks: P13-NF-16/23/35/43**. The conformance run must show actual submitted context,
correlated lifecycle and output events, model/account evidence, hidden provider and tool mediation,
and every stall row under the exact Claude Code artifact. A hook firing proves only the event and
fields it authenticates. If provider submission, built-in tools, or context consumption cannot be
observed or confined, the tested mode remains advisory or unsupported rather than receiving a
Claude-specific waiver.

**Rule — Codex activation has the identical bar.** Rules 34, 41, 47, 59, 75 and 101; **checks:
P13-NF-16/23/35/44**. The conformance run must show actual submitted context, correlated lifecycle
and output events, model/profile/reasoning and account evidence, sandbox and hidden path
confinement, and every stall row under the exact Codex artifact. A rollout file, composer state,
or terminal render is accepted only for the precise observation its authenticated structure and
subject binding prove. Missing strong consumption or completion evidence keeps those capabilities
unsupported.

**Rule — a future adapter arrives through declarations and evidence.** Rules 30, 44, 49, 84
and 115; **checks: P13-NF-08/45**. The builder adds a registered package, exact assembly binding,
`AdapterEvidenceContract`, tuple-specific conformance record, stall matrix, and the shared suite's
captured/live evidence. No core switch statement, copied run state, new standing vocabulary,
unregistered provenance string, or generic “CLI-compatible” assertion is permitted. An adapter may
support fewer modes than Claude Code or Codex and remain honest; it may not report parity for a
case it cannot witness.

---

## 10. What Instar 1.x does today and what carries forward

**Value — source-audit scope.** The read-only audit used Instar 1.x source at commit
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`. It covered `SessionManager`,
`PendingInjectStore`, `ModelTierEscalation`, `ModelSwapService`, `CompactionSentinel`,
`SessionWatchdog`, `HelperWatchdog`, `SubscriptionPool`, `QuotaPoller`, `ProactiveSwapMonitor`,
`SwapAntiThrash`, `SwapWorkGate`, `AccountSwitcher`, and the incident notes in `CLAUDE.md`.
These observations describe that source tree only. They are not evidence for a 2.0 runtime.

**Rule — incident-earned behavior is preserved through core-owned mechanisms.** Rules 31, 42,
55, 59, 63 and 68; **checks: P13-NF-24/35/37/38/40/46**.

| 1.x behavior that must survive | Incident that earned it | 2.0 disposition |
|---|---|---|
| Initial input survives a server cut and any loss is loud | `PendingInjectStore` records the 2026-06-06 Codex boot window in which the TTY survived but the process-local pending inject vanished and the operator waited more than 50 minutes | Part Four/Five durable custody precedes Part Eight delivery; uncertainty remains pending and Part Six recovery observes the original operation |
| Recovery is deduplicated, verified, bounded, and cannot race a zombie kill | `CompactionSentinel` records three independent triggers, silent inject loss, and a 15-minute killer racing recovery; later guards also stopped interruption of long active turns | One `LoopRecord`/`RecoveryRecord` per incident, fresh structured evidence, current fence, and no kill while the owning recovery/execution remains admitted |
| Slow process probes do not freeze the server or turn timeout into death | `SessionWatchdog` records synchronous `ps` probes blocking health and restart; `SessionManager` later adds bounded asynchronous tri-state tmux probes | Bounded observation operations return unknown on probe failure; unknown cannot become process death or kill permission |
| Interruption escalates by exact target and carries attribution | `SessionWatchdog` records targeted descendant checks and the misleading Codex “aborted by user” text | Part Eight operations bind process start/incarnation and record the actual principal; Part Six owns finite escalation |
| Background helpers are covered instead of hiding behind an idle parent | `HelperWatchdog` exists because parent-session monitoring missed spawned helpers | Visible helpers become child runs and resources; opaque helpers block governed activation |
| Model identifiers are framework-specific, closed, and server-resolved | `ModelTierEscalation` records drift where a new framework was checked against Claude's model list; `ModelSwapService` added exact lookup, idle protection, cost admission, and independent confirmation | Seven/Profile owners select exact pins; the adapter translates them, and the shared suite covers every runtime tuple |
| Quota uses measured windows, preserves unknown, and never crosses frameworks | `QuotaPoller` records a live Codex weekly window arriving in the positional primary field; `SubscriptionPool` and `QuotaTracker` record unknown being mistaken for zero headroom | Provider-origin windows retain their reported duration and freshness; consumers re-resolve account/framework and preserve unknown |
| Account moves do not thrash or kill live work for optimization | `ProactiveSwapMonitor` records the 2026-06-09 untagged wall and the 2026-07-02 day of 36 swaps in eight waves that repeatedly killed six build helpers; `SwapAntiThrash` and `SwapWorkGate` added brakes | Account change is an admitted replacement/continuation under current facts, finite loops, fresh quota, dwell/resource policy, and explicit busy/unknown refusal |
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
accepted input, recovery, dedup key, dwell, or continuation obligation. No terminal phrase,
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
artifact/platform/mode remains declared until its complete suite executes, held until the owning
bars pass, and held-reviewed only after independent review at the exact generation. The switch
from advisory or observation-only to governed worker mode is a new `AssemblyAdmission`, never an
environment flag interpreted by the adapter.

**Rule — resource and timing evidence includes failures.** Rules 13, 39, 60, 61, 64 and 92;
**checks: P13-NF-09/22/29/35/37/47/48**. Conformance records named hardware, operating system,
runtime artifact, account class, workload, sample population, clocks, failures, timeouts,
distribution, memory, CPU, file descriptors, queue depth, input/output bytes, model tokens, money,
attempt count, observation lag, launch time, grounding time, turn latency, stop latency, and
recovery time. Each queue, poller, capture, loop, and retained observation has a finite size,
cadence, retention, and exhaustion outcome. A target or estimate is labelled as such and cannot
satisfy a measured gate. A timeout remains a timed-out sample rather than disappearing from the
population.

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
| P13-NF-04 | contract | `describe` claims support from configuration, family default, or stale conformance | Exact artifact/platform mode reports current capabilities, sources, gaps, and conformance refs |
| P13-NF-05 | security | PATH alias, wrapper, auto-update, or executable replacement changes the runtime after admission | Exact bytes/object identity match the admitted assembly and process observation |
| P13-NF-06 | lifecycle | Missing consumption, stop, or observation support silently falls back to another mode | Affected mode refuses with stable unsupported reason while a supported advisory mode remains explicit |
| P13-NF-07 | parity | Claude mock passes and is credited to Codex, or one platform result covers another | Same public suite records separate exact tuple results and limitations |
| P13-NF-08 | build | Adding Gemini/Grok requires a core runtime switch or copied run state | New declared adapter/package/binding passes unchanged port and suite |
| P13-NF-09 | observation | Missing/stale/partial quota becomes zero usage or full headroom | Fresh provider-origin window is measured; unavailable window remains unknown with freshness/source |
| P13-NF-10 | security | Adapter-reported account/model/profile overrides conflicting signed history | Consumer re-resolves current history, records conflict, and inhibits affected action |
| P13-NF-11 | integration | Raw inbound model string or unsupported thinking value reaches the CLI | Seven/Profile-owned exact pins translate to validated arguments and acceptance evidence |
| P13-NF-12 | integration | Requested model/account/runtime fails and adapter silently substitutes while retaining label | Explicit owning policy admits and labels a permitted alternative, or launch refuses |
| P13-NF-13 | security | Credential bytes appear in argv, environment capture, logs, fixture, error, or worker-readable store | `SecretRef`/custodian handle supplies use and only redacted identity evidence leaves custody |
| P13-NF-14 | e2e | Process launches without recorded run/step, current lease, reservation, effect validation, or exact scope | Production assembly launches one admitted worker through Parts Five, Six, Eight, and Ten |
| P13-NF-15 | fault | Reused PID, terminal name, or sibling process is accepted as the prior worker | Start identity plus fresh incarnation binds the exact process and rejects reuse |
| P13-NF-16 | integration | PTY echo or prompt disappearance is accepted as context consumption | Instrumented model-context boundary emits a correlated `context-consumed` observation |
| P13-NF-17 | lifecycle | Delayed/resumed start reuses intake-time history and clock | Fresh actual-start read covers current history, clock, graph, and context receipt |
| P13-NF-18 | security | Ungrounded worker invokes provider, tool, message, or file-write path | Loading/observation remains available while every ordinary public effect refuses |
| P13-NF-19 | fault | Server dies after accepting inbound but before or during live delivery and input disappears | Durable intake/step/operation remains pending and recovery resumes exact custody |
| P13-NF-20 | security | Delivery targets stale incarnation or cross-conversation worker | Current fence, exact launch/incarnation, intake identity, and digest accept the neighbor |
| P13-NF-21 | integration | PTY write, return-without-error, or echo is labelled consumed or completed | Exact observations retain accepted, consumed, output, and completed stages separately |
| P13-NF-22 | load | Busy runtime accumulates unbounded memory queue, overwrites a draft, or merges inputs | Bounded durable backpressure preserves each operation and ordered capable runtime accepts exact inputs |
| P13-NF-23 | live | Synthetic hook or screen scrape satisfies governed context delivery | Real exact-artifact context witness correlates input digest and model request on named hardware |
| P13-NF-24 | fault | Cut at every delivery boundary causes silent loss or blind duplicate | Original operation is observed, remains pending when unknown, and only closed evidence permits next action |
| P13-NF-25 | lifecycle | Resume creates a new run or inherits an old lease/grant | Same durable run resumes under new incarnation, current fence, and fresh grounding |
| P13-NF-26 | lifecycle | Post-compaction context omits a required governing class or claims obsolete byte parity | Current-generation required classes match and new consumption evidence is recorded |
| P13-NF-27 | integration | First post-compaction reply omits disclosure or pre-pause inbound disposition | Valid `ContinuityAccounting` binds disclosure, inbound, reply, and honest disposition |
| P13-NF-28 | fault | Missing/stale runtime handle authorizes blind fallback or effect replay | Grounded replacement is separately admitted after original observations and current history |
| P13-NF-29 | observation | Config file, process label, old heartbeat, pane, or probe timeout is called live/dead | Fresh exact-incarnation proof yields live; unreadable probe yields unknown |
| P13-NF-30 | semantic | Prompt, spinner, footer, model label, completion phrase, or terminal silence changes authoritative state | Same pane is available diagnostically while structured evidence alone drives state |
| P13-NF-31 | integration | Duplicate output, scrollback growth, or unrelated transcript write counts as step progress | New correlated event/operation/output for exact launch and step records progress once |
| P13-NF-32 | semantic | Final phrase, runtime success label, or process exit completes turn/run with pending children or stream | Correlated lifecycle evidence plus explicit pending closure reaches owners for acceptance |
| P13-NF-33 | lifecycle | Exit zero maps directly to successful `RunExit`, or missing process maps to clean exit | Exit observation preserves status/evidence/unknowns and Part Five alone accepts success |
| P13-NF-34 | fault | Partial, malformed, delayed, reordered, or duplicated output becomes a complete result | Ordered bounded capture records exact limitations and late evidence without promotion |
| P13-NF-35 | coverage | One enumerated silent-stop class lacks a source, detection limit, recovery, or positive/failing case | Full exact-tuple stall matrix executes and retains declared gaps |
| P13-NF-36 | security | Interrupt/kill targets by substring, stale PID, pane-wide control key, or expired fence | Exact process start/incarnation and current one-use claim admit one scoped operation |
| P13-NF-37 | fault | Stop loop retries forever, skips quiescence evidence, or treats elapsed wait as stopped | Registered finite loop executes bounded escalation and reports unresolved stop honestly |
| P13-NF-38 | recovery | Worker disappearance immediately relaunches and repeats original launch/delivery/effect | Recovery queries original identities, adopts late evidence, then conditionally admits replacement |
| P13-NF-39 | effect | Resumed worker repeats uncertain provider/tool/message operation under a new adapter attempt | Earlier non-occurrence/quiescence/charge settles before a fresh reservation and claim |
| P13-NF-40 | security | Account change writes credentials directly, crosses framework, or mutates live label without proof | Custodian-proved compatible account is admitted and the replacement/current runtime is re-observed |
| P13-NF-41 | lifecycle | Opaque runtime helper survives untracked or is killed as if no child work existed | Governed child run/resource is visible and recovered, or opaque-helper mode refuses |
| P13-NF-42 | load/e2e | Ordinary harness saturation, crash, quota wall, or kill consumes the reserved live-session responder | Production minimal plane preserves input and serves honest stop/repair while exact prerequisites remain |
| P13-NF-43 | live | Claude Code pane fixtures or fake hooks earn production governed activation | Real Claude artifact on named hardware proves context, confinement, lifecycle, stall, and stop cells |
| P13-NF-44 | live | Codex rollout/pane fixtures or fake events earn production governed activation | Real Codex artifact on named hardware proves context, confinement, lifecycle, stall, and stop cells |
| P13-NF-45 | parity | Future runtime is marked compatible from CLI shape or vendor family | Exact artifact supplies declarations, full shared suite, stall matrix, and recorded unsupported cells |
| P13-NF-46 | regression | A named 1.x incident returns through process-local custody, pane authority, blind retry, or swap thrash | Each incident trace reaches the 2.0 owner and required safe outcome |
| P13-NF-47 | wiring/load | Null/no-op holder, test-only boot, unbounded poll/capture/queue/loop, or ordinary worker uses reserve | Production bindings delegate to real doors and measured finite limits hold on named hardware |
| P13-NF-48 | activation | Declared fixture, estimate, successful-only sample, or stale review marks tuple governed | Complete check-run evidence at exact generation and independent review precede new assembly admission |

---

## 13. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 59, 68, 69 and 115; **checks:
P13-NF-01/07/24/35/42/43/44/45/48**.

| Duty | Disposition |
|---|---|
| A session is a worker for Part Five durable work | **Held:** launch, identity, grounding, input, output, exit, and replacement all retain the run and step owners; P13-NF-14–18/25/33 |
| Claude Code and Codex can become real 2.0 workers | **Held by a conditional contract:** exact adapter mappings and live tuple gates P13-NF-43/44; unsupported evidence cannot be waived, and this document claims no current artifact has passed |
| Gemini, Grok, and later runtimes have a stable entry shape | **Held:** package/declaration/assembly route plus unchanged shared suite P13-NF-08/45 |
| Live inbound survives cuts and reaches the actual context boundary honestly | **Held:** durable pre-delivery custody, stage separation, exact incarnation, consumption witness, and cut matrix P13-NF-19–24 |
| Resume and compaction preserve durable work and the last inbound | **Held:** current authority, fresh grounding, context-class parity, and `ContinuityAccounting` P13-NF-25–28 |
| Liveness, turn completion, model pins, account, and quota are honest | **Held:** fresh subject-bound observations, current-history re-resolution, no pane authority, and unknown quota P13-NF-09–13/29–34 |
| Kill and recovery use Part Six leases and loops | **Held:** registered effects, current fences, finite escalation, original-operation observation, and no blind repeat P13-NF-35–40 |
| A live ordinary session cannot take down Rule 15 reachability | **Held:** child/resource visibility and separate minimal-plane reserve P13-NF-41/42/47 |
| Harness parity is measured once without lowest-common-denominator claims | **Held:** one suite, exact tuple records, explicit unsupported cells, three tiers, and activation evidence P13-NF-07/43–45/48 |

---

## 14. Operator decisions and honest limits

**Value — governed-mode boundary.** Should opaque Claude Code or Codex modes remain available only
as advisory workers when the exact artifact cannot expose model-context consumption or mediate its
hidden provider/tool paths, or should they be disabled entirely? Options are advisory-only with
prominent limitations, or disabled. **Recommendation: advisory-only**, because it preserves useful
human-directed work without borrowing the governed-worker claim.

**Value — supported account-change posture.** Should account changes prefer replacing the worker
at a grounded boundary, or permit a runtime's proven in-session account switch? Options are
replacement-by-default with a separately conformed in-session exception, or in-session-by-default.
**Recommendation: replacement-by-default**, because it makes credential, model, quota, and process
identity coincide at one observable boundary.

**Value — activation breadth.** Should an adapter activate governed mode per exact artifact,
platform, and capability mode, or across all builds once one tuple passes? Options are tuple-scoped
activation, or family-wide activation. **Recommendation: tuple-scoped activation**, because vendor
updates and platform integrations can change the very evidence boundary the contract relies on.

**Value — terminal support.** Should the reference packages require tmux wherever a runtime is
interactive, or treat tmux as one replaceable PTY implementation? Options are required tmux, or a
replaceable PTY/process driver under identical evidence checks. **Recommendation: replaceable
driver**, while retaining the exact `=session:` target requirement for the tmux implementation.

**Value — evidence retention.** How long should harness event captures, opaque continuation
handles, and diagnostic pane snapshots remain available? Options are the shortest policy that
covers recovery and independent review, or a longer forensic window with greater privacy and
storage cost. **Recommendation: the shortest measured window that covers the longest admitted
recovery and review horizon**, with pane snapshots shorter than structured, content-minimized
observations.

**Value — honest limits.** No adapter can prove that a model understood supplied context, that a
provider will preserve a conversation forever, that an administrator cannot replace the runtime
or observer, or that an opaque vendor billing surface has no later charge. The design can prove
exact delivery boundaries, captured behavior, confinement within the tested host boundary, and
retained uncertainty. The operator decides whether those residual limits are acceptable for each
mode.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P13-NF-02/47/48** and the governed review process. This document claims no deployment,
runtime measurement, independent review convergence, or operator approval. Implementation becomes
eligible only after the exact Claude Code, Codex, or future tuple has real three-tier, wiring,
confinement, hostile-cut, stall-matrix, resource, and live-hardware evidence, followed by the
required independent desk review and exact-content operator approval.

*Depends on: Parts One through Eleven, especially Part Five (`docs/09-the-run-graph.md`), Part Six (`docs/10-the-transport-and-leases.md`), Part Seven (`docs/11-the-judgment-doorway.md`), Part Ten (`docs/14-the-assembly.md`), and Part Eleven (`docs/15-the-operator-surfaces.md`).*
