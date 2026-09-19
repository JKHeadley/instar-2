# The fixed single-machine installation contract

**Value — purpose.** This profile defines the bounded contracts for one usable installation.
It does not define a general installer. It does not generate keys. It does not add a certification
system. It does not turn the eighteen production resolver names into eighteen new record bodies.
It selects one machine, one voter, one pre-bound Telegram conversation, one confined Native
worker, one admitted model route, the six-fold minimal plane, and one operator-administered
approval, clock, and observation host.

**Rule — reading convention and evidence discipline.** Owner: Ten for this assembly profile;
imported facts and behavior retain the owners named below. Predicate: P10-SI-01 passes only when
every installed value resolves through the named owner at one current register generation and
source vector. A missing, stale, conflicted, tainted, ambiguous, or wrong-owner value refuses the
dependent scope. Positive neighbor: the same package with exact owner-produced references and
current evidence is prepared, and activation proceeds only through each owner's existing gate.
This file specifies contracts. It is not installation authorization, runtime evidence, or a live
claim.

---

## 1. Ownership, placement, and the fixed scope

**Value — placement.** This file is a numbered companion section of Part Ten. The Part Twelve
layout establishes that a governed design may keep a short root and line-commentable numbered
sections. This profile is smaller than a whole adapter part, so one companion section is enough.
The Part Ten root remains the registered durable location. Its sibling changelog owns this file's
history. A new top-level part or a parallel assembly declaration would add governance surface
without adding an installation capability.

**Rule — imported owners remain authoritative.** Owner: Ten for selection and composition.
Predicate: P10-SI-02 rejects any installation body, producer, decoder, or consumer that redefines
an imported owner record. Positive neighbor: Four's `conversation-binding`, Six's `Lease` and
`AdmissionReservation`, Three's `GenerationRecord`, Two's durability receipts, and Nine's probe
and assessment records are referenced through their public decoders. The owner map is:

| Owner | Authority retained in this profile |
|---|---|
| One | principals, grants, scope, clock values, decisions, outcomes, evidence, and secret references |
| Two | admitted history, causal closure, durability receipts, machine-key history, conflicts, taint, and capture status |
| Three | declarations, the verified register, `GenerationRecord`, entering-force history, and governed body introduction |
| Four | verified-act intake, authenticated sender resolution, and `conversation-binding` |
| Five | run governance, actual-start grounding, answer consumption, and durable run state |
| Six | the one-voter authority, leases, assignment-derived fences, reservations, claims, accounting, and retained exposure |
| Seven | provider judgment requests, decoded answers, and output-use acceptance |
| Eight | per-operation durability demand, dispatch, observation, settlement, and no-repeat ownership |
| Nine | independent challenge, delivery and provider-evidence assessment, protection posture, probes, and freshness |
| Ten | manifest selection, installation references, assembly admission, confinement, custody, and lifecycle wiring |
| Eleven | operator surface, minimal-plane dependency verdict, limited voice, and whole-slice acceptance |
| Twelve | Telegram identity, route, capability, provider-acceptance limit, and delivery-stage evidence |

**Rule — the profile has one exact scope.** Owner: Ten, with operator standing verified through
One and Eleven. Predicate: P10-SI-03 accepts only one named machine identity, one Six voter, one
Native harness and model-route tuple, one Telegram bot/account/chat/topic route, one bound
operator principal, one reply-only audience, and the six named Eleven folds. It rejects a second
execution machine, voter, bot, conversation, provider tuple, platform, or protected-mutation
capability. A separately enrolled durability peer is permitted, and required whenever a selected
operation demands replication; it is not a second execution voter. Positive neighbors: the exact
approved local-only tuple and the same one-voter tuple with its required remote durability peer are
eligible for their own admission. A same-machine second process satisfies neither peer requirement.
A broader execution tuple remains not admitted in this scope.
Owner basis: `docs/00-the-purpose.md:99-122` preserves the default independently failing copy and
states the pending local-loss proposal; `docs/12-the-effect-doorway.md:241-263` gives Eight both
approved operation-demand arms; `docs/15-the-operator-surfaces.md:201-227` makes Eleven consume the
selected arm without adding an execution voter.

---

## 2. G1 — the local-loss proposal and the peer alternative

**Rule — every irreversible operation chooses one real durability demand.** Owner: Eight for
the operation demand, Two for receipts, and the operator for the deployment policy. Predicate:
P10-SI-04 permits dispatch only when the exact operation and its full causal closure satisfy one
of these two arms:

1. `replicated(1)` has an authenticated acknowledgment for the exact required prefix from an
   enrolled store on a second independently failing machine.
2. `local-durable` names a current, independently approved P-08 local-loss policy for this
   installation and operation, and the local durable prefix contains authorization, preparation,
   provider disclosure and maximum-charge reservation, reply preparation, observations, and all
   later settlement predecessors available at dispatch.

Missing policy, an operation absent from the policy, a partial causal prefix, a local second
process, or automatic fallback after peer loss refuses dispatch. Positive neighbors: an ordinary
replicated operation with its real peer receipt dispatches; an explicitly listed local-durable
operation with its complete local receipt and current policy dispatches. No arm or record is
named `replicated(0)`.

**Value — the proposed loss model in plain words.** If the operator accepts the local-durable
arm, permanent loss of this one machine can destroy the authority, work, captures, observations,
and accounting evidence needed to reconstruct a paid model call or Telegram send. No peer
survives that loss. An unknown earlier effect cannot safely be repeated from memory or from a new
installation. Losing the only voter, key, clock, route, or evidence path stops the dependent
scope. No failover or delivered outage notice is promised when the path needed to deliver it is
gone.

**Rule — absence of operator acceptance retains the peer.** Owner: Eleven for the dependency
verdict and Ten for composition. Predicate: P10-SI-05 requires `replication-peer` whenever the
purpose proposal is not approved, the installed local-loss policy is absent or stale, or any
selected operation still demands `replicated(1)`. Positive neighbor: a real enrolled peer on a
second machine with an authenticated exact-prefix receipt clears that dependency without adding
a second voter. If the proposal and exact policy are approved, only the listed local-durable
operations omit the peer dependency.

---

## 3. G2 and G3 — the closed record and bootstrap contract

**Rule — one selection body covers only missing installation selections.** Owner: Ten.
`InstallationSelection` version 1 is the sole new general selection body in this profile.
Predicate: P10-SI-06 accepts a selection only when its closed fields decode, its identity is
unique, and every referenced owner fact is admitted at the same installation, scope, machine,
and generation. A role with missing role-specific references, two unequal bodies with one id,
an unregistered implementation, or a self-asserted readiness claim refuses. Positive neighbor:
two distinct roles may select two declared implementations while sharing the same verified
installation and generation.

