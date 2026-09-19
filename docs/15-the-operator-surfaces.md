**Status: draft, awaiting approval. Governed.**

# Part eleven — operator surfaces and the first vertical slice

**Value — purpose.** The operator should meet authority at a clear, small edge: see what is being
asked, understand what one action will confer, approve or decline from a phone, and receive an
honest result. This part makes that edge and proves the narrow system behind it works as one
recoverable whole. No automatic check proves that a surface feels calm or that its wording is
wise; rule 80's independent review holds that judgment.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91 and 113; **checks:
P11-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every claim belongs to its nearest
Rule or Value block. This part makes no claim about Instar 1.x today. A design check is not runtime
evidence; measured means a recorded execution on named hardware and workload, never a configured
target or estimate.

---

## 1. Ownership and boundaries

**Rule — part eleven defines no new core type.** Rules 1, 30, 49, 69 and 90; **checks:
P11-NF-01/03**. The operator surfaces are consumers and producers of types owned by earlier parts.
They do not create a second authorization, binding, delivery, verification, projection, or
session-liveness schema.

| Owner | Names consumed here |
|---|---|
| One | `Authorization`, `StandingGrant`, `Revocation`, `VerifiedPrincipal`, `Directive`, `Intent`, `Decision`, `Result`, `Outcome`, `Evidence`, `Measurement`, `Conflict`, provenance and scope values |
| Two | fact envelope, causal frontier, durability state, capture reference, projection, checkpoint, folded-through vector, taint and genesis replay |
| Three | declarations, register generation, profiles, governed ports, rule graph and check-run records |
| Four | intake port, conversation binding, operation classification, authorization request and session-start evidence |
| Five | durable run, awaiting authorization, grounding, continuity accounting, transport envelope and delivery evidence |
| Six | lease, fence, bounded loop, recovery and transport receipts |
| Seven | judgment request/resolution, benchmark record and measured hold cost |
| Eight | effect operation, outbound message, dispatch, settlement and verification obligation |
| Nine | verification plan/request/assessment, probe and grade records, guard posture and external protection broker |
| Ten | concrete adapters, executable assembly, isolation and native harness contracts |

**Value — boundary choice.** Nine owns the reference monitor outside the monitored agent. Eleven
claims the human surface that supplies its verified act and displays its independently witnessed
result. Ten realizes the process and storage separation. This split prevents the screen that asks
for approval from also deciding that its own approval path is protected.

---

## 2. One operator surface family

**Rule — authority completes only on a registered verified surface.** Rules 28, 79, 82, 89, 98,
104 and 106; **checks: P11-NF-04–09**. Every operator action that can grant, revoke, waive,
re-bind, change protected content, or authorize an irreversible operation is presented by a
registered surface adapter and returns through part four's intake port as a verified act. Chat may
request and link to the action; channel attestation cannot complete it. The action uses part one's
existing `Authorization`, `StandingGrant`, or `Revocation` shape and names the exact request,
principal, scope, action set, artifact/base digests, expiry where the owning type permits one, and
current register generation.

**Rule — the operator approves, never authors.** Rules 79 and 82; **checks: P11-NF-05/06**. The
surface is rendered from the durable authorization request. It places the primary approve and
decline actions first, explains the effect in plain language, quotes requester prose only inside a
visibly untrusted region, and does not expose a free-form grant editor. A standing-grant candidate
appears only when part four's recurrence evidence exists and can select only the exact subset and
term derived there. The phone contract covers reading, step-up authentication, approving,
declining, binding, transferring, revoking, emergency stop, and viewing the receipt without a
terminal or desktop-only detour.

**Rule — explicit yes binds one immutable subject.** Rules 82, 94, 98, 101 and 109; **checks:
P11-NF-07–11**. The final confirmation repeats the action, affected subject, scope, audience,
cost/irreversibility class, current base and expiry. Its challenge is unpredictable, single-use,
short-lived, audience-bound, and signed or PIN-gated by an independently administered verifier.
The returned act binds the exact request digest. Replayed proof, moved base, altered rendering,
changed scope, expired challenge, wrong operator or channel-attested confirmation refuses. Silence,
page view, link click, biometric unlock alone, and a successful chat reply are never yes.

