# The fixed single-machine installation contract

**Status: draft, awaiting operator approval.**

**Value — purpose.** This profile defines the bounded contracts for one usable installation.
It does not define a general installer. It does not generate keys. It does not add a certification
system. It does not turn the eighteen production resolver names into eighteen new record bodies.
It selects one machine, one voter, one pre-bound Telegram conversation and optionally one
pre-bound Slack DM or thread for the same operator, one confined Native worker, one admitted
model route, the six-fold minimal plane, and one operator-administered approval, clock, and
observation host.

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
`AdmissionReservation` and `CapacityReservation`, Three's `GenerationRecord`, Two's durability receipts, and Nine's probe
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
| Twelve | Telegram and Slack identity, route, capability, provider-acceptance limit, and delivery-stage evidence |

**Rule — the profile has one exact scope.** Owner: Ten, with operator standing verified through
One and Eleven. Predicate: P10-SI-03 accepts only one named machine identity, one Six voter, one
Native harness and model-route tuple, one Telegram bot/account/chat/topic route, one bound
operator principal, one reply-only audience, and the six named Eleven folds. It may additionally
select one Slack app/account route in one workspace to that same operator's pre-bound DM or
single thread, for text-only replies to the same authorized audience. Both routes share the
existing worker, admission and resource bounds. It rejects a second execution machine, voter,
provider tuple, additional account or conversation beyond these two routes, any other platform,
or protected-mutation capability. A separately enrolled durability peer is permitted, and required whenever a selected
operation demands replication; it is not a second execution voter. When only one machine is
enrolled, the admitted installation carries no peer dependency and uses the accepted closed
irreversible local-durable P-08 set. Ordinary bounded operations follow the purpose's fully
functional single-machine Rule and §2's ordinary-operation rule. The proposed
`native-confined-launch` remains under M4-L's implementation/admission hold and §12's evidence
contract. Whenever a second machine is enrolled, the peer-backed arm uses
`replicated(1)` by default. Positive neighbors are the exact admitted single-machine tuple and the
same one-voter execution tuple with its real remote durability peer. A same-machine second process
is not that peer. A broader execution tuple remains not admitted in this scope.
Owner basis: `docs/00-the-purpose.md` defines the fully functional single-machine shape and
peer-backed default; `docs/12-the-effect-doorway.md:241-266` gives Eight both installed
operation-demand arms; `docs/15-the-operator-surfaces.md:201-231` makes Eleven consume the selected
arm without adding an execution voter.

---

## 2. G1 — the supported single-machine arm and peer-backed default

**Rule — every irreversible operation chooses one real durability demand.** Owner: Eight for
the operation demand, Two for receipts, and the operator for the deployment policy. Predicate:
P10-SI-04 permits dispatch only when the exact operation and its full causal closure satisfy one
of these two arms:

1. `replicated(1)` has an authenticated acknowledgment for the exact required prefix from an
   enrolled store on a second independently failing machine.
2. `local-durable` names a current, independently approved P-08 installation policy that binds
   this profile and the operator's one-time acceptance of its closed operation set: the installed
   paid provider call, reply-only Telegram `ordinary-reply` send, and text-only, reply-only Slack
   `ordinary-reply` send in one workspace to the bound operator's pre-bound DM or thread.
   The exact operation is a
   member of that set. Its local durable prefix contains authorization, preparation, provider
   disclosure and maximum-charge reservation, reply preparation, observations, and all later
   settlement predecessors available at dispatch. The operator does not hand-list the operations.

Missing or stale policy, an operation outside the profile set, a partial causal prefix, a local
second process presented as a peer, or automatic fallback after peer loss refuses dispatch.
Positive neighbors are a profile operation with its complete local receipt in the single-machine
arm and a replicated operation with its real peer receipt in the peer-backed arm. No arm or record
is named `replicated(0)`.

**Rule — ordinary bounded operations have their own local durability rule.** Owner: Eight;
predicates: P10-SI-04/36. `ordinary-local-durability-scope` is RESOLVED by the purpose's fully
functional single-machine Rule and its ordinary bounded-operation Rule. The provider/reply closed set
and its exact membership check govern irreversible effects. An ordinary operation requires all
four consequential-effect tests to be false, finite enforced bounds and the whole causal record
retained durably at least locally, with its complete required prefix durable before dispatch.
Corresponding P-08 interpretations/checks enforcing the broader exclusion still require a named
grant before changing; this document grants no such edits. M4-L and all implementation/evidence
holds remain open. Approval starts nothing and adds no peer prerequisite.

**Value — the accepted loss model in plain words.** Permanent loss of this one machine can
destroy the authority, work, captures, observations, and accounting evidence needed to
reconstruct a paid model call or Telegram or Slack send. No peer survives that loss. An unknown earlier
effect cannot safely be repeated from memory or from a new installation. Losing the only voter,
key, clock, route, or evidence path stops the dependent scope. No failover or delivered outage
notice is promised when the path needed to deliver it is gone. The installer presents this text
with the closed operation set for the operator's one acceptance for this installation.

**Rule — the installed shape determines the peer dependency.** Owner: Eleven for the dependency
verdict and Ten for composition. Predicate: P10-SI-05 gives the admitted single-machine arm no
`replication-peer` dependency and requires its current P-08 policy to bind the profile, closed
operation set, accepted loss model, and effective generation. Missing or stale policy refuses the
single-machine arm instead of adding a peer dependency. Whenever a second machine is enrolled,
the peer-backed arm requires `replication-peer` and uses `replicated(1)` by default. An operation
whose demand names replication requires that arm and refuses in the single-machine arm. Loss of an
enrolled peer refuses the replicated operation and never selects local durability automatically.
Positive neighbors are the policy-bound no-peer arm and a real second-machine peer with an
authenticated exact-prefix receipt; neither adds a second execution voter.

---

## 3. G2 and G3 — the closed record and bootstrap contract

**Rule — one atomic set covers the fixed installation selections.** Owner: Ten.
`InstallationSelectionSet` version 1, fact kind `assembly-InstallationSelectionSet` schema 1,
is the fixed profile selection unit. Its rows retain the complete `InstallationSelection` v1
data below, including each row’s digest. Singleton v1 history remains immutable and readable
through its original kind and decoder; it is never silently upgraded or used as a missing-set
fallback. Predicate: P10-SI-06 accepts the set only when its closed fields and every row decode,
its identities are unique, and every referenced owner fact is admitted at the same installation,
scope, machine, and generation. A role with missing role-specific references, two unequal
bodies with one id,
an unregistered implementation, or a self-asserted readiness claim refuses. Positive neighbor:
one signed set selects the exact applicable roles and implementations at one verified
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

**Rule — the closed set commits every row.** Owner: Ten. Predicate: P10-SI-32 requires
exactly the top-level fields `type`, `schemaVersion`, `id`, `installation`, `machine`, `scope`,
`generation`, `rows`. Their values are `InstallationSelectionSet`, `1`, the canonical digest of
all fields except `id`, and the exact shared installation/machine/scope/generation plus rows.
Every row has exactly the fields in the preceding table: its `type` remains
`InstallationSelection`, its `schemaVersion` remains `1`, and its `id` remains the canonical
digest of all its other fields. Common fields must equal the enclosing set byte for byte.
References keep their sorted, unique, nonempty bounded form. Sort rows lexicographically by
`role`, then `instance`, using canonical string ordering, never locale order. Reject unknown
fields, unknown roles, wrong owners, duplicate role/instance keys or row digests, and any
missing or excess applicable slot. One Two envelope and machine signature commits the complete
canonical Ten-produced set. No row has its own signature, causal frontier or fact identity.

The closed role/owner/instance map is the following finite expansion of P10-SI-07. Each instance
is the exact slot literal in the table, pinned in the independently approved
package; there is no second instance of a single slot or caller-selected extra instance. Fold
instances are the six exact Eleven projection ids. Fact-segment instances distinguish the
local-prefix and replicated-prefix consumer slots even if both reference the same actual prefix.
These strings reuse the existing production names and lifecycle roles; the closed naming is a
measured encoding default for unambiguous resolution, not new operator policy or authority.

| Role | Checked role owner | Permitted instance slots and count |
|---|---|---|
| `operator-surface` | `part-eleven` | `operator-surface-registration`, one |
| `challenge-verifier` | `part-nine` | `operator-challenge-verifier-binding`, one |
| `verified-act-intake` | `part-four` | `intake-verified-act-binding`, one |
| `minimal-plane-fold` | `part-eleven` | `minimal.intake-ledger`, `minimal.principal-binding`, `minimal.run-view`, `minimal.outbound-obligation`, `minimal.authority-queue`, `minimal.guard-repair`, one each; Two’s fold declarations also required |
| `minimal-plane-replay` | `part-ten` | `minimal-plane-replay-binding`, one |
| `minimal-responder` | `part-eleven` | `minimal-responder-binding`, one; Five policy and Six capacity references also required |
| `prerequisite-cut` | `part-ten` | `prerequisite-cut`, one |
| `prerequisite-recovery` | `part-ten` | `prerequisite-recovery`, one |
| `delivery-witness` | `part-nine` | `platform-delivery-witness-binding`, one |
| `fact-segment` | `part-two` | `fact-local-durable-segment`, one; `fact-replication-receipt`, one only in the peer-backed arm |
| `verification-clock` | `part-nine` | `clock-source`, one |
| `conversation-route` | `part-four` | `conversation-route`, one; Twelve identity evidence also required |
| `delivery-evidence-service` | `part-nine` | `delivery-evidence-service`, one; Twelve stage evidence also required |
| `scope-protection` | `part-ten` | Exactly one of `protected` or `unprotected-permitted`, matching the approved policy |

The maximum is 20 rows: six folds, two lifecycle controls, two fact-segment slots, nine other
single slots and one scope-protection slot. The accepted local-durable arm has 19, omitting only
the peer slot under P10-SI-04/05. The eighteen production names count resolver obligations, not
selection rows. Direct Three/Four/Six records and the signer path add no selection rows. The
roster, count and instance equality are proved against the exact approved package and manifest,
not against a fixture’s array length. A package missing one fold or scope protection refuses.

**Value — the accepted costs of an atomic set.** This is a bounded design choice for one fixed
installation/machine/scope/approved package/generation. It carries these costs for the operator:

| Concern | Accepted cost and retained boundary |
|---|---|
| Per-role changes | No replacement or extension within a generation. A later approved generation is necessary, not sufficient: ProductionInstallation v1 cannot be rebound in place. The `installation-generation-transition` gap in §4 holds changed or expired selections until the transition is specified and granted; old facts and obligations remain, with no reset under a new identity. Unequal same-key singleton selections already conflict; the set does not introduce a supersession shortcut. |
| Per-row expiry | Every row keeps its own exact `validUntil`, checked at use. An expired required row inhibits its dependent scope. There is no maximum set horizon and Six rebind cannot extend a row. |
| Authorship and approval | One author, signature and approval/import standing cover the whole exact set. Independently authored or separately approved row batches are unsupported. Grants for the singleton kind cannot authorize the new kind. Other owners’ records remain independently authored. |
| Causal position | All rows must validate at one causal position with the union of required fact references. Earlier per-row verdicts from different cones or times cannot be copied into the set. Existing history is not rewritten. |
| Update and crash granularity | Initial selection admission is one append, present or absent as a whole after a crash. Restart reuses the exact committed envelope. Incremental row installation in a generation is unavailable; other package facts retain their own crash/restart proofs. |
| Failure and disclosure | An unverifiable or malformed set certifies none of its rows. Envelope integrity and taint share one failure domain. The signed unit discloses all rows in one scope; different disclosure scopes must never be combined. Row diagnostics identify every failure but supply no partial authority. |
| References and compatibility | A consumer must resolve the real set envelope plus row digest/role/instance. A row cannot be passed as a signed fact. Singleton v1 history requires its original verified admission inputs under §4; missing inputs hold populated-root migration under `historical-installation-admission-context`. Admitting a new set requires explicit new-kind support. |
| Preparation | Missing or corrupt set bytes leave every dependent binding unresolved. Restoring current external evidence can clear one dependency of a valid set; changing a selection cannot be repaired by appending one row. |
| Performance | Fewer envelopes and one shared basis per validation are measured engineering defaults, not a promised speedup. Full strict-consumer evidence at the original bounds remains required; this design can still fail its measured envelope. |

Decision basis: `docs/00-the-purpose.md:67-79` requires explicit dispositions and measured
engineering defaults; `:99-124` requires durable cause and supports one machine. Two’s immutable
fact and causal-position rules (`docs/06-the-fact-envelope.md:104-130,422-460`) require exact
bytes, one genuine envelope and unioned causal references, while `:584-599` requires current
evidence-unavailable taint. Ten’s P10-SI-02/06/07/23 supplies the owner separation and finite
roster. Atomic granularity is the bounded owner-contract amendment addressing repeated shared
admission; the constitution does not prescribe a wire name or batching. Canonical digest/order
reuse is derived from `src/assembly/installation-selection.ts:56-75` and the existing canonical
package, with completeness and duplicate neighbors as its check. The general callback
purity/dependency contract is an unresolved separate gap, not a prerequisite or grant here.
Separately authored batches, same-generation incremental updates, bulk admission for arbitrary
owners, general purity infrastructure and a general history-read redesign are outside this cut.

**Rule — the eighteen production names resolve without eighteen bodies.** Owner: Ten for the
audit and consumer; each referenced fact retains the owner in the table. Predicate: P10-SI-07
requires every applicable production name and instance to resolve exactly once. A direct-owner
row rejects an `InstallationSelection` or `InstallationSelectionSet` lookalike. A selection row rejects a fabricated owner fact. A
not-applicable peer marker is legal only as nondependency metadata for P10-SI-04's admitted
single-machine arm. Positive neighbor: the single-machine profile resolves the applicable
seventeen rows with owner facts and selection instances and carries no peer handle; the
peer-backed profile resolves all eighteen including a real Two receipt.

| Production name | Resolution in this profile | Body owner |
|---|---|---|
| `operator-surface-registration` | Set row with `InstallationSelection` role `operator-surface` references Eleven's registered surface declaration | Ten selects; Eleven owns the surface |
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
| `fact-replication-receipt` | role `fact-segment` selects the exact source prefix and Two's public `FactStorePort`; a replicated operation consumes its authentic exact-prefix `AppendReceipt` with one distinct enrolled peer, while the row is nondependency metadata only for the admitted single-machine profile's closed local-durable operation set | Ten selects; Two owns the port and receipt |
| `conversation-binding` | consume Four's `conversation-binding` directly | Four |
| `conversation-route` | role `conversation-route` references Four's binding and Twelve's authenticated bot/account/chat/topic identity evidence | Ten selects; Four/Twelve own identity |
| `delivery-evidence-service` | role `delivery-evidence-service` references Nine's declared service and the supported Twelve evidence stage | Ten selects; Nine owns assessment |

**Rule — the fence and resource reservation stay Six-owned.** Owner: Six, consumed by Ten.
Predicate: P10-SI-08 accepts the fence only through Six's current assignment and accepts
`AssemblyAdmission.resourceReservation` only when it references the exact Six
`CapacityReservation` for standing installation capacity under §11, or `AdmissionReservation`
for actual operation admission, for the same scope, holder, incarnation, generation, lifetime,
and finite resource allocation. The minimal-responder selection requires CapacityReservation;
an operation reservation cannot substitute for it. A `.boot-lease`, fixture id, configured limit, expired lease, wrong holder,
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

**Rule — configuration bodies have one admission contract.** Owner: Ten produces
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
| `InstallationSelectionSet` v1 | `assembly-InstallationSelectionSet`, schema 1 | Ten `recordInstallationSelectionSet`; Ten `decodeInstallationSelectionSetAtOrigin`; Ten `decodeHistoricalInstallationSelectionSet` | Exact admitted installation, generation and independent package approval; union of all rows’ required owner facts/declarations and exact new-kind import grant references | Two-approved machine key signs the whole set; verified approving operator or system principal with standing for this exact new kind, installation, scope, package digest and action |
| `InstallationSelection` v1 (singleton history) | `assembly-InstallationSelection`, schema 1 | Ten `recordInstallationSelection`; Ten `decodeInstallationSelectionAtOrigin`; Ten `decodeHistoricalInstallationSelection` | Exact admitted `assembly-ProductionInstallation`; Three `generation-record`; operator approval; selected implementation declaration; every role-specific owner declaration or fact | Two-approved machine key for the envelope; verified operator, or system principal whose live import grant names this kind, installation, scope, package digest, and action |
| `ProductionSignerReference` v1 | `assembly-ProductionSignerReference`, schema 1 | Ten `recordProductionSignerReference`; Ten `decodeProductionSignerReferenceAtOrigin`; Ten `decodeHistoricalProductionSignerReference` | Exact admitted `assembly-ProductionInstallation`; Three `generation-record`; operator approval; verified external bootstrap digest; selected Two `MachineKey` entry validated from the bootstrap key set | The selected Two-approved machine key for the envelope; verified operator, or system principal with the same exact bounded import standing; the referenced `SecretRef` grants no standing |
| `InstalledRunGovernanceReference` v1 | `rungraph-installed-governance-reference`, schema 1 | Five `recordInstalledRunGovernanceReference`; Five `decodeInstalledRunGovernanceReferenceAtOrigin`; Five `decodeHistoricalInstalledRunGovernanceReference` | Exact admitted installation; Three `generation-record`; operator approval; every named contract, feature, bound, gate, decoder, capture, and grounding-policy declaration | Two-approved machine key for the envelope; verified operator, or system principal whose live import grant names this kind, installation, scope, package digest, and action |

Origin decoders require the producer's active admission guard and re-resolve the complete causal
set before append. Historical decoders use the origin-pinned schema, generation, causal cone, and
owner decoders. They do not import current authority into old bytes. An unequal signer reference
for one installation, machine, and generation, or unequal governance reference for one
installation, scope, and generation, is an immutable conflict and inhibits that scope. Positive
neighbors reuse equal canonical facts. A later approved generation is necessary, not sufficient
for replacement: `installation-generation-transition` below holds the existing-installation
transition; earlier facts cannot be rewritten.

**Rule — historical configuration retains its original admission inputs.** Owner: Ten for
selection and signer references, Five for installed governance, with Three/Four/Two retaining
register, approval and envelope authority. For each historical Part A envelope, resolve its
original independently verified package/approval, origin register and owner context, and original
signer bootstrap where applicable. Retain those inputs across restart and select them from verified
origin evidence; never substitute the newly approved set package or current bootstrap. Missing
historical inputs are an identified unavailable-evidence hold, not a rewritten approval, discarded
record, or successful migration. Current strict resolution accepts only the explicit set arm.
This applies to `InstallationSelection` v1, `ProductionSignerReference` v1 and
`InstalledRunGovernanceReference` v1, including cross-history conflict inspection.

The bounded context selection belongs to inspection/import/replay under M3-S-S4/S7/S9, with
read-only input plumbing under S8. Reconstruction of all necessary original owner contexts through
public ports is not yet established: `historical-installation-admission-context` is an ungranted
compatibility gap and holds migration of populated roots until that reconstruction is explicitly
specified and granted. Selecting already verified original inputs does not authorize inventing
missing owner context. Basis: `src/assembly/installation-selection.ts:115,255`,
`src/assembly/production-signer-reference.ts:37,62`, `src/rungraph/installed-governance.ts:93,149`
and `src/assembly/production-installation-import.ts:130-139` bind these decoders to their original
package/approval and bootstrap; retained exports alone do not preserve readability.