| Field | Required value |
|---|---|
| `type`, `schemaVersion` | `InstallationSelection`, `1` |
| `id` | Immutable digest identity over every field below |
| `installation`, `machine`, `scope` | Exact `ProductionInstallation` v1 id, machine identity, and manifest scope |
| `role` | One closed role from the role table below |
| `instance` | Stable role instance; the six folds and the two lifecycle controls each have distinct instances |
| `implementation` | Exact declared implementation or service id selected by the manifest |
| `owner` | Expected owner part from the closed role table; this label is checked against the referenced owner-produced declaration and is not owner evidence by itself |
| `generation` | Three's current entering-force register generation |
| `references` | Sorted, nonempty owner fact or declaration references required by that role |
| `validUntil` | Finite owner-comparable horizon when the selected reference is time-bound; otherwise explicit `not-time-bound` |

`InstallationSelection` selects. It does not certify health, independence, protection,
conformance, reservation, freshness, delivery, or activation. Those properties still require
their owner-produced current records.

The closed role list is the role literals in the eighteen-name table plus `scope-protection`.
The `scope-protection` instance references the operator-approved scope policy and names its exact
artifact classes and requirement, either `protected` or `unprotected-permitted`. Nine still owns
the observed posture and Ten still owns the admission join. An omitted role, free-form role or
policy value outside that two-value list refuses. The positive neighbors are the two exact arms
in P10-SI-14.

**Rule — the eighteen production names resolve without eighteen bodies.** Owner: Ten for the
audit and consumer; each referenced fact retains the owner in the table. Predicate: P10-SI-07
requires every applicable row to resolve exactly once. A direct-owner row rejects an
`InstallationSelection` lookalike. A selection row rejects a fabricated owner fact. A
not-applicable peer is legal only under P10-SI-04's local-durable arm. Positive neighbor: the
single-machine profile resolves the applicable seventeen rows with owner facts and selection
instances; the default replicated profile resolves all eighteen including a real Two receipt.

| Production name | Resolution in this profile | Body owner |
|---|---|---|
| `operator-surface-registration` | `InstallationSelection` role `operator-surface` references Eleven's registered surface declaration | Ten selects; Eleven owns the surface |
| `operator-challenge-verifier-binding` | role `challenge-verifier` references Nine's service declaration, administrative domain, and independently installed trust reference | Ten selects; Nine owns readiness |
| `intake-verified-act-binding` | role `verified-act-intake` references Four's public `admitVerifiedAct` declaration | Ten selects; Four owns admission |
| `minimal-plane-projection-binding` | six role `minimal-plane-fold` instances reference Eleven's fold ids and Two's fold declarations | Ten selects; Eleven/Two own semantics |
| `minimal-plane-replay-binding` | role `minimal-plane-replay` references Ten's source-only runner declaration and the admitted measurement matrix | Ten |
| `minimal-responder-binding` | role `minimal-responder` references Eleven's responder declaration, Five's minimal-run policy, and Six reservation facts | Ten selects; Eleven/Five/Six own behavior and authority |
| `assembly-lifecycle-control-binding` | roles `prerequisite-cut` and `prerequisite-recovery` reference executable Ten controls and their repair owner | Ten |
| `platform-delivery-witness-binding` | role `delivery-witness` references Nine's witness declaration and the exact Twelve platform/account/stage subject | Ten selects; Nine owns assessment |
| `fact-local-durable-segment` | role `fact-segment` selects the exact source prefix and Two's public `FactStorePort`; at use, consume its authentic `AppendReceipt` for every exact-prefix envelope with `durability.kind: local-durable`; no appendable receipt kind is invented | Ten selects; Two owns the port and receipt |
| `register-generation-record` | consume the `generation-record` envelope through Three's public `decodeGenerationRecord`; retain its Part Two `FactEnvelopeReference` | Three |
| `identity-key-set` | `ProductionSignerReference` selects the exact approved bootstrap `MachineKey` entry by id from Two's current `FactContext.keys`; Two validates its machine and segment-position range | Two/Ten |
| `clock-source` | role `verification-clock` references Nine's declared service and trust configuration; current readings remain Nine evidence | Ten selects; Nine owns freshness |
| `transport-Lease` | consume Six's `Lease` directly | Six |
| `transport-FenceToken` | consume Six's current assignment-derived fence through its public authority; no standalone stored token is invented | Six |
| `fact-replication-receipt` | role `fact-segment` selects the exact source prefix and Two's public `FactStorePort`; a replicated operation consumes its authentic exact-prefix `AppendReceipt` with one distinct enrolled peer, while the row is inapplicable only for the exact approved local-durable operation | Ten selects; Two owns the port and receipt |
| `conversation-binding` | consume Four's `conversation-binding` directly | Four |
| `conversation-route` | role `conversation-route` references Four's binding and Twelve's authenticated bot/account/chat/topic identity evidence | Ten selects; Four/Twelve own identity |
| `delivery-evidence-service` | role `delivery-evidence-service` references Nine's declared service and the supported Twelve evidence stage | Ten selects; Nine owns assessment |

**Rule — the fence and resource reservation stay Six-owned.** Owner: Six, consumed by Ten.
Predicate: P10-SI-08 accepts the fence only through Six's current assignment and accepts
`AssemblyAdmission.resourceReservation` only when it references the exact Six
`AdmissionReservation` for the same scope, holder, incarnation, generation, lifetime, and finite
resource allocation. A `.boot-lease`, fixture id, configured limit, expired lease, wrong holder,
or standalone fence-shaped fact refuses. Positive neighbor: the current voter recovers its
prefix, grants the exact assignment, and returns a current reservation that Ten revalidates at
activation and use.

**Rule — `ProductionInstallation` version 1 remains byte-stable.** Owner: Ten for the sibling
reference, Two for key history, and Three for body registration. `ProductionSignerReference`
version 1 is the only new signer body. Predicate: P10-SI-09 refuses before a source-history write
or network call unless the external bootstrap pin, the sibling body, the existing installation,
and Two's admitted key-set history agree exactly. Positive neighbor: an operator-pre-provisioned
signing handle and already approved public-key range resolve through the pinned bootstrap and the
sibling body, after which existing owner writers may append.

| Field | Required value |
|---|---|
| `type`, `schemaVersion` | `ProductionSignerReference`, `1` |
| `id` | Immutable digest identity over every field below |
| `installation`, `machine` | Unique link to the unchanged `ProductionInstallation` v1 id and machine identity |
| `signer` | One existing One `SecretRef` to an operator-pre-provisioned private signing handle; never private bytes |
| `keySet` | Exact id of the approved bootstrap `MachineKey` entry that Two validates for this machine and permitted segment-position range |
| `generation` | Three entering-force generation that declares this body and the referenced identities |
| `bootstrapDigest` | Digest of the independently approved bootstrap package loaded from the external pin |