**Rule — verifier selection and verifier readiness are separate.** Owner: Eleven for the
surface verdict, Nine for the independently administered service and evidence, and Ten for the
installed selection. **Checks: P11-NF-07–13**. The installed selection names the exact service,
administrative domain, trust reference, surface and generation, but confers no readiness. The
surface becomes ready only when current Nine evidence also binds its clock, `issue` and `verify`
operations, one-use challenge, expiry and replay protection to that subject. A selection string,
installer assertion, empty probe list or agent-administered service refuses. The positive
neighbor joins the same selection to a current independently signed challenge execution and live
probe evidence. A prepared selection remains useful while the readiness hold stays visible.

**Rule — the surface cannot certify itself.** Rules 26, 82 and 98; **checks: P11-NF-10–13**.
Part nine's external protection broker verifies the authorization with pinned decoders and current
authority, then journals and applies protected changes. The surface displays broker receipt,
effective policy, the latest forbidden-write/load-path probe result, effective loaded
digest/version, independent witness freshness, and any uncertainty separately. A protected label
requires every item current for the exact artifact class plus part ten's live isolation proof;
missing or stale evidence renders that class explicitly `unprotected`, never merely degraded or
implicitly safe. If the broker or its witness is unavailable, protected mutation stays closed;
the request, decline, emergency stop, read-only evidence, repair path and honest status remain
reachable. A green client toast, HTTP 2xx, merge event, repository rule, or the agent's own report
cannot stand in for the broker's independently authenticated receipt and effective-path witness.

**Rule — authorization waits drain without becoming consent.** Rules 46, 52, 87, 88 and 98;
**checks: P11-NF-14/15**. Pending requests are a pull-first bounded list ordered by consequence and
age. Required notifications coalesce into the existing alert destination. Each row exposes
requester, system-derived action, scope, evidence freshness, expiry, blocked work and recurrence;
it reaches approved, declined, superseded, expired, withdrawn, conflict, or still-pending without
any timer-to-yes transition. The original requester receives an attributable receipt for each
terminal disposition through eight's message operation.

---

## 3. The full conversation-binding surface

**Rule — a conversation's first sender never self-binds.** Rules 28, 98 and 104; **checks:
P11-NF-16/17**. The binding surface starts from either a genesis grant already naming the
operator's authenticated platform identity or a verified pairing action outside the conversation.
An unbound conversation remains requester-level indefinitely. Its first message can create a
pairing request, but neither its content, sender order, display name, possession of the chat, nor
the agent's recognition can create operator standing.

**Rule — every binding action exposes the complete subject.** **Checks: P11-NF-17–21**. Before a
verified act, the surface shows authenticated platform, stable conversation identity, stable
operator identity, proposed scope, current binding or explicitly unbound state, provenance class,
and the exact grant or revocation that will be appended. Pair, pre-bind, transfer, narrow, widen,
revoke, and inspect are distinct registered actions. Transfer is supersession, never an edit.
Narrowing, widening and moving to a new platform identity each require a fresh verified act.

**Rule — conflicts freeze authority, not the brake.** Rules 14, 28, 77 and 95; **checks:
P11-NF-20/22**. Concurrent incompatible binding facts produce part two's `Conflict`; no newly
claimed operator standing is usable until resolution. The surface presents both causally valid
claims and their provenance and asks the independently verified operator to resolve them with a
new superseding fact. A previously bound operator's emergency stop and the independent verified
stop remain live during the conflict. No timestamp, machine majority, latest arrival, or UI choice
made before verification silently chooses a winner.

**Rule — identity churn invalidates selection.** Rules 28, 32 and 89; **checks:
P11-NF-19/23**. When an adapter reports that the platform identity evidence no longer has its
declared stability, the binding surface marks the binding stale and requires re-verification.
Messages under the changed identity cannot exercise operator standing. Revocation and repair stay
available from the independent surface. The surface shows the transport-wide count of bindings
whose selection depends on the affected credential so the compromise blast radius is visible,
without exposing other conversations to the requester.