**Rule — set admission is atomic and shares one basis.** Owner: Ten. Predicate: P10-SI-33
requires `recordInstallationSelectionSet`, `decodeInstallationSelectionSetAtOrigin` and
`decodeHistoricalInstallationSelectionSet` to pin the exact set bytes in the independently
approved canonical package. Each set-validation invocation validates its shared installation,
generation, approved scope/package, issuer and register basis exactly once, then checks every
row’s complete owner-specific obligations against that basis. This is invocation-local
composition, not retained validation state between calls. Calling the complete singleton decoder
once per row is forbidden, as is supplying a fabricated singleton origin. Existing singleton
producers and historical decoders retain their own semantics. In particular, singleton v1
historical decoding retains its origin-approved `transport-AdmissionReservation` interpretation
for minimal-responder; only the new set row validator requires `transport-CapacityReservation`.
An old singleton may remain valid historical configuration but cannot satisfy the new fixed-profile
set or current capacity requirement.

Required causal predecessors include the exact installation, generation, approval, relied-on
import grants and every fact reference required by any row; declarations resolve in that exact
owner-issued register. Three’s generation, Four’s approval/binding, Six’s lease/capacity, Five’s
governance and signer/bootstrap evidence remain separate genuine records and public owner reads.
The role owner label supplies no authorship, issuance or current permission. Historical admission
uses this set’s actual cone and origin-pinned interpretation; unavailable evidence still taints
consumption. Origin admission checks its exact active record guard before basis work and again
before completion, and checks current generation, author/import standing and owner gates freshly.
An old grant naming `assembly-InstallationSelection` is insufficient.

One invalid row refuses the entire append. Report all detectable row failures with role/instance,
row digest and owner/reason, marking unverifiable rows unresolved without pretending to certify
any good subset. The immutable set key is installation/machine/scope/generation. Equal reruns
reuse the actual committed envelope, including restart after a lost append acknowledgment.
Unequal same-key sets, duplicate envelopes or contradictory same-key rows anywhere in the actual
opened history inhibit the scope; a new set digest cannot resolve the conflict. Singleton history
must also be checked for conflicting row keys, never converted into set rows by assertion.
Replacement or extension needs a later independently approved generation, which is necessary,
not sufficient: `installation-generation-transition` holds that transition with old facts retained.
Positive neighbors include exact rerun and crash on either side of the single append.

**Value — generation approval does not rebind an installation.** A later approved generation is
necessary, not sufficient. `ProductionInstallation` v1 cannot be rebound in place. The transition
of an existing installation to that generation, including installation identity, bootstrap/package
approval and continuity of outstanding work and capacity, is an unresolved Ten owner-contract gap:
`installation-generation-transition`. Until that transition is explicitly specified and granted,
changed or expired selections remain inhibited; this amendment authorizes neither mutation of old
installation facts nor resetting obligations under a new identity. Basis:
`src/assembly/installation-selection.ts:94-99` requires the referenced installation’s generation,
`src/assembly/production-installation.ts:87-95` refuses unequal bytes under its immutable id, and
the bootstrap/signer generation bindings remain unchanged. Generation approval alone supplies no
available repair path for that existing installation.

**Rule — a selected row remains anchored in its real envelope.** Owner: Ten. Predicate:
P10-SI-34 resolves the applicable P10-SI-07 name/instance to exactly one row and returns
`InstallationSelectionRowReference` v1: closed `type`, `schemaVersion`, `set`, `rowDigest`,
`role`, `instance`, with `type: InstallationSelectionRowReference`, `schemaVersion: 1` and
`set` the real Two `FactEnvelopeReference` (`owner: part-two`, `name: FactEnvelope`, actual
set envelope `id`). This is a typed consumer address, not an owned fact or appendable schema.
Every consumer verifies the row digest and exact selected implementation, role owner,
installation/machine/scope/generation, horizon and current external evidence. The returned
`fact` is the actual enclosing set fact, never a row-shaped synthesized envelope.

Stored `AssemblyRequiredFactBinding` v1 remains the closed `reference`, `expectedKind`,
`required` shape (`src/assembly/contracts.ts:34-38`, `src/assembly/records.ts:28`). For an
explicit new-set binding, `reference` is the real set envelope id, `expectedKind` is
`assembly-InstallationSelectionSet`, and `required` is true. The binding’s roster position
selects role/instance through the closed approved map; the exact approved set supplies its row
digest. All selection slots point to the same set envelope; no row digest is interpreted as an
envelope id, and no old reference string changes meaning. Direct-owner bindings retain their
real envelope kind/reference. No stored binding-shape or AssemblyManifest version change is
needed for this mapping. The new v1 row-address type and an explicit set-row result arm are
additive runtime contracts in `contracts.ts`; the old resolved-reference API retains its result
meaning. If implementation requires another stored field or version, that is a named ungranted
schema gap, not permission to widen v1 silently. `ProductionInstallation` v1,
`ProductionSignerReference` v1 and `InstalledRunGovernanceReference` v1 remain byte-stable.

Six’s minimal-responder row selects the exact same-store CapacityReservation, its single current
rebind chain and finite parent debit under §11. Selection occupies no ordinary slot and grants
no execution permission. Current authority, capture availability, stop, lease/fence, policy,
remaining capacity and per-row horizon are checked at activation/use. Basis:
`docs/09-the-run-graph.md:167-185` and `docs/10-the-transport-and-leases.md:365-472` keep durable
selection separate from fresh permission; `docs/06-the-fact-envelope.md:431-468,584-599,734-765`
keeps outside-cone status, unavailable evidence and source freshness current.

Owner basis: `docs/06-the-fact-envelope.md:157-168` owns key-set bootstrap; lines 410-454 own
schema, signature, references, and standing admission; lines 688-700 own declared fact inputs.
`docs/07-the-declarations.md:213-243` owns verified generation loading and the landing principal.
`docs/09-the-run-graph.md:683-692` owns the governance loader. `docs/14-the-assembly.md:38-84`
keeps stored bodies and imported public ports distinct.

---

## 5. G5 and the two boot over-constraints

Eight owns the registered fixed launch; Ten supplies its restricted executor, and Six supplies
the actual operation reservation and one-use claim. Manual placement cannot activate that worker.
P10-SI-36's ordinary loading-only profile does not remove P10-SI-11/12's bounded Seven supervisor
from an automated critical installation/recovery pipeline. A standalone restricted-UID experiment
can evidence an OS boundary only; neither it nor a fact append is admitted production launch.

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
for an operation whose approved demand is `replicated(1)`. The admitted single-machine arm has no
peer dependency and requires its exact profile-bound policy and local receipt instead. Positive
neighbors: the peer-backed scope reports and satisfies the peer; the accepted single-machine scope
has no peer handle and satisfies every remaining edge.
`ApprovedMinimalDependencySelection` is Ten's typed result. It carries the exact operation, scope,
demand, policy reference, sorted required dependency names, and admitted handles for those names.
Its only inapplicable form is nondependency metadata for `replication-peer` under the admitted
single-machine profile's exact `local-durable` policy. That marker is never a required dependency
or admitted replica handle. Both switch-on and live minimal-path evaluation consume the same
owner-validated dependency selection. Missing policy refuses the single-machine selection. A
replicated operation requires the peer-backed selection. Owner basis:
`src/assembly/records.ts:270-283` currently requires the blanket roster;
`src/assembly/contracts.ts:303-323` currently has only a real-replica handle;
`src/operator/live.ts:5-26` and `src/operator/production-switch-on.ts:15-29` currently require the
same unconditional list.

**Rule — missing bindings come from the opened root.** Owner: Ten. Predicate: P10-SI-16
requires read-only inspection of the actual opened root at one proven coherent source vector
and generation. The product carries the exact installation/scope, vector and generation, every
applicable resolved and unresolved binding, and owner/reason/source references for each unresolved
item. Where bytes or references are absent, the expected binding source and explicit null actual
reference identify the gap. It returns the owner-decoded scope-protection row with its real set
address and the genuine dependency inputs where present; absent or unavailable inputs remain
typed unresolved/null. Before set admission is implemented, it may expose a genuinely decoded
singleton under an explicit `singleton-history` input arm with its real envelope, distinct from
the `set-row` input arm. That historical input does not resolve the new fixed-profile set
requirement or enable a singleton fallback in strict runtime. An unknown/unregistered new kind
is unavailable, never decoded with a permissive replacement registration. It is never an `ApprovedMinimalDependencySelection`, approved selection
substitute or claim of live readiness. Malformed/unreadable root or an unprovable coherent view
refuses the inspection itself rather than returning an empty missing list. Within a coherent
view, collect all applicable failures instead of stopping after the first bad binding.

A missing, incomplete or corrupt set reports every affected unresolved binding, including every
fold and scope-protection input. A complete approved set with unavailable current route evidence
reports the route dependency and retains all other independently resolved rows. Restoring that
actual owner evidence clears only the route dependency on fresh inspection; changing route
selection bytes needs a later approved generation, which is necessary, not sufficient: the
`installation-generation-transition` gap in §4 keeps that repair inhibited until specified and
granted. This narrows incremental preparation:
appending only a missing route row in the same generation is unsupported. No missing binding
may be manufactured to make inspection succeed.

Inspection performs no append, migration, recovery write, switch-on, poll, capacity allocation,
lease renewal or external effect. A caller-provided empty array, hard-coded hold list, fixture
identity or copied `current: true` cannot provide evidence. The standalone read-only product
may land under §7/P10-SI-35 before strict Part B migration; strict runtime behavior remains held.
M4 consumes these inputs to resolve its own exact operation/scope/durability dependency selection
only when every required current owner predicate passes, including real current capacity. An
honest unresolved inspection supports preparation and refusal tests, not successful switch-on.
Final assembly admission re-resolves the same selection and rechecks current owners after boot
and before activation. Basis: P10-SI-11/12/15, Two’s coherent projection and evidence rules, and
Five/Six’s current-authority boundaries; a read-only result supplies no cause for an effect.

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
4. Nine's genuine current output-use VerificationAssessment v2 names the complete response
   subject in Nine §5 and separately satisfies `response-authenticity` and
   `response-completeness` through its public current consumer (P9-NF-64–66/P10-SI-37).
   Occurrence never substitutes. Charge and old-executor quiescence retain their separate rows.
5. Eight's settlement names the same request, operation, claim, digest, observations, outcome,
   and the exact same Nine assessment fact id/hash as condition 4, consuming its four settlement
   rows. A second unrelated assessment, including a v1 occurrence pass, cannot satisfy this join.
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

PREVIEW-S2 is a separately supervised, unconfined preview grant under the recorded waiver and
P-11 assertion. It is not production installation/admission or M3/M4/M5 closure. Its separate
subscription-login route requires a frozen host-owned profile, pinned executable/version, exact
account and a desk activation record. The API-key route is unchanged; there is no key fallback,
dollar allowance, paid overage permission or automatic retry. Unsupported managed policy,
contradicted extra usage, known subscription exhaustion, missing bindings or changed profile
refuse before model launch. Unobservable extra usage remains explicitly operator-attested.

Framing v2 uses the exact fixed 1424-byte replacement `--system-prompt` instruction and unchanged
canonical stdin, with data-only context `{bindings, conversationKind:'captured-telegram-updates',
conversation}` preserving all selected updates. System plus stdin must fit 4096 UTF-8 bytes,
including JSON escaping; measure before intent and before any child. No truncation, context
projection, `--json-schema`, prose wrapping or second model call repairs an overflow or refusal.
The independent stdin-only limit remains 4096. Description,
Seven maxInputBytes and the approved Eight definition all use 4096; neither Eight owner is
changed. Extracted Decision 16384, raw terminal 65536, metadata 8192 per envelope, backing capture
capacity 1048576, max output tokens 2048 and model timeout 120000 ms remain independent bounds.
Response reservations total 330416 bytes (210264 receipt + 87384 raw base64 + 16384 answer +
2 × 8192 metadata), apart from already retained input/facts. Capacity is reserved before launch.
The original Six lease and loop window is 300000 ms in the same clock domain as Eight current
and Seven deadline; the persisted start/deadline are never restarted. Selection requires five
minutes before the unchanged trial expiry 2026-09-28T20:40:00Z.


PREVIEW-S2 adds the fixed `acceptedReplyPreviewText` projection over owner-validated same-store
facts. It reads the signed acceptance's decoded Decision, requires conclusion subject
`preview-stage2-answer`, predicate `answer-text` and a nonempty string value, and uses that value directly as the reply text.
It escapes `&`, `<`, `>` in that order, rejects unsupported controls and rendered UTF-8 overflow,
and neither repairs nor truncates a Decision. The helper grants no authority; current accepted
answer consumption and grounding remain mandatory. The original raw-answer path remains valid.

For PREVIEW-S2, the reply message text must equal either the unchanged raw accepted-answer bytes
under their digest or Five's exact signed-Decision PREVIEW projection. Value, acceptance,
conversation and current authority checks remain owner checks at reservation and dispatch; the
adapter cannot rewrite prepared text. The complete canonical OutboundMessage, including all
identities, sourceResult and JSON escaping, must fit the existing OperationDefinition maximum
of 4096 bytes. Text fitting by itself is insufficient; overflow is held without truncation or send.
Declared subscription monetary demand is zero, not evidence of zero actual cost: original Eight
finalCharge stays null and delayedExecutionExcluded false; Six actualCharge is -1, unresolved 1,
released 0, retryEligible 0 and monetary exposure 0. Pending work remains pending.

The preview sidecar persists one selected post-cutoff turn, exact context references/digest,
activation/policy bindings, one burned model slot and a terminal latch. Real Four/Five/Six/Seven/
Eight/Nine constructors share signed owner history; preview governance, local signing, original
placement/capacity and local evidence strength remain explicit waivers. A local observed return
supports occurrence only, never proof of billing settlement or quiescence. Unknown launch or
send after a crash is held without replay. A preserved response may complete only the same owner
chain within current authority and original deadline. A stopped predecessor is retained intact;
desk cutover archives it and inherits expiry, counters, cursor and every prior turn exclusion.
Framing v2 preserves the exact legacy source/terminal authority attestations. A separate ordinary
signed `preview-invocation-binding` Evidence attestation, subject the prepared request record id,
retains the complete canonical claim capture with activation/profile/policy and raw-system hashes,
complete policy, framing, full request/prepared fact references, effect/Run/attempt and submitted
capture/digest. It is appended after preparation before intent and verified on preparation,
dispatch and recovery; duplicate/mismatched or post-dispatch missing bindings refuse. No owner
schema, response evidence roster, authority equality or activation-record schema changes.

The first live attempt returned captured non-JSON prose and correctly held without a send.
The framing amendment allows one specific desk-supervised successor, maximum two activations
in the existing lineage, for one new post-cutoff update. Its read-only predecessor proof requires
the signed complete prose failure, genuine Nine/Eight/Six unresolved accounting, and no acceptance
or reply authority anywhere. Exclusive fsynced marker reservation precedes complete immutable
archive/copy; reservation/predecessor bind system/framing and policy/activation/profile, cutoff,
stop proof and unresolved store references, and completion binds archive/predecessor hashes.
Partial/corrupt copy or marker holds without replay or alternate-root retry. Active restarts and
historical reads join the prepared binding to these records. Legacy v1 history needs no retrofit.
All prior turns, cursor, bounds, expiry and counters remain inherited; the predecessor latch stays
intact. The successor's fresh local ledger does not settle or reset the first obligation. Both
outcomes retain UNKNOWN charge/quiescence and store identity. This is no production activation,
real-model success prediction, general multi-activation mechanism or third-attempt authorization.
The exact inputs, invocation and offline evidence inventory are in tests/preview/README.md.

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

### Nine's exact-response assessment and the first reply

**Rule — P10-SI-37 composes the two response predicates without changing settlement.** Owner:
Nine for the bar/derivation/current consumer; Seven for interpretation/acceptance; Eight for
settlement; Six for accounting; Five for conditional use; Ten for capture and composition.
P9-NF-64–66 are the owner checks. All ten P10-SI-17 conditions above remain conjunctive, with
P10-SI-18/24. The implementation order is:

1. Preserve the actual return and source/terminal captures; record Seven's response-observed fact
   and Eight's response observation after the already admitted request/claim/executor observation.
2. Seven's read-only `decodeCapturedProviderDecision` validates the real captured answer without
   settlement or acceptance. Nine's `createProviderResponseAssessmentPort.assess` consumes that
   genuine same-store owner decoder and those existing facts, records the
   output-aware request and derives/records one v2 assessment with all six rows. Its immutable
   subject is exactly Nine §5's subject, without any forward reference to settlement or acceptance.
3. Eight consumes that same fact's four settlement rows and appends its settlement. Six applies
   accounting to that exact settlement fact/hash without releasing unknown maximum exposure.
4. Seven consumes Nine's same fact through `consumeProviderResponseAssessment`, redecodes the exact
   captured Decision and records ProviderAnswerAcceptance only after all remaining joins pass.
5. Five conditionally opens its one standard reply Run under the original predecessor, stop,
   standing, fence and conversation obligation; Eight admits that reply's own operation.

A pre-existing settlement based on an occurrence-only assessment is ineligible for this first
G6 mode. This follows from condition 5 and the absence of a granted historical settlement-upgrade
operation: it is a bounded eligibility limit, not a new prohibition on an owner's future linked
reassessment. Keep its original accounting, exposure and observation path. Do not manufacture a
replacement operation, rewrite settlement, release resources, or invoke the provider to obtain
another response. The existing fully settled resolution remains available under its own rules.

**Rule — one route has one explicit source and completion contract.** Owner: Ten/Seven at the
return boundary, Nine at the bar. Check: P10-SI-37 with P9-NF-64/66 and Ten P10-NF-22/23/24.
The selected route is the existing `createClaudeCodeProductionRoute` in
`src/assembly/production-provider.ts:19`: provider `anthropic`, the one explicit model and route
from the admitted installation, exact executable realpath/artifact digest, canonical working
directory and pre-provisioned credential custodian. Those installed values must be real owner
references; this document supplies no model name, endpoint, account, binary digest or credential.
The supported response mode is a single bounded non-streaming CLI result envelope carrying one
final reply Decision. Tools, additional turns, streaming assembly and alternate providers are
outside this mode. The existing tools-empty/one-turn/no-hidden-retry arguments and Six/Eight
admission remain mandatory; this assessment adds no command execution or process launch.

The physical `productionProviderIO` boundary at `scripts/production-boot-io.mjs:23–29`
collects stdout chunks, then currently applies `Buffer.concat(chunks).toString('utf8')`.
That replacement decoding can collapse invalid bytes and a valid U+FFFD sequence into the same
parseable JSON string. The landed `ProductionProviderIO` result at
`src/assembly/production-provider.ts:12–14` carries only that string; its parser at :58 cannot
recover the original bytes. S21 therefore preserves the bounded collected stdout bytes in the
IO result before any replacement decoding. S9 consumes that byte field, validates UTF-8
strictly before parsing, and preserves the exact raw bytes and their computed digest through
S8's local capture/evidence path to Nine's assessment. A legacy text field may remain for existing
settlement-only consumers, but cannot establish output-use provenance. Limited/error results
retain their explicit disposition and cannot qualify as complete responses.

The pinned capture parser requires exactly one complete stdout JSON frame and rejects
malformed/extra frames, missing required result fields, invalid encoding, a limited execution,
nonzero/null exit, error/cancellation/timeout, byte/token/turn limits and tool-call completion.
It preserves the raw terminal frame before extraction. The existing extraction contract is
`structured_output` serialized by the pinned parser when present, otherwise the string `result`;
Nine must reproduce the exact chosen bytes and digest, and Seven must decode those bytes. The
parser artifact/version fixes serialization, field precedence and bounds; mere JSON validity is
not evidence of a successful final answer. The only accepted completion reason is the contract's
explicit successful-final-reply outcome, supported by captured terminal evidence. Every unknown
or unsupported reason refuses; the parser cannot infer that outcome from `type: result`,
`is_error: false`, code zero, a session id or the `complete` state alone.