The host receives `bootstrapLocator` and `expectedBootstrapDigest` from operator-administered
configuration outside the history the package authenticates. The locator resolves an immutable
package containing the approved installation id, machine identity, genesis hash, register
generation, trust-root material, public key/range, and exact signing-handle `SecretRef`. The
package contains no signer-reference digest. After verifying the external package digest, Ten
constructs the sibling signer reference with `bootstrapDigest` equal to that verified digest and
verifies its installation, machine, key-set, and signing-handle fields against the package. The
locator and expected digest are never inferred from the encrypted root. A sibling signed only by
the key it introduces is not approval. Equal reruns reuse the same handle and facts. Changed
immutable input refuses. This profile contains no key generation, rotation ceremony, general vault
setup, or unattended recovery.
Owner basis: `src/assembly/production-installation.ts:7-19` fixes the existing
`ProductionInstallation` v1 bytes; `docs/06-the-fact-envelope.md:157-168` makes the key set an
independently bootstrapped governed chain; `docs/14-the-assembly.md:882-902` keeps operator
preparation distinct from supervised critical installation.

---

## 4. G4 — installed Five governance

**Rule — Five maps approved references into `RunGovernance`.** Owner: Five for the mapping and
loader; Three owns the verified register; Two owns capture. `InstalledRunGovernanceReference`
version 1 is the one missing Five policy-reference body. Predicate: P10-SI-10 accepts it only
when every named entry resolves in one current verified register, every gate's declared decoder
matches Five's actual consumer, the capture declaration resolves to a Two-owned preservation
port, and the grounding policy matches the selected scope and generation. A serialized function,
caller-supplied register object, missing gate, wrong decoder, stale generation, or mutable
threshold refuses. Positive neighbor: the installed record below resolves through Five's public
loader into the existing runtime interface; the loader supplies callbacks from owner ports after
resolution and serializes none of them.

| Field | Required value |
|---|---|
| `type`, `schemaVersion` | `InstalledRunGovernanceReference`, `1` |
| `id`, `installation`, `scope`, `generation` | Immutable identity, exact installation/scope, and Three entering-force generation |
| `contract` | Approved `rungraph.contract` governed-document entry |
| `feature`, `bound` | Approved `rungraph-core` and `rungraph.bound` entries |
| `gates` | Exact ids and decoders for `rungraph.admit/decodeRun`, `step/decodeRunStep`, `transition/decodeRunTransition`, `exit/decodeRunExit`, `grounding/decodeSessionGrounding`, and `stop/decodeRunTransition` |
| `capture` | Declaration reference for Two's durable `preserve` port |
| `groundingPolicy` | Existing approved entry plus exact `threshold`, `maxAge`, and sorted `briefingClasses` values selected for this scope |

The public loader takes this record, a Three `VerifiedRegister`, a register context, Two's capture
port, and the current owner context. It returns the existing `RunGovernance` interface or a typed
refusal. It does not create a parallel policy language or a second authority history.

**Rule — the three configuration bodies have one admission contract.** Owner: Ten produces
installation selections and signer references; Five produces installed governance references;
Three registers their schemas; Two admits their envelopes. Predicate: P10-SI-23 requires
independently verified operator approval covering the exact installation and scope. The author is
that operator or a system principal with an exact standing-covered import grant for the approved
package. The machine signature uses Two's approved key range. These facts confer no standing. Each
producer admits the exact referenced installation, generation, implementation, and policy through
their owners before append. Equal canonical reruns reuse the existing fact. Unequal selections for
the same installation, generation, scope, role, and instance conflict and inhibit that scope; a new
digest does not resolve the conflict. Requester-only metadata refuses. The same approved metadata
from the authorized operator or bounded import principal is the positive neighbor.

| Owned body | Exact fact kind and version | Public owner producer and decoders | Required references and independently pinned inputs | Envelope signer and required author standing |
|---|---|---|---|---|
| `InstallationSelection` v1 | `assembly-InstallationSelection`, schema 1 | Ten `recordInstallationSelection`; Ten `decodeInstallationSelectionAtOrigin`; Ten `decodeHistoricalInstallationSelection` | Exact admitted `assembly-ProductionInstallation`; Three `generation-record`; operator approval; selected implementation declaration; every role-specific owner declaration or fact | Two-approved machine key for the envelope; verified operator, or system principal whose live import grant names this kind, installation, scope, package digest, and action |
| `ProductionSignerReference` v1 | `assembly-ProductionSignerReference`, schema 1 | Ten `recordProductionSignerReference`; Ten `decodeProductionSignerReferenceAtOrigin`; Ten `decodeHistoricalProductionSignerReference` | Exact admitted `assembly-ProductionInstallation`; Three `generation-record`; operator approval; verified external bootstrap digest; selected Two `MachineKey` entry validated from the bootstrap key set | The selected Two-approved machine key for the envelope; verified operator, or system principal with the same exact bounded import standing; the referenced `SecretRef` grants no standing |
| `InstalledRunGovernanceReference` v1 | `rungraph-installed-governance-reference`, schema 1 | Five `recordInstalledRunGovernanceReference`; Five `decodeInstalledRunGovernanceReferenceAtOrigin`; Five `decodeHistoricalInstalledRunGovernanceReference` | Exact admitted installation; Three `generation-record`; operator approval; every named contract, feature, bound, gate, decoder, capture, and grounding-policy declaration | Two-approved machine key for the envelope; verified operator, or system principal whose live import grant names this kind, installation, scope, package digest, and action |

Origin decoders require the producer's active admission guard and re-resolve the complete causal
set before append. Historical decoders use the origin-pinned schema, generation, causal cone, and
owner decoders. They do not import current authority into old bytes. An unequal signer reference
for one installation, machine, and generation, or unequal governance reference for one
installation, scope, and generation, is an immutable conflict and inhibits that scope. Positive
neighbors reuse equal canonical facts or introduce a later approved generation without rewriting
the earlier facts.

Owner basis: `docs/06-the-fact-envelope.md:157-168` owns key-set bootstrap; lines 410-454 own
schema, signature, references, and standing admission; lines 688-700 own declared fact inputs.
`docs/07-the-declarations.md:213-243` owns verified generation loading and the landing principal.
`docs/09-the-run-graph.md:683-692` owns the governance loader. `docs/14-the-assembly.md:38-84`
keeps stored bodies and imported public ports distinct.

---

## 5. G5 and the two boot over-constraints