**Value — minimal gestures.** Pairing uses a short-lived code or signed link followed by a clear
confirmation on the verified surface. The constitution does not require either gesture. The
implementation may choose one only after its capture, phishing, forwarding, accessibility and
mobile tests pass the same binding contract.

---

## 4. The minimal plane and its projections

**Rule — the minimal plane is enumerated.** Rules 7, 14, 15, 32, 33, 43 and 69; **checks:
P11-NF-24–28**. The plane contains only the facts and disposable projections needed to authenticate
and preserve intake, resolve a current conversation binding, expose pending work and authority,
receive an emergency stop, render diagnosis, perform bounded repair, send an attributable reply,
and prove its delivery. Its projections are:

| Projection | Source facts and admitted use |
|---|---|
| Intake ledger | preserved intake, dedup and admission facts; proves receipt and pending/drained state |
| Principal and binding view | grants, revocations, identity evidence and conflicts; resolves requester/operator selection |
| Minimal run view | open minimal-plane assignments, blockers, stop and recovery facts; schedules only communication/repair work |
| Outbound obligation view | outbound operation, settlement and delivery evidence; proves pending/sent/uncertain/verified without inventing success |
| Authority queue view | authorization requests and dispositions; renders operator work but confers no authority |
| Guard and repair view | required holder observations, source availability and owned repair obligations; labels what is safe and stale |

Each fold declares every admitted fact kind as consumed or ignored, reads only the spine and pinned
register generation, carries folded-through vector and known-lineage horizon, and produces
canonical bytes. No projection is authority; stale or missing views rebuild from facts.

**Rule — genesis replay time is a measured admission bound.** Rules 13, 15, 39, 43 and 64;
**checks: P11-NF-27–31**. Before a release is eligible, the assembly deletes every minimal-plane
projection and checkpoint, replays from genesis on each supported deployment class, and records
hardware/storage profile, fact and byte counts, lineage count, register generation, cold/warm
cache state, start/end monotonic readings, peak memory, result digest and failures. The measured
bound is the maximum successful wall duration and peak memory across the release's declared
workload matrix, plus an explicit finite admission margin. A configured target, percentile,
single warm run, extrapolation, or estimate cannot populate it.

The release declares a finite startup budget per deployment class. If any measured sample exceeds
that budget, diverges in bytes, omits a lineage, or fails, the release cannot claim the minimal
plane boot-rebuild bound. Optimization may add checkpoints, but the genesis measurement remains a
release gate and checkpoint rebuild must byte-match it at the same vector. The document contains
no fabricated number before an implementation produces one.

**Rule — projection failure is scoped.** Rules 14, 15, 42, 77 and 95; **checks:
P11-NF-25/28/32**. A corrupt or over-budget projection is quarantined and rebuilt while its source
facts remain intact. Authority-changing operations close on unknown/stale state. Independently
authenticated intake, emergency stop, a clearly limited response, and bounded repair remain
reachable through the smallest healthy path. If fact integrity or identity for the minimal plane
itself cannot be established, the surface says that plainly and exposes the independently
administered recovery path; it never paints cached green.

---

## 5. Rule 15 while a session is live

**Rule — an authenticated user reaches a bounded responder while the minimal path is admitted.**
Rules 14, 15, 46, 52, 64, 77 and 95; **checks: P11-NF-33–38**. Every authenticated message reaching
an admitted intake is preserved. It receives, within the deployment's measured live-response
bound, either the requested attributable response or an attributable limited response naming what
is pending, blocked or uncertain and what owned repair is active **only while the dependencies in
the next paragraph remain admitted**. Loss of that path is a measured outage with preserved work,
not a promise that reserved capacity can replace missing authority or durability.