The exact CLI build's provider endpoint/account authentication evidence and terminal-reason
mapping are **unclosed evidence-contract inputs**. The existing route at :56–69 discards the raw
terminal frame and has no recheckable successful-final-reply witness. Its IO at :9–14 exposes
only code, limited and stdout. Consequently this route is output-use-ineligible until an approved
AdapterEvidenceContract, pinned executable/parser and captured positive/refusing neighbors
establish that mapping and source boundary. No vendor token spelling or independently verified
provider signature is invented here. If this CLI build cannot supply the required evidence,
HOLD provider-response-source-and-completion-evidence remains; this grant does not select a
replacement provider. The gap is owned by Ten/Seven for supply and Nine for bar adequacy.

The admitted custodian observes the return of its exact confined invocation. Its source Evidence
must bind the actual authenticated provider endpoint/account, credential-reference binding
without secret bytes, executable/parser artifact, model/route, request/attempt/operation and
consumed claim. An IO-supplied label is insufficient: the approved evidence contract must state
how the trusted executable's authenticated channel and invocation correlation establish those
bindings and what the custodian actually observes. A CLI process may only expose indirect channel
evidence; code zero and terminal JSON alone authenticate neither provider nor account. The
operator-controlled executable/configuration/credential/channel boundary is a trust assumption;
a compromised executable, administrator, credential or channel controller can fool it. Record
those common failures in Nine's independence declaration. For unsigned content the ceiling is
channel-attested observation, admitted only by Nine's approved observation-strength bar. Available
provider signatures are verified for their covered fields without inflating unsigned fields.

**Rule — evidence survives the real return boundary.** Owner: Seven for the optional
`ProviderObservation.responseEvidence` envelope, Ten for its custody, One/Two for Evidence and
capture. Check: P10-SI-37. Its closed bounded groups are:

| Envelope group | Required content and preservation |
|---|---|
| Contract | Exact parser and AdapterEvidenceContract references/versions; one declared response mode; finite metadata/raw-terminal/capture bounds from the approved plan and Seven's admitted capture budget |
| Authenticated source | Observer principal/controller and source Evidence references; endpoint/account and credential-reference binding; executable artifact and selected provider/model/route; exact call/request/attempt/operation/claim/submitted binding |
| Terminal | Actual raw terminal frame and its hash at return, completion Evidence/source reference, reason under the pinned contract, byte/limit/error/termination observations and original comparable observed clock |
| Answer transform | Raw-source capture/hash, approved extraction contract and resulting exact answer digest; no caller assertion of completion or digest replaces recomputation |

The confined invocation at `src/assembly/provider-invocation.ts:103–136` copies only own data
fields and bounds nested fields without executing getters or retaining mutable provider objects.
It must include this optional envelope, preserve raw source/terminal bytes into registered local
captures, and append their One Evidence through the existing admitted capture/fact context before
publishing the canonical response capture. Source Evidence binds the already known call; it does
not require the later response observation. The stored response envelope carries those source
references and hashes, avoiding a self-hash or a causal cycle. Shared facts contain permitted
metadata/references only. No raw network export or credential bytes enter these records.

Reserve space for the original observation, the complete raw terminal frame and bounded envelope
before dispatch. The existing `6 * maxOutputBytes + 8192` bound alone is not a budget for an extra
copy of stdout plus evidence. The new total must be calculated with overflow checks from the
already enforced output limit, selected CLI stdout limit and explicit finite envelope bounds,
and fit Seven's admitted `maxCaptureBytes` and Six capacity. Missing capacity refuses the call;
a later capture failure preserves uncertainty and never drops pinned history to make room. The
numeric envelope caps and installed parser artifact remain required owner-approved contract
inputs, not guessed defaults or unlimited metadata. Legacy observations omit the envelope; they
retain historical decoding and their original settled path, but cannot meet the response bar.
Seven/Two's local custody, access, redaction and unresolved-case pins remain unchanged.

**Rule — the decisions have constitutional and owner bases.** Owner: Ten/Nine, check:
P10-SI-37 and P9-NF-64–66. The following is the bounded decision inventory.

| Decision | Basis or named gap |
|---|---|
| Separate authenticity/completeness from occurrence and semantic truth | Purpose's evidenced-completion constraints; Nine §1/§5 evidence ownership, Seven §3/§8 and the ten P10-SI-17 conditions |
| Closed subject, captured bytes, current same-store consumer | Purpose's nothing-silently-lost rule; Nine §2/§3/§5, Seven §8 and Two's canonical identity/causal admission |
| Version the existing three records, keep all four settlement rows | Nine's single type ownership and immutable version chains; Eight's unchanged settlement and Six's accounting ownership |
| Give only the three owned bodies schemaVersion 2; retain FactEnvelope.schemaVersion 1 and the existing record-owned field schema | Agent-owned engineering default, measured rather than approved under Purpose's engineering disposition and technical-correctness responsibility; no new deployment policy or constitutional amendment. P9-NF-65 measures mixed-body source-only reconstruction; P9-NF-66/P10-SI-37 measure consumption and restart while preserving signed history and current evidence checks |
| One acyclic assessment fact precedes settlement and acceptance | P10-SI-17 conditions 4–6 and Nine's predecessor rules; no available owner grant upgrades old settlements |
| One installed route and finite reply-only envelope | §1's fixed profile and Seven's existing bounded provider route; exact CLI source/terminal semantics and cap values remain the named contract-input gap above |
| Accept honest unsigned channel evidence only under an approved bar | Ten §5's model-provider row, Seven §8 and Nine §2's explicit strength/independence; no constitutional demand for a second provider or machine |
| Preserve one machine and require real protected-content review | Purpose's single-machine rule and prohibition on self-administered safeguards; §2/P10-SI-03/04/05 and LIVE repository declarations |
| Keep unavailable installation, billing and runtime proofs held | Purpose rules 2–4 and Nine §13's tier discipline; source shape or a document approval cannot supply those proofs |

**Value — operator costs and limits.** The operator must provision and maintain the one trusted
route's executable, credential/channel configuration and parser/evidence contract, arrange
protected-source review, and supply real evidence before replies can use this mode. Capturing the
raw result and source/terminal evidence uses more local disk and reserved capacity. Hashing,
parsing and checking the same bytes at use takes CPU and adds latency; the implementation must
report measured bounds, not promise a latency here. Missing, stale or ambiguous evidence can
hold an otherwise readable answer. The original call's maximum possible cost stays reserved
until its own settlement evidence closes, reducing money available for new work. Missing final
billing does not become zero, and no free retry follows from a withheld answer.

No extra model call is required merely to assess existing bytes. One machine remains supported
under the existing local-durable policy and causal closure; no peer, extra voter or second billing
service is added. Channel evidence can be fooled by a compromised trusted boundary and cannot
prove hidden model identity or answer quality. Operators receive that limit, the evidence status,
and the remaining holds rather than a universal authenticity or quality promise.

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
| `src/assembly/index.ts` | Add only the public export lines for the P10-SI-23 Ten bodies and P10-SI-32–35 read-only/set contracts, the M3 importer/loader/replay/report ports, and the M4 launch-boundary/custody-wiring ports named below. |
| `src/assembly/records.ts` | Validate P10-SI-15's owner-approved required roster instead of requiring all ten dependencies unconditionally; an inapplicable peer must carry the exact local-loss selection and cannot decode as a live dependency handle. |
| `src/assembly/contracts.ts` | Add the closed `ApprovedMinimalDependencySelection` result and its required-versus-inapplicable peer representation; preserve `AssemblyLiveDependencyHandle` as evidence of an actually admitted dependency. |
| `src/assembly/production.ts` | Resolve the P10-SI-07 owner map, the P10-SI-23 bodies, and P10-SI-15's operation/scope dependency selection; preserve public owner-port identity checks and final `runtime.admit`. |
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
| `src/assembly/assembly.declarations.json`, `src/rungraph/rungraph.declarations.json` | Add only the declaration and decoder/producer bindings for `InstallationSelectionSet`, `InstallationSelection`, `ProductionSignerReference`, and `InstalledRunGovernanceReference` and their exact fact kinds from P10-SI-23. |
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
Existing One, Two, Three, Four, Six, Eleven, and Twelve record bodies stay unchanged.
Nine's only output-use body extension is the three explicitly versioned variants in Nine §5 and
P10-SI-37's exact proposed map below; all Nine v1 bodies retain their meanings.
Six’s additional CapacityReservation body and its separate proposed source/test grants are confined
to §11 and Six §4a. A new file above implements only its named P10-SI predicates and adds no
other record or policy language.

The new test-file grant covers every predicate. The two landed production fixture helpers have
the exact migration grant below; additional set/inspection helpers are individually proposed in
this section’s M3-S map and capacity helpers in §11. No other landed fixture edit is authorized.

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

No landed test may be edited except the exact allowlist, digest, and declaration-baseline lines
and the two fixture helpers named here, or a
separately approved, individually named M3-S, M4-L, M4-G6-N or §11 grant. Owner: Ten for the fixture migration; referenced records
retain their public owners. The fixture-preservation requirements of P10-SI-20 require
tests/assembly/production-fixture.ts and
tests/assembly/round8-extended-fixture.ts to construct the P10-SI-07 inputs through real owner
producers and registered decoders. Only their binding-evidence setup and required owner-context
wiring may change. tests/assembly/production.test.ts and every assertion in it stay byte-identical.
A caller's wrong route reference or incomplete binding remains wrong or incomplete; fixture setup
must not repair it. Positive neighbor: genuine prerequisite facts reach the original callable,
role, and honest-partial cuts. An old named-kind wrapper cannot satisfy an InstallationSelection
row. This grants no compatibility bypass in production admission. The two helpers' exact reviewed
hashes may change in the inventory and be added to A2's grantedContent; only their resulting
inventory and enclosing checker pins may then move. tests/model-provider/fixture.ts and
tests/model-provider/review/assertions.mjs remain byte-identical and must pass while reading the
changed provider path. No fixture may be rewritten to look like production evidence.

The declaration changes are source inputs, not generated authority. After each unit commits its
declaration inputs, the ordinary Three generator may update only the deterministic changed files
among `generated/capabilities.md`, `generated/conversion.json`, `generated/coverage.md`,
`generated/fact-schemas.json`, `generated/glossary.md`, `generated/register.json`,
`generated/rules.md`, `generated/shape.json`, and `generated/source.json`. M3 introduces only the
three singleton/signer/governance P10-SI-23 bindings plus the explicitly additional
`assembly-InstallationSelectionSet` schema-1 binding under P10-SI-32/33. M4 registration is limited to P10-SI-17
`judgment-provider-ProviderAnswerAcceptance` v1 and the separately approved M4-L bindings:
`effect-OperationDefinition` v2, `effect-EffectRequest` v2 and `effect-OperationObservation` v2
with discriminator `native-confined-launch`, that exact operation feature, and the producer/decoder
bindings in Eight §4a. `EffectValidation` and `EffectSettlement` remain v1 with the explicitly
defined version-aware joins; outbound and provider interpretations remain unchanged. These are
proposed M4-L registrations, not permission to implement before review and operator approval.
P10-SI-37 extends that closed M4 list only with Nine's `verification-VerificationPlan`,
`verification-VerificationRequest` and `verification-VerificationAssessment` owned-body schema 2
under unchanged FactEnvelope.schemaVersion 1 and their exact producer/decoder/feature/holder and
fixture bindings. Preserve older body versions, exact
owner-reference entries and each map's separate approval and hold conditions. No additional
family is implied; registration supplies no permission to implement before required review
and operator approval.
Hand-edited generated output refuses.

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
   `src/judgment/index.ts`, `src/judgment/provider-path.ts`,
   `src/judgment/judgment.declarations.json`, and
   `src/effects/provider-path.ts`. The existing `src/effects/index.ts` and owner-directory
   allowances remain. No assertion or main-versus-HEAD comparison changes.
2. In `tests/rungraph/production-grounding-scope.test.ts`, change only `liveInputGrant` to add
   `src/judgment/index.ts`, `src/judgment/provider-path.ts`,
   `src/judgment/judgment.declarations.json`, and
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
6. P10-SI-35 permits the independently reviewed read-only inspection prerequisite to land before
   strict Part B consumer migration. M3-S implementation/performance closure is not a prerequisite
   for independent confined-boundary, custody, Nine-host or G6 evidence. Every landed unit has its
   own final reviewed source digests, single inventory digest, checker/A2/P13 pins and committed-input
   register outputs. Each implementation unit rebases before changing shared sources and recomputes
   final pins serially. No concurrent aggregate-inventory edits and no carrying an earlier aggregate
   digest across changed inventory bytes are permitted. M4 positive boot still requires the actual
   opened-root inspection/selection/capacity product; independent evidence supplies no substitute.
7. Re-pin any affected owner-reference manifest through the ordinary Three generator from the
   approved declaration inputs. Do not hand-edit generated authority or widen a source-hash
   exemption.
   The declaration baseline at `tests/rungraph/closure-registration-additivity.test.ts:12`
   is `3ded685bb0e4daa944cbe90e191d56d93ef54f70`. Preserve it and every existing declaration and
   assertion for the set/inspection cut. A later baseline move needs independent review of the
   exact additive Five declaration delta, its own named test grant and consequential pins; an
   arbitrary new HEAD is not an approved pin.
   Existing historical integrity remains mandatory: equivalent canonical bytes and both identity
   guards in `src/facts/historical.ts`; complete consumed validation inputs in Ten’s historical
   selection/signer caches; fresh origin guards/current authority without a historical verdict.
   `tests/facts/historical-memo-context.test.ts` remains a regression witness. This amendment
   grants no new Part Two performance work, cache, fence expansion or timeout change.
8. Preserve historical decoders, default replicated-mode positives, protected-scope positives,
   unprotected protected-mutation refusals, all current production provenance checks, and the
   byte-identical landed provider-path readers named above.

### Atomic-set and inspection implementation map

**Rule — independent inspection and strict migration have separate landing gates.** Owner: Ten
for inspection and selection, Five for origin gating, Six/Eleven for capacity and consumer proof,
and the desk for reviewed grants. Predicate: P10-SI-35 permits an independently reviewable
P10-SI-16 read-only cut before P10-SI-31’s strict Part B migration. It must prove actual-root
identity, coherent vector/generation, exhaustive unresolved output and typed owner inputs while
preserving the held strict runtime path. It cannot call the strict resolver and hide its first
failure as an empty list. Shared owner validation may be factored only if its strict behavior
and public runtime path remain unchanged. The inspection candidate in an unlanded worktree is
review material, not an approved cherry-pick. The positive neighbor reads a held root and reports
its real remaining work without activating it; an incoherent/unreadable root refuses.

All coordinates in this subsection refer to actual base
`f7a04dd0721d1101fa4bf8f10975844cac221ff6`. The source, helper, test and pin rows below are separate
proposed grants under P10-SI-19/20/30; operator approval of the design does not itself grant their
implementation landing. Each needs independent review and its own vetoable disposition. A new
path has no base line and is identified explicitly as new. §11’s immutable `e7dd5e3` coordinates
remain coordinates for its capacity grants, not asserted locations in this base. In particular,
`fixedRecordFixture` is at `tests/assembly/fixed-installation-contract.test.ts:26` in this base;
`tests/assembly/fixed-installation-owner-fixture.ts` is absent. This cut grants no new helper file.

| Proposed source grant | Exact existing source coordinate and sole boundary |
|---|---|
| M3-S-S1 | `src/assembly/installation-selection.ts:19,45,56,79,123,238,250,335,339,347`: add the closed set type/schema/registration and three named set producer/decoders; factor a new-set-only row validator requiring the exact Six CapacityReservation for minimal-responder and taking the single invocation-local shared basis, exact package/new-kind standing, unioned predecessors, conflict/rerun/crash semantics. Preserve singleton v1’s origin-approved AdmissionReservation interpretation and every historical path, current origin guard and signer-shared basis check; an old singleton cannot satisfy the new set or current capacity requirement. No memo, purity witness or general bulk API. |
| M3-S-S2 | `src/assembly/index.ts:38-39`: export only `InstallationSelectionSet`, `InstallationSelectionRowReference`, `OpenedProductionInstallationInspection` and `inspectOpenedProductionInstallation`, `installationSelectionSetSchemas`, `registerInstallationSelectionSetBody`, `recordInstallationSelectionSet`, `decodeInstallationSelectionSetAtOrigin`, `decodeHistoricalInstallationSelectionSet`; no changed signer/governance body. |
| M3-S-S3 | `src/assembly/assembly.declarations.json:15-25`: add one sibling `assembly-InstallationSelectionSet` protected-artifact declaration, schema-1 producer/origin/historical decoder bindings and P10-SI-32–35 obligations at this owner source; retain singleton declarations. |
| M3-S-S4 | `src/assembly/production.ts:20,42,53,97,118`: isolate `inspectOpenedProductionInstallation` for P10-SI-16/35 from `resolveReferences` and `bootProductionAssembly`; collect each binding verdict at the same actual snapshot and return genuine owner-decoded inputs. Select each historical Part A envelope’s original verified admission context under §4 for inspection and cross-history conflict checks; missing inputs report historical-installation-admission-context, never a current-package substitute. At the later strict migration gate only, resolve set row addresses through the approved closed map, scan opened history for competing sets/rows and preserve every final current-owner check at :142,168,269. No legacy-kind fallback. |
| M3-S-S5 | `src/assembly/contracts.ts:34-65,366-373`: define the closed runtime `InstallationSelectionRowReference` v1 and explicit set-row resolution arm and `OpenedProductionInstallationInspection` result, with typed null/unresolved owner inputs, vector/generation and source references. Keep stored binding fields and existing resolved-fact API meaning; distinguish actual set fact from row data. |
| M3-S-S6 | `src/assembly/records.ts:28,264,270`: only strict-migration validation of explicit new-kind bindings and P10-SI-15 applicability; preserve stored shapes and all six fold/owner/required checks. Inspection-only landing needs no stored-record decoder change. |
| M3-S-S7 | `src/assembly/production-installation-import.ts:20,26,51,81,98,135,158,173`: explicit set kind/closed fields/key and complete approved roster, deterministic prerequisite ordering and unioned references; one set append/reuse step and exact-envelope crash reuse, never incremental row append. Preserve genuine plan/bootstrap issuance and Seven-supervisor refusal before writes. At :130-139, select the original verified package/approval, origin register/owner context and applicable signer bootstrap for each historical Part A envelope under §4, retaining those inputs across reopen; do not pass all stored configurations through the new package context. Missing reconstruction holds populated-root migration under historical-installation-admission-context. Keep singleton history readable without accepting it as a new fixed-profile set. |
| M3-S-S8 | `src/assembly/production-installation-loader.ts:15,24`: only necessary typed read-only prepared-input plumbing for set/inspection and the retained original package/approval/register/owner/bootstrap inputs selected under §4 across restart; external pin-before-parse, real-path/root exclusion and issued bootstrap identity remain. Bootstrap wire bytes stay unchanged; no new mutable trust input. Leave this file unchanged if no plumbing is necessary. |
| M3-S-S9 | `src/assembly/production-installation-replay.ts:34,49,68,77`: carry the actual new kind in complete source/schema inputs and the six owner-supplied fold decisions; consume genuine set/inspection owner inputs, selecting each historical Part A envelope’s original verified admission context and applicable signer bootstrap under §4 across reopen; unavailable context holds populated-root migration under historical-installation-admission-context. Preserve complete-vector equality, cold/warm matrix, all failure and measurement accounting. No capacity renewal or reduced history. |
| M3-S-S10 | `src/assembly/production-installation-report.ts:44,57,73,106`: represent row addresses and exhaustive per-binding owner/reason/source verdicts from the same opened inspection; decode whole sets before selecting rows; retain all twenty-five existing report obligations and distinguish preparation from admission. M3-S is a desk/contract hold, not a new authority-granting runtime flag. |
| M3-S-S11 | `src/rungraph/installed-governance.ts:145-149`: independently reviewed early origin guard immediately after closed input and kind/scope checks, before basis work. Retain the final guard at :169, historical branch, genuine active producer at :216-220, current generation, approved package/owner validation and loader. No Five body or Six permission change. |
| M3-S-S12 | `scripts/slice-assembly.mjs:117,276,296-310,327-332,416-420,1078-1103`: only §7/§11’s owner-preparation/live-resolution/schema/authoring/restart regions construct or restore one exact approved set through the real public owners. Register genuine decoders and restore genuine grant references/context before replay; retain `src/facts/admission.ts:76`. No altered effect schedule, reduced workload or accounting reclassification. |