**Rule — manual preparation is configuration, not supervised execution.** Owner: the operator
for manual administration and Ten for consuming its outputs. Predicate: P10-SI-11 classifies a
step as manual preparation only when an operator-administered identity places or selects already
approved bootstrap bytes, pre-provisioned secret handles, storage location, and package inputs;
the step performs no key creation or rotation, source-history append, migration, recovery,
network call, external effect, retry loop, or activation claim. Presence of a prepared file is
configuration only. Positive neighbor: the operator places an immutable bootstrap package and
pin, and the read-only host later verifies both without calling a provider or Telegram.

**Rule — an automated critical install or recovery stage remains supervised.** Owner: Seven for
the bounded step supervisor and Ten for pipeline composition. Predicate: P10-SI-12 refuses a
critical automated stage before dispatch unless its finite step list, limits, current supervisor
reference, input digests, expected writes, stop behavior, and recovery owner are admitted. An
unavailable supervisor is a named hold. Positive neighbor: a bounded owner-mediated import with
a current Seven supervisor may validate owner facts and append the exact predeclared package.
Read-only inspection after the import may run without that supervisor because it performs no
installation or recovery write. This profile adds no unattended OS or key provisioning pipeline.

The operator may manually place or select one already approved prepared package under P10-SI-11.
An importer that validates and appends any package fact is an automated critical install stage,
even when an operator starts it and even when it imports only one bounded package. P10-SI-12
therefore requires Seven's current bounded step supervisor for that append. No such supervisor
source is landed at this baseline. The named hold is `seven-bounded-install-supervisor`. M3 may
still deliver its importer, loader, source-only replay runner, and per-predicate report and prove
the read-only path against the external pin and prepared bytes. Its proof must stop before source-
history append, migration, recovery, switch-on, provider call, or Telegram call. The later positive
executes the same finite import plan under the current Seven supervisor. Owner basis:
`docs/14-the-assembly.md:882-902` requires the supervisor for every automated critical install or
recovery stage and excludes history append from manual preparation.
`docs/11-the-judgment-doorway.md:137-145` owns bounded supervision and refuses a missing supervisor
or recursive self-authorization.

**Rule — verifier binding is distinct from verifier readiness.** Owner: Ten for selection, Nine
for the independently administered verifier and evidence, and Eleven for the surface verdict.
Predicate: P10-SI-13 treats the `challenge-verifier` selection as prepared only. Readiness also
requires current Nine evidence for the exact administrative domain, trust reference, service id,
surface, generation, clock, `issue` and `verify` operations, one-use challenge, expiry, and replay
protection. A selection string, installer signature, empty probe list, or agent-administered port
cannot clear `independent-challenge-verifier`. Positive neighbor: the selected service presents
current independently signed readiness and live challenge evidence for that exact subject.

**Rule — artifact protection is scope-specific and honest.** Owner: Ten for assembly admission,
Nine for posture evidence, and the operator for the scope policy. Predicate: P10-SI-14 admits the
declared scope when either its protection requirement is `protected` and Nine returns current
`protected` evidence, or its requirement is `unprotected-permitted` and Nine returns authentic
`unprotected` posture while every protected-mutation port and operation is absent or closed.
Both arms still require current worker isolation, effect confinement, secret custody, approval,
and owner evidence. Missing posture or a `protected` requirement with unprotected evidence
refuses. Positive neighbors: a protected scope with its independent monitor admits; this fixed
reply-only scope admits as visibly unprotected when mutation is closed and the remaining gates
pass. An unconfined worker never becomes the positive neighbor.

**Rule — boot dependencies derive from the operation and scope.** Owner: Eleven for the minimal
dependency verdict, Eight for operation demands, and Ten for inspection and composition.
Predicate: P10-SI-15 derives required dependencies from the exact admitted operations and scope.
Local facts, register generation, identity keys, clock, lease, fence, conversation binding,
route, and supported delivery evidence remain required. A replication receipt is required only
for an operation whose approved demand is `replicated(1)`. The local-durable arm requires its
exact policy and receipt instead. Positive neighbors: the replicated scope reports and satisfies
the peer; the approved local-loss scope omits only that peer and satisfies every remaining edge.
`ApprovedMinimalDependencySelection` is Ten's typed result. It carries the exact operation, scope,
demand, policy reference, sorted required dependency names, and admitted handles for those names.
Its only inapplicable form is `replication-peer` under that exact approved `local-durable` policy.
An inapplicable peer is represented as inapplicable under the exact approved local-loss policy; it
is never represented as an admitted replica. Both switch-on and live minimal-path evaluation
consume the same owner-validated dependency selection. Missing policy or a replicated operation
retains the peer requirement. Owner basis: `src/assembly/records.ts:270-283` currently requires the
blanket roster; `src/assembly/contracts.ts:303-323` currently has only a real-replica handle;
`src/operator/live.ts:5-26` and `src/operator/production-switch-on.ts:15-29` currently require the
same unconditional list.

**Rule — missing bindings come from the opened root.** Owner: Ten. Predicate: P10-SI-16 requires
a read-only inspection of the actual opened root at a stated source vector and generation before
the switch-on verdict. It enumerates every applicable unresolved binding, owner, reason, and
source reference. A caller-provided empty array, hard-coded hold list, fixture identity, copied
`current: true`, or inspection that writes installation facts refuses. Positive neighbor: a root
missing the route reports `conversation-route`; after an admitted route selection and current
owner evidence are present, a fresh inspection clears only that item. Final assembly admission
re-resolves and rechecks all authority and live dependencies.

---

## 6. G6 — using a complete answer while accounting remains unresolved

**Rule — output use and accounting completion are separate facts.** Owner: Seven for answer
acceptance, Nine for evidence assessment, Eight for settlement, Six for accounting, and Five for
run consumption. `ProviderAnswerAcceptance` version 1 is the one new cross-owner output-use
record. Predicate: P10-SI-17 allows Five to consume a model answer exactly once when all fields
below and all ten conditions after the table hold. Missing or stale evidence refuses output use.
Positive neighbor: an exact complete answer with unknown final charge is usable while its maximum
exposure remains held; the existing fully settled resolution remains usable and may also close
the accounting obligation.

| Field | Required value |
|---|---|
| `type`, `schemaVersion` | `ProviderAnswerAcceptance`, `1` |
| `id`, `request`, `attempt`, `response` | Immutable acceptance id and Seven's exact request, attempt, and response-observed fact |
| `operation`, `claim`, `digest` | Six/Eight exact operation, consumed one-use claim, and submitted digest |
| `capture`, `answerDigest` | Existing response capture reference and digest of the decoded answer bytes |
| `assessment` | Nine assessment accepting the response's authenticity, completeness, and exact subject for output use only |
| `settlement`, `accounting` | Eight settlement and Six `SettlementApplication` for the same operation and settlement fact/hash |
| `maximumCharge`, `retainedExposure` | Finite enforced route maximum and Six's currently retained maximum exposure |
| `generation`, `acceptedAt` | Current source generation and owner-comparable clock |