The minimal responder's authority domain is one registered minimal-plane run under its own current
system-principal grant, a current conversation binding, and six's current exclusive lease/fence;
it has no authority over the ordinary run it reports on. Its required source dependencies are the
verified local-durable minimal fact segment, current register/decoder generation, identity keys and
clock. Its required transport dependency is the admitted conversation adapter and route capable of
accepting intake and independently evidencing the delivery stage it declares. Its response uses
eight's ordinary message operation and that operation's approved durability demand. The reference
default is **replicated(1)**: local preparation is not dispatch permission until one required peer
acknowledges the exact facts. The purpose's single-machine proposal, if the operator accepts it
through this pull request, permits
only an explicitly listed `local-durable` operation with its complete causal prefix and current
P-08 loss policy. It never creates `replicated(0)` or an automatic fallback after peer loss. The
responder has a reserved finite worker, local storage, queue, transport and effect budget independent of ordinary
workloads, but that reserve cannot manufacture a peer acknowledgment, current binding, lease,
fence, key, route or decisive effect evidence. Loss of an ordinary model, benchmark, projection,
run owner or business-effect dependency leaves the minimal path eligible for a limited response;
loss of a required dependency named here does not.

**Rule — the minimal dependency verdict consumes the exact operation policy.** Owner: Eleven
for the verdict, Eight for the operation demand, Two for durability evidence, and Ten for the
installed join. **Checks: P11-NF-33–38**. The predicate requires `replication-peer` for every
`replicated(1)` operation and requires the exact current local-loss policy plus local receipt for
every approved `local-durable` operation. A missing or stale policy, partial causal closure,
unlisted operation, or caller-supplied omission refuses. Positive neighbors are a real peer
receipt for the reference mode and a complete local receipt for an explicitly approved local-loss
operation. Every other minimal dependency remains unchanged.

**Rule — always-reachable never means always-powerful.** Rules 28, 42, 63, 86 and 95; **checks:
P11-NF-34/36/39**. The minimal responder may preserve, authenticate, explain recorded state,
accept a directive for later owned work, execute the emergency stop, and perform registered
bounded repairs under its own current grant. It cannot borrow stale conversation ownership,
manufacture a judgment, authorize the blocked run, or report an effect complete without evidence.
When safe attribution itself is unavailable, it preserves the input and returns only through the
independent recovery surface; it does not speak as the agent on guessed identity.

**Rule — live reachability is measured under declared cuts.** Rules 13, 15, 37, 60, 62 and 64;
**checks: P11-NF-35–38**. One fault class saturates ordinary workers and queues, kills the ordinary
conversation worker, makes ordinary model/business-effect dependencies unavailable and corrupts
each non-source projection while retaining every minimal-path prerequisite above; messages must
still receive the bounded honest response. A second fault class removes each required minimal
dependency, including the replication peer, lease authority and route, and requires preserved
input, an owned outage/repair obligation, retained maximum exposure, zero replay under a fresh
identity, and recovery once that exact prerequisite returns—never an impossible response during
its absence. The workload records receipt-to-preservation, receipt-to-first-honest-response when
eligible, stop-to-halt when its authority path exists, outage interval, queue age, reserved resource
use and lost/duplicate replies. The finite bound applies only to samples whose declared minimal
prerequisites held. Any lost accepted input, false answer, unbounded queue, replay, or exceeded
budget fails admission; dependency downtime is reported separately and cannot be omitted from
availability evidence.

**Value — a narrow voice is better than a counterfeit full one.** The constitution requires
reachability and truth, not conversational elegance during failure. A limited responder should be
brief and concrete. Independent semantic review judges whether its language remains useful and
does not imply authority it lacks.

---

## 6. Behavioral seams and shared failure traces

**Rule — every cross-part interaction has one record and a closure owner.** Rules 33, 42, 45,
63, 69, 95 and 113; **checks: P11-NF-40/41**.