The inspection-only source subset is S2/S4/S5/S10 and any demonstrably necessary read-only S8/S9
plumbing, with additive tests and its reviewed pins; it must work against actual available history
and report a missing set honestly before the set implementation lands. It cannot require set
admission, Six allocation or a Part B runtime resolver swap. S1/S3/S6/S7 and the strict portions
of S4/S9/S10/S12 remain behind their implementation grants and P10-SI-31. M4 boot wiring remains
in its existing §7 grant: `src/assembly/production-boot.ts:38-42,82-84` consumes inspection,
removes caller `missingBindings` and the blanket fallback only when its real typed dependency
join is available, then rechecks it after `bootProductionAssembly`. Unresolved input cannot be
converted to an approved empty selection. No new entry/bin/host wiring is needed just to expose
the standalone inspection port; §7’s already named M4 wiring grants do not authorize early boot.

| Proposed helper grant | Exact existing helper and bounded preparation change |
|---|---|
| M3-S-H1 | `tests/assembly/fixed-installation-contract.test.ts:20-119`, `FixedRecordOptions` / `fixedRecordFixture` at :26: optional genuine consumer-store/owner-context preparation for the complete approved set and schema/decoder registration; preserve default singleton fixtures and every test body. This is the actual-base equivalent of §11 H1’s owner-preparation region, not a file-wide test exception. |
| M3-S-H2 | `tests/assembly/production-fixture.ts:12,123,130,137`: P10-SI-20 binding-evidence setup and §11 H2 package/reference preparation construct the exact full set through genuine owner producers, translate only explicit good fixture aliases to real set references and row identities. Preserve deliberately wrong references, absent bindings, partial cuts and `uncheckedManifest`; no automatic repair. |
| M3-S-H3 | `tests/assembly/round8-extended-fixture.ts:12,22`: §7 P10-SI-20 / §11 H3 schema, owner-history, signer and target-store wiring only; supply the new kind to genuine fold definitions and retain explicit fixture-admitted provenance. |
| M3-S-H4 | `tests/assembly/live-input-owner-fixture.ts:14,169,178,298`: §11 H4 owner schema/context, installation and returned-handle preparation only; consume H1/H2 in the same store. Preserve actual Five/Six/Eight inputs, deliberate mutations and cuts. |
| M3-S-H5 | `tests/assembly/production-boot-owner-fixture.ts:17,218,227,350`: §11 H5 initial/recovery owner context, generation, lease and package preparation only; real grants restored on restart, no installation loop or fake operation, physical checkpoints and mutation timing unchanged. |
| M3-S-H6 | `tests/assembly/production-boot-installed-fixture.ts:29`: §11 H6 descriptor, genuine decoder/owner-history/package preparation only; preserve `placeRun`, delivery, recovery and caller mutations. |

`tests/assembly/genuine-production-fixture.ts:30` remains byte-identical: H2/H4 supply its package
and owner handles. `tests/assembly/production-run-admission-lifecycle-host.ts:63` remains unchanged
for the set cut; its separate §11 H8 capacity reporting grant remains scoped there. Set selection
adds no operation or capacity category. `tests/slice/acceptance.ts:28,128,445` and
`tests/slice/acceptance.test.ts:10` have no additional set grant; §11 H9/H10 remain separately
reviewed capacity-only grants. No other helper adjustment follows automatically from a type error.

Exactly one new test path is proposed: M3-S-N1,
`tests/assembly/installation-selection-set.test.ts` (new, no base line). It exercises
P10-SI-06/07/16/23/32–35 with real producer/decoder/consumer boundaries, complete roster and
opened-root fixtures. Unit, integration and physical crash neighbors may be grouped in that
one file; it is not permission to copy owner logic or alter another test. S11 separately adds
named cases in its existing test file under T2 and T5 below. All landed test bodies, singleton-history
assertions and original bounds are preserved except the exact pin-only T1 change. The unchanged
`tests/rungraph/installed-governance.test.ts:24` witness covers both genuine active producer/loader
success and historical success after the producer clears its guard: the loader invokes the
historical decoder at `src/rungraph/installed-governance.ts:241-242`. No separate positive cases
are needed.

| Proposed landed-test grant | Exact existing test or insertion coordinate; sole change |
|---|---|
| M3-S-T1 | `tests/harness-adapters/a2-governance-and-additivity.test.ts:7`, `P13-A2-ADDITIVITY permanent main-vs-HEAD comparison keeps every touched owner legacy fixture byte-identical`: only `grantedContent` at :10 gets final reviewed hashes of actually changed H1–H6, S11’s test file and inventory, and independently authorized scope/helper pins where actually required. No directory/prefix/comparison/assertion changes. |
| M3-S-T2 | Add immediately before the closing suite at `tests/rungraph/installed-governance.test.ts:46`, new case `P10-SI-10/23 inactive origin refuses before historical basis preparation`: well-shaped inactive origin performs zero basis preparations, with closed-input and wrong-kind/scope checks retaining precedence; test instrumentation only, no production flag. Existing :24 and :36 test bodies stay byte-identical. |
| M3-S-T5 | Same additive insertion coordinate `tests/rungraph/installed-governance.test.ts:46`, new case `P10-SI-10/23 stale wrong-register and changed-package governance refuse`: add only the needed stale/wrong-register/changed-package negatives; preserve the existing :36 assertions without duplicating them as new cases. |

Each existing test witness below is independently frozen, not a migration grant. P10-SI-31
requires the entire affected roster, including negatives, accounting, restart and public entry;
these named witnesses do not reduce that roster:

| Exact landed test coordinate | Required unchanged witness |
|---|---|
| `tests/rungraph/installed-governance.test.ts:24` | `records approved immutable references once and builds the existing runtime governance`; unchanged witness for genuine active producer/loader success and historical decoding without an active origin guard |
| `tests/rungraph/installed-governance.test.ts:36` | `refuses missing gate, wrong decoder, serialized callback and mutable policy` |
| `tests/assembly/production.test.ts:11` | P10-SEAM-01, all seven production binding groups as a closed additive contract |
| `tests/assembly/production.test.ts:30` | P10-SEAM-02, platform witness cannot equal requester/surface/effect adapter |
| `tests/assembly/production.test.ts:39` | P11-V31, conversation-route resolves by its fixed signed-history kind, never caller `expectedKind` |
| `tests/assembly/production.test.ts:49` | P10-SEAM-03, partial binding stays partial and never becomes boot handles |
| `tests/assembly/production.test.ts:66` | P11-V40 R4, every confirmation operation is callable before boot |
| `tests/assembly/production.test.ts:77` | R9-F2 V65, unavailable posture refuses before handles |
| `tests/e2e/slice.test.ts:15` | P11-NF-43/49/50, uninterrupted control succeeds through public boot and unchanged `withinExecution` at :19 |
| `tests/assembly/production-boot-public-entry.test.ts:7` | `boots the public application before Telegram poll; fixture-admitted: ${fixtureAdmissionNames}` |
| `tests/assembly/production-boot-public-entry.test.ts:22` | `installed bin boots the same public application and admits Four; fixture-admitted: ${fixtureAdmissionNames}` |
| `tests/integration/rereview7-conformance.test.ts:62` | V59, `real composition slice accepts exact current independent evidence` |
| `tests/e2e/rereview7-conformance.test.ts:35` | V71, `process kill after durable Part Nine record restarts through real public assembly to the same witnessed result`; successful recovery required |
| `tests/assembly/production-run-admission-lifecycle.test.ts:25` | `SIGKILL after Six durable write and before the append callback reconstructs no invented Run` |
| `tests/assembly/production-run-admission-lifecycle.test.ts:44` | `terminal Run closure survives its durable callback cut with one Run and one unreleased reservation` |
| `tests/rungraph/production-grounding-scope.test.ts:5` | `PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories`; no set/inspection fence expansion |
| `tests/operator/round15-regressions.test.ts:80` | V79, changed source paths stay inside the explicit owner allowlist; no set/inspection fence expansion |
| `tests/rungraph/closure-registration-additivity.test.ts:10` | P5-SEAM-RC-R9-F3-ADMISSION-BINDINGS / P5-SEAM-RC-R10-F3-ADDITIVE-REGISTRATION; :12 retains `3ded685bb0e4daa944cbe90e191d56d93ef54f70`, no Five declaration-baseline move for this cut |

| Proposed registration/pin grant | Exact input or support coordinate and boundary |
|---|---|
| M3-S-P1 | `scripts/register-owner-references.mjs:33-44`: add exactly `decodeInstallationSelectionSetAtOrigin` and `decodeHistoricalInstallationSelectionSet` bound to `src/assembly/index.ts` / `src/assembly/installation-selection.ts`; add fixture ids P10-SI-32, P10-SI-33, P10-SI-34, P10-SI-35 and exactly N1 to the Part Ten fixture path list. Preserve existing owner checks and singleton decoders. |
| M3-S-P2 | `register-source/owner-references/part-ten.json:5,24`: register those exact set decoder artifacts and four fixture ids at N1, with reviewed source hashes; retain singleton entries and repin only changed selection source/H1 artifact bytes and all four existing `src/assembly/index.ts` module hashes at :28,39,50,61. For S11 alone, `register-source/owner-references.json:25,126,137` refreshes its existing test and two Five decoder source artifacts. No fabricated review or generated authority. |
| M3-S-P3 | `tests/assembly/production-grounding-inventory.json:5241` (`reviewedSupportSources`): final reviewed entries only for actually changed S1–S12 sources/helpers, H1–H6, T2 and T5’s file, N1, and P1/P2 registration inputs where the support ledger requires them. Exact existing anchors include :5245 slice, :5254 contracts, :5260 index, :5263 production, :5265 records, :5388 production fixture, :5396 round8 fixture, :5443 selection, :5445 loader, :5446 Five, :5447 report, :5448 replay, :5449 import, :5450 H1. Record every old/new digest and reviewed source commit; no obligation/assertion mapping deletion. |
| M3-S-P4 | `scripts/check-assembly-contracts.mjs:178`: final reviewed inventory digest; T1’s exact `grantedContent` inventory/helper/test entries at :10; `scripts/check-p13-contract-map.mjs:266`: resulting T1 hash. Unchanged source-scope test retains its digest. Only already enumerated deterministic `generated/*` outputs may regenerate through Three after committed input review; no hand edits and no additional kind. |

The six folds must receive the actual new kind in their source roster. Their decisions for
`assembly-InstallationSelectionSet` are explicit `ignores`: intake-ledger, no intake event;
principal-binding, no principal grant or Four binding; run-view, no Five work state;
outbound-obligation, no effect/settlement; authority-queue, no approval act; guard-repair, no
owned repair observation. This follows Eleven’s `src/operator/plane.ts:6-60` informational
fold contract: owner configuration is consumed by Ten, not minted as semantic work by a fold.
Pass the kind through H3/S9/S12’s real inputs to the existing owner definition; no `plane.ts`
edit, all-ignores replacement projection, dropped source bytes or changed owner meaning is
permitted. All six keep their existing folds for actual owner events and explicit nonempty
ignore reasons, with actual set bytes/facts included in measured populations.

**Rule — structural evidence proves the full workload.** Owner: Ten with the public owners and
Eleven/desk for P10-SI-31. P10-SI-32–35 require N1 to cover all of these neighbors:

- Whole-set signature success and a one-row mutation refusal; exact row digest, canonical order,
  duplicate key/digest and unknown role negatives; complete approved applicable roster positive.
- Missing/wrong-owner reference and mixed scope/machine/generation refusal; copied unissued
  register/bootstrap and inadequate new-kind import grant refusal; genuine owner-issued positive.
- A mixed-history/reopen case reads genuine singleton, signer and governance v1 envelopes plus
  the new set with unchanged old bytes and each envelope’s original verified admission inputs;
  conflict detection remains correct and no singleton runtime fallback is allowed. Missing
  historical inputs yield the named unavailable-evidence hold. A fresh-root set test cannot
  discharge this compatibility obligation or establish an installation-generation transition.
- A genuine old minimal-responder singleton referencing AdmissionReservation decodes successfully
  under its origin-approved v1 interpretation, while refusing it as current set/capacity evidence.
- Equal rerun and physical crash immediately before/after set append, including lost acknowledgment:
  no partial row installation and reuse of the exact committed envelope. Other package facts keep
  their existing restart obligations. Conflicting unequal sets/rows anywhere in opened history
  inhibit the scope, including conflict evidence outside the selected set’s historical cone.
- Exact per-row expiry and unavailable evidence refuse their dependent use; Six’s current same-store
  rebind chain, retained debit, no ordinary-slot consumption and immutable row horizon remain intact.
- Complete set plus missing current route evidence retains other resolved rows; restoration clears
  only that dependency. Missing/corrupt/incomplete set reports all affected slots. Malformed root,
  unreadable root, mixed vector or unprovable generation refuses inspection, never an empty list.
- Inspection has zero writes, allocations, activation/poll/effect calls and cannot make strict boot
  succeed. Genuine signer/governance/direct-owner paths remain unchanged. Test instrumentation proves
  one shared basis invocation per set validation, not one per row; no fabricated singleton envelope.

Measure the unchanged main control and the structurally changed full actual Part B roster/control
at the original bounds, including the 180-second bound, then run every P10-SI-31 positive, negative,
accounting, restart, public-entry, V59 and successful V71 consumer. No timeout increase, skipped
consumer, reduced row roster or crude-pilot timing is evidence. Count and time Five’s inactive
origin and genuinely active calls separately. Outer-owner sample partitions cannot predict wall
clock savings. The unapproved capacity memo and M3-E2/E3/E4 performance approaches are stopped;
retain their drafts/receipts as evidence, retire the capacity memo from implementation, and do
not revive them or add another Two optimization. A failed structural measurement retains M3-S;
it grants no local memo or universal history-read framework.

The split sequence is binding:

1. Land the separately converged mutable-envelope correctness fix and independently review/measure
   S11’s early Five origin guard with T2 and T5, the unchanged :24 witness named above, and final
   pins. Keep the working main workload intact.
2. Obtain operator approval of the bounded structural design/costs and separate implementation
   grants before implementing its new body or sequence. Independently extract, review and land
   truthful P10-SI-16 inspection; preserve the held strict runtime path. Design approval and
   read-only inspection supply no Part B performance or activation evidence.
3. Develop independent M4 restricted Native launch/forbidden-path proof, custody, the
   operator-administered Nine verifier/clock/observer host and the designed Seven/Five/Eight
   accepted-answer join through their real public owners. Each independent landing has reviewed
   final pins and the next rebases; no concurrent aggregate-inventory edits. The desk can execute
   the restricted-identity proof; a worker session’s privilege limit does not hold all boundary work.
4. M4’s positive boot/dependency-selection join still waits for the inspection product and real
   current Six capacity/activation evidence. Honest unresolved input permits preparation and
   refusal tests only. Never substitute `[]`, host labels or fake approved selections.
5. M5’s bounded driver/state machine and model-independent limited-response preparation may proceed
   against public contracts. Its actual bin conversation, second turn, restart, stop and uncertainty
   proof require admitted M3/M4 dependencies. Even a limited reply is an effect needing current
   authority, capacity, durability and delivery. No live bot/model use or usable-live-agent claim
   is authorized while those gates remain held.

Basis: the durable-cause and truthful-evidence constraints in `docs/00-the-purpose.md:99-124`,
Ten’s manual/supervised boundary (`docs/14-the-assembly.md:882-902`), Seven’s bounded supervisor
(`docs/11-the-judgment-doorway.md:137-145`), and §11’s strict-consumer and activation obligations.
The sequence supports one machine under P10-SI-03/04/05/29; it adds no peer prerequisite. The
remaining performance result, physical activation joins and general callback interpretation gap
are explicitly unevidenced; no preference resolves them.

---

### M4-L — fixed confined-launch implementation cut

The document landing order is binding: land the independently approved M3-S document first,
rebase this supplement onto that landed document, then land the corrected M4-L supplement.
P10-SI-32–35 retain M3-S's atomic-set/admission/resolution/inspection meanings; launch is
P10-SI-36. If an intervening approved document allocates that id, use the next unused id rather
than overwrite a predicate. The shared contract retains both registration lists, all individually
named M3-S/M4-L/§11 exceptions, the sole §8 P10-SI-20 definition, inspection prerequisites,
original-bound strict-consumer gates, and the historical-context/generation-transition holds.

**Rule — each proposed grant is separately reviewable.** Owner: Eight/Ten for their boundaries,
Six for the sole S11 consumer addition, Three for registration tooling, the desk for final pins
and the operator for protected content. Predicates: P10-SI-19/20/36. These are proposed grants
pending independent review convergence and operator approval; documentation approval closes only the design hold. No source implementation,
protected-content approval, pin or runtime pass is created by this text. Source coordinates in
this subsection are immutable base `9e17a00fe95440ef8fbe878dc2f0cd3cca2a47ec`. `:1 (new)` means
an absent path whose proposed file starts at line 1, not an existing source location. S11 alone
uses base `452729a0d791f9b5425c2fe288de428e88dc30fb`; its :306–313 region is the :288–295
consumer identified at `c5e2b67d3df0cca7321aa806d0da2cb1d8910d97`. §12 fixes the initial-worker
preparation and resource-reference interpretation consumed by S2/S3/S9/S11, without a Five edit.

| Grant | Exact source path and bounded delta | Protected-artifact disposition |
|---|---|---|
| M4-L-S1 | `src/effects/contracts.ts:7–51,112–137`: closed v2 process record and public execution/executor consumer types from Eight §4a; retain all v1 message types/purposes and provider interpretations. | LIVE `src/effects/**` |
| M4-L-S2 | `src/effects/records.ts:18–47,89–182,204–217`: exact v2 shapes, registrations, producers, origin/historical decoders, canonical joins and version-aware validation/settlement references; enforce §12's initial Run anchor, Eight-derived identities and exact prior-allocation/prepared-fact join; preserve v1 meaning. | LIVE `src/effects/**` |
| M4-L-S3 | `src/effects/doorway.ts:21–42,132–246,359–402`: genuine same-store launch constructor/check, bounded admission, durable one-use handoff, observation and restart reconstruction only, including §12's admitted unfinished Run preparation and original mapping recovery. No Five-owned pre-grounding RunStep or launch-attempt producer is required or invented. Message/live-input/provider behavior stays intact. | LIVE `src/effects/**` |
| M4-L-S4 | `src/effects/index.ts:1–7`: public process types, constructor/check, producer and decoder exports from Eight §4a only. | LIVE `src/effects/**` |
| M4-L-S5 | `src/effects/effect.declarations.json:1–6`: only `native-confined-launch` feature/operation, its explicit schema/producer/decoder bindings, bounds/metrics and P10-SI-36/inherited checks. Preserve both protection declarations. | LIVE `src/effects/**` |
| M4-L-S6 | `src/assembly/harness.ts:7–39,83–97`: bind launch and original-launch observation to Eight's genuine consumer and durable identity; remove reliance on the launch map as authority. No delivery shortcut or new lifecycle method. | Declared `src/assembly/**` is DARK at this base, not LIVE |
| M4-L-S7 | `src/assembly/production-native-context.ts:9–22,40–58`: bind current process identity/artifact and loading readback to the exact admitted launch; keep context delivery's separate consumed claim and payload checks. | Same DARK assembly pattern |
| M4-L-S8 | `src/assembly/production-launch-boundary.ts:1 (new)`: the exact restricted OS executor, canonical profile/artifact/identity/handle checks, bounded expiry enforcement and original-process observation. No policy authoring, arbitrary executable, hidden kill/cleanup operation or new record. | Same DARK assembly pattern |
| M4-L-S9 | `src/assembly/production-composition.ts:22–37,46–92`: only public-owner launch constructor/executor wiring on the same store, consuming Five's unchanged Run open/read and the genuine Six execution consumer with S11 under §12; no replacement admission wrapper, positive boot/dependency selection or capacity bypass. | Same DARK assembly pattern |
| M4-L-S10 | `src/assembly/index.ts:14–17,49`: only exports for the named launch boundary and its public types. | Same DARK assembly pattern |
| M4-L-S11 | `src/transport/run-admission.ts:306–313` at `452729a` (the :288–295 consumer at `c5e2b67`), inside `createProductionRunAdmission.execution`: add only §12's prepared-fact-reference arm. Resolve the exact prepared AdmissionReservation in the existing verified prefix by fact id, validate kind/run/original fence and required resource reference, derive its operation and select that operation's current reservation; compare immutable request/attempt/digest bindings and retain non-closed/current-run/current-assignment checks. Preserve the legacy operation-key arm and all its checks; an invalid fact reference cannot fall back to a guessed key. No change to prefix verification, placement selection, provenance, authority, contracts, schemas, settlement, indexes or other methods. | LIVE `src/transport/**`; separate exact protected-content approval at landing, no directory grant |