The output-use predicate is the conjunction below:

1. Seven's request, response, and capture resolve without taint, conflict, or missing required
   predecessors.
2. The response is `complete`, has non-null bytes, fits the recorded byte and token bounds, and
   decodes through Seven's current `Decision` decoder.
3. Request, attempt, effect request, operation, consumed claim, input digest, provider, model,
   route, floor, evidence set, and response capture agree exactly.
4. Nine's current assessment names that exact subject and supports response authenticity and
   completeness. It does not claim final charge or old-executor quiescence unless its evidence
   supports them.
5. Eight's settlement names the same request, operation, claim, digest, observations, outcome,
   and Nine assessment.
6. Six's accounting names the exact settlement id, settlement fact id/hash, operation, request,
   and digest. Its `retryEligible` is `0`.
7. The provider route has an enforceable finite `maximumCharge`. The original Six reservation
   covers it. When accounting is unresolved, `retainedExposure` equals the unreleased maximum
   exposure held by Six and cannot be presented as actual or zero charge.
8. The current spend account has nonnegative remaining capacity after all retained exposures.
   Independent new work may use only that remainder.
9. No later answer acceptance or second provider operation exists for the same logical attempt.
   Restart reuses this record and never repeats the call.
10. Five records answer consumption separately from settlement. The provider step and its
    accounting obligation remain pending while `unresolved` is nonzero. Output use cannot mark
    the provider run ready, complete, charge-settled, or eligible to repeat that work.

**Rule — one accepted answer can open one separately accountable reply.** Owner: Seven produces
and historically decodes `judgment-provider-ProviderAnswerAcceptance` through
`recordProviderAnswerAcceptance` and `decodeHistoricalProviderAnswerAcceptance`; Five owns
`openAcceptedProviderReply` and the standard `run-opening` it returns; Eight consumes the reply
run's separately admitted outbound operation. Predicate: P10-SI-24 conditionally records one
acceptance-use binding under the original current predecessor, stop, standing, lease-derived fence,
and conversation obligation. The binding is the ordinary Five `Run` v1 opening keyed by the exact
acceptance fact. It adds no new Five body. Its opening retains the original conversation obligation
as a causal reference, so the acceptance fact and obligation together are rechecked even though the
acceptance fact alone deduplicates the run id. That binding may supply one separately admitted reply
run. The original provider run and its accounting remain pending. The reply run references the
accepted answer and obtains its own grounding, authority, budget, durability, and Eight dispatch
claim. It cannot invoke the model again or mark the original run complete. Restart finds the same
acceptance-use binding, reply run, and outbound operation. Unknown reply delivery follows the
original operation's observation path.

Historical decoding uses the origin-pinned schema, generation, causal predecessors, and captured
`Decision` bytes. Current authority, freshness, stop, fence, conversation binding, and retained
exposure are rechecked before a new use, not used to erase an earlier accepted use. Later accounting
settlement does not invalidate its historical acceptance. A changed predecessor, stop, standing,
fence, conversation obligation, missing reply-run admission, model call from the reply run, or
second consumption refuses. Positive neighbor: one assessed complete answer yields one real reply
while original accounting remains unresolved, and restart produces neither a second model call nor
a second reply operation. Owner basis: `docs/09-the-run-graph.md:166-170` assigns conditional answer
acceptance to Five; lines 694-704 retain the pending provider step.
`docs/11-the-judgment-doorway.md:158-190` assigns answer production and use between Seven and Five.
`src/rungraph/graph.ts:231-257`
and `src/rungraph/service.ts:144-179` preserve the existing rule that an unresolved provider step
cannot make its own run ready.

**Rule — uncertainty never becomes a free retry.** Owner: Six and Eight. Predicate: P10-SI-18
keeps the original operation identity, claim, settlement obligation, maximum exposure, and
`retryEligible: 0` while any charge or quiescence predicate is unknown. Timeout, restart, another
provider, a new key, another run, or a new budget cannot create a replacement attempt for the
same intended work. Positive neighbor: genuinely independent new user work with a different
semantic operation may be admitted within the unreserved remainder; a retry becomes eligible
only after Eight proves non-occurrence, old-executor exclusion, and final charge through the
existing fully settled path.

---

## 7. Exact builder source, fence, and pin grants

**Rule — the implementation grant is exact and additive.** Owner: the landing desk for the
reviewed grant and each named source owner for its code. Predicate: P10-SI-19 rejects any modified
existing source, new source, fence, pin, or fixture outside the tables and rules below. Positive
neighbor: a listed additive file is created for only its named predicates, while an exact existing
file changes only for its stated predicate and every reviewed source is pinned to final bytes.