| Seam | Producer | Consumer | Authoritative record | Transition order | Fail direction | Closure owner |
|---|---|---|---|---|---|---|
| Authorization completion | Four's request | Eleven surface; four/eight/nine validate | Exact request digest and existing authorization/decline fact; broker journal for protected change | render → verified act through intake → current exact validation → effect/broker → receipt | authority closed; diagnosis, stop and preserved request open | Eleven interaction; four authority decode; eight effect; nine broker |
| Conversation binding | Genesis or verified operator act | Four standing resolution | Existing grant/revocation facts at causal frontier | inspect → verify → append → fold → receipt | no self-bind; conflict freezes new authority, not stop | Eleven surface act; four resolution; two conflict/replay |
| Minimal plane | Facts from source parts and ten assembly | Live responder and operator views | Spine at stated vector; projections disposable | verify/replay → compare → admit scope/dependencies → preserve → replicate(1) → serve/repair | mutation closed on stale; accepted intake preserved; response requires the declared minimal path | Eleven admission/live posture; source owners close their facts; ten wiring |
| Vertical slice | Four → five → seven → eight → nine | Ten assembly and acceptance harness | Causally linked facts plus independent delivery evidence | preserve/authenticate → run → judgment → response effect → verify → rebuild | affected effect closed; accepted input and owned repair remain live | each part its transition; eleven whole-slice verdict |

**Rule — four shared traces have one answer.** Rules 24, 26, 31, 33, 42, 63 and 68;
**checks: P11-NF-41/42**.

| Trace | Required result |
|---|---|
| Crash after effect, before record | The replacement queries the same admitted operation through nine's evidence contract. Missing proof remains uncertain and cannot authorize a fresh invocation. The surface shows uncertainty and owned repair. |
| Duplicate delivery | Same semantic identity and digest joins the existing operation and produces at most one consumed completion. Different digest is Conflict. A second receipt is evidence, not a second effect. |
| Cancellation racing completion | A causally prior stop prevents new admission. An already claimed effect may settle later and is reported without reviving the cancelled run or erasing cost. |
| Stale authority | Binding, authorization and protected effects recheck current grant/revocation, base, digest, generation and fence. Stale observations remain evidence only and cannot authorize. |

---

## 7. The first vertical slice

**Rule — one exact chain proves the narrow waist.** Rules 14, 15, 26, 28, 37, 41, 42, 46, 58,
62, 68, 75, 77, 89 and 95; **checks: P11-NF-43–49**. The acceptance fixture uses one real
authenticated conversation adapter and a pre-existing verified conversation binding. It preserves
one message, admits one durable run, makes one bounded model judgment through the registered
doorway, renders one attributable ordinary reply, admits and sends it through the effect doorway,
collects independent evidence for the adapter's declared delivery stage, grades the judgment when
the declared outcome becomes observable, and rebuilds every resulting projection from facts.

The fixture kills the worker after every durable boundary: after preservation, authentication and
standing resolution; after run creation; after grounding; after judgment request, reservation,
dispatch and recorded resolution; after outbound operation preparation, claim, external send and
settlement; after delivery evidence; and before each projection rebuild. Each restart begins from
the executable assembly's public boot path, not a test-only recovery helper. A deterministic kill
schedule enumerates every adjacent pair and records which cut actually fired.

**Within each execution**, reconstruction takes that execution's actual admitted facts at one
pinned vector and compares canonical projection bytes across a clean genesis rebuild, checkpoint
rebuild and every supported implementation. It preserves that execution's clock readings,
incarnations, recovery facts, attempts, costs and model output; it never normalizes real history to
look like the control. **Across the uninterrupted control and cut executions**, comparison uses a
semantic acceptance predicate: input preserved; logical intake, run, judgment and outbound
operation identities stable through takeover within that execution; every obligation in an allowed
terminal or owned-pending disposition; evidence truthful to its source and stage; exposure retained;
and at most one external application per semantic outbound identity. Reply content need not equal a
separate control execution's model output. Once one execution has durably prepared an immutable
outbound payload, recovery of that same execution must use its exact payload digest or refuse a
conflicting replacement.

**Rule — success and uncertainty are factual and bounded.** **Checks: P11-NF-45–50**. The positive
slice names an adapter whose stable semantic operation key survives takeover, whose query/receipt
can prove application or decisive non-occurrence, whose delayed executions have a declared finite
quiescence observation, and whose final charge becomes observable. Its replication peer, lease
authority, route, identity source and evidence service eventually recover within the fixture's
declared finite recovery window. Under those prerequisites, passing requires: one admitted
input; one durable run identity; one accepted judgment resolution with complete capture/meter
references; no action outside its floor; one attributable outbound operation; no more than one
externally observed reply for the semantic message identity; delivery proved only to the adapter's
declared stage; no open ownerless obligation; within-execution rebuild equality; the across-run
semantic predicate above; and recorded duration, memory, tokens, money, attempts and notification
counts inside declared finite bounds.