Eight's LIVE declaration is `src/effects/effect.declarations.json:2–3`; Ten's DARK declaration
is `src/assembly/assembly.declarations.json:7–10`. A future unprotected runtime posture does
not downgrade repository protection. Exact LIVE source content requires operator approval.
No new effects source file is assumed. Six remains read-only except S11's exact additive consumer
region; Nine, held M3 files and the pending selection-set design remain read-only. The separate
G6 `provider-path.ts` grant does not become a launch grant.

| Grant | Exact helper/input dependency and bounded delta | Protected-artifact disposition |
|---|---|---|
| M4-L-H1 | `scripts/register-owner-references.mjs:9,13–46`: add exactly `part-eight` to the manifest list and its six process origin/historical decoder bindings named in Eight §4a; its fixture/probe lists are empty. Add `36` to Ten's fixture roster for the single P10-SI-36 registration. Decoder modules are `src/effects/index.ts`; decoder artifacts are `src/effects/records.ts`. Producers remain declaration bindings, not a new manifest field. No wildcard owner, path, decoder or fixture acceptance. | LIVE `scripts/*register*.mjs` |
| M4-L-H2 | `register-source/owner-references/part-eight.json:1 (new)`: existing manifest shape, owner `part-eight`; exact six origin/historical decoder entries in Eight §4a, module/artifact pins for S4/S2, and empty fixture/probe/document lists. No duplicate P10-SI-36 id, probe claim or invented governed-document id. | LIVE `register-source/**` |
| M4-L-H3 | `register-source/owner-references/part-ten.json:4`: additive P10-SI-36 fixture for `tests/assembly/fixed-installation-live.test.ts`, retaining every existing entry and refreshing only artifact pins whose approved bytes changed. | LIVE `register-source/**` |

The registration gap is concrete: `scripts/register-owner-references.mjs:9,13–46,58–66,88–96`
accepts only its enumerated owners/decoders and lacks Part Eight. H1–H3 close that exact gap
without assuming a register can be synthesized. Toolchain protection is declared at
`src/register/toolchain.declarations.json:119–126,135–142`. Both manifest contents and H1's
exact script delta require operator approval. Existing `boundary.ts`, Two canonical/owned-body
registration and historical decoding, Six authority/records, Ten contracts/records/history and
Nine public assessment are consumed unchanged. Six's production run-admission execution consumer
has only the separately reviewed S11 exception; every surrounding check remains unchanged.
Their public behavior, not copied validation, is the source of truth. If an additional helper/schema/fold dependency is needed, name its
file:line and keep that dependent mode held; these rows do not authorize it.

| Grant | Exact test or pin boundary |
|---|---|
| M4-L-T1 | `tests/effects/fixed-native-launch.test.ts:1 (new)`: new owner-contract tests for P10-SI-36, genuine schema/producer/origin/historical paths, same-store provenance, zero-OS refusal controls and restart/claim cuts. A genuine v1 observation with its claim and settlement must still historically decode and resolve the original Six operation after v2 registration; a forged stored legacy intermediate refuses. Registration-helper positive and refusal cases run here through the genuine helper; no landed register test edit. |
| M4-L-T2 | `tests/assembly/fixed-installation-live.test.ts:1 (new at this base)`: launch-specific full-port integration and actual physical lifecycle/attack evidence for P10-SI-36 and its named neighbors only. Preserve the message-purpose decoder diagnostic when bringing in the independently prepared test (diagnostic coordinates are :8–26 in the confined-runtime worktree, not landed lines here). Exact temporary profile/worker proof artifacts may be constructed inside this test's bounded temporary directory and S8's granted boundary; no new helper file is granted. |
| M4-L-T3 | `tests/operator/round15-regressions.test.ts:80,89`: V79 source allowlist only; the four S1–S4 paths are already present, retain them and add exactly `src/effects/effect.declarations.json`. Retain other approved entries, assertions and comparisons. No `src/effects/` prefix. |
| M4-L-T4 | `tests/rungraph/production-grounding-scope.test.ts:5,9`: exact `liveInputGrant` addition of `src/effects/effect.declarations.json`; preserve S1–S4 and every other entry/comparison. Existing assembly prefix is no semantic grant beyond S6–S10. |
| M4-L-P1 | `tests/assembly/production-grounding-inventory.json:5241`: after independent review add/update only changed S1–S11, H1–H3, T1–T4 artifact digests and applicable `reviewedSupportSources` entries, including the final independently reviewed `src/transport/run-admission.ts` digest for S11. Preserve obligation rows, mappings and unrelated hashes; P10-SI-36's new evidence cannot replace a landed obligation. |
| M4-L-P2 | `scripts/check-assembly-contracts.mjs:178`: only resulting `REVIEWED_GROUNDING_INVENTORY` digest of P1's reviewed final bytes; no checker logic change. |
| M4-L-T5 | `tests/harness-adapters/a2-governance-and-additivity.test.ts:7,10–19`: A2's `grantedContent` inventory and scope-test final digests only for this base. If T2 has landed independently before this cut, its exact approved launch-only additions need its own desk-reviewed content entry; preserve its diagnostic and all unrelated assertions. No general test exemption. |
| M4-L-P3 | `scripts/check-p13-contract-map.mjs:266`: only the enclosing digest of T5's final reviewed bytes. No architecture predicate change. |

The two provider fixture/readers `tests/model-provider/fixture.ts:1` and
`tests/model-provider/review/assertions.mjs:1` remain byte-identical. So do all other landed
assertions and helpers except the individually specified lines above. No fixture-admitted
provider route, owner label or recorded-bytes custodian proves live launch or confinement.
A rebase discovering another enclosing pin, registration count, helper or assertion dependency
reports that exact file:line for separate disposition; it never moves an arbitrary baseline.

P10-SI-36 has one register fixture binding in H3, to T2; its evidence contract requires both T1
and T2 to execute and report their separate tiers. No duplicate fixture id denotes two different
artifacts. S5 and H1–H3 are the exact committed declaration/owner-reference inputs. The process decoder
artifacts are S2/S4; T1/T2 are the exact inspection artifacts. After the desk commits approved
inputs, Three's ordinary generator may change only deterministic outputs among
`generated/capabilities.md`, `generated/conversion.json`, `generated/coverage.md`,
`generated/fact-schemas.json`, `generated/glossary.md`, `generated/register.json`,
`generated/rules.md`, `generated/shape.json`, `generated/source.json`. Call this output grant
M4-L-G1; no handwritten register or new output is authorized. Final digests are outputs of
independently reviewed final bytes, never placeholders this contract supplies. The desk records
old/new pins and reviewed source commit, then lands serially with other units. This grant does
not alter `register-source/owner-references.json`'s Part Five declaration baseline or strict
Part B, nor any purpose, Seven, Six or Nine record contract.

### M4-G6-N — exact-response implementation map

**Rule — the output-assessment cut is exact and separately reviewable.** Owners: Nine/Seven/Ten
for response evidence and consumption, Eight/Five for existing G6 consumers, Three for committed
registration inputs, the desk for final pins and the operator for protected content. Checks:
P10-SI-19/20/37 and P9-NF-64–66. Every row below is a **proposed grant**, pending independent
design convergence and exact implementation/protected-content approval. This document grants
no source write or live activation. No directory-wide grant or new source file is assumed.
Coordinates are immutable base `9e17a00fe95440ef8fbe878dc2f0cd3cca2a47ec`; `:1 (new)` denotes an
absent file, not landed lines. A rebase must resolve the named region against reviewed bytes.

Document merge order: approved M3-S (`design-m3s-selection-set-and-inspection`, reviewed coordinate
`1e7feb2`) first, then the approved Eight launch supplement (`design-m4-fixed-launch-operation`,
reviewed coordinate `e5ea93f`) semantically rebased onto M3-S, then this supplement semantically
rebased onto both. Reserve P10-SI-32–35 for
M3-S, P10-SI-36 for launch, P10-SI-37 for this output-use composition, and P9-NF-64–66 for Nine.
Retain both preceding maps and their owner meanings, registration inputs and held dependencies.
M3-S's `historical-installation-admission-context` original-context reconstruction hold,
`installation-generation-transition` hold, actual opened-root inspection requirements and
strict-consumer/performance closure gates remain operative. The purpose's fully functional
single-machine Rule resolves `ordinary-local-durability-scope`; Eight's M4-L implementation/admission
hold remains operative. Nine assessment resolves none
of these holds. This document order does not require completed M3-S implementation or
performance closure for independent M4
evidence and authorizes no new implementation unit.
If another approved allocation intervenes, resolve it before merge; never reuse its number.
This document order adds no runtime dependency between G6 and any separate preparation unit.
Implementation units land serially after their
own review/gate, rebase, and recomputation of final shared pins; no concurrent aggregate edits.

| Grant | Exact source region and sole proposed delta | Protection at base |
|---|---|---|
| M4-G6-N-S1 | `src/verification/contracts.ts:7–46,120–160`: preserve v1 aliases/four-predicate vocabulary; add the closed response subject, two predicates, three v2 output variants, version union and public port/view types from Nine §5. | LIVE `src/verification/**` |
| M4-G6-N-S2 | `src/verification/records.ts:18–38,82–119,195–211,225–302`: version-specific exact shapes/validators, owned-body schema 2 for exactly three families; unchanged FactEnvelope schema 1; body-version-aware validation/append, origin/historical branches, lossless v1 decoding adapter and canonical identity/closure. No changed v1 meaning or historical promotion. | LIVE `src/verification/**` |
| M4-G6-N-S3 | `src/verification/runtime.ts:64–125`: add `deriveProviderResponseAssessment` and its resolved evidence input; reuse the four settlement derivations without changed strength/freshness rules. No caller evaluator. | LIVE `src/verification/**` |
| M4-G6-N-S4 | `src/verification/effect-consumption.ts:14–37,39–205`: add `createProviderResponseAssessmentPort`, `assess`, current synchronous response consumption and same-fact v2 settlement consumption; retain legacy input-key/history checks. | LIVE `src/verification/**` |
| M4-G6-N-S5 | `src/verification/index.ts:1–15,31–34`: only the named new derivation, port/types and `decodeVerificationRecordAtOrigin` / `decodeHistoricalVerificationRecord` exports. | LIVE `src/verification/**` |
| M4-G6-N-S6 | `src/verification/verification.declarations.json:1–12`: explicit owned-body v1/v2 producer/decoder bindings for VerificationPlan, VerificationRequest and VerificationAssessment, retaining the outer v1 family bindings, and bounded feature/holder bindings for P9-NF-64–66. No outer v2 family or new register field. No `verification.core` activation, no claimed held edge from unexecuted evidence; retain all existing LIVE protection. | LIVE `src/verification/**` |
| M4-G6-N-S7 | `src/judgment/contracts.ts:135–142`: optional bounded `responseEvidence` envelope and its legacy absence, using existing Evidence/capture contracts. | LIVE `src/judgment/**` |
| M4-G6-N-S8 | `src/assembly/provider-invocation.ts:12–17,35–70,103–144`: finite evidence/capture reservation, descriptor-only copying, and local capture/admitted Evidence preserving S21/S9's exact raw stdout bytes and digest through the response subject to Nine; retain exact claim/request/answer binding at return. Keep actual claim consumption, byte/token bounds, custody and zero hidden retries. | DARK `src/assembly/**` |
| M4-G6-N-S9 | `src/assembly/production-provider.ts:9–14,19–71`: selected CLI source/completion observation and pinned parser only; consume S21's bounded stdout byte field with strict UTF-8 validation before parsing and preserve its exact bytes/digest to S8. A retained legacy text field is settlement-only and cannot establish output-use provenance. No extra provider, process-launch capability, arbitrary executable or loosened admission. Unsupported source/terminal semantics stays held. | DARK `src/assembly/**` |
| M4-G6-N-S10 | `src/assembly/production-provider-owners.ts:6–7,12–26,39–59`: construct the genuine same-store Nine response port, supply it to Seven/Eight and preserve the real legacy owner composition. | DARK `src/assembly/**` |
| M4-G6-N-S11 | `src/judgment/provider-path.ts:37–50,55–74,75–172,248–281`: P10-SI-17 acceptance schema/producer/origin/historical decoder and current Nine consumer with exact Decision/settlement/accounting joins; extract `decodeCapturedProviderDecision` at :263–272 for pre-settlement read-only Nine consumption and reuse in both Seven paths. Preserve ProviderJudgmentResolution's `unresolved === 0`. | LIVE `src/judgment/**` |
| M4-G6-N-S12 | `src/judgment/index.ts:1,7–8`: only acceptance producer, `decodeProviderAnswerAcceptanceAtOrigin`, `decodeHistoricalProviderAnswerAcceptance`, `decodeCapturedProviderDecision` and associated public types. | LIVE `src/judgment/**` |
| M4-G6-N-S13 | `src/judgment/judgment.declarations.json:1–12`: only ProviderAnswerAcceptance binding, the `decodeCapturedProviderDecision` public decoder and the response-evidence consumer/producer references supporting its P10-SI-17/37 contract. Retain both LIVE protections. | LIVE `src/judgment/**` |
| M4-G6-N-S14 | `src/effects/provider-path.ts:35–49,119–150,348–412`: same-assessment settlement and accepted-answer consumer under the existing P10-SI-17/18/24 separation. Keep fully settled path, all retry bars, unknown exposure and `chargeSettled: false` for unresolved use. | LIVE `src/effects/**` |
| M4-G6-N-S15 | `src/effects/index.ts:4–5`: only the existing G6 grant's public accepted-answer settlement consumer export; no provider-api or process-record expansion. | LIVE `src/effects/**` |
| M4-G6-N-S16 | `src/rungraph/types.ts:196`: P10-SI-24 public `openAcceptedProviderReply` contract only; no new Five body. | Outside LIVE `src/verification/**`, `src/judgment/**`, `src/effects/**` |
| M4-G6-N-S17 | `src/rungraph/records.ts:87–115,223–242`: acceptance-backed standard Run opening and original conversation-obligation resolution only; retain all existing run decoder rules. | Outside LIVE `src/verification/**`, `src/judgment/**`, `src/effects/**` |
| M4-G6-N-S18 | `src/rungraph/service.ts:14,144–179`: P10-SI-24 current conditional one-use reply opening/reconstruction only; preserve original pending provider step and exposure. | Outside LIVE `src/verification/**`, `src/judgment/**`, `src/effects/**` |
| M4-G6-N-S19 | `src/rungraph/index.ts:1–7`: only the named reply-opening public exports/types. | Outside LIVE `src/verification/**`, `src/judgment/**`, `src/effects/**` |
| M4-G6-N-S20 | `src/assembly/production-composition.ts:22–37,65–66,84–91`: wire the assessed acceptance to the separately admitted reply through public owners on the same store. No boot, dependency-selection, launch or capacity change. | DARK `src/assembly/**` |
| M4-G6-N-S21 | `scripts/production-boot-io.mjs:17–30`: preserve the bounded collected stdout bytes through the `productionProviderIO` result before replacement decoding, carrying those bytes on success and preserving explicit limited/error disposition. Retain executable/args/cwd/env, timeout, maximum-byte enforcement, no shell and no retry. No launch capability or storage/Telegram/native-context IO change. | No declared protected-artifact pattern matches this host at the base; outside LIVE `src/verification/**`, `src/judgment/**`, `src/effects/**` and the DARK `src/assembly/**` pattern. |

LIVE declarations are `src/verification/verification.declarations.json:7–10`,
`src/judgment/judgment.declarations.json:3–5`, and `src/effects/effect.declarations.json:2–3`.
The DARK assembly pattern is `src/assembly/assembly.declarations.json:7–10`. An allowed unprotected
runtime-artifact posture does not remove LIVE repository protection. The final exact Nine,
Seven and Eight content requires operator protected-content approval, separately from design
approval and the exact source grant.

**Rule — version consumers and helpers are inventoried before extension.** Check: P9-NF-65 and
P10-SI-19/37. The generic runtime recorder at `src/verification/service.ts:11–35` delegates to
record decoding/comparison/spine append; :39–69 uses plan arms and current posture, not response
verdicts. `src/verification/storage.ts:9–27,34–89` folds unchanged family names and delegates
identity; it requires no new merge class or projection edit. Both stay read-only. The v1 ports in
`src/verification/reconciliation.ts:69–200` and recovery in `src/verification/traces.ts:16–44`
keep v1 types, requests and settlement semantics. `src/verification/review.ts:90–116` consumes
identity/source status; `src/verification/provider-settlement-support.ts:19` reads only the four
named settlement predicates. These files stay read-only and are regression dependencies. The
new contracts preserve legacy aliases while the generic record union admits v2. If compilation
or actual durable reconstruction needs another helper change, name the exact region and refusing
regression for separate review; these entries are not implied edit grants.

The material helper exception is Seven's `observationCheck` and closed snapshot: merely adding
an optional type field would cause `snapshotObservation` to classify new envelopes as malformed.
Its exact proposed compatibility grant is H1, tested through the real return and legacy paths.

| Grant | Exact helper/registration input and sole proposed delta | Protection at base |
|---|---|---|
| M4-G6-N-H1 | `src/judgment/model-adapter.ts:12–31,33–68`: validate/copy only the bounded optional envelope, retain descriptor/no-getter checks, compute its finite capture bound and preserve byte-identical legacy receipt encoding when absent. Never derive either Nine verdict here. | LIVE `src/judgment/**` |
| M4-G6-N-H2 | `scripts/register-owner-references.mjs:9,13–46`: enumerate `part-nine` and `part-seven`; exactly Nine's `decodeVerificationRecord`, `decodeVerificationRecordAtOrigin`, `decodeHistoricalVerificationRecord` (module S5/artifact S2), Seven's two acceptance decoders plus `decodeCapturedProviderDecision` (module S12/artifact S11), P9-NF-64–66 fixtures at T1, and Ten's P10-SI-17/24/37 fixtures at T3/T4. Retain M3-S/Eight entries. No wildcard or new manifest field. | LIVE `scripts/*register*.mjs` |
| M4-G6-N-H3 | `register-source/owner-references/part-nine.json:1 (new)`: existing manifest shape, owner `part-nine`, exactly H2's three decoder entries with S5/S2 hashes and three P9 fixture entries pointing to T1; probes/documents empty. Producers remain declaration bindings. | LIVE `register-source/**` |
| M4-G6-N-H4 | `register-source/owner-references/part-seven.json:1 (new)`: existing shape, owner `part-seven`, exactly H2's two acceptance decoder entries and `decodeCapturedProviderDecision` with S12/S11 hashes; fixtures/probes/documents empty. | LIVE `register-source/**` |
| M4-G6-N-H5 | `register-source/owner-references/part-ten.json:4`: single additive fixture binding each for P10-SI-17/24 to T3 and P10-SI-37 to T4, retaining every existing fixture/decoder and only refreshing changed approved artifacts. | LIVE `register-source/**` |
| M4-G6-N-H6 | `scripts/check-verification-contracts.mjs:10–22`: extend exact disposition population from 63 to 66, with explicit partial/runtime-held reasons for 64–66 and actual executed-test requirements unchanged. Preserve :32–59 ownership checks and :67–68's prohibition on invented activation/held declarations. | Outside the named LIVE source patterns |