| Existing path granted | Sole permitted change |
|---|---|
| `src/assembly/service.ts` | Replace the unconditional `posture(scope) === 'protected'` test with P10-SI-14's declared-scope conjunction; preserve all manifest, conformance, isolation, custody, probe, freshness, and admission checks. |
| `src/assembly/index.ts` | Add only the public export lines for the two P10-SI-23 Ten bodies, the M3 importer/loader/replay/report ports, and the M4 launch-boundary/custody-wiring ports named below. |
| `src/assembly/records.ts` | Validate P10-SI-15's owner-approved required roster instead of requiring all ten dependencies unconditionally; an inapplicable peer must carry the exact local-loss selection and cannot decode as a live dependency handle. |
| `src/assembly/contracts.ts` | Add the closed `ApprovedMinimalDependencySelection` result and its required-versus-inapplicable peer representation; preserve `AssemblyLiveDependencyHandle` as evidence of an actually admitted dependency. |
| `src/assembly/production.ts` | Resolve the P10-SI-07 owner map, the three P10-SI-23 bodies, and P10-SI-15's operation/scope dependency selection; preserve public owner-port identity checks and final `runtime.admit`. |
| `src/assembly/production-boot.ts` | Consume the inspected scope/dependency result before switch-on; remove the blanket missing-list fallback; preserve secret scrubbing, one opened root, close-on-error, exact installation comparison, production-owner provenance, and final owner recheck. |
| `src/assembly/production-application.ts` | Load the verified fixed-installation inputs and pass only the admitted composition to the existing boot boundary; preserve its no-poll-before-admission rule. |
| `bin/instar-production.mjs`, `scripts/production-boot.mjs`, `scripts/production-boot-io.mjs` | Wire the external bootstrap locator, expected digest, prepared package, confined I/O, and typed boot result into the existing production entry. These hosts add no policy, standing, fact shape, fallback, or admission bypass. |
| `src/assembly/production-holds.ts` | Read-only. M3 and M4 may read and report its landed holds but may not edit, remove, reinterpret, or clear them. A hold closes only through its named owner evidence. |
| `src/assembly/harness.ts`, `src/assembly/production-native-context.ts` | Bind the admitted Native launch and context readback to P10-SI-13/14/16 and the exact worker artifact without adding a launch shortcut. |
| `src/assembly/custody.ts`, `src/assembly/provider-credential-custodian.ts` | Wire P10-SI-08/09/14 custody from pre-provisioned `SecretRef` values; preserve confinement and never expose credential bytes to the worker. |
| `src/assembly/production-composition.ts` | Compose the selected dependency result, verifier host, accepted-answer reply path, launch boundary, and custody ports through their public owners only. |
| `src/operator/live.ts` | Replace the global ten-name list with consumption of the exact `ApprovedMinimalDependencySelection`; preserve every required dependency and the accepted-input, exposure, repair, and zero-replay checks. |
| `src/operator/production-switch-on.ts` | Consume the same `ApprovedMinimalDependencySelection` as live evaluation; preserve adapter refusals and repair ownership. |
| `src/operator/contracts.ts`, `src/operator/index.ts` | Define and export the consumer-owned `MinimalDependencySelection` wire type used by both live and switch-on evaluation. Ten's `ApprovedMinimalDependencySelection` in `src/assembly/contracts.ts` implements that public type. No `src/operator/` file imports `src/assembly/`. |
| `src/rungraph/types.ts` | Add Five's public `openAcceptedProviderReply` port contract without changing the stored `Run` v1 body. |
| `src/rungraph/records.ts` | Admit the exact acceptance-backed standard `Run` opening and re-resolve its original conversation obligation; preserve ordinary intake openings and every existing run field and decoder rule. |
| `src/rungraph/service.ts` | Implement P10-SI-24's conditional one-use reply opening under the current predecessor, stop, standing, fence, and conversation obligation; preserve the unresolved original provider run. |
| `src/rungraph/index.ts` | Add only the export lines for the P10-SI-23 governance loader and P10-SI-24 reply-opening public contracts. |
| `src/judgment/provider-path.ts` | Register, produce, origin-decode, and historically decode `judgment-provider-ProviderAnswerAcceptance`; retain the existing `ProviderJudgmentResolution` rule that requires `unresolved === 0`. |
| `src/judgment/index.ts` | Add only the public exports for `recordProviderAnswerAcceptance` and its origin and historical decoders. |
| `src/effects/provider-path.ts` | Let the exact P10-SI-17 acceptance supply output to Five's P10-SI-24 reply-opening consumer while returning `chargeSettled: false` and retaining the original accounting obligation; preserve the existing fully settled path and all retry bars. |
| `src/effects/index.ts` | Add only the public export for the accepted-answer settlement consumer used by Five. |
| `src/assembly/assembly.declarations.json`, `src/rungraph/rungraph.declarations.json` | Add only the declaration and decoder/producer bindings for `InstallationSelection`, `ProductionSignerReference`, and `InstalledRunGovernanceReference` and their exact fact kinds from P10-SI-23. |
| `src/judgment/judgment.declarations.json` | Add only the declaration and producer/decoder bindings for `ProviderAnswerAcceptance` and `judgment-provider-ProviderAnswerAcceptance`. |

The additive M3 sources are exact:

- `src/assembly/installation-selection.ts` and
  `src/assembly/production-signer-reference.ts` contain only their P10-SI-23 schemas,
  registrations, producers, and origin/historical decoders.
- `src/rungraph/installed-governance.ts` contains only the P10-SI-10/23 body, schema,
  registration, producer, origin/historical decoders, and Five loader.
- `src/assembly/production-installation-import.ts` contains the finite prepared-package plan and
  the P10-SI-12 supervised append consumer. It exposes a read-only dry-run when the named Seven
  supervisor hold is open.
- `src/assembly/production-installation-loader.ts` resolves the external locator and digest and
  loads the immutable prepared bytes without writing history.
- `src/assembly/production-installation-replay.ts` performs the source-only replay at the stated
  vector and generation without switch-on or network access.
- `src/assembly/production-installation-report.ts` emits the P10-SI predicate report from owner
  verdicts and may not turn a hold into a pass.

The additive M4 sources are also exact:

- `src/assembly/production-launch-boundary.ts` is the single confined Native launch boundary for
  the admitted machine, artifact, worker, scope, and dependency selection.
- `src/assembly/production-custody-wiring.ts` joins pre-provisioned `SecretRef` values to the
  existing storage, Telegram, and provider custodians without returning secret bytes.
- `scripts/fixed-installation-verifier-clock-observer.mjs` is the separately launched,
  operator-administered small host for Nine's public challenge-verifier, comparable-clock, and
  observer ports. It does not run inside the production worker, add a fact body, or modify
  `src/verification/`. Its trust reference, administrative domain, clock subject, observations,
  and current evidence still pass P10-SI-13 and Nine's owner gates.

No other new source file is granted. `src/assembly/production-installation.ts` stays version 1.
Existing One, Two, Three, Four, Six, Nine, Eleven, and Twelve record bodies stay unchanged. A new
file above implements only already named P10-SI predicates and adds no record or policy language.

The new test-file grant covers every predicate without authorizing edits to landed fixtures:

| Additive test path | P10-SI coverage granted |
|---|---|
| `tests/assembly/fixed-installation-contract.test.ts` | 01, 02, 03, 06, 07, 08, 09, 11, 12, 19, 20, 21, 22, 23 |
| `tests/assembly/fixed-installation-bootstrap.test.ts` | 08, 09, 11, 12, 16, 22, 23 |
| `tests/rungraph/installed-governance.test.ts` | 01, 02, 10, 19, 20, 23 |
| `tests/operator/fixed-installation-dependencies.test.ts` | 03, 04, 05, 13, 14, 15, 16, 19, 20, 21 |
| `tests/assembly/fixed-installation-live.test.ts` | 04, 08, 13, 14, 15, 16, 18, 19, 20, 22 |
| `tests/assembly/fixed-installation-custody.test.ts` | 08, 09, 11, 14, 19, 20, 22 |
| `tests/verification/fixed-installation-host.test.ts` | 13, 14, 19, 20, 22 |
| `tests/rungraph/provider-answer-reply.test.ts` | 17, 18, 19, 20, 24 |
| `tests/e2e/fixed-installation-reply.test.ts` | 01, 03, 04, 05, 10, 13, 14, 15, 16, 17, 18, 20, 21, 22, 24 |