For a cut after model or send dispatch-claim where the adapter cannot provide decisive application,
non-occurrence, quiescence or final-charge evidence, the required result is not success: the same
logical operation remains owned and uncertain, its maximum execution and charge exposure remains
reserved, no new semantic key/provider/route is invoked, and every projection rebuild reproduces
that pending state. Later evidence may settle it through six/eight/nine's existing contract. A
permanently opaque adapter remains uncertain indefinitely. Refusal and uncertainty are required
neighbors, never failures coerced green or permission to weaken six's or eight's rules.

**Rule — the fixture uses the real assembly.** Rules 30, 37, 62, 69, 105 and 115; **checks:
P11-NF-43/49/51**. Part ten's executable assembly supplies real persistence, intake, run, lease,
judgment, effect, verification, surface and harness ports with non-null wiring evidence. Test
credentials and probe resources are isolated; a real platform witness observes delivery. A mock
provider may be a unit control but cannot satisfy the live slice. Unsupported adapter evidence is
reported as partial and cannot be promoted by the surface. Part ten must realize the minimal
authority domain and every named source/transport/effect dependency above, enforce replicated(1)
before reply dispatch, expose dependency admission and outage state, supply the adapter evidence
and eventual-recovery controls used by the positive slice, and prove the owned-uncertain/retained-
exposure/zero-replay outcome for opaque cuts. Eleven supplies these acceptance requirements; ten
must not invent weaker substitutes or a private recovery path.

**Value — the first slice is deliberately boring.** Its reply may be a harmless paraphrase or
classification whose outcome can be observed without a risky side effect. The value is proof of
durable attributable agency, not product breadth.

---

## 8. Non-functional checks and activation

**Rule — every bound names workload, subject and failure action.** Rules 13, 34, 39, 43, 55, 60,
64 and 75; **checks: P11-NF-27–38/45–51**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Genesis replay | delete views/checkpoints; cold/warm full replay over release corpus on each deployment class | measured maximum plus declared margin fits startup budget; divergence or overrun blocks admission |
| Live reachability | saturate ordinary resources; separately cut non-minimal and required minimal dependencies while sending authenticated messages/stops | bounded response while prerequisites hold; otherwise preserved owned outage with zero replay; availability and dependency downtime reported separately |
| Surface integrity | mutate rendering, digest, base, scope, identity, challenge and broker availability at each confirmation cut | zero unauthorized effective acts; protected mutation closes while diagnosis and stop stay live |
| Mobile completion | supported phone viewport, keyboard and assistive navigation through every operator action | every action completes without terminal/desktop; hidden or unreachable primary action fails |
| Delivery uniqueness | kill around send, lose receipt, duplicate callback and expire caches | one external semantic reply maximum; uncertainty never triggers a fresh identity |
| Resource ceiling | flood pending requests, binding attempts and slice runs at limit and limit-plus-one | finite queue/concurrency/byte/token/money caps hold; overflow coalesces or refuses with preserved input |
| Reconstruction | corrupt each disposable projection and replay equal vectors on two supported architectures | canonical bytes equal; missing lineage/taint or architecture-dependent fold fails |

**Rule — activation needs all three tiers and independent evidence.** Rules 34, 37, 62, 72, 73,
81 and 105; **checks: P11-NF-49–53**. Unit tests cover decoders and pure rendering; integration
tests exercise every public port with real persistence and fault cuts; live lifecycle tests use
the production initialization path, phone surface, authenticated channel and independent delivery
witness. Part nine records semantic surface review and live holder posture. No surface or minimal
plane is called live from screenshots, mocks, configured routes, self-report or a document lint.

---

## 9. Negative contract fixtures

**Rule — each negative has a realistic positive neighbor.** Rules 34, 36, 37 and 69;
**checks: P11-NF-01/53**.