H2 must enumerate exactly `tests/verification/provider-response-assessment.test.ts` for Nine,
`tests/rungraph/provider-answer-reply.test.ts` and `tests/e2e/fixed-installation-reply.test.ts`
for these Ten fixture ids. A fixture id has one registered artifact, not duplicate meanings.
The manifest's decoder artifact hashes are hashes of the committed S2/S5/S11/S12 bytes under
Three's canonical hashing, not hand-invented pins. H3/H4 are new manifests because the base
loader only enumerates Four/Five/Ten. Toolchain LIVE protection is declared at
`src/register/toolchain.declarations.json:119–126,135–142`; H2–H5 require its exact approval.
No other manifest, Part Five declaration baseline or register-owner source is granted.

| Grant | Exact test or pin region and sole proposed delta |
|---|---|
| M4-G6-N-T1 | `tests/verification/provider-response-assessment.test.ts:1 (new)`: real producer/registered body-version decoders/current-port tests for P9-NF-64–66, mixed body v1/v2 source-only durable rebuild under outer schema 1, duplicate/conflict closure and H2–H5 helper registration positives/refusals. No permissive fixture owner; caller-supplied Seven decoder substitutes refuse. |
| M4-G6-N-T2 | `tests/assembly/provider-response-evidence.test.ts:1 (new)`: actual return-boundary descriptor copying/capture and selected CLI parser/evidence contract, cap arithmetic and legacy H1 compatibility. Exercise the real `productionProviderIO` boundary with valid non-ASCII bytes, invalid UTF-8 inside otherwise parseable JSON, split multibyte chunks, truncation/limits and extra frames; assert raw-byte/digest equality through capture to assessment and invalid-encoding refusal. Retain actual raw terminal bytes; no additional test file. |
| M4-G6-N-T3 | `tests/rungraph/provider-answer-reply.test.ts:1 (new at base)`: preserve the v1 decoder/occurrence-without-answer diagnostic, add same-fact positive/negative G6 joins and Five's one-use/stop/predecessor cases. The diagnostic's :12–25 is in the adjudicated confined-runtime worktree, not landed base lines. |
| M4-G6-N-T4 | `tests/e2e/fixed-installation-reply.test.ts:1 (new at base)`: real-owner composition, exact accounting/exposure and restart reconstruction for P10-SI-17/18/24/37; zero second model calls or reply operations. Test evidence never claims installed route admission. |
| M4-G6-N-T5 | `tests/operator/round15-regressions.test.ts:80,89–99`: V79 exact allowlist additions S1–S7, S11–S15 and H1 only, retaining already allowed paths. No Nine/Seven/Eight directory prefix, changed comparison or weakened assertion. |
| M4-G6-N-T6 | `tests/rungraph/production-grounding-scope.test.ts:9–17`: named `providerResponseAssessmentGrant` enumerates the same exact S1–S7/S11–S15/H1 paths; add only its membership test to the existing outside-path filter. Preserve main-versus-HEAD basis, existing grants and empty-outside assertion. |
| M4-G6-N-T7 | `tests/verification/coverage.test.ts:10,15`: only the two exhaustive count assertions change 63 to 66 for H6. Retain all false-certification/ownership/declaration assertions; no baseline or status relaxation. |
| M4-G6-N-P1 | `tests/assembly/production-grounding-inventory.json:5241`: after independent review add/re-pin only actually changed S1–S20/H1–H6/T1–T7 support entries as applicable, plus only S21's independently reviewed changed `scripts/production-boot-io.mjs` support digest through the existing P2/T8/P3 consequent pin chain. Preserve all obligation rows, their mappings, landed source assertions and unrelated hashes. |
| M4-G6-N-P2 | `scripts/check-assembly-contracts.mjs:178`: only the resulting reviewed inventory digest; no dependency population or checker logic change. |
| M4-G6-N-T8 | `tests/harness-adapters/a2-governance-and-additivity.test.ts:7,10–19`: only final reviewed P1 inventory, T6 scope-test and T7 coverage-test entries in `grantedContent`. If T1–T4 have landed before this unit, their exact additions require desk-reviewed entries here, retaining diagnostics. No prefix or assertion change. |
| M4-G6-N-P3 | `scripts/check-p13-contract-map.mjs:266`: only the enclosing hash of final reviewed T8 bytes; preserve every architecture/additivity check. |

The landed provider fixture/readers `tests/model-provider/fixture.ts:1` and
`tests/model-provider/review/assertions.mjs:1` stay byte-identical and must pass, as must every
existing settlement assertion. `tests/assembly/production-boot-provider.test.ts:1` also remains
unchanged and must run as S21/S9's compatibility witness. T5/V79 and T6 inspect only `src` paths,
so S21 requires no new entry in those source fences; no additional fence expansion is granted.
No other landed helper/test change is implied. T7 is an exhaustive
count extension, not a waived obligation. Additional declaration/registration/checker effects
found on rebase need exact file:line review before changing them; an unrelated baseline never
moves to make this unit pass. No fabricated reviewed hash belongs in a draft.

M4-G6-N-G1 is the sole generated-output grant: after the desk commits approved S6/S13/H2–H5
inputs and reviewed artifact pins, run Three's ordinary generator. Only deterministic changes
among `generated/capabilities.md:1`, `generated/conversion.json:1`, `generated/coverage.md:1`,
`generated/fact-schemas.json:1`, `generated/glossary.md:1`, `generated/register.json:1`,
`generated/rules.md:1`, `generated/shape.json:1`, `generated/source.json:1` are permitted. No
hand edits or new generated authority. The desk records each old/new manifest artifact hash,
support-source digest, P1/P2 inventory digest, T8 content digest and P3 enclosing digest against
the reviewed source commit. This draft supplies no final implementation pins.

**Rule — implementation evidence closes the runtime obligation separately.** P10-SI-37 and
P9-NF-64–66 require T1–T4 to exercise actual public ports and durable reconstruction. Required
neighbors: occurrence without an answer; authentic partial/truncated/error response; complete
unauthenticated response; wrong request/claim/provider/model/route/capture/digest/parser/terminal
event; forged `complete`; missing/changed bytes; stale/incomparable/tainted/withdrawn evidence;
duplicate/conflicting assessment; forged origin/historical intermediate; v1 settlement unchanged;
both response rows satisfied with charge/quiescence insufficient and real maximum exposure held;
stop/predecessor change; second consumption; restart finding the same assessment/acceptance/reply
with zero second provider calls. Test getter/mutation attacks and terminal limit/tool/error
neighbors at the real copying boundary. Re-run unchanged settlement and provider fixture/readers.
Report unit, full-port integration, restart and installed live evidence as separate tiers.
A mocked channel, canned fact or author test cannot close installed source-authentication proof.
Design approval, a declaration patch and an occurrence pass close none of these runtime holds.

---

## 8. Negative contracts and realistic positive neighbors

**Rule — every changed gate is exercised on both sides.** Owner: the owner named in each row;
Ten owns the composed proof. Predicate: P10-SI-20 requires every negative and its positive
neighbor below to execute through the production decoder or consumer named by the contract,
and requires all §7 fixture-preservation constraints, including genuine owner preparation,
preserved negative inputs and unchanged landed assertions. A typed object comparison,
fixture-only registry, or direct helper call is insufficient.

| Owner and predicate | Negative | Positive neighbor |
|---|---|---|
| Eight/Two, P10-SI-04 | Local effect has no current policy or lacks one causal predecessor; zero provider/Telegram/Slack calls | Same exact operation has either a real peer receipt or approved local policy plus complete local receipt; one admitted dispatch |
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
| Nine, P9-NF-64/P10-SI-37 with P10-SI-17 | Occurrence-only, unauthenticated complete, authentic incomplete, wrong subject/parser/terminal, or unavailable evidence | Same exact captured response passes both declared bars at its honest strength; no semantic-quality claim |
| Nine/Two, P9-NF-65/P10-SI-37 | v1 promotion, forged origin/history, missing closure, unequal duplicate or silent fold winner | Real versioned producers/decoders preserve v1 settlement and reconstruct one v2 assessment without changing identity |
| Nine/Seven/Eight/Six/Five, P9-NF-66/P10-SI-17/18/24/37 | Stale/withdrawn evidence, different assessment in settlement, released exposure, second consumption, stop/predecessor change or restart replay | Same fact supports both output rows and separate settlement rows, unknown charge/quiescence keeps exposure and retryEligible 0, one separately admitted reply survives restart |
| Ten/Seven, P10-SI-37 | Copied complete flag, dropped terminal/source metadata, mutable/getter envelope, extra frame, limits/error/tool stop, unproved CLI source | Bounded actual return captures and approved parser reproduce one exact final Decision; absent legacy envelope remains settlement-only |

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
| Single-machine policy | Eight operation demand; Two durability; Ten profile; operator P-08 policy | `acceptedOrRejected: ______`; `installation: ______`; `profileOperationSet: P10-SI-04`; `profileOperationSetAccepted: ______`; `localDurableDemandAccepted: ______`; `fullCausalClosure: ______`; `permanentMachineLossStatementAccepted: ______`; `automaticFallbackForbidden: ______`; `effectiveGeneration: ______` |
| Zero voter-loss availability | Six membership and reservation policy | `singleVoterAccepted: ______`; `lossStopsAdmission: ______`; `noFailover: ______`; `outageNoticeLimitAccepted: ______`; `repairOwner: ______` |
| Unprotected artifacts | Nine posture; Ten scope policy | `artifactClasses: ______`; `postureForEach: ______`; `protectedMutationUnavailable: ______`; `workerIsolationStillRequired: ______`; `independentApprovalAndKeyCustodyStillRequired: ______`; `rootCompromiseLimitAccepted: ______` |
| Transport evidence limits | Twelve capability; Nine assessment; Four binding | `telegramModeAndIdentity: ______`; `tokenCompromiseExposureAccepted: ______`; `providerAcceptanceClaim: ______`; `humanDeliveryOrReadNotClaimed: ______`; `ordinaryChatCannotGrantStanding: ______`; `witnessStageAndFreshness: ______` |
| Maximum spend and unknown outcomes | Six reservation/accounting; Seven route; Eight settlement | `currencyAndWindow: ______`; `enforceableMaximumPerCall: ______`; `totalExposureCap: ______`; `observationCountTimeResourceBounds: ______`; `unknownExposureRetention: ______`; `noAutomaticRepeat: ______`; `newWorkRemainderRule: ______` |
| Minimal voice | Eleven surface; Five minimal run; Six reserves | `permittedStatementsAndActs: ______`; `forbiddenOrdinaryClaims: ______`; `stopAndBoundedRepairGrant: ______`; `workerMemoryStorageQueueTransportEffectReserves: ______`; `dependencyOutageWording: ______` |
| Measured envelope | Eleven admission; Ten replay/conformance; Seven route quality | `machineAndStorageClass: ______`; `coldWarmWorkloadMatrix: ______`; `historyCapacity: ______`; `startupAndResponseBounds: ______`; `margins: ______`; `modelPromptContextTuple: ______`; `qualityEvidenceAndLimits: ______` |
| Fixed confined launch | Eight approved definition; Six finite allocation; Ten exact boundary; Nine evidence | `nativeArtifactAndExecutableDigests: ______`; `restrictedIdentityAndBoundaryDigest: ______`; `loadingObservationHandles: ______`; `finiteResourceAndExpiryLimits: ______`; `wholeTreeExpiryEvidence: ______`; `startupCostAndUnknownAllocationRetentionAccepted: ______`; `exactProtectedContentApproval: ______` |
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

The individual runtime/report hold names are retained from
`src/assembly/production-holds.ts:3-28` and
`src/assembly/production-installation-report.ts:16-34`. They are reported against actual owner
evidence, never cleared by this design or by an empty caller list:

| Retained hold | Evidence owner |
|---|---|
| `independent-worker-protection` | Nine; scope-specific P10-SI-14 still applies |
| `replication-peer` | Two; only the admitted P10-SI-04/05 local-durable arm has no peer dependency |
| `installation-trust-register-identity` | Three |
| `independent-verification-clock` | Nine |
| `operator-surface-registration` | Eleven |
| `independent-challenge-verifier` | Nine |
| `verified-act-intake-binding` | Four |
| `minimal-plane-fold-bindings` | Eleven, using Two’s fold contract |
| `source-only-replay-admission` | Ten |
| `minimal-responder-budget-admission` | Six/Five/Ten/Eleven under §11 |
| `live-dependency-admission` | Ten |
| `conversation-binding-route` | Four/Twelve |
| `prerequisite-lifecycle-controls` | Ten |
| `platform-delivery-witness` | Nine |
| `assembly-manifest-admission` | Ten |
| `adapter-conformance-evidence` | Ten |
| `worker-isolation-evidence` | Ten |
| `storage-custody-admission` | Ten |
| `activation-probe-evidence` | Nine |
| `activation-resource-reservation` | Six/Ten under §11 |
| `production-context-sampling` | Ten |
| `run-governance-policy` | Five |
| `provider-settlement-witness` | Eight with Nine evidence |
| `conversation-driver` | Twelve |
| `seven-bounded-install-supervisor` | Seven |

`HOLD M3-S — fixed-installation record granularity and strict-consumer performance` and
`HOLD M3-I — responder reservation representation and consumer completeness` are additionally
retained desk/contract dispositions under §11. `src/assembly/production-holds.ts` stays unchanged.

Deferred breadth is explicit: protected runtime/dashboard mutation, a general setup experience,
automatic key lifecycle, additional machines or voters, other conversation platforms, multiple
bots, a universal billing oracle, and stronger human-delivery or read claims are not admitted in
this scope. The profile retains worker confinement, independent approval, secret custody, real
Nine assessment, finite spend, no silent repetition, and the ordinary owner path from intake
through reply.

**Rule — each missing proof retains its named hold.** Owners are listed below; checks:
P10-SI-22/37 and P9-NF-64–66. These are contract/desk dispositions, not additions to or
replacements for the runtime hold roster. Report the twenty-four entries at
`src/assembly/production-holds.ts:3–28` and `seven-bounded-install-supervisor` at
`src/assembly/production-installation-report.ts:15–17` individually. Neither file is writable
under this supplement. An empty missing list, a prepared handle or a declaration cannot stand
in for an admitted dependency.

| Named hold | Owner and exact closing evidence |
|---|---|
| HOLD M4-G6-N | Nine's approved bar, closed subject, versioned producer/registered decoders/current consumer; Ten/Seven's captured evidence and Seven/Eight/Six/Five's exact downstream joins. Requires the supplement's approval, separate exact protected-source approval, implementation and positive/negative/restart proof; occurrence, answer text or Grade is insufficient. |
| HOLD provider-response-source-and-completion-evidence | Ten/Seven supply actual authenticated-source and successful terminal/capture evidence for the selected route, parser and artifact; Nine accepts its honest bar/strength. CLI JSON, code zero or a local signature cannot close it. Exact endpoint/account binding, terminal mapping, artifact and finite envelope caps remain required contract inputs. |
| HOLD M4-L | Eight/Ten's separately governed confined-launch owner operation, exact implementation grant and actual confinement evidence; this output-use assessment supplies none. |
| HOLD independent-challenge-verifier | Nine/Eleven: real independent operator administration, factor/trust/configuration and current live challenge evidence. The model-answer assessor cannot mint approval standing. |
| HOLD independent-verification-clock | Nine/Eleven: installed comparable-clock source, independent administration/configuration and current probes. Copying a timestamp supplies no freshness. |
| HOLD platform-delivery-witness | Ten/Eleven/Nine: actual exact-post observation at its claimed tier; the Telegram post observer is not the answer assessor. |
| HOLD storage-custody-admission | Two/Ten: real installed custody admission; a prepared reference or isolated storage test is insufficient. |
| HOLD resolved recovery custody | Two/Ten: the real resolved recovery-handle consumer and its admitted evidence. |
| HOLD admitted-worker mediated read | Ten/Two: an actually admitted worker performs the mediated read under the current confinement/custody boundary. |
| HOLD M3-S | Ten: its own approved atomic selection-set/inspection contract, exact grants, real original-bound owner inputs and consumer proof; response evidence supplies no selection authority. |
| HOLD M3-I | Six/Ten/Eleven: the capacity contract and its complete accounting/consumer evidence under §11; no operation reservation masquerades as standing capacity. |
| HOLD seven-bounded-install-supervisor | Seven/Ten: genuine bounded supervision for automated critical installation/history/recovery work. |
| HOLD minimal-responder-budget-admission | Six/Five/Ten/Eleven: enforced finite independent capacity, governed minimal Run and limited-voice activation proof. |
| HOLD activation-resource-reservation | Six/Ten: actual enforceable activation reservation and current owner joins. |
| HOLD opened-root inspection | Ten: its real inspection product over the actual opened root at the current source vector. |
| HOLD positive boot/dependency-selection join | Ten/Eleven: actual inspection and current applicable owner dependencies; no strict resolver or capacity proof is anticipated here. |
| HOLD exact final charge | Eight/Six: authoritative final accounting of the original operation; this response mode may proceed only while maximum exposure remains held and all ten G6 conditions pass. |
| HOLD old-executor quiescence | Eight/Nine/Six: actual exclusion of delayed original execution; a completed answer alone proves none. |
| HOLD retries of uncertain work | Six/Eight: original non-occurrence, old-executor exclusion, final liability and fresh admission under their existing rules; retryEligible stays 0 while unresolved. |
| HOLD M5 usable-live-agent proof | Ten/Eleven/Five and the live driver: actual admitted conversation, second turn, restart, stop and uncertainty evidence using real M3/M4 dependencies. |
| HOLD broader capabilities | Their existing owners: protected mutation, universal billing, stronger delivery/read claims and wider deployment require their own contracts and evidence, outside this cut. |

Semantic truth/quality keeps Seven/Nine's existing judgment/benchmark duties and is never claimed
by a response-authenticity/completeness pass. None of the above holds is cleared by approving this
design. Single-machine support remains P10-SI-03/04/05/29; independent administration does not
itself require a second physical machine.

---

## 11. Responder-capacity admission

**Rule — selection, capacity and execution have distinct owner evidence.** Owner: Six for
capacity and scheduling isolation; Five for the governed responder Run; Ten for selection and
activation joins; Eleven for limited voice and whole-slice acceptance. Predicate: P10-SI-25
requires the `minimal-responder` row, anchored in its real selection set, to reference Six's `transport-CapacityReservation`
v1 through its public decoder, Eleven's responder declaration and Five's minimal-run policy.
Six's §4a defines the body, authority producer, origin/historical decoders, fields and lifecycle.
Ten neither constructs it nor accepts an operation reservation in its place for the new set row.
`InstallationSelection` v1 historical decoding retains its origin-approved AdmissionReservation
interpretation. An old singleton may remain valid historical configuration but cannot satisfy
the new fixed-profile set or current capacity requirement. The same-store
positive reserves capacity, resolves the selection, then schedules the ordinary conversation's
first loop without creating a responder Run or EffectRequest during preparation. Missing,
foreign-store, wrong-kind, wrong-owner, stale or conflicted evidence refuses the dependent scope.