No landed test may be edited except the exact allowlist and digest lines below.
`tests/model-provider/fixture.ts` and `tests/model-provider/review/assertions.mjs` remain
byte-identical and must pass while reading the changed provider path. No fixture may be rewritten
to look like production evidence.

The declaration changes are source inputs, not generated authority. After each unit commits its
declaration inputs, the ordinary Three generator may update only the deterministic changed files
among `generated/capabilities.md`, `generated/conversion.json`, `generated/coverage.md`,
`generated/fact-schemas.json`, `generated/glossary.md`, `generated/register.json`,
`generated/rules.md`, `generated/shape.json`, and `generated/source.json`. M3 introduces only the
three P10-SI-23 fact-kind bindings. M4 introduces only the P10-SI-17
`judgment-provider-ProviderAnswerAcceptance` binding. Hand-edited generated output refuses.

Owner basis for this path grant: `src/assembly/production-application.ts:28-49` owns the admitted
boot composition; `src/assembly/production-holds.ts:1-30` says its names confer no authority;
`src/assembly/production-native-context.ts:16-65` owns the claim-bound Native context boundary;
`src/assembly/provider-credential-custodian.ts:7-45` owns confined provider credentials; and
`src/assembly/production-composition.ts:45-91` composes only public owner ports.
`src/operator/contracts.ts:143-149` owns the minimal-dependency consumer types, while
`src/assembly/contracts.ts:303-323` owns Ten's admitted dependency handles.
`docs/07-the-declarations.md:213-243` makes committed declaration inputs and the ordinary Three
generator, not hand-edited output, the source of a register generation.

The builder's reviewed fence and pin grant is also exact:

1. In V79 of `tests/operator/round15-regressions.test.ts`, change only the source allowlist to add
   `src/judgment/index.ts`, `src/judgment/provider-path.ts`, and
   `src/effects/provider-path.ts`. The existing `src/effects/index.ts` and owner-directory
   allowances remain. No assertion or main-versus-HEAD comparison changes.
2. In `tests/rungraph/production-grounding-scope.test.ts`, change only `liveInputGrant` to add
   `src/judgment/index.ts`, `src/judgment/provider-path.ts`, and
   `src/effects/provider-path.ts`, and change only `productionBootGrant` to add
   `src/operator/contracts.ts` and `src/operator/live.ts`. Its existing
   `src/operator/index.ts` and `src/operator/production-switch-on.ts` entries remain. Assembly and
   rungraph paths remain confined to their existing prefixes.
3. M3 adds or re-pins final independently reviewed digests in
   `tests/assembly/production-grounding-inventory.json` for its changed host/source paths:
   `bin/instar-production.mjs`, `scripts/production-boot.mjs`,
   `scripts/production-boot-io.mjs`, `src/assembly/index.ts`,
   `src/assembly/contracts.ts`, `src/assembly/records.ts`, `src/assembly/service.ts`,
   `src/assembly/production.ts`, `src/assembly/production-boot.ts`,
   `src/assembly/production-application.ts`, `src/assembly/installation-selection.ts`,
   `src/assembly/production-signer-reference.ts`,
   `src/assembly/production-installation-import.ts`,
   `src/assembly/production-installation-loader.ts`,
   `src/assembly/production-installation-replay.ts`,
   `src/assembly/production-installation-report.ts`, `src/rungraph/index.ts`,
   and `src/rungraph/installed-governance.ts`. An unmodified path retains its existing digest.
4. M4 adds or re-pins final independently reviewed digests for its changed host/source paths:
   `scripts/fixed-installation-verifier-clock-observer.mjs`, `src/assembly/index.ts`,
   `src/assembly/contracts.ts`, `src/assembly/service.ts`, `src/assembly/production.ts`,
   `src/assembly/production-boot.ts`, `src/assembly/harness.ts`, `src/assembly/custody.ts`,
   `src/assembly/production-native-context.ts`, `src/assembly/production-composition.ts`,
   `src/assembly/provider-credential-custodian.ts`,
   `src/assembly/production-launch-boundary.ts`,
   `src/assembly/production-custody-wiring.ts`, `src/operator/contracts.ts`,
   `src/operator/index.ts`, `src/operator/live.ts`, `src/operator/production-switch-on.ts`,
   `src/rungraph/index.ts`, `src/rungraph/types.ts`, `src/rungraph/records.ts`,
   `src/rungraph/service.ts`, `src/judgment/index.ts`, `src/judgment/provider-path.ts`,
   `src/effects/index.ts`, and `src/effects/provider-path.ts`. An unmodified path retains its
   existing digest. A new key is added only after that unit's independent review has fixed its
   final bytes; adding a path does not itself claim prior review.
5. Each unit updates `REVIEWED_GROUNDING_INVENTORY` in
   `scripts/check-assembly-contracts.mjs` to the digest of its independently reviewed inventory
   bytes. Each unit also sets the exact final digests of
   `tests/assembly/production-grounding-inventory.json` and
   `tests/rungraph/production-grounding-scope.test.ts` in A2's `grantedContent`. No directory
   exemption, obligation-row deletion, assertion change, or weaker main-versus-HEAD comparison is
   granted.
6. M3 lands first with its final source digests, single inventory digest, checker constant, A2
   digest, declarations, and generated register outputs. M4 then rebases onto landed M3, changes
   the shared `src/assembly/production.ts`, `src/assembly/production-boot.ts`, and
   `src/rungraph/index.ts` from that baseline, and recomputes every M4 source digest and the one
   inventory digest. M4 never carries forward M3's aggregate inventory digest after changing the
   inventory bytes.
7. Re-pin any affected owner-reference manifest through the ordinary Three generator from the
   approved declaration inputs. Do not hand-edit generated authority or widen a source-hash
   exemption.
8. Preserve historical decoders, default replicated-mode positives, protected-scope positives,
   unprotected protected-mutation refusals, all current production provenance checks, and the
   byte-identical landed provider-path readers named above.

---

## 8. Negative contracts and realistic positive neighbors

**Rule — every changed gate is exercised on both sides.** Owner: the owner named in each row;
Ten owns the composed proof. Predicate: P10-SI-20 requires every negative and its positive
neighbor below to execute through the production decoder or consumer named by the contract.
A typed object comparison, fixture-only registry, or direct helper call is insufficient.