| Fixture | Stage | Failure exposed; positive neighbor |
|---|---|---|
| P11-NF-01 | build | Missing ownership, duty, seam, trace or check; complete inventories resolve |
| P11-NF-02 | docs | Unlabelled claim, history marker or unsupported present-day claim; governed lint passes compliant text |
| P11-NF-03 | architecture | New core/approval/binding schema or private import; earlier owned types and public ports pass |
| P11-NF-04 | build | Authority-completing action has no registered surface/operation; enumerated entries resolve |
| P11-NF-05 | UI/e2e | Operator must author scope or use terminal/desktop; pre-filled phone flow completes |
| P11-NF-06 | rendering | Sender prose escapes untrusted region or candidate widens approval; fixed system frame passes |
| P11-NF-07 | security | Silence/view/click/chat attestation becomes yes; explicit verified act passes |
| P11-NF-08 | security | Wrong requester/operator/audience/scope/digest accepts; exact bound subject passes |
| P11-NF-09 | fault | Expired/replayed challenge or moved base accepts; fresh single-use challenge passes |
| P11-NF-10 | integration | Client success substitutes for broker receipt; independent admitted receipt passes |
| P11-NF-11 | race | Validation and mutation allow base/path swap; broker's atomic transaction passes |
| P11-NF-12 | isolation | Surface can rewrite verifier/policy/root; independently administered boundary passes |
| P11-NF-13 | fault | Broker outage paints green or silences stop/diagnosis; scoped closed mutation and live repair pass |
| P11-NF-14 | lifecycle | Pending wait ages into yes or disappears; explicit non-yes terminal drains |
| P11-NF-15 | load | Approval flood creates per-item pushes/unbounded queue; coalesced bounded pull view passes |
| P11-NF-16 | e2e | First sender becomes operator; unbound requester plus verified pairing passes |
| P11-NF-17 | security | Pairing code/chat ownership alone binds; independently verified exact act passes |
| P11-NF-18 | rendering | Binding omits stable identities/scope/current state; complete subject passes |
| P11-NF-19 | lifecycle | Platform identity churn retains operator selection; stale then reverified binding passes |
| P11-NF-20 | race | Concurrent rebinding chooses timestamp/majority; Conflict and verified supersession pass |
| P11-NF-21 | security | Transfer/widen/revoke edits state without fresh act; new causal fact passes |
| P11-NF-22 | e2e | Binding conflict disables prior-holder/independent stop; brake remains reachable |
| P11-NF-23 | privacy | Requester learns unrelated binding/blast-radius identities; bounded aggregate passes |
| P11-NF-24 | build | Minimal-plane projection or source is unenumerated; complete declaration passes |
| P11-NF-25 | rebuild | Projection reads another view or hides unknown lineage; spine-only fold exposes horizon |
| P11-NF-26 | architecture | Projection authorizes; current facts/decoder remain authority |
| P11-NF-27 | performance | Estimate/target/percentile labeled measured replay bound; complete sample record passes |
| P11-NF-28 | rebuild | Checkpoint differs from genesis at equal vector; canonical equality passes |
| P11-NF-29 | performance | Warm-only or one-size corpus claim; declared cold/warm deployment matrix passes |
| P11-NF-30 | fault | Failed/timeout sample omitted from bound; release admission fails honestly |
| P11-NF-31 | load | Replay memory/time exceeds finite budget unnoticed; measured defect blocks admission |
| P11-NF-32 | fault | Corrupt non-source view takes down all intake/stop; scoped rebuild path passes |
| P11-NF-33 | integration | Authenticated input lost while ordinary owner is dead; admitted minimal authority/path preserves and serves it |
| P11-NF-34 | security | Limited responder borrows stale authority or claims completion; honest narrow response passes |
| P11-NF-35 | load | Ordinary saturation consumes reachability reserve, or reserve is claimed to replace missing lease/peer/durability; separate finite reserve with explicit prerequisites passes |
| P11-NF-36 | fault | Non-minimal outage silences an admitted minimal path, or minimal-path outage promises a reply; limited response versus preserved owned outage follows the dependency split |
| P11-NF-37 | timing | Configured SLA, successful-only percentile or dependency downtime hidden in response bound; eligible worst sample plus margin and separate availability record pass |
| P11-NF-38 | lifecycle | Eligible message/stop misses bound, or ineligible path loses input/replays; scoped admission failure and owned recovery pass |
| P11-NF-39 | security | Unknown identity speaks as agent; preservation and independent recovery pass |
| P11-NF-40 | build | Seam misses producer/consumer/record/order/direction/owner; complete row passes |
| P11-NF-41 | integration | Shared seam implementations disagree on identity/order/closure; joint contract passes |
| P11-NF-42 | fault | Any shared trace retries, duplicates, revives or authorizes incorrectly; required trace result passes |
| P11-NF-43 | e2e | Slice uses test-only boot/private port/null adapter; production public assembly passes |
| P11-NF-44 | fault | Kill schedule skips an adjacent durable boundary; complete recorded schedule passes |
| P11-NF-45 | lifecycle | Rebuilds of one run diverge at equal vector, or separate runs are forced byte-identical; within-run equality plus across-run semantic predicate passes |
| P11-NF-46 | integration | Judgment exceeds floor or loses capture/meter reference; bounded complete record passes |
| P11-NF-47 | lifecycle | Relay ack labeled verified delivery; declared-stage independent witness passes |
| P11-NF-48 | rebuild | Open ownerless obligation, uncertain exposure or missing fact disappears from view; honest pending state with retained maximum charge/application exposure passes |
| P11-NF-49 | wiring/e2e | Any required port is null/no-op or bypassed; real delegation evidence passes |
| P11-NF-50 | accounting | Duration/memory/token/money/attempt count missing or beyond cap; complete bounded sample passes |
| P11-NF-51 | live | Mock/canned provider or synthetic delivery satisfies production slice; real bounded call/witness passes |
| P11-NF-52 | UI | Objective dashboard/mobile floor fails; activation remains blocked |
| P11-NF-53 | build | Declared fixture lacks executed check-run evidence; no held/live claim is emitted |