The decisions and their constitutional dispositions are explicit:

| Decision | Disposition and check |
|---|---|
| Capacity precedes ordinary allocation and remains visible after restart | Constitution constraint 2 (nothing silently lost), durable cause, Six §8 repair capacity, and Eleven's finite independent minimal budgets require this; P6-NF-42 and P10-SI-26 test conservation and loss detection |
| The reservation has no run, effect or loop identity | The owner separation in §1, Six's scheduling isolation, and Ten's minimal-responder rule distinguish reserved resources from Five's admitted work; P6-NF-41/43 and P10-SI-25 test the separation |
| A separate `CapacityReservation` rather than another `AdmissionReservation` arm | Engineering default addressing the concrete representation gap: Six's closed operation body stays historically unchanged. The constitution does not select a wire spelling; P6-NF-41 measures whether the default preserves existing operation decoding and admits capacity independently |
| Capacity amounts, units, policy windows and finite validity | Operator deployment policy, already required by the finite resource and spend acceptance fields in §9. Missing approved values hold admission. There is no implicit numerical default or additional spending authority |
| Actual responder work enters Five, Six and Eight | Nothing outward by default, durable cause, least revelation and the prohibition on self-administered safeguards; P10-SI-28 retains standing, grounding, operation admission, custody and audience checks |
| Capacity receives a named acceptance category | Constraints 2 and 3 prohibit losing accounting or claiming a passing slice by omission; P10-SI-27 requires exhaustive source coverage and keeps all actual effects accountable |
| One execution machine and one voter remain usable | The constitution's single-machine Rule and P10-SI-03/04/05 decide this; P10-SI-29 forbids a new peer or voter prerequisite for capacity |
| Preparation can land while activation remains held | Constraints 3 and 4 require claims at the evidenced tier; P10-SI-31 permits the bounded strict-resolver migration only with passing affected consumers and individually retained holds |

No unresolved question in this table is settled by preference. The representation gap is an
owner-contract gap addressed by Six §4a, not a new constitutional exception. Physical reservation
enforcement and the parent/child runtime accounting join need implementation evidence under the
holds below; this document does not assert that they are already provided. Questions for the
operator: disposition of this cross-owner contract and each separately named landed-test/helper
and fence grant in P10-SI-30 through the standing pre-merge veto process. Existing deployment
amounts and permissions remain the policy inputs; no additional constitutional principle is
requested.

**Rule — one finite budget survives preparation and restart.** Owner: Six; Ten consumes its
verdict. Predicate: P10-SI-26 consumes P6-NF-42's componentwise parent/child balance. Required
capacity is deducted before ordinary allocations in the installed authority's same source store;
it is never borrowed by ordinary work. The capacity debit is neither a pending effect nor run
exposure. Actual minimal effects have their own retained exposure inside that debit. Ten reports
both without charging the parent twice or omitting a real charge. The allocation must be present
at every required prefix; absence is a hold, not zero reserved capacity. The scalar operation
spend bound cannot stand in for worker, memory, storage, queue and transport enforcement.

Six's durable capacity head and predecessor chain, exact policy and authority frontier survive
restart. Recovery registers the genuine decoder before reading them, retains the debit while
its old clock or fence is unusable, and requires a current guarded rebind before use. The
selection may retain its exact original fact reference only while Six proves the single valid
successor chain with unchanged allocation identity and policy, within the selection's own
horizon. The selected row is anchored by its real set envelope and row digest/role/instance.
A changed generation, expired row or changed selection bytes needs a later independently approved
generation and complete set. That generation is necessary, not sufficient: §4’s
`installation-generation-transition` gap keeps changed or expired selections inhibited until the
existing-installation transition is specified and granted, without mutating old facts or resetting
obligations under another identity. Rebind cannot replace/extend a set or its row horizon. Loss of a required prefix, changed allocation,
ambiguous successor, missing receipt or unavailable authority inhibits ordinary and minimal
admission against that budget and appears in the report. Replay is read-only; it neither renews
leases nor allocates again. Equal preparation reuses the actual facts. A new process, empty
fixture map or changed command prefix never replenishes capacity.

**Rule — Eleven can name all capacity without treating it as semantic work.** Owner: Eleven
for acceptance; Six for the source accounting; Ten for the report. Predicate: P10-SI-27 adds the
closed report category `installation-capacity`, carried in `installationReservations`. A row
contains the exact capacity fact reference and stable key, installation/scope/generation,
parent and child domains, policy/unit/window references, allocated vector, current held or
released state, successor and source-frontier references, current usability with its blocker,
and Six's parent remainder and child-usage projection. Historical evidence with unavailable
current authority is visibly last-known, not live. A released row is historical evidence, not
available responder capacity.

The report also carries `capacitySourceReferences`: the complete set of decoded capacity fact
references at the observed source frontier. Acceptance requires exact identity-set equality
between that set and the initial/successor histories represented by `installationReservations`,
one unambiguous head per key, and disjointness from all operation identities. The report carries `selectedCapacityReferences` from Ten's strictly resolved installation
roster at that same frontier. Each selected responder allocation must occur exactly once; an
installed minimal-responder role cannot report an empty requirement. Only a source-proven
non-installation test context has an empty selection set. Ordinary semantic operations remain in
`sixOperations` and `operations`; harness control operations retain `contextOperations`.
The separate `operationSourceReferences` lists every decoded operation identity with its
initial/latest Six fact references; acceptance requires its exact union across the operation
tables. Every decoded operation must appear exactly once in the applicable operation category. Unknown
or multiply classified records refuse; a command string, foreign run, or caller-provided label
cannot turn an `AdmissionReservation` into capacity. The producer's source-coverage claim is
proved against the actual opened store in integration and replay tests, including omission of a
capacity row and omission of a foreign-run operation. Equal table lengths alone do not suffice.

Capacity is excluded from semantic operation count, role count, semantic keys, run identity and
pending-effect exposure because it is an owner-decoded allocation, not because a filter hides it.
Eleven explicitly checks its coverage, required presence and Six's conservation verdict.
Capacity bytes, history facts and measured process cost remain in whole-execution measurements.
The existing same-run refusal, duplicate-role refusal, unresolved-operation obligation checks,
exposure reconciliation and money-journal checks still apply to every actual semantic operation.
Across-execution acceptance checks capacity coverage in each report and equivalent allocation
policy/quantities; separate executions need not have identical position-derived fact ids.
Within a restart history the stable key, debit and causal successor chain must persist exactly.

No active responder-operation category is claimed by the Part B cut. A future live responder
must expose its actual governed Run and Six/Eight accounting in a separately admitted minimal
work report, joined to this child allocation and the whole installation totals. Until that
consumer contract and its separate grant are evidenced, actual responder operations cannot be
hidden in `installation-capacity` and minimal activation stays held.

**Rule — capacity leaves the conversation slot free and is revalidated at use.** Owner: Six,
Five, Eight and Ten at their respective boundaries. Predicate: P10-SI-28 requires P6-NF-43/44.
Selection and reservation create no `LoopRecord`; the ordinary conversation retains its sole
slot and unchanged prohibition on a second ordinary loop. The minimal execution domain is
separately named in the same finite parent policy, not a second unlimited authority/store.
Activation must join Five's actual governed minimal Run, its own current system grant and
grounding, Six's current child resource admission and bounded recovery scheduling, and Eight's
real operations. Six serializes the parent/child accounting join before permitting use.
Ten revalidates exact owner facts, installation, scope, holder, incarnation, fence, generation,
stop, lifetime and remaining allocation at activation and every use; a historical resolver
success never mints current permission. Lost authority retains work and debits while closing
use. Real responder effects keep their own operation identity, run, claim, exposure and Eight
settlement; Nine assesses actual evidence through its unchanged public seam.

An attributable conversation reply also needs Four's current binding and Six's exclusive
conversation lease/fence at dispatch. A minimal repair-domain lease cannot acquire that standing
for itself. Without conversation ownership it can preserve/queue input or perform an independently
admitted infrastructure operation under its own identity. A capacity fact grants no outbound
capability, repaired run, user-visible success or ordinary work resumption.

**Rule — capacity requires no additional machine.** Owner: Ten for the profile, Six for the
finite one-voter allocation, and Eight/Two for effect durability. Predicate: P10-SI-29 admits
capacity with one machine, one voter and the accepted P-08 closed local-durable operation set.
Separate authority domains or an independently administered same-machine process are not another
voter or durability peer. Responder effects use the applicable existing P10-SI-04 demand; the
allocation adds no operation to the local-durable set and supplies no peer receipt. Positive
neighbors are the complete accepted no-peer profile and the existing real-peer arm. Missing
local policy refuses; it does not require adding a peer to make the single-machine Rule usable.
Permanent loss of the only machine retains the accepted loss model and no failover promise.

**Rule — implementation and landed-test changes have exact, separate scope.** Owner: each
source owner below and the landing desk for grants. Predicate: P10-SI-30 requires independent
owner review of this resolution and a separate operator-vetoable disposition for every grant
row before implementation landing. Documentation approval supplies no implementation permission. The following paths are the proposed bounded cut;
all others retain their existing grants or holds. Anchors in this subsection refer to immutable
M3 commit `e7dd5e327374e7f2c834d042bf20288f98a8bc2f`, rather than line numbers after editing.
They are source coordinates for review; the implementation grant is contingent on approval.

| Proposed source grant | Exact paths and change boundary |
|---|---|
| M3-I-S1 — Six capacity contract | `src/transport/contracts.ts`: add CapacityReservation, capacity port/input/projection types and explicit finite parent-policy input; preserve AdmissionReservation at :23 and all operation fields. `src/transport/records.ts`: add the closed shape, registration, origin/historical decoding, capacity projection and conservation checks; :217–223 retains operation exposure, unresolved-attempt and recovery-loop rules, with the ordinary remainder deducted at :222. :244 keeps its ordinary loop refusal. No capacity branch may fall through to recovery or settlement decoding |
| M3-I-S2 — Six capacity authority | `src/transport/authority.ts`: add the four guarded capacity ports to the existing authority and use its same spine/conditional head; preserve `OperationReserve` at :265, including its real Run/EffectRequest requirement. `src/transport/index.ts`: export the named public types/decoders. `src/transport/transport.declarations.json`: register only the new body, producer/decoder bindings and P6-NF-41–44 obligations; no declaration claims live activation |
| M3-I-S3 — Ten exact resolution | `src/assembly/installation-selection.ts:292–298`: the new InstallationSelectionSet row validator requires the exact Six CapacityReservation for minimal-responder, retaining all three required owners. InstallationSelection v1 historical decoding retains its origin-approved AdmissionReservation interpretation. An old singleton may remain valid historical configuration but cannot satisfy the new fixed-profile set or current capacity requirement. No old record or decoder meaning changes in place. `src/assembly/production.ts`, `src/assembly/production-boot.ts`, `src/assembly/contracts.ts`, `src/assembly/records.ts`, `src/assembly/service.ts`: thread the public capacity evidence and current-use verdict into resource admission, preserving existing stored body fields and all effect/context operation joins. `src/assembly/index.ts`: necessary public exports only |
| M3-I-S4 — prepared package and reports | `src/assembly/production-installation-import.ts`, `src/assembly/production-installation-loader.ts`, `src/assembly/production-installation-replay.ts`, `src/assembly/production-installation-report.ts`: order owner resolution before selection, restore the real capacity history, expose capacity and holds, and retain the read-only boundary while Seven's supervisor is missing. `src/assembly/production-application.ts`, `scripts/production-boot.mjs`, `scripts/production-boot-io.mjs`, `bin/instar-production.mjs`: thread only the same prepared inputs/public handles under §7, without live activation |
| M3-I-S5 — slice preparation | `scripts/slice-assembly.mjs:117,296–303,327–332,416–420,1078–1103`: M3-H's exact live-resolution, schema, authoring and restart regions use the shared genuine owner path for capacity; no schedule or fake operation in installation setup |
| M3-I-S6 — slice classification and report | `scripts/slice-assembly.mjs:1837–1850`: enumerate capacity separately by owner-decoded kind; classify real operations from exact owner references, refusing unknown roles. :2311–2327: produce exhaustive capacity and operation categories at the same frontier, with authority-unavailable status. :2343–2354, including :2351–2352: emit capacity coverage and balances separately while preserving complete semantic/control operation, key and route accounting. These regions require a grant beyond M3-H |

The independently vetoable fixture/helper grants are separate even when they share one producer:

| Proposed helper grant | Exact path and bounded change |
|---|---|
| M3-I-H1 | `tests/assembly/fixed-installation-owner-fixture.ts:21` (`fixedRecordFixture`): prepare/restore the genuine capacity record in the supplied consumer store, register its real Six decoder and finite fixture policy before selecting it; retain explicit fixture-admitted provenance |
| M3-I-H2 | `tests/assembly/production-fixture.ts:47,77–113,249,280`: selection references and `productionPackageRecords` use the current consumer authority's capacity port, not its operation reservation; alias translation preserves deliberate bad inputs |
| M3-I-H3 | `tests/assembly/round8-extended-fixture.ts`: only M3-F2's owner-history, signer and target-store/owner-handle wiring consumes H1/H2 |
| M3-I-H4 | `tests/assembly/live-input-owner-fixture.ts`: only M3-F3's schema/context, installation and returned-handle preparation; actual Five/Six/Eight input, cuts and mutations are preserved |
| M3-I-H5 | `tests/assembly/production-boot-owner-fixture.ts`: only M3-F4's initial/recovery owner context, generation, lease and package setup; no installation loop; physical checkpoints and mutation timing remain |
| M3-I-H6 | `tests/assembly/production-boot-installed-fixture.ts`: only M3-F5's descriptor, decoder, owner-history and package setup; preserve `placeRun`, physical delivery and caller mutations |
| M3-I-H8 | `tests/assembly/production-run-admission-lifecycle-host.ts:63–82`, `recoveryProof`: report operation reservations with existing run fields and uncertainty checks intact; add the owner-decoded `installationReservations` capacity category and exact coverage. Do not use “all remaining operations” as installation capacity. |
| M3-I-H9 | `tests/slice/acceptance.ts:28` (`SliceReport`), `:128` (`withinExecution`), `:445` (`acrossExecutions`): add capacity/category report types and fields and additive coverage/conservation checks per P10-SI-27. `SixOperationRow` at `:22` and `unaccounted` at `:124` remain unchanged. Preserve the same-run predicate at :167, unresolved ownership at :202, role ceiling at :203, exact operation identity sets and all exposure checks. Capacity cannot be admitted by weakening any of those predicates |
| M3-I-H10 | `tests/slice/acceptance.test.ts:10`, shared `report` fixture: add explicit empty capacity coverage for its non-installation unit baseline and explicit source-category coverage for its operations; it cannot imply that an installed responder may omit required capacity |

`tests/assembly/genuine-production-fixture.ts` remains byte-identical for this capacity cut.
Package/reference adaptation belongs to H2, which preserves explicit bad caller references;
genuine owner-handle preparation belongs to H4, which exposes the actual consumer-store authority
through the existing handle shape. Neither may supply a second authority budget or a permissive
resolver.

The test bodies at `tests/slice/acceptance.test.ts:41`, `:248`, and
`tests/assembly/fixed-installation-contract.test.ts:80` remain byte-identical; H10 may adapt only
their shared report fixture.

Each landed test below needs its own grant, not a file-wide exemption. Test names and definition
lines are exact; the specified changes preserve all existing assertions and negative inputs:

| Proposed landed-test grant | Exact test | Permitted change |
|---|---|---|
| M3-I-T4 | `tests/rungraph/production-grounding-scope.test.ts:5` — `PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories` | Add only `src/transport/contracts.ts`, `src/transport/records.ts`, `src/transport/authority.ts`, `src/transport/transport.declarations.json` to an exact capacity allowlist; retain the existing index grant and all comparisons |
| M3-I-T5 | `tests/operator/round15-regressions.test.ts:80` — `V79 the changed source paths stay inside the explicit Part Four, Part Ten and operator allowlist` | Add only the same four Six source paths to an exact capacity allowlist; preserve main comparison, all other allowances and `src/index.ts` byte equality |
| M3-I-T6 | `tests/harness-adapters/a2-governance-and-additivity.test.ts:7` — `P13-A2-ADDITIVITY permanent main-vs-HEAD comparison keeps every touched owner legacy fixture byte-identical` | Only `grantedContent` at :10–19: final reviewed digests of actually changed H1–H6 and H8 paths governed by this map, the scope test and inventory, plus separately authorized pre-existing M3 pins where independently required; no prefix expansion or comparison/assertion change |

M3-I-T7 is an additive-test grant for new
`tests/transport/responder-capacity.test.ts`,
`tests/integration/responder-capacity.test.ts`,
`tests/e2e/responder-capacity.test.ts`, and
`tests/slice/responder-capacity-acceptance.test.ts`. They exercise P6-NF-41/42/43 and
P10-SI-25/26/27/29 through genuine producers/decoders and the production resolver: reservation
without a loop, ordinary scheduling and budget exhaustion, duplicate/unequal commands, concurrent
issuer conservation, wrong policy/domain/store, lost prefix, lease/clock expiry, restart and lost
append acknowledgment, retained debit, explicit release refusal, no new effect and exhaustive
category coverage. New integration/lifecycle checks may use fixed-installation's shared helper;
no new permissive fixture, registration bypass or copied owner logic is granted. P10-SI-28's
actual responder activation and P6-NF-44 remain non-executable until their separate runtime grant.

`tests/slice/responder-capacity-acceptance.test.ts` owns the same-run-plus-capacity positive,
missing-capacity negative, two-role-plus-capacity positive, and attempted foreign-operation
relabeling negative. `tests/integration/responder-capacity.test.ts` owns the exact same-store
capacity selection positive and operation-kind substitution negative through the production
resolver and shared owner helper. These cases retain genuine producer/decoder evidence and do
not copy owner validation logic into a test.

Unchanged regression witnesses include the following exact observed cuts. Their failure demands
an implementation repair or another named finding, never a changed expected result:

- `tests/e2e/slice.test.ts:15`, `P11-NF-43 P11-NF-49 P11-NF-50 the uninterrupted control execution runs the chain through the public assembly boot path`; its :19 `withinExecution` assertion stays unchanged.
- `tests/assembly/production-boot-public-entry.test.ts:7`, `boots the public application before Telegram poll; fixture-admitted: ${fixtureAdmissionNames}`; the observed :17 call stays unchanged. The separate :22 test, `installed bin boots the same public application and admits Four; fixture-admitted: ${fixtureAdmissionNames}`, also stays unchanged.
- `tests/integration/rereview7-conformance.test.ts:62`, V59 `real composition slice accepts exact current independent evidence`, stays unchanged.
- `tests/e2e/rereview7-conformance.test.ts:35`, `V71 process kill after durable Part Nine record restarts through real public assembly to the same witnessed result`, stays unchanged and requires successful recovery evidence.
- `tests/assembly/production-run-admission-lifecycle.test.ts:25`, `SIGKILL after Six durable write and before the append callback reconstructs no invented Run`, and :44, `terminal Run closure survives its durable callback cut with one Run and one unreleased reservation`, each stay unchanged.

M3-I-P1 confines pin work to exact final reviewed source/support entries in
`tests/assembly/production-grounding-inventory.json`, including the `scripts/slice-assembly.mjs` key at inventory :5245 and the
`tests/slice/acceptance.ts` key at inventory :5438, and only the retained, actually changed helper/test paths above.
`tests/assembly/genuine-production-fixture.ts` receives no repin for this capacity cut; separately
authorized pre-existing M3 pins remain available where independently required. Preserve every obligation row,
assertion mapping and unrelated digest. Refresh the resulting inventory digest at
`scripts/check-assembly-contracts.mjs:178`, T6's existing inventory/scope and granted helper/test
entries, and T6's enclosing hash at `scripts/check-p13-contract-map.mjs:266` only after independent
review. Six's declared bindings and new predicates go
through its committed declaration input and Three's ordinary generator; only §7's enumerated
generated outputs may change. Review records retain old/new digests and reviewed source commit.
No pin update authorizes another source or test edit. Any additional fence, snapshot, registration
count, test assertion or helper dependency needs an individually named exact grant.