| Owner and predicate | Negative | Positive neighbor |
|---|---|---|
| Eight/Two, P10-SI-04 | Local effect has no current policy or lacks one causal predecessor; zero provider/Telegram calls | Same exact operation has either a real peer receipt or approved local policy plus complete local receipt; one admitted dispatch |
| Ten, P10-SI-06/07 | Wrong role owner, duplicate unequal id, selection substituted for a direct owner fact, or peer silently omitted | One complete applicable roster resolves; local mode marks only peer not applicable under the exact policy |
| Two/Ten, P10-SI-08/09 | Self-signed signer, bootstrap read from authenticated root, `.boot-lease` used as Six authority, or changed immutable pin | External pin and pre-provisioned handle agree with admitted key history; current Six fence/reservation resolves |
| Five, P10-SI-10 | Serialized callback, stale generation, missing gate, or wrong decoder | Public loader constructs existing `RunGovernance` from current register and owner ports |
| Two/Three/Five/Ten, P10-SI-23 | Requester metadata, wrong kind, absent approval/import grant, owner-label-only claim, or unequal same-key configuration | Authorized owner producer appends one exact causally closed fact; equal rerun reuses it |
| Seven/Ten, P10-SI-11/12 | Supposed manual step appends history, or critical automated import lacks supervisor | Manual placement remains configuration; supervised bounded import performs only its declared writes |
| Nine/Ten/Eleven, P10-SI-13 | Verifier selection claims readiness with no live evidence | Same selection plus current independent challenge evidence becomes ready |
| Nine/Ten, P10-SI-14 | Unprotected scope exposes protected mutation, or protected scope receives unprotected posture | Reply-only unprotected scope has mutation closed; protected scope with current monitor also remains valid |
| Ten/Eleven, P10-SI-15/16 | Hard-coded peer in approved local mode, caller `missingBindings: []`, or stale root inspection | Exact operation dependencies derive at current vector and final admission rechecks them |
| Seven/Five/Eight/Six, P10-SI-17/18 | Complete answer has no assessment, cap, retained exposure, exact accounting join, or no-repeat proof | Complete assessed answer is used once while unknown charge remains reserved; settled answer follows existing closure path |
| Seven/Five/Eight/Six, P10-SI-24 | Changed predecessor or stop, second consumption, reply-run model call, or restart creates another reply operation | One acceptance opens one grounded reply run and one outbound operation while the original provider run and exposure remain pending |

---

## 9. Appendix — operator acceptance fields

**Rule — acceptance uses existing owner records.** Owner: the record owners in the table, with
One and Eleven verifying the operator act. Predicate: P10-SI-21 refuses activation while any
required field is blank, unverified, stale, or inconsistent with the installed package. Positive
neighbor: the operator fills and signs the real fields through the verified surface, and each
owner consumes only its own portion. The blank table is a review form, not an authority record.

| Written acceptance | Existing record owner(s) | Fields for the operator; real values intentionally blank |
|---|---|---|
| Scope and administration | Ten manifest/deployment policy; One/Eleven standing | `machineIdentity: ______`; `deploymentClass: ______`; `voterCount: ______`; `nativeModelTuple: ______`; `botAccountChatTopic: ______`; `operatorPrincipal: ______`; `workerIsolationAdmin: ______`; `sourceAndKeyCustodian: ______`; `challengeAdmin: ______`; `observerAdmin: ______`; `sharedTrustedHostAndCommonFailure: ______` |
| Local-loss policy | Eight operation demand; Two durability; operator P-08 policy | `acceptedOrRejected: ______`; `installation: ______`; `operations: ______`; `demandForEach: ______`; `fullCausalClosure: ______`; `permanentMachineLossStatementAccepted: ______`; `automaticFallbackForbidden: ______`; `effectiveGeneration: ______` |
| Zero voter-loss availability | Six membership and reservation policy | `singleVoterAccepted: ______`; `lossStopsAdmission: ______`; `noFailover: ______`; `outageNoticeLimitAccepted: ______`; `repairOwner: ______` |
| Unprotected artifacts | Nine posture; Ten scope policy | `artifactClasses: ______`; `postureForEach: ______`; `protectedMutationUnavailable: ______`; `workerIsolationStillRequired: ______`; `independentApprovalAndKeyCustodyStillRequired: ______`; `rootCompromiseLimitAccepted: ______` |
| Transport evidence limits | Twelve capability; Nine assessment; Four binding | `telegramModeAndIdentity: ______`; `tokenCompromiseExposureAccepted: ______`; `providerAcceptanceClaim: ______`; `humanDeliveryOrReadNotClaimed: ______`; `ordinaryChatCannotGrantStanding: ______`; `witnessStageAndFreshness: ______` |
| Maximum spend and unknown outcomes | Six reservation/accounting; Seven route; Eight settlement | `currencyAndWindow: ______`; `enforceableMaximumPerCall: ______`; `totalExposureCap: ______`; `observationCountTimeResourceBounds: ______`; `unknownExposureRetention: ______`; `noAutomaticRepeat: ______`; `newWorkRemainderRule: ______` |
| Minimal voice | Eleven surface; Five minimal run; Six reserves | `permittedStatementsAndActs: ______`; `forbiddenOrdinaryClaims: ______`; `stopAndBoundedRepairGrant: ______`; `workerMemoryStorageQueueTransportEffectReserves: ______`; `dependencyOutageWording: ______` |
| Measured envelope | Eleven admission; Ten replay/conformance; Seven route quality | `machineAndStorageClass: ______`; `coldWarmWorkloadMatrix: ______`; `historyCapacity: ______`; `startupAndResponseBounds: ______`; `margins: ______`; `modelPromptContextTuple: ______`; `qualityEvidenceAndLimits: ______` |
| Initial live use | Twelve Telegram scope; Eleven whole-slice verdict; Ten manifest | `throwawayBot: ______`; `demoGroupAndTopic: ______`; `replyOnlyAudience: ______`; `allowedOperations: ______`; `spendAndMessageLimit: ______`; `secondInboundRequired: ______`; `restartAndStopRequired: ______`; `broaderResidualCapabilitiesUnavailable: ______` |

---

## 10. Disposition and honest limits

**Rule — this profile closes design gaps, not implementation holds.** Owner: Ten for the
installation verdict and Eleven for the whole slice. Predicate: P10-SI-22 reports each of the
twenty-five production holds individually as prepared, admitted, or still held, with its owner
and evidence reference. It never converts installation metadata into a live service claim.
Positive neighbor: a prepared package can close its exact record predicates while verifier,
clock, confinement, probes, reservation, driver, or live proof remain visibly held until their
real evidence arrives.

Deferred breadth is explicit: protected runtime/dashboard mutation, a general setup experience,
automatic key lifecycle, additional machines or voters, other conversation platforms, multiple
bots, a universal billing oracle, and stronger human-delivery or read claims are not admitted in
this scope. The profile retains worker confinement, independent approval, secret custody, real
Nine assessment, finite spend, no silent repetition, and the ordinary owner path from intake
through reply.