---

## 10. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 69 and 71; **checks:
P11-NF-01/53**.

| Duty | Disposition |
|---|---|
| 11.1 — projections and genesis replay time | **Held:** six projections are enumerated and P11-NF-27–31 require a measured release bound. No number exists before execution; that is honest measurement discipline, not a deferred estimate. |
| 11.2 — full conversation-binding surface | **Held:** pre-bind, pair, inspect, transfer, narrow, widen, revoke, churn and conflict resolution are covered by P11-NF-16–23; first sender never self-binds. |
| 11.3 — external reference monitor | **Held by the claimed split:** nine owns the external protection broker; eleven consumes it and owns verified human action/receipt surfaces; ten supplies isolation. P11-NF-10–13 refuse self-certification. |
| 11.4 — live-session half of rule 15 | **Held:** reserved bounded responder, honest limited authority and hostile-cut measurement P11-NF-33–39. Total loss of minimal-plane identity/fact integrity is the explicit recovery boundary, never falsely called reachable. |
| 11.5 — where authorizations complete and bindings establish | **Held:** registered independently verified phone surfaces; acts return through intake and are revalidated by the authority/effect/broker owners, P11-NF-04–23. |

---

## 11. Operator decisions and honest limits

**Value — external administration.** The proposed surface trusts part nine's independently
administered broker and verifier. The operator decides whether its separate OS/service identity,
recovery custody and loss-of-root procedure are acceptable. Without that separation the affected
surface must say unprotected.

**Value — authentication gesture.** A PIN-gated confirmation and a signed hardware-backed action
have different phishing, recovery and accessibility costs. No check chooses the right deployment
default. Whichever is selected must pass the identical subject-binding, replay and mobile tests.

**Value — published margins.** No check chooses how much safety margin to add to the worst measured
genesis replay and live-response samples. The operator approves deployment budgets and margins
after the raw distributions, failures and hardware profiles are visible; the measurements
themselves cannot be replaced by that approval.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P11-NF-49/53** and the governed review process. This draft claims no deployment, runtime
measurement, review convergence or operator approval. Implementation becomes eligible only after
the real three-tier, isolation, live-surface, hostile-cut and reconstruction evidence exists.