**Rule — the minimum landing cut is strict resolution with complete consumers.** Owner: Ten
and Eleven for the landing evidence, Six for the capacity contract. Predicate: P10-SI-31 requires
all of the following before Part B's strict production-binding migration can land: approved owner
resolution and exact grants; genuine same-store capacity production and decoding; finite parent
budget deduction with no ordinary loop occupancy; repeat/restart preservation; strict current
owner-resolution with no legacy-kind fallback; explicit capacity/category reporting; all affected
positive, negative, crash, recovery and accounting consumers passing at their original bounds;
and independently reviewed final pins. The control, installed public entry and V59 must reach
their original success, and V71 must supply successful recovery evidence. Read-only package proofs
alone do not complete the production migration. The sole sequencing exception is P10-SI-35’s
independently reviewed, isolated read-only P10-SI-16 inspection prerequisite: it may land without
Part B, but cannot migrate strict consumers, remove runtime holds or claim their evidence.

The 80/20 boundary permits reservation semantics and genuine fixture proofs to close M3-I's
representation/consumer finding without claiming a live installation. Fixture-admitted capacity
is valid evidence only for its exact test store, policy and generation. It is not exported as
installed permission. Real automated import/recovery remains read-only while its supervisor is
absent; the same production gate remains closed, with no fixture bypass in the runtime. The
physical and activation checks below are independently necessary to clear their own holds.

| Named hold | Closure owner and work retained |
|---|---|
| `M3-S — fixed-installation record granularity and strict-consumer performance` | Ten owns set admission/resolution and inspection; Five the early origin gate; Six/Eleven unchanged capacity/consumer obligations; the desk original-bound evidence. Holds strict Part B migration and readiness claims until approved structural design where needed, genuine implementation and every P10-SI-31 consumer pass. Documents, unit tests, guard timing or inspection alone cannot close it. No stopped memo approach is authorized |
| `M3-I — responder reservation representation and consumer completeness` (`SIX–TEN–ELEVEN responder-capacity admission`) | Six/Ten/Eleven and the landing desk: closes only after reviewed implementation of the minimum cut and the full affected consumer evidence; documentation approval alone does not close it |
| `historical-installation-admission-context` | Ten/Five with Three/Four/Two: ungranted reconstruction of the original verified package/approval, origin register/owner context and applicable signer bootstrap. Holds populated-root migration until specified and granted; missing inputs remain unavailable evidence, never rewritten approval or discarded history |
| `installation-generation-transition` | Ten: ungranted transition of an existing immutable installation to a later generation, including identity, bootstrap/package approval and continuity of outstanding work and capacity. Changed or expired selections remain inhibited until specified and granted; generation approval alone cannot close it |
| `seven-bounded-install-supervisor` | Seven, consumed by Ten: real bounded supervision for any automated critical installation append, migration or recovery; manual placement and read-only inspection retain P10-SI-11/12's boundary |
| `minimal-responder-budget-admission` | Six for enforceable worker/memory/storage/queue/transport/effect reservation and child isolation, Five for its governed minimal Run, Ten/Eleven for measured dependency and limited-voice admission. P6-NF-44/P10-SI-28 activation tests, actual resource enforcement and the minimal-operation report/consumer grant remain here |
| `activation-resource-reservation` | Six/Ten: current exact holder/incarnation/fence/generation/lifetime joins and shared parent/child debit at actual launch and each use, with restart and revocation evidence. Prepared history never closes this hold |

Reports retain `NON-EXECUTABLE-UNTIL-seven-bounded-install-supervisor`,
`NON-EXECUTABLE-UNTIL-minimal-responder-budget-admission`, and
`NON-EXECUTABLE-UNTIL-activation-resource-reservation` until each owner supplies its evidence.
All other unclosed P10-SI-22 holds remain individually visible. Nine source,
`src/assembly/production-holds.ts`, ordinary loop multiplicity, new provider/Telegram behavior,
general multidomain scheduling, a general installer and additional deployment breadth are outside
this cut. If activation requires changes to Five/Eight bodies or Nine interpretation, it needs a
separate named owner predicate and exact source/test grant; the capacity record supplies none.

---

## 12. Fixed confined-launch admission

**Rule — P10-SI-36 is the fixed confined-launch predicate.** Owner: Eight for the exact approved
`native-confined-launch` definition, process v2 records, admission and no-repeat; Six for genuine
reservation/claim; Ten for the restricted executor and exact binding; Nine for applicable evidence
assessment. Eight §4a is the owner record/API contract; Ten §§3–4 is the physical boundary.
The mode is one exact Native artifact on the named machine, under the operator-installed
restricted identity, into `context-loading` through exactly one approved authenticated mediated
endpoint with the exact finite loading/observation method set. Every granted handle resolves to
that endpoint and current installation/run/incarnation; all other IPC/network/effect endpoints
are denied and an additional endpoint is unsupported. There is no
command text, arbitrary executable, new outbound-purpose literal, automatic restart/replacement,
provider access or implicit readiness. The exact five-field control/costly/agent/none/bounded
profile and all four constitutional tests are enforced at registration and actual use.

**Rule — the first loading worker anchors on Five's admitted unfinished Run.** Owners: Five
for unchanged Run admission/read and actual-start grounding; Eight for initial-launch identity
and preparation; Six for reservation; Ten for the bound specification. Check: P10-SI-36 in
M4-L-T1/T2. For this initial-worker arm, the following is the controlling specialization of
Eight §4a's preparation wording: pending work means the already admitted Run, not a pre-grounding
pending RunStep; Eight derives the launch identities, not a Five semanticMessage slot or launch
attempt producer. The v2 fields and their owners otherwise retain Eight §4a's contract. This arm
adds no Five record, source change, resume protocol or replacement worker.

1. Five's genuine same-store `createRunGraph(...).open` admits the Run. `pending` is the exact
   `run-opening` fact containing that Run, not `Run.opening` (the earlier stimulus), an arbitrary
   same-kind fact or a caller-created step. Resolve it through the admitted store and Five's
   genuine reader. Require the same Run with `head === run.id`, `state === ready`, no conflicts
   and no pending RunSteps; set `expectedPredecessor = run.id`. Recheck actual scope, authority,
   generation, stop, finite budget and Six's current fence at preparation and dispatch.
2. Let `H(x)` be the existing canonical encoder's `.hash` for the exact JSON tuple x, including
   its normal hash prefix. Set `k = H(["native-confined-launch", pending])`,
   `step = "initial-step:" + k`, `semanticMessage = "initial-launch:" + k`, and
   `attempt = "initial-launch-attempt:" + k`. Eight owns these exact derivations. `step` reserves
   the intended first-step identity; it is not evidence of an admitted RunStep. Ten's launch,
   initial context delivery/grounding and subsequent first-step preparation bind that identity.
   The existing request id remains `"request:" + H(["native-confined-launch", installation,
   machine, run, step, incarnation])`; `digest` remains H of the complete canonical parameters.
3. Before creating a reservation, reconstruct any original mapping for this immutable Run anchor
   from admitted owner history, including Six's prepared rows when the complete Eight request
   has not yet been appended. Six first durably fixes the exact request/attempt/digest and
   original incarnation/fence mapping; Ten records the final specification; Eight records the
   complete request and verification obligation. All required causal preparation is durable
   before dispatch. A crash before reservation creates no launch effect to repeat. Once the
   mapping exists, recovery reuses it: changed incarnation, generation, parameters or request
   key cannot create a second launch for that Run. Concurrent conflicting preparations refuse;
   stale, missing or ambiguous original evidence holds dispatch, never derives replacement work.
4. Six's recovery obligation and Eight's history retain outstanding launch uncertainty and
   allocation. Do not insert a fake item into `RunView.pending`, declare the Run running or
   grounded, complete it or release resources on launch/expiry alone. After actual launch,
   context delivery and real grounding still precede Five's admitted first RunStep. Observation
   of a progressed Run is not fresh initial-launch permission. New work, resume and replacement
   require their own contracts, not this initial-worker arm.

**Rule — the resource join is acyclic and the Six interpretation additive.** Owners: Eight
for the full body/allocation join, Six for S11's genuine execution consumer, Ten for its unchanged
specification. Check: P10-SI-36, retaining P6-NF-09/12/35. Let A be the exact sorted unique list
of genuine prior allocation facts, each predating the prepared launch reservation fact P.
This specializes Eight §4a's shared-resource comparison for this one field only:

| Field | Exact value |
|---|---|
| `parameters.resourceReferences` | A, checked through its genuine owners against the installed finite limits; excludes the future P, claim and specification |
| `HarnessLaunchSpec.processOperation` | P, the prepared Six AdmissionReservation fact id, never its operation key |
| `HarnessLaunchSpec.resourceReferences` | sorted unique A union {P} |
| Eight admission | Exact derived list relation, prepared reservation/request/attempt/digest/run/fence and every other shared parameter; both complete canonical bodies and their required causal closure |

An operation spend reservation is not installation capacity. Missing required prior allocation
remains held; no empty-list substitute, invented allocation or new generic Six capacity reader
is granted. The parameter digest is computable before P; the specification can reference P
because it is recorded afterward. This supplies neither a fabricated claim nor a hash cycle.

S11 resolves P by exact fact id in the existing verified transport prefix and requires kind
`transport-AdmissionReservation`, owner-decoded type AdmissionReservation, state `prepared`,
matching Run and original fence, with P present in the specification's resource references.
It takes the operation only from that prepared record and follows its current reservation.
Prepared/current immutable request, attempt, digest, Run and fence bindings must agree; current
reservation must remain non-closed, for the current Run and current lease assignment. Historical
preparation never revives a closed or foreign operation. Preserve the verified-prefix, current
placement/ownership selection, provenance and surrounding execution checks unchanged. The legacy
operation-key arm keeps its original reservation-reference and current-state checks for existing
placements; a fact reference that is missing, wrong-kind or otherwise invalid never falls back
to it. Eight's v2 decoder requires P, so legacy compatibility cannot admit operation-key v2 input.
No Six authority, record contract, schema, settlement, index or public-interface change follows.

T1/T2 require genuine owner-produced positive preparation before grounding; refusal of raw
stimulus, forged Run, stale head, terminal/stopped/conflicted Run and caller-changed identity
before OS invocation; and cuts after reservation/specification/request/consumption recovering
one original mapping with no launch under a new incarnation. T2 calls the genuine
`createProductionRunAdmission.execution` and real Five/Ten grounding chain using P with its
current consumed reservation, including reconstruction. Refuse wrong kind/run/fence, claim or
consumed fact substituted for P, closed current reservation, missing P, missing/extra/wrong prior
allocation, changed request/attempt/digest, stale placement and foreign store. Keep legacy
placement, existing Six admission and Five actual-grounding regressions green. These are required
checks, not reported executions, and all landed test bodies remain unchanged.

P10-SI-36 refuses message/context/provider/fact-append substitution; copied owner labels;
unapproved definition/version; changed executable, artifact, OS profile, environment, working
scope or handles; wrong machine/installation/run/step/incarnation; missing, foreign-store or wrong
Six reservation/claim; stale holder/fence/generation/clock/lifetime/stop/predecessor; missing causal
closure or inadequate durability; second consumption, restart duplication and reused PID. Every
pre-dispatch refusal has zero OS invocations. Unauthorized child/network/file access is tested
inside the worker and must be denied by the installed boundary, not merely by a TypeScript API.

The positive neighbor obtains a genuine current same-store Eight admission with one Six claim,
creates one exact confined process and records one attributable launch observation. A fresh host
reconstructs that same operation or retains its uncertainty without spawning again. Fault cuts
include before/after request/specification, reservation, validation, claim, durable consumption,
OS spawn, response and observation append; a lost acknowledgment is never a fresh launch identity.
Expiry evidence covers the entire tree and outstanding dispatches despite host/worker failure.
One authentic mediated loading/observation request succeeds while all applicable forbidden paths
in Ten §3/§4 refuse. The singleton endpoint and exact finite method set are bound by
`handlePolicyDigest` and exact handle comparison. The endpoint enforces the real owner's public
request, including freshness and incarnation, not merely socket reachability. An extra endpoint,
expanded method set, substituted handle and cross-incarnation handle must refuse, including
actual OS attempts to reach another endpoint. One successful test alone does not prove the
singleton boundary. Separate context-delivery/model/reply admissions remain required.

P10-SI-04/08/13/14/15/18 and P8-NF-03–17/25–30 remain operative. P10-SI-18 forbids replacement
while execution, resource accounting or quiescence is unknown without pretending this local
worker is a billed model call. The purpose's fully functional single-machine Rule resolves
`ordinary-local-durability-scope`; local launch still requires the ordinary-operation checks in
§2 and M4-L's implementation/admission evidence. Unit/schema evidence, full-port integration, actual lifecycle/OS-boundary evidence and
Nine's applicable assessment are four distinct reported tiers. A design check, mocked syscall,
standalone sudo spawn or message-decoder refusal cannot close the live predicate.

**Value — supported shape and operator costs.** The one-machine shape needs no second machine,
service per owner, general sandbox framework, artifact-protection broker or exact-billing oracle
merely to host this launch. Direct composition is allowed where capabilities permit it. The
operator must install and maintain the restricted identity and exact boundary, set finite resource
and lifetime limits, and approve the exact protected implementation and registration changes.
The desk's restricted-identity experiment can use its existing non-interactive sudo; it needs no
new privilege ruling. Its proof must fix absolute profile/worker paths, executable resolution,
UID, hashes and actual results; placeholders are not evidence.

Durable preparation and before-spawn claim writes add startup time and storage work. Boundary and
restart tests plus independent review cost engineering and operator time. Loading-only ports
limit what the worker can do; model calls and replies need separate admission. Finite expiry may
end unfinished loading. An uncertain start can tie up its allocation and leave work waiting,
possibly indefinitely, because automatically spawning another worker is forbidden. Losing the
only machine can lose the evidence needed to reconstruct work; it promises neither failover nor
a delivered outage notice. Broader cleanup/restart, arbitrary processes and unsupported platforms
remain unavailable. These costs follow the existing scope, finite-resource, evidence and no-repeat
rules; the desk presents their acceptance in plain words, not as a choice of competing owners.
The purpose's ordinary bounded-operation Rule permits this durability class; it supplies no
implementation approval or runtime admission.

**Rule — evidence closes named holds independently.** P10-SI-22 keeps these dispositions visible:

| Hold | Closure evidence and owner |
|---|---|
| `ordinary-local-durability-scope` | RESOLVED by the purpose's fully functional single-machine Rule and its ordinary bounded-operation Rule: the irreversible provider/reply set and membership check stay intact; ordinary operations require all four tests to be false, finite enforced bounds and the whole causal record durable at least locally. Any corresponding P-08 check change still needs a named grant. Approval starts nothing and closes no implementation/evidence hold. |
| `M4-L — fixed confined-launch owner operation and exact grant` | OPEN: Eight's approved definition/v2 admission/no-repeat implementation, Ten's real integrated restricted execution and expiry/attack/allowed-port evidence, applicable Nine assessment, desk-reviewed exact grants/pins and operator approval of protected content. Resolution of the governing-document gap supplies no implementation/admission evidence or authority-conferring runtime flag. |
| `general-process-execution` | Separate Eight contracts/grants and actual evidence for arbitrary executables/shells, broader modes, cancellation/cleanup, automatic restart/replacement/retry. This breadth is deferred, not a prerequisite for this one operation. |
| `M3-S — fixed-installation record granularity and strict-consumer performance` | Existing structural/performance owner evidence and full affected checks; no timeout increase or bypass supplied here. |
| `M3-I — responder reservation representation and consumer completeness` | Six/Ten/Eleven and desk closure of §11's genuine capacity representation, strict complete consumers and independently reviewed pins. A launch operation reservation is not installation capacity. |
| `seven-bounded-install-supervisor` | Seven's actual finite supervision of critical automated install/recovery, consumed by Ten. Manual placement/read-only inspection grants no activation. |
| `minimal-responder-budget-admission` | §11's Six finite child allocation, Five governed minimal Run and Ten/Eleven measured dependency/limited-voice evidence. |
| `activation-resource-reservation` | Actual current holder/incarnation/fence/generation/lifetime and shared allocation at launch/use, with restart/revocation proof. |
| `opened-root inspection / positive dependency-selection and boot join` | Approved selection-set design, actual opened-root inspection product and current owner/capacity evidence; no empty missing-list, host label or fixture selection. |
| `independent-challenge-verifier` | Nine's independently administered authentic exact-subject challenge, one-use/replay/restart/expiry refusal evidence. |
| `independent-verification-clock` | Nine's authentic comparable subject clock and current finite freshness; rereading never refreshes evidence. |
| `worker-isolation-evidence` | Ten's exact-mode forbidden-path and permitted authenticated-port evidence with full tree/handle bounds, applicable Nine assessment and honest residuals. |
| `storage-custody-admission` | Real pre-provisioned custody, permitted bounded mediated read and scope/grant/unresolved-ref/worker-secret refusals. Host-side proof may proceed; admitted Native end-to-end use still needs launch. |
| `activation-probe-evidence` | Nine's actual current exact-mode live probe through admitted launch/cleanup, not an empty probe list or host uptime. |
| `adapter-conformance-evidence` | Ten's actual exact artifact/platform/mode conformance and lifecycle proof. |
| `platform-delivery-witness` | Nine assessment of authentic Twelve exact-post acceptance evidence; neither human delivery/read nor model billing/quiescence follows. |
| `protected runtime/dashboard mutation` and `artifact-protection broker` | Separate independent protection/approval design and proof; outside this admitted runtime scope. Repository LIVE protection remains operative. |
| `exact-charge` and `old-executor-quiescence` | Decisive owner-accepted evidence; honest unknown accounting retains exposure and cannot permit replay. |
| `multi-machine authority/failover`, `broader platforms/bots`, `human delivery/read claims` | Separate approved scope/contracts and real evidence; outside this fixed operation. |
| `conversation-driver` and `M5 usable-live-agent proof` | Actual admitted bin entry, second inbound turn, restart, stop and uncertainty demonstration after real M3/M4 dependencies; no live bot/model use or usable-agent claim is supplied here. |

Keep the complete landed production-hold roster read-only. At the source coordinate above,
`src/assembly/production-holds.ts:3–29` supplies 24 names and
`src/assembly/production-installation-report.ts:16–17` adds `seven-bounded-install-supervisor`
for the 25-row P10-SI-22 report. Each keeps its individual owner/evidence disposition: none becomes
admitted from this document. Single-machine `replication-peer` is nondependency metadata only
under P10-SI-04/05; unavailable protection may be honestly unprotected only under P10-SI-14.
Neither interpretation erases a hold name or grants a missing current dependency.

Independent custody, Nine host and G6 preparation/evidence retain their existing exact grants;
launch-specific holds do not stop them. Their fixture-admitted tests do not clear real clock,
verifier, probe, isolation or reservation holds. Strict Part B and pending selection-set design
stay held on their own evidence. Approved units land separately, serially repinned and rebased;
no aggregate-pin race or positive boot substitution is allowed.

Remaining concrete inputs are the operator-installed artifact/executable/profile/UID and scoped
handles, measured finite limits and failure-surviving expiry proof, current genuine owner facts,
applicable independent evidence and final reviewed content/digests. Their absence is an M4-L or
named evidence hold, never permission to choose defaults. An additional owner consumer, schema,
helper, cancellation effect, supervisor path or checker discovered during implementation must
be reported by exact file:line before its dependent work exceeds §7's approved grant.
