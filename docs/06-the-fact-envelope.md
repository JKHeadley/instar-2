# Part two — the fact envelope, the version chain, and the projection contract

**Status: approved. Governed.**

The big-picture design gives the system one logical append-only record of facts, and says that
every current view — active runs, open commitments, standing grants, register entries, spend,
last-known ownership — is a projection computed from it. Part one built the values a fact can
carry. This part builds the record itself: what a fact must say about its own origin before it is
allowed in, how a thing that governs carries its history, and what a projection is permitted to be.

The failure this part exists to prevent is the one 1.x actually has. In 1.x the current view *is*
the truth: a store holds today's answer, the history is whatever a log happened to catch, and when
the two disagree there is no way to tell which is wrong. Anything derived that can also be written
to is a second authority, and two authorities are two answers. So the contract here is narrow and
unpleasant on purpose: facts are appended and never changed, every view is a pure function of
facts, and a view that cannot be thrown away and rebuilt is not a view.

Two properties are deliberately separated throughout, because conflating them is how record
systems lie. **Integrity** is "these bytes were not altered": a content hash gives it against
accident, and only a signature gives it against an author who can recompute the hash.
**Authenticity** is "this principal really produced this": no hash of any kind gives it, and this
part builds it from part one's provenance and the machine key set. A record with integrity and
no authenticity is a diary anyone may write in neatly.

A third separation runs through everything time-shaped: the appender's clock is **testimony**, and
causal position is **evidence**. A clock reading orders a display; it never resolves authority.
Every check in this part that decides what a principal *may do* resolves at causal position — what
the appender had provably seen — never at a wall-clock instant the appender itself chose.

This document chooses no database, no wire format, and no ordering service. It fixes what any
implementation must guarantee, and it lists the exact shapes every implementation must refuse.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

It is four contracts and one write port. The **envelope** is what every fact carries regardless of
kind, sufficient to attribute, place, order, and verify it without knowing the kind. The
**admission contract** is the single boundary through which a fact enters — the same boundary for
local append and replication receipt, differing only in fail direction. The **version chain** is
how a thing that governs — a rule, a term, a register entry, a governed document — carries its own
history, so "which version was in force when this happened" is a lookup rather than a
reconstruction. The **projection contract** is what a derived view may and may not do, so nothing
derived can quietly become a second source of truth. The write port is `append`, and it is the
only one.

**Rule — append is the only write.** Rules 7 and 90 forbid losing or editing what was recorded.
**Check:** held by shape and by behaviour, not by naming: the fact-store port's interface exposes
exactly one mutating method (an arity check on the port type — fixture P2-NF-15); a contract test
asserts that after *any* sequence of port operations, every previously admitted fact is still
readable, hash-verifying, and at its original position (P2-NF-16); and segment hash chains are
re-verified against tamper out-of-band — incrementally at boot from a durable per-segment
verified-through watermark to head (cheap, so boot never rides the full-history curve), and in
full by the scheduled sweep (rare, budgeted, the only form that catches watermark corruption — the
same incremental/genesis split the projection rebuild check uses). A lint on exported names
(update, delete, truncate, prune, vacuum, rewrite) runs as a secondary tripwire and is labelled as
such — per rule 26, the name lint is the symbol and the contract test is the state.

**Value — one logical record, many physical segments.** The constitution requires reconstructable
history, not a single database. Segments are chosen so a machine can keep appending while
partitioned, at the cost of a partial rather than total order, which the ordering section pays for
explicitly. The parent's phrase "one logical append-only sequence" survives here with its honest
meaning stated: the record is a set of totally-ordered segments under a partial causal order — a
directed graph, not a line — plus one deterministic linearization used for presentation only.

---

## What this adopts and declines from event sourcing

This is an event-sourced design with derived read models, and pretending otherwise would cut it
off from that literature's hard-won lessons. Adopted: append-only events, views as folds,
rebuild-from-history, schema-versioned events with forward migrations. Declined, with reasons:
**snapshots that replace history** (a checkpoint here is itself a projection and never licenses
removing a fact — rule 7); **a global ordered stream** (no ordering service; causal partial order
plus a labelled presentation order instead); **eventual-consistency silence** (staleness is a
value carried on every view, and authority reads fail closed on it). Named and handled rather than
inherited by accident: idempotent folding (replication re-delivery collapses on `id`), poison
facts (a fact that decodes but crashes a fold is quarantined per projection and surfaced — it must
not wedge the fold loop; fixture P2-NF-48), consumer offsets (the folded-through vector), and
replay cost (the growth instruments section).

**Value — event history plus projections, named plainly.** The rules require lookup-able history,
not event sourcing by name; the parent already chose this shape. Naming the lineage is chosen so
reviewers can import known failure modes instead of rediscovering them. One layer of this design
is deliberately delegable rather than bespoke: the hash-chained, signed, append-only segment is
exactly the shape proven transparency-log and Merkle-log components implement, and an adapter may
be built on one — what this document fixes is the *contract* (the envelope fields, the refusals,
the fixtures), not an implementation, per the parent's rule that replaceable technology choices
stay out of the constitution.

---

## The envelope every fact carries

A fact says that something occurred. It is never a statement about what is currently true — that
is what a projection is for. The distinction is load-bearing: "the run is active" is not a fact,
"the run was started" is.

| Field | Meaning |
|---|---|
| `id` | Stable, globally unique, never reused — and namespaced to the appending machine (it is derivable from `machine` + `segment` + position, or verifiable against the appending key), so a cross-machine collision is a decode refusal, not a conflict to adjudicate. |
| `kind` | The registered fact schema this fact is an instance of. |
| `schemaVersion` | The version of that schema, per part one's versioning convention. |
| `at` | A clock measurement, in part one's sense: a reading taken by a named holder. Testimony for presentation; never an input to an authority resolution. |
| `machine` | The stable opaque key of the machine that appended it. A rename changes a nickname elsewhere, never this key. |
| `principal` | The `VerifiedPrincipal` that caused it. System-originated action uses `kind: system` through the same door, per part one — there is no bare-identifier alternative. |
| `provenance` | Part one's `Provenance` for that principal, pinned at append: the adapter, method, authenticated-record reference and capture hash, time, verifying machine, and class (`verified` or `channel-attested`). A replicated fact decodes to a principal *pinned at origin* — a distinct decode path from live intake, which never re-mints authority from bytes. |
| `segment` | The append segment this fact belongs to — the owning machine, the segment **epoch**, and the position within it. Positions are dense: a gap is detectable and refused (P2-NF-12). A machine's segments are totally ordered by epoch: each new segment's genesis records the closing head hash of its predecessor segment, so a machine's whole history is one auditable lineage even across restores. |
| `prevInSegment` | The `contentHash` of the previous fact in this segment (a defined genesis value for the first, which for a successor segment binds the predecessor segment's closing head). This makes each segment a strict hash chain, so a fork — two facts at one position — breaks the chain visibly at every receiver (P2-NF-09, P2-NF-10). Distinct from `predecessors`, which is causal. |
| `predecessors` | What this fact causally follows, in two parts whose cost is bounded and stated: the in-segment predecessor's id, plus a **causal frontier** — one (epoch, position) pair per machine lineage the appender had folded, vector-clock-shaped and bounded by machine count rather than by fact count, so a long partition or a big fleet grows it linearly in machines, never in history. A merge after a partition is therefore expressible. Kinds the schema registry marks *causally bound* — every standing-gated kind, an authorization, a supersession, a revocation-dependent act — must additionally include their required references **by fact id** or be refused (P2-NF-23). |
| `body` | The kind-specific payload, whose shape the registered schema fixes. It enters the hash preimage as its as-appended canonical bytes, so hash verification never needs the body's schema. |
| `contentHash` | The canonical hash over every field above — excluding itself and `signature`. |
| `signature` | The appending machine's signature over `contentHash`, verifying against that machine's key in the governed key set for the fact's segment-position range. `machine` must equal the signing key's registered owner (P2-NF-07, P2-NF-08). |

**The canonical preimage, exactly.** The hash is computed over the canonical encoding (part one's
convention 6) of the envelope minus `contentHash` and `signature`, with three additional
commitments this part is the first to need: the envelope's own type name and schema version are
inside the encoded bytes as a domain separator; an absent optional field encodes distinguishably
from a present-but-empty one, so stripping a causal reference changes the hash (P2-NF-06); and the
fold-key instant (see Ordering) is encoded fixed-width so byte order over it is time order. A
canonical-bytes fixture set with expected hashes ships with the package, per part one's pattern.

**Equality and immutability** (part one's convention 2): identity by `id`; version equality is
meaningless here because **every field of a fact is immutable** — a fact has exactly one version
by construction; value equality is field for field. Two records under one `id` whose fields differ
are not two versions but an attack or a fork, refused at decode (P2-NF-13) or surfaced by the
chain break (P2-NF-10).

**What the envelope makes impossible.** An anonymous fact: `principal` is required, has no
"unknown" value, and has no bare-identifier bypass. An event whose cause genuinely cannot be
resolved is recorded as a fact *about an unattributable observation* — a registered kind,
`unattributable-observation`, whose `principal` is the observing holder (with `kind: system`
provenance) and whose body carries part one's `UnresolvedInput`; the admission ladder names this
wrap as the only door for such input (P2-NF-29), so rule 14's deliver-when-unsure softness
survives the fact boundary instead of being silently undone by it. Because the wrap admits input
from the cheapest identity there is, it is budgeted: sustained unresolvable traffic coalesces per
(channel, window) into one counted observation fact whose raw items land in the redactable capture
store, and `unattributable-wrap-rate` is an emitted measurement — rules 60 and 46 apply to this
accumulation like any other. A fact that cannot be placed: `machine`, `segment`, `at`,
`prevInSegment` all required. A forged or quietly altered fact: alteration breaks `contentHash`
(integrity), and authorship is carried by `signature` + `provenance` (authenticity) — the hash
alone is never claimed as proof of origin.

**Rule — every fact is attributable and verifiable.** The parent's §2 requires every fact to carry
id, causal predecessor, machine, principal, schema version, and content hash; rules 28 and 29
require every principal — human, agent, or system — verified through one door; rule 89's
message-provenance obligation gains its substrate here: signing is automatic at the record layer.
**Check:** the decoder refuses an envelope missing any field (absent-as-value is a defined
encoding, not an omission); `principal` admits only `VerifiedPrincipal` (P2-NF-03); a fact whose
effect exceeds requester standing carries `verified` provenance or is refused (P2-NF-04);
signatures verify against the governed key set (P2-NF-07, P2-NF-08); a recomputed `contentHash`
mismatch is refused at ingest and at read (P2-NF-05).

**Rule — the machine key set is governed state with a lifecycle, not an assumption.** Rules 90
(versioned by construction), 32 and 33 (shared state, declared and tested) require it; the checks
are P2-NF-69/70 plus the key set's own chain walk. Registering a new
machine key requires operator standing; the key set is a governed version chain riding the minimal
plane (see the bootstrap paragraph under Admission), so verifying it never requires the record it
verifies. A key's validity window is keyed on **segment position ranges** — causal, not wall-clock,
so a backdated `at` cannot move a fact into an old key's window. Rotation opens a new range; facts
verify against the key that was valid for their position (P2-NF-69). Compromise is handled by an
operator-attested compromise position: facts at or after it in the compromised key's segments are
quarantined as a conflict class awaiting operator review — never silently kept, never silently
dropped (P2-NF-70); facts before it stand. De-registering a machine closes its segments' lineage
with an operator segment-close fact.

**Rule — a fact carries no secret.** Rule 100 requires a secret stored before it is spent, never
travelling through incidental surfaces. **Check:** three layers, honestly graded. A fact body may
hold a `SecretRef`, never a secret value; the schema registry refuses a kind declaring a
secret-valued field (P2-NF-18, build lint); every free-text body field must be declared in the
schema and length-clamped, so the scannable surface is enumerated (P2-NF-19, build lint); and the
deterministic secret-shape scan runs at admission on every fact, first in the ladder (P2-NF-17).
**The residual, stated:** a secret in prose that matches no shape can pass. Because an admitted
fact is immutable and replicated, the remediation for a miss is not deletion — it is rotating the
exposed credential, appending a retraction, and recording the exposure as a fact. The scan is
best-effort by nature and this document says so rather than presenting it as closure.

**Value — the payload is small and points outward.** Large content — a transcript, a captured
page, a diff — lives in the **capture store** (registered below), and the fact carries its content
hash and location. This keeps replay cheap: the envelope itself is the dominant per-fact cost
(the pinned principal + provenance block is roughly forty percent of it), and the recorded lever
if replay cost ever binds is a normalized principal reference, not a fatter body. The cost of
pointing outward is that the capture store becomes load-bearing for audit, so it is registered
here with an agreement the build checks — every referenced capture resolves at append (P2-NF-64)
and a capture deletion under a live reference requires a tombstone fact (P2-NF-65) — rather than
left as an undeclared dependency.

---

## Ordering, and what it honestly gives us

Within a segment, order is total: positions are dense and assigned by the single owner. Across
segments the honest relation is a partial order: A precedes B when A is reachable from B through
`predecessors`, or both share a segment and A's position is lower. Everything else is concurrent.

Two orders are then deliberately kept apart:

- **Causal order** is the partial order above. It is the only ordering a decision, a projected
  value, or an **authority resolution** may rest on.
- **Fold order** is a deterministic total order used only so that projection output is identical
  across machines at the same folded-through state. Concurrent facts order by the tuple (the
  fold-key instant, `machine`, `id`), compared as fixed-width canonical bytes. The **fold-key
  instant** is extracted, not inferred: the clock measurement's value normalized to one canonical
  unit and encoded fixed-width big-endian, so byte order is genuinely time order — comparing
  encoded measurement *records* would order by field layout, which is why the preimage rules pin
  this. A reading the decoder cannot normalize refuses the fact (malformed envelope).

**Rule — fold order can never become a value.** The parent requires reconciliation that records
conflicts rather than choosing winners silently; rules 31 and 33 require divergence surfaced and
agreements tested. The old form of this rule — "a decision may not rest on fold order" — was
unenforceable, because a projection could launder a tiebreak into a folded value that a later
decision reads legitimately. So the obligation moves onto projections, where it is mechanical:
**a projection must be commutative over concurrent facts — where its output would depend on their
fold order, it must emit a `Conflict` instead of a value.** Commutativity is declared, not
guessed: for each kind it folds, a projection declares a **merge class** from a closed set —
`additive` (order-free accumulation), `set-union`, `max`/`min`, `exclusive-singleton` (concurrent
writers to one identity are a `Conflict` by definition), or `cap-checked aggregate` (concurrent
facts each individually valid whose *combination* breaches a declared bound produce a computed
violation record — two concurrent spends inside a cap alone and over it together are neither a
winner-picks problem nor a bare `Conflict`, but an aggregate breach the view must state). A
projection folding a kind with no declared merge class fails the build (P2-NF-74). **Check:** the
permutation test verifies each declared class's laws, with its bound stated so it is actually
runnable: the check replays each projection fixture under all adjacent-pair transpositions of its
concurrent facts (quadratic, budgeted per projection — swap-invariance at the tested orderings)
plus a seeded random sample of full permutations and property-generated concurrent sets as a
tripwire (P2-NF-51). The check is fixture-and-generation-bounded — a projection non-commutative
only on inputs outside both remains possible, and that residual is stated here the same way the
secret-scan residual is. The reconciliation suite (reorder, duplication, partition, conflict,
late-segment insertion) produces byte-identical output on every machine *at the same
folded-through vector*.

**Value — the presentation tiebreak is the appender's clock, flagged when implausible.** No rule
forces a tiebreak; clock order is chosen because it is close to human expectation. It is also
appender-controlled, and the design treats it accordingly: it cannot select an authoritative value
(the commutativity rule above) and it cannot move an authority resolution (standing resolves at
causal position — Admission rung 9), so what remains is presentation. A reading implausibly far
from the receiving machine's own clock is admitted but flagged, the divergence recorded as a fact
and shown beside the entry, so a broken or lying clock distorts a labelled display, never an
unlabelled one. The alternative — refusing to linearize concurrent facts at all — is safe and
unusable.

**The cost this choice carries, priced.** A segment arriving late folds into the *middle* of the
presentation order, so an incremental fold cannot simply append: on reconnection, every affected
projection re-folds from its last checkpoint at or before the earliest arriving instant. Checkpoint
cadence therefore bounds partition-recovery cost (a day-long partition costs a re-fold from the
last checkpoint, not from genesis), and the checkpoint section below is what makes that bound real.

**What this does not give us.** Fold order does not make a later clock reading a later event;
causal order is sparse where appenders lack links. So the schema registry declares, per kind,
which causal references are mandatory — every standing-gated kind names the grant state it relies
on, an authorization names its base, a supersession names its predecessor, a revocation-dependent
act names the revocation state it read — and the decoder refuses a causally-bound kind whose
reference is absent (P2-NF-23). The in-segment link is mandatory for every fact (P2-NF-24), so
each machine's own history is always fully ordered even when nothing else is.

---

## Durability, replication, and what a segment owner owes

**Append returns a typed durability state, not a boolean** — and that this is typed is a choice:

**Value — durability is a state the caller can demand.** No rule forces typed durability;
`local-durable` (survives this machine's crash) and `replicated(n)` (n peers acknowledged) are
chosen so the effect doorway (part eight) can *name* which state an irreversible effect demands
before it acts. This part supplies the states and the measurement (replication lag per segment);
the fixture for effects-on-insufficient-durability lands with part eight, named now (P2-NF-63).
Without this, "no fact is machine-local" is a statement about schemas wearing the costume of a
statement about reality: every fact is physically machine-local between append and replication,
and the window is now measured and bounded rather than unmentioned.

**The failure model, stated.** The substrate is assumed **crash-only**: a machine may stop, lose
unreplicated tail, restart from backup, or partition — and the envelope machinery (chains,
signatures, contiguity, epochs) is what turns each of those into a detectable, recoverable
condition. The one Byzantine case this design defends is the one it can: a **compromised machine
key**, whose forged facts verify until the compromise is attested and whose handling is the key
lifecycle's quarantine — a colluding majority of machines, or a compromised operator, is outside
this part's threat model and said so. What is demanded *of* a replication substrate is
correspondingly small — durable local append and at-least-once, eventually-complete delivery of
owned segments; ordering, dedup, integrity, authenticity, and completeness detection all live in
the envelope, which is why a proven log component can carry the substrate without inheriting any
trust.

**Replication is additive, authenticated, and complete.** A peer delivers only segments it owns
(P2-NF-11), over an authenticated channel, and the receiver runs the same admission boundary as
local append — same decoders, same checks, different fail direction (see Admission). Receipt
verifies per-segment contiguity: positions are dense, so a gap is detectable, and a stream with a
hole is quarantined and surfaced, never accepted silently (P2-NF-12) — an incomplete replica that
answers confidently is worse than an unreachable one. Re-delivery collapses idempotently on `id`.
Catch-up after a long partition is rate-bounded (a declared ceiling, per rule 60) so a returning
laptop is not saturated by its own history.

**Rule — a fact whose causal reference has not yet arrived is held, not refused.** Rule 14 sets
the preservation direction; rules 46 and 60 bound the hold. **Check:** P2-NF-25 and P2-NF-31. On
the intake path a dangling reference is a refusal — the client is talking about something that
does not exist. On the replication path it is an ordering accident: the fact is parked in a
bounded, deduplicated **pending set** keyed by the unresolved reference, admitted when the
reference arrives, and escalated as a conflict-class record when a declared TTL expires — never
silently dropped (P2-NF-25). Because standing-gated kinds are causally bound, a grant that has not yet arrived is
exactly this case — a dangling reference that holds — so an honest inter-segment ordering accident
can never quarantine an honest peer's stream, and an adversary cannot induce that quarantine by
delivering segments grant-last. At its bound the pending set refuses *new* holds back to the
replication layer for redelivery — held facts are never shed (the never-vanish agreement) — with
per-peer sub-bounds so one peer cannot exhaust it, and `pending-set-depth` alarms before
saturation.

**Segment ownership survives restore, loss, and rename.** Machine identity is the stable opaque
key; a rename never moves ownership. A machine restoring from backup cannot prove it stands at its
own true head, so it must open a *new* segment epoch — its genesis binds the predecessor segment's
closing head, so lineage is auditable and resuming the old segment would fork a total order, which
the `prevInSegment` chain makes visible at every receiver as a chain break (P2-NF-09, P2-NF-10)
rather than a silent divergence. A machine that is permanently lost leaves its segment open-ended;
the folded-through vector says honestly "this lineage's head is the last I saw," and a deliberate
operator fact closes a segment lineage so readers can distinguish finished from partitioned. A
closed lineage folds into a compact per-machine closed-through summary in every view's known-set,
so retired laptops and dead VMs do not grow the per-view structure forever;
`known-segment-set-size` and `machine-key-count` are emitted measurements so that curve is
visible, not assumed flat.

**Rule — reconciliation is deterministic and records conflicts.** The parent's §2 requires it;
rules 31 and 33 require degraded-condition coherence and tested agreements. **Check:** the
reconciliation fixtures (reorder, duplication, partition, conflict, late-segment, gap, fork)
produce identical results on every machine at equal vectors; a same-identity immutable-field
disagreement yields a `Conflict` record, and a projection resolving one silently fails the
fold-primitive test (P2-NF-52).

**Value — full history on every machine, for now.** Every machine holds every segment, so the
smallest disk in the fleet bounds retention for all of it, and total fleet storage is machine-count
times history size. The alternative — a bounded local suffix with older segments fetched on demand
— removes no fact and remains open. Full copies are chosen first because every machine can then
audit, rebuild, and serve alone through a partition — **bounded by capture availability**: the
capture store replicates with segments *except* the judgment-capture classes whose machine-local,
retention-bounded handling the big picture promises and part nine owns, so "audit alone" is
honestly "audit every fact alone, and every capture this machine holds." So that this choice can
be reversed without a redesign, the alternative's *interface* is fixed now even though no adapter
implements it: a machine holding a bounded suffix fetches older segments on demand through the
same verified replication-ingest path — same chain checks, same contiguity, nothing bypassed —
so moving to bounded suffixes later changes an adapter, not this contract. One consequence is
named rather than silent: full replication puts every machine in possession of the whole record —
principals, provenance, refusal metadata — so at-rest access control and encryption for the
replicated stores are a stated requirement on the storage adapters, deferred explicitly to the
adapter-contract part (part ten), not absent. The growth instruments
below are what turn "revisit this" into a real trigger instead of a hope.

---

## Admission — the one boundary a fact can enter through

The admission boundary is a **blocking site** in the register's sense, and it declares the
register's required facts for that kind rather than describing itself only in prose: `authority:
block`; `decidesAlone`, carried per rung exactly as `failDirection` is carried per consumer:
`ruled-three` for the secret-shape scan (a live secret leaving) and `governed-state` for the
remaining rungs — the integrity/decode and standing rungs deterministically enforce *recorded
governed state* rather than judge anything, the category rule 4 names, shared with every decoder
part one already ships; `criticality`: the
record is the substrate every audit rule stands on; `failDirection`: **closed** for the mutation
path (an unverifiable fact does not enter), **open** for intake-origin input — rule 14's direction
— with the preservation mechanics under `preservesInput` (the register field is binary; this entry
carries the split as rule 95's per-consumer sub-declarations, one per path); `preservesInput`: the refusal store and
the unattributable-observation wrap, named below; `inspectedBy`: the fixture suite.

**Value — the bootstrap breaks the circle at a pinned, out-of-band anchor.** The standing
projection is folded from grant facts that themselves pass standing checks, and signatures verify
against a key set that is itself governed state — both circular at genesis. The constitution does
not prescribe how the circle breaks; this design breaks it the way the big picture's §11 minimal
plane suggests: a small genesis segment carries the first facts — the machine key set's first
version and the org-intent-grounded standing grants — and the standing rung's ground for *those*
facts is verification against the org-intent document's own approval anchor (`approvedIn`), not
against the projection they create. "Independently verified" is given a concrete meaning: the
genesis segment's content hash is pinned in the governed repository beside the org-intent
document, and the host-verification material needed to check that anchor is distributed
out-of-band with the installation — a residual trust root this document names rather than hides,
exactly as the secret-scan residual is named. Everything after genesis resolves normally.

**The happy path, before the refusals.** One ordinary append-and-replicate, with the terms in
their places: (1) a doorway hands the boundary a candidate fact — principal verified, provenance
pinned; (2) the appender fills the envelope: its lineage's next position, `prevInSegment`, the
causal frontier it has folded, the grant references its kind requires; (3) admission runs the
ladder below and the fact enters the owning machine's segment — `append` returns `local-durable`;
(4) peers receive the segment slice, re-run the same ladder, and acknowledge — the durability
state climbs to `replicated(n)`; (5) each machine's projections fold the fact under their
declared merge classes and carry their folded-through vector forward; (6) an authority question
about what the fact changed is answered from a projection that is current within its staleness
bound, or refuses. Everything else in this section is what happens when one of those six steps
cannot proceed.

One ladder, two ports, named: **authorAndAppend** (the origin port — *constructs* position,
frontier, `prevInSegment`, hash, and signature, then runs the ladder including the origin-only
frontier check) and **verifyAndAdmit** (the replication port — every one of those fields arrives
authored and immutable and is *verified*, never generated). They share the decoders, the
refusal reasons, and every rung below; what differs is which fields each trusts, which it
produces, and the fail directions already declared.

The ladder, in refusal order — fixed so a refusal reason is stable, and each mapped onto part
one's closed `Refused` reason list rather than minting new reasons. Rungs 2–6 share one
structural phase: any failure to parse, re-encode, or verify the envelope's own bytes classifies
as rung 2's `decode` reason regardless of where it surfaced, so the stability promise is
implementable:

1. **Secret shape** (`policy`) — the deterministic scan, over the raw bytes, first — so that what
   it catches is never parsed further, never retained below.
2. **Structural parse** (`decode`) — the minimal untrusted parse of the envelope shape: any
   missing or ill-typed envelope field, absent-as-value encodings included, an unnormalizable
   fold-key reading.
3. **Content hash** (`integrity`) — recomputed over the as-appended canonical bytes; the body
   enters as its as-appended bytes, so no body schema is needed. Verified **before the signature**,
   because the signature is over the hash: authenticating an unverified hash value would prove
   who signed while leaving open *what* was signed (P2-NF-22 also pins: before any migration).
4. **Signature** (`integrity`) — over the now-verified hash, against the governed key set for the
   fact's segment-position range; `machine` must own the key.
5. **Unknown or unregistered `kind`** (`decode`).
6. **Unknown `schemaVersion`** (`decode`) — on intake, refused unless a migration forward
   exists; migration runs only after rungs 3–4 passed. On the replication path a version
   *newer* than this machine understands is a rolling upgrade in progress, not corruption: the
   fact holds in the pending set exactly as a not-yet-arrived reference does — bounded,
   measured, admitted when the schema support arrives — so a fleet mid-upgrade never terminally
   refuses its own future.
7. **Unresolvable `principal`** (`standing`) — refused *unless* wrapped as an
   `unattributable-observation`, which is the only door for unresolved input (P2-NF-29).
8. **Causal references** (`decode`) — the in-segment link always; per-kind mandatory references —
   for a standing-gated kind that includes the grant state relied on, by fact id. The vector the
   appender resolved against is declared exactly once: it *is* the envelope's causal frontier,
   and the causal cone rung 9 resolves over is the closure of `predecessors` (the in-segment
   chain plus that frontier) — there is no second, disagreeing declaration to reconcile.
   Dangling references refuse on intake and hold on replication (P2-NF-23, P2-NF-24, P2-NF-25). Resolving references
   *before* standing means an unresolved grant is always this rung's case — a hold on
   replication, a `decode` refusal on intake — never a terminal `standing` refusal for what is
   only an ordering accident.
9. **Standing** (`standing`) — the appending principal holds live standing covering this kind and
   scope, **resolved at causal position, as a deterministic function of the fact's declared
   causal cone**: the named grants must be live and unrevoked *within the history the fact
   descends from*, so every receiver computes the identical verdict from the fact alone — never
   at the appender-chosen `at`, which would let a backdated clock resurrect revoked standing
   (P2-NF-72), and never against the evaluating machine's own wider state: a revocation the
   receiver holds that lies *outside* the fact's cone routes to the reconciliation pass below,
   never to an ingest refusal — otherwise two honest replicas would disagree about admissibility
   and a chain gap would quarantine an honest stream. A fact admitted whose cone did not include
   this machine's newest revocation head *within the grant scopes the fact names* is admitted
   **marked `provisional`** — scoped to relevant grants, so ordinary replication lag does not
   make every fact provisional — and a provisional fact's authority may not feed an irreversible
   effect until reconciliation clears it (P2-NF-73, owned by part eight with the durability
   fixture). The marker's lifecycle is pinned, not implied: provisional marks are machine-local
   sidecar state homed inside the fact-store register entry exactly as the verified-through
   watermarks are; the reconciliation pass is level-triggered — it runs whenever a revocation
   folds — and a mark clears when no revocation this machine holds, within the fact's named
   grant scopes, satisfies the reconciliation predicate, evaluated at the same staleness horizon
   authority reads use (P2-NF-75 tests that clearing happens and is correct, the complement of
   P2-NF-73's never-feeds test). Provisional and contested are **taint the fold itself carries**:
   the fold primitive delivers an authority-bearing fact together with its current status, and a
   projection consuming one either propagates that taint into its output or refuses authority
   output — untainted authority computed from tainted input is a fixture failure, not a style
   choice (P2-NF-76). One check runs at the **origin only**, because only there is it
   deterministic: at local append, the declared frontier is compared against the appending
   machine's own folded-through vector within the named grant scopes — a fact whose frontier
   omits a relevant revocation head its own machine had already folded is refused at origin
   (P2-NF-77), since omitting what the appender provably held is not an ordering accident but
   the one way left to write an honest-looking fact around a known revocation. Receivers never
   re-run this against their own state — the cone rule keeps replica verdicts identical — and a
   received fact's trailing frontier remains the provisional/reconciliation path's business. **The reconciliation pass,
   pinned:** its predicate is a revocation that is neither inside the fact's cone nor causally
   after the fact (concurrent, or prior-but-unseen); each machine appends any resulting
   `Conflict`-class record under its own system principal on its own segment, keyed on the
   (fact, revocation) pair so independent machines' records collapse as duplicates in the fold;
   authority projections serve the narrower answer while one is open. Partition availability and
   no-silent-extension are both kept, at the cost of retroactive flagging (question 7 puts that
   trade to the operator). Appending without standing would be minting (P2-NF-26, P2-NF-27). A
   body field typed as a constitutional value decodes through part one's decoder with this fact's
   pinned provenance, so part one's refusals apply inside the body, not only at intake
   (P2-NF-28).
10. **Body schema** (`decode`) — last, so a body error is never reported for a fact refused for a
    stronger reason.

**Rule — a refusal preserves metadata, never the body.** Rule 4 requires a block to preserve its
input; rules 60 and 46 bound what anything may accumulate; rule 100 forbids the guard that catches
a secret from becoming the thing that stores it. **Check:** the refusal store retains refusal
reason, submitting principal or peer, canonical hash, byte length, and first/last-seen with an
occurrence count — deduplicated on (hash, reason) so a loop collapses to one counted row — and
never the body bytes (P2-NF-30); it is a registered store with a declared bound, retention window,
and saturation behaviour that degrades to a coarser per-source aggregate (count, first/last,
reason histogram) rather than to nothing — stated plainly: under a high-variance flood the
row-level forensics of the flood itself are what age out first, and the aggregate is what survives
(P2-NF-31). Its agreement with the fact store — a refused hash is never admitted **without an
intervening admissibility-state change** — is scoped to the terminal refusal classes (`policy`,
`integrity`, `standing`, `decode` on intake) and excludes the decode sub-classes whose ground can
legitimately cure (an unresolved reference whose referent later replicates in; an unknown schema
version whose migration later ships — a cured refusal records what cured it); a replication-path
ordering event is recorded as a *hold*, not a refusal — so the scheduled agreement check never
flags correct behaviour as a violation. The per-source refusal
rate is an emitted measurement, since a refusal stream is exactly the evidence the retention
exists to keep.

**Value — a fixed refusal order.** No rule forces this sequence. Stability of the reason is chosen
so a client can rely on which refusal it will see; secrets are screened first because rung 1 is
the one place where retention of the evidence would itself be the harm; integrity precedes
authenticity because a signature over an unverified hash authenticates nothing.

---

## One partition, worked end to end

The moving parts above compose into one story, told once so a reader can check their model.
Machines A and B partition. On A, the operator revokes delegate P's grant: a revocation fact
lands in A's segment, causally after the grant. On B — which has not seen the revocation — P
appends a standing-gated fact. B's admission resolves rung 9 over that fact's declared cone: the
grant is live there, so the fact admits; B's own newest revocation head is inside the cone, so it
is not even provisional *on B*. B's authority projection, however, knows from the machine
registry that A's lineage exists and has gone unobserved past its staleness bound — so an
authority *question* about P on B ("may P act now?") refuses as stale even while P's fact sits
admitted; B keeps serving user-channel views, labelled. The partition heals. A's segment
replicates to B; contiguity and chain checks pass; the revocation folds. The reconciliation pass
finds P's fact: the revocation is neither inside its cone nor causally after it, so B appends a
`Conflict`-class record keyed on that (fact, revocation) pair — A independently appends the same
key and the fold collapses the duplicates. Authority projections serve the narrower answer (P
unauthorized) from the moment the revocation folds; the flagged fact stays in the record,
visibly contested, for the operator or a standing-covered resolution to settle. Nothing was
refused for being early, nothing silently extended revoked authority, no replica ever disagreed
about admissibility, and every step above names the machinery that performed it.

The same lifecycle, as a table — every state a standing-gated fact can occupy, and what moves it:

| State | Entered when | Leaves by |
|---|---|---|
| refused (origin) | its frontier omits a relevant revocation its own machine held (P2-NF-77), or any ladder rung fails | terminal — metadata retained |
| held (replication) | a causal reference has not yet arrived | referent arrives → ladder resumes; TTL → escalated as conflict-class |
| admitted | the ladder passes with the cone covering this machine's relevant revocation heads | terminal for the fact; its *authority* lives on below |
| admitted, `provisional` | the ladder passes but the cone trails this machine's relevant revocation heads | reconciliation clears it (no held revocation satisfies the predicate at the horizon, P2-NF-75) → plain admitted; or a revocation satisfies it → contested |
| contested | the reconciliation predicate matches a revocation | a standing-covered resolution or the operator settles the `Conflict`; the fact itself stays readable |
| folded, tainted | a projection consumes it while provisional/contested/evidence-unavailable | taint propagates into the view or authority output refuses (P2-NF-76) |

---

## Retraction, correction, redaction — and the thing that is never deletion

A fact is wrong sometimes. None of it is repaired by changing the record.

**Rule — unsaying takes standing.** A retraction asserts a named fact should not be relied on,
**with a required `reason`** — a retraction without one does not decode (P2-NF-68), which is also
what makes rule 112's recorded-reason requirement mechanical; a correction is a new fact of the
same kind naming the fact it corrects. Both are writes against the *meaning* of the record —
stronger than appending, as strong as resolving a conflict — and part one already gates conflict
resolution on live standing in scope. So: the retracting or correcting principal must hold live
standing covering the named fact's kind and scope, at least equal to the standing its append
required; retracting or correcting a fact that confers standing, authorization, or ownership
requires the standing of the original grant. Rules 28, 86, and 104 are what leak without this.
**Check:** decode-time standing resolution, as admission rung 9 (P2-NF-32, P2-NF-33); a
self-serving case — a component retracting the refusal or judgment records that name it — is a
fixture, not a hope.

**Rule — the fold owns corrections.** Rule 24: a double-count that survives rebuild is exactly
the recurrence a hidden correction hides. Left to each author, a projection that ignores the
`corrects` field folds a mis-recorded $400 and its $40 correction as $440 — and passes
rebuild-equivalence, because it double-counts identically on rebuild. So correction handling lives
in the fold primitive, not in author discipline: the fold delivers a corrected fact and its
corrections as one superseded pair, never as independent occurrences (P2-NF-36). A correction
chain resolves to the causally latest; concurrent corrections to one fact are a `Conflict`. A
retraction may itself be retracted — the fact returns to relied-upon and every retraction stays
readable; cycles are refused at decode.

**Rule — a retracted fact is visibly retracted, not invisible.** Rules 7 and 24: hidden
corrections are how recurrence goes unnoticed. **Check:** a projection dropping a retracted fact
without recording that a retraction applied fails rebuild-equivalence (P2-NF-35); the retracted
fact stays readable with a verifying hash (P2-NF-34); retraction counts per kind are emitted
measurements.

**Value — incidental third-party content gets a lawful exit that is not deletion of history.**
This rests on a stated reading of rule 7, not on a rule that requires it — which is why it is a
Value and why question 4 puts the whole mechanism to the operator. Rule 7's subject is what the
*agent knows* — its memory. A third party's personal data arriving incidentally in a message
body, a mis-routed private message, a sensitive claim mis-attributed to a named person: none of
that is agent memory, all of it can land in the record, and a design with no exit forces the
operator into emergency deletion — the exact act the rules forbid — the first time an erasure
obligation arrives. So bodies that can carry such content live in the capture store by reference,
and an operator-standing **redaction fact** tombstones the capture *bytes* while the fact's
envelope, hash, the reference, and the redaction itself remain permanent. The redaction's scope is
bounded to its motivation, not only to its byte-mechanics: its `reason` is from a closed list
(erasure-obligation, mis-routed private content, mis-attributed sensitive claim — others refuse,
P2-NF-66); a capture referenced by an `Authorization`'s provenance, an open `Conflict`, or an
unresolved judgment record is not redactable (P2-NF-67) — the one byte-destruction primitive must
not be able to un-verify an approval or destroy contested evidence; and a redaction executes
after a declared delay window during which it is surfaced on the attention surface, so a
self-serving redaction is visible before it runs. **What redaction honestly achieves:** it is
cooperative deletion — every compliant store deletes the bytes and every compliant surface stops
serving them; a partitioned replica holds them until it reconnects and honours the tombstone, and
no proof of erasure exists. After redaction, what remains provable: that the fact occurred, its
envelope's integrity and authorship, the removed content's hash and byte length, and who redacted
it, when, for which listed reason. What is no longer possible: re-inspecting the content;
projections treat a redacted capture as unavailable evidence, never as silently absent — every
capture-referencing read carries a `captureStatus` of `available`, `tombstoned`, `expired`, or
`missing`, and a bare historical hash is never presented as live evidence (it proves the identity
of bytes that cannot be re-inspected, nothing more) — and
that status propagates: a fact or conclusion whose named evidence is a redacted capture carries
the same evidence-unavailable taint the fold uses for provisional authority, so anything still
relying on it is visibly resting on unverifiable ground (part seven's outcome grading treats
such conclusions as unverifiable rather than wrong), instead of quietly keeping its force.
**Check:** P2-NF-37 (standing), P2-NF-66 (closed reasons), P2-NF-67 (protected references),
P2-NF-65 (tombstone), and the append-only contract test asserts this is the sole byte-removal
carve-out.

**Value — no compaction in the first implementation.** Rule 7 forbids deleting what the agent
knows outright once `holdsAgentMemory` is yes — which for this store it is — so fact deletion is
rule-forced off the table (that is P2-NF-60's real ground, not implementation preference).
Compaction that provably loses nothing is *permitted* by rule 7 and still declined here, because
the proof does not exist yet; the allowance stays unused until it does. The cost — the record only
grows — is accepted **with its instruments attached** (the growth section), not on a promise to
notice.

---

## The version chain, for everything that governs

A rule, a term, a register entry, and a governed document are the same shape of thing: in force,
descended from something, approved somewhere. Each version carries:

| Field | Meaning |
|---|---|
| `since` | The fact that put this version in force. |
| `supersedes` | The version this one replaced; nothing for the first. A merge version — see forks — names both heads. |
| `approvedIn` | The **explicit-yes record** this version rests on, in part one's sense: the host's signed review-approval event for a repository-governed thing, an operator-authenticated authorization for a runtime-governed one. **A merge event never qualifies** (part one, verbatim). |
| `landedIn` | For a repository-governed thing: the merge commit on `main` where this version landed — the *locator* rule 90 names, generated from git, carrying no approval authority of its own. |
| `base` | What the approved content was reviewed against — the target branch head, register generation, or chain position. An approval whose base has moved does not transfer (part one's `base-moved`). |

**Why two anchor fields.** Rule 90 says a version carries "the pull request and commit that
approved it." Part one, approved after the rule book, establishes that the *yes* is the host's
review-approval record and that a merge event never qualifies — because rule 82 has the agent
perform merges, a merge-commit anchor would let the agent approve its own constitution. Read
together: the pull request's review approval is the authority (`approvedIn`), the commit is the
location (`landedIn`), and both are carried. This document flags that reading explicitly rather
than silently reinterpreting the rule; confirming it (or routing a formal amendment to rule 90's
wording) is one of the questions at the end. **The scope of the operator's yes, stated so it
cannot inflate:** an explicit-yes record is demanded only of versions of things that *govern* —
a rule, a term, a register entry, a governed document, a protected artifact. Ordinary work — a
feature, a fix, a refactor — merges on green with no human approval, exactly as rule 82 already
provides; nothing in this part adds an approval step to it. Operator approval is designed to be
the rare event, not the routine one (operator direction, 2026-09-04). Part one's limit is restated here so it cannot be
assumed away: a host that does not sign its review events can produce only `channel-attested`
approval records, and those do not qualify as the `approvedIn` of a protected artifact — a
governed thing on such a host has no valid repository anchor, which is a refusal, not a
downgrade.

**Honest scope for runtime-governed things.** Part one carried an open question: dashboard and
runtime artifacts have no approval anchor outside the agent's write authority yet. A runtime
`approvedIn` is therefore an `Authorization` whose provenance must be a verified operator action —
which the admission ladder can check — but the deeper anchor question stays open and carried to
parts nine and eleven, as part one recorded. This part does not pretend to close it.

**Rule — history is a lookup.** Rule 90; rule 7. **Check:** each field checkable at a stated
moment: `approvedIn` and `base` are resolved **once, at append** — the host's signed delivery is
verified then and recorded as a fact, so the build verifies recorded resolutions locally instead
of re-asking the host for every version on every build (the re-resolution against the host runs on
a bounded recent window plus a random sample, with its fail direction declared: closed for release
paths, since change integrity bears the miss). `landedIn` must be a real merge commit on `main`
(P2-NF-39); `approvedIn` must be an explicit-yes record and is refused when it is a merge event
(P2-NF-38); a version whose content hash differs from the hash its approval binds does not decode
(P2-NF-40 — rule 82's binding); a version landed on a moved base without re-issue is refused
(P2-NF-41); every `supersedes` resolves (P2-NF-42); an in-place edit that produces no new version
fails the build (P2-NF-43).

**Rule — a fork in a governing chain degrades to a conflict, never to a wedge.** Rules 31 and 33:
partitions are legitimate, so two machines can blamelessly append versions superseding the same
head — and an adversary can try to induce it deliberately. A permanent build failure would hand
either a durable denial of service against governance itself. The cheap induction is closed at
decode: a second version with the **same content hash and same approval** superseding the same
head collapses idempotently into the first — a replay cannot manufacture a fork (P2-NF-71); a
*different* concurrent version requires its own explicit-yes record, which is not cheap to mint.
A genuine fork yields a recorded `Conflict` surfaced to the operator, and until resolution **the
superseded head — the incumbent — remains in force**: neither contender takes effect, which fails
toward the already-reviewed state and grants nothing new (the freeze an attacker could force is
"the rules stay as they were," at the cost of delaying a legitimate change until the operator
merges — a human-loop cost this document accepts and names). Resolution is a **merge version**
whose `supersedes` names both heads, appended under operator standing in scope, carrying its own
`approvedIn` (P2-NF-44, P2-NF-45); the chain walk then passes. A cycle or a gap remains a hard
failure — those cannot arise blamelessly.

**Value — approval records differ by host, the chain does not.** A repository approval resolves
through the host's signed review event; a runtime approval through a verified operator action.
Both fill the same fields, so a reader never branches on what kind of thing it holds. The cost is
one indirection at resolution time.

---

## The projection contract

A projection is a pure fold over facts producing a view. Each clause removes a way it could
become something else, and each names its check.

1. **The fold is the only writer.** A projection exposes no operation that lets any caller set a
   value; its storage is written only by its own fold applying facts in order (P2-NF-46 — an
   architecture test, since a fixture cannot observe an out-of-band write; the fold signature is
   the enforcement surface).
2. **It declares its inputs, and every input decision is explicit.** A projection names the fact
   kinds it folds. Registering a *new* kind requires every existing projection to record `folds`
   or `ignores` with a reason — the build fails on a registered kind with no decision from some
   projection (P2-NF-47, P2-NF-48). This is what makes "a new fact kind silently ignored" a build
   failure a script can actually produce, rather than a judgment no script has.
3. **Its only other input is the register generation, as an argument.** A projection that needs
   governed metadata — schema shapes, declared immutable fields, the standing matrix — takes the
   register generation as an explicit parameter, exactly as part one's decoders do; it never reads
   another projection's storage (P2-NF-50). The fold signature admitting only facts and the
   generation is the convention; the *enforcement* is an import-and-effect lint over each
   projection package: pure except for writes to its own storage and checkpoints — no ambient
   store, clock, file, global, cache, or network reaches it (P2-NF-49 and P2-NF-50 are both
   lint-backed, not signature-implied), so there is no channel for a peer view — or any
   undeclared input — to arrive through. Honestly bounding effects this way is beyond a
   best-effort grep in most languages, so this adds one capability to part one's language
   capability floor — the toolchain must be able to bound a package's effects (a capability
   system, an effect-aware checker, or an injected-capability runtime), and the language is
   chosen, as part one fixed, by compiling the fixtures. The register
   projection's own bootstrap rides the big picture §11 minimal plane: a small, independently
   verified segment whose facts describe the register itself.
4. **It is deterministic to the byte.** Ordered iteration only; exact decimal or integer
   arithmetic for money and counts — binary floating point for a monetary quantity is a build
   failure (P2-NF-53); comparison is byte comparison over the view's canonical encoding; the
   reconciliation suite runs on at least two architectures, because a single-machine
   rebuild-and-compare reproduces its own non-determinism identically and cannot see it.
5. **It is disposable, and the test is pinned.** Deleting the projection's storage and rebuilding
   from facts must produce the same view **at the same folded-through vector**: the comparison
   captures a vector P first, rebuilds through P, and compares against the live view snapshotted
   at P (P2-NF-57, P2-NF-58) — comparing against a moving live view fails every time for a reason
   unrelated to the property. The rebuild check runs on a declared cadence with a wall-clock
   ceiling per projection; hitting the ceiling is a surfaced failure of the *budget*, distinct
   from divergence.
6. **It may forget only what it declared it would.** A projection's retention rule — which
   identities it may drop, on what terminal fact — is part of its definition and an input to
   rebuild-equivalence, so a rebuild forgets the same things in the same order. Without this,
   working-set is O(every identity ever), and the fix would otherwise be invented ad hoc per
   author. Identities carrying immutable fields subject to conflict detection are not forgettable.
7. **It is never an authority about what happened.** The register is the authoritative *index* of
   governed things — "what exists" — and never a second answer to "what occurred."
   **Check:** no consumer resolves an occurrence-time question against projection storage (an
   architecture lint over the query surface), and a register entry carries no occurrence-time
   claim of its own.
8. **It says how current it is, honestly.** A view carries its **folded-through vector** — one
   entry per machine, each a monotone (epoch, position) pair over that machine's totally-ordered
   segment lineage, with closed lineages collapsed to a closed-through summary — plus the set of
   machine lineages it knows to exist. "Current" is only ever relative to that set. **The known
   set has a defined origin:** it derives from the governed machine registry on the minimal plane,
   never from gossip alone — so a registered machine whose lineage head has not been observed
   within the staleness bound reads as *unknown-staleness*, and authority reads fail closed on it
   exactly as on a known-but-unfolded segment; an idle machine distinguishes itself from a
   withheld one by heartbeat facts or an operator lineage-close (P2-NF-54) — and that close is
   deliberately a minimal-plane operation, verified against the genesis anchor the way the first
   grants are, so freeing authority reads from a dead machine's lineage never depends on the
   very authority projection that lineage is blocking. A segment carrying a
   revocation cannot be invisible-by-omission, because the machine that owns it is in the
   registry or its facts were never admissible at all.

**Rule — staleness is a value, and authority fails closed on it.** Rule 95 requires a declared
fail direction per consumer; rule 14 sets the user channel's. A projection answering an
**authority question** — standing live, authorization valid, ownership held, spend within cap —
refuses past a declared staleness bound on any known-but-unfolded (or unknown-staleness) lineage,
and serves the *narrower* answer while a relevant record is in conflict (P2-NF-55, P2-NF-56): a
revocation that has not arrived is exactly the case where "current over what I hold" and "true"
diverge, and the absence of a negative fact must not read as permission. User-channel views keep
serving, labelled. Admission's own standing resolution (rung 9) is the one authority consumer
with a stated carve-out — it resolves as a deterministic function of each fact's declared causal
cone so a partitioned machine keeps recording and every replica reaches the same verdict, with
facts marked `provisional` when this machine's newer revocation heads lie outside that cone; the
reconciliation pass plus retroactive `Conflict` flagging is what keeps the carve-out from
silently extending revoked standing, and provisional authority feeds no irreversible effect
(P2-NF-73). **Check:** every
registered projection declares its class (authority-answering or informational) and its bound; the
partition fixture — revocation on machine A, authority read on partitioned machine B — fails any
authority projection that answers live.

**Value — lagging reads are served, labelled, and the strong read is scoped to what exists.** A
reader may demand currency **relative to a position it has previously observed** — read-your-writes
and monotonic reads, both locally satisfiable — or relative to a named lineage set. A demand for
global "now" is not offered: under a partial order with no ordering service, knowing the global
head requires every machine to answer, which converts the strong reader's partition into an
outage and is precisely what this design refuses to do. That limit is stated so callers design
against it rather than discovering it.

**Rule — every store this part creates is a register entry, with its facts actually supplied.**
Rules 32, 33, 69; the register's kind 1. The table below is the declaration, not a promise of one
— including `standards` (rule 69's both-ends resolution) and `status`. Growth values are from the
register's closed list; where this part genuinely needs a value the list lacks, it proposes the
shape change through the register's own amendment process rather than writing prose beside the
field — that is question 4's second half. **Check:** the register build fails on a missing
required fact; the `agreesWith` invariants are the scheduled tests named here.

| Entry | `growth` | `holdsAgentMemory` | `machineScope` | `agreesWith` | `standards` | `status` |
|---|---|---|---|---|---|---|
| fact store (segments) | `unbounded` | **yes** — learnings, commitments, corrections land here; rule 7's ban attaches with full force | `shared` (its per-segment verified-through watermarks and the provisional marks are machine-local maintenance state carried inside this entry) | projections via pinned rebuild-equivalence; capture store via reference resolution | rules 7, 28–33, 89, 90, 100, 112, 113 — checks P2-NF-15/16, 05–14, 57/58 | `live` (effective at the part-two build) |
| capture store | **proposed `redacts`** — deletes bytes only under an operator-standing tombstone fact with the envelope retained; this value does not exist in the register's closed list, and its addition is formally proposed as a register-shape amendment riding this document's approval (question 4) | yes | `shared`, judgment-capture classes excepted (machine-local, part nine's retention decision) | fact store: every referenced capture resolves or carries a tombstone (P2-NF-64/65) | rules 7, 26, 100 — checks P2-NF-64/65/37/66/67 | `live` (effective at the part-two build) |
| refusal store | `deletes` (bounded window; aggregate survives row shedding) | no — metadata only, never bodies | `machine-local`, stated reason: refusals are evidence about a *local* boundary's traffic | fact store: a terminally-refused hash never admitted without an intervening admissibility-state change (holds + curable decode sub-classes excluded) | rules 4, 46, 60 — checks P2-NF-30/31 | `live` (effective at the part-two build) |
| pending set (replication holds) | `deletes` (bounded, TTL-escalated) | no | `machine-local`, stated reason: an ordering accident is local to the receiving replica | fact store: a held fact either admits or escalates, never vanishes | rules 46, 60 — check P2-NF-25 | `live` (effective at the part-two build) |
| projections (each) | `deletes` (per its declared retention rule; disposable by contract) | no — *the facts hold it*; the view is disposable | `machine-local`, stated reason: derived, rebuildable from the shared record | the fact store, via clause 5's pinned test | rules 24, 31–33, 45, 95 — checks P2-NF-46–58 | `live` per projection at its registration |

(The register's `growth: deletes`-plus-`holdsAgentMemory: yes` build failure is what forces the
projection row's posture: a projection never answers yes, because deleting a *view* of memory
deletes no memory — the spine still holds it. A projection kind whose view genuinely held memory
the spine did not would be mis-designed, and the build failure firing is the correct outcome.)

---

## Growth, and the instruments that make its costs visible

The record only grows; several checks replay it; boot rebuilds views from it. Every one of those
costs is measured, because "revisit when a problem is measured" is only honest if the measurement
exists and something re-surfaces it.

**Rule — the store emits its own cost curve.** Rule 13 (a measurement knows what it measured);
rule 8 (untracked is abandoned); rules 46 and 60 (bounded backlogs, bounded accumulation).
**Check:** these are registered measurement subjects with a named producer: `sequence-length`
(facts, per segment), `segment-bytes`, `append-rate` (windowed), `genesis-replay-duration` (per
projection), `checkpoint-replay-duration` (per projection), `boot-rebuild-duration`,
`replication-lag` (per segment), `refusal-rate` (per source), `unattributable-wrap-rate`,
`retraction-count` (per kind),
`conflict-backlog-age`, `pending-set-depth`, `known-segment-set-size`, `machine-key-count`, and
`historical-encoder-count` (every schema version's canonical encoder stays load-bearing forever —
the count is visible so its growth is a fact, not a surprise), plus a canonical-bytes re-encode
fixture per *retired* schema version, since decode fixtures alone do not keep an old encoder
honest. The compaction question re-opens at a declared **replay-duration threshold** — replay
time, not byte count, is what actually breaks, and a faster disk legitimately moves it — and that
re-opening is a registered loop with a re-surfacing cadence, per rule 8, opened by this document
rather than deferred to memory.

**Rule — checkpoints exist, and a checkpoint is a projection.** Rule 15: boot time rides replay
cost, and an agent unreachable for the length of a genesis replay is the exact failure "the agent
is always reachable" forbids — the machine that can fix a resource problem must come up before its
history has been fully re-read. **Check:** a projection may persist checkpoints at a
folded-through vector; a checkpoint inherits every clause above — disposable, fold-written,
deterministic — and never licenses removing a fact beneath it (P2-NF-59: a checkpoint that does is
compaction wearing a costume). The rebuild check splits: **incremental** (from last checkpoint —
frequent, cheap, catches fold bugs) and **genesis** (from nothing — rare, budgeted, the only form
that catches checkpoint corruption and the only one that fully holds rule 33's agreement). The
segment hash-chain verification splits the same way (watermark at boot, full chain in the sweep).
The minimal plane's projections are named by part eleven and their genesis-replay time is one of
the measurements above, so rule 15's boot path has a number attached instead of an assumption.

---

## Multi-machine posture

Stated explicitly, as rule 113 requires:

- **The fact record is shared.** Each machine owns its segment lineage and never appends to
  another's — held by the signature (only the owner's key signs) and the chain (P2-NF-09,
  P2-NF-11), not by politeness. Replication is additive, authenticated, contiguity-checked.
- **Projections, the refusal store, and the pending set are machine-local, with their reasons
  declared in the register table above.** Derived or boundary-local state replicating would
  replicate conclusions instead of evidence.
- **A partitioned machine keeps working — within locally-provable standing.** It appends locally
  where the standing its facts rely on is provable from segments it holds (rung 9's carve-out,
  with `provisional` marking where its cone trails this machine's revocation heads), serves
  labelled-stale views, and fails closed on authority questions past their bound. On
  reconnection segments merge by the reconciliation rules, retroactive standing conflicts are
  flagged, and genuine divergence surfaces as `Conflict`s.
- **Durability is a state, not an assumption** — the append states and replication-lag measurement
  above are this posture's honesty about the window in which a fact exists on one disk.

**Rule — every change declares its multi-machine posture.** Rules 113 and 32. **Check:** the
register entries above carry `machineScope` with reasons; the reconciliation and partition
fixtures are the tested agreement.

**Value — no fact is machine-local, which is stricter than the rule.** Rule 32 permits a justified
machine-local *store*; this design forbids a machine-local *fact* outright (P2-NF-61), because a
fact only one machine can ever see cannot be reconciled or audited from anywhere else — but that
is this document's choice, not the constitution's requirement, and it is marked accordingly.

---

## The negative contract fixtures

Numbering continues part one's sequence with a part prefix — **P2-NF-nn** — so a bare citation is
unambiguous across parts. Each row names its **stage**, because a runtime fixture cannot observe
an architecture property: `decode` (refused at admission), `ingest` (refused/held at replication
receipt), `build` (a lint or registry check fails the build), `arch` (an architecture/contract
test over the implementation's shape), `test` (a behavioural contract test).

**Rule — the fixtures are the contract.** Rules 34, 36, 37, and 69. **Check:** every fixture
number exists in the implementation's test suite at its named stage; a fixture that passes when it
should refuse fails the build; part one's build step maps invariants to fixture numbers and this
table extends the same map.

| # | Stage | Shape | Refused/failed because |
|---|---|---|---|
| P2-NF-01 | decode | A fact with no `principal` | Attribution is required; no anonymous variant exists. |
| P2-NF-02 | decode | `principal` built from a name lifted from message content | Part one: a name is not a `VerifiedPrincipal`. |
| P2-NF-03 | decode | `principal` as a bare register id | The system lane goes through `kind: system`, not around the door. |
| P2-NF-04 | decode | An authority-bearing fact whose provenance is `channel-attested` or absent | Part one's provenance floor applies to facts. |
| P2-NF-05 | decode | Stored `contentHash` differs from recomputation | The record was altered — integrity. |
| P2-NF-06 | test | Two envelopes differing only in absent-vs-empty `predecessors` hash identically | Field-omission second preimage; absent must encode distinctly. |
| P2-NF-07 | decode | A `signature` that does not verify against the governed key for `machine` at this position | Authenticity, not integrity, is what proves origin. |
| P2-NF-08 | decode | `machine` differs from the signing key's registered owner | A valid signature under the wrong identity is a forgery. |
| P2-NF-09 | ingest | A fact whose `prevInSegment` does not extend the receiver's held head | Chain break: fork, tamper, or gap — surfaced, never merged silently. |
| P2-NF-10 | ingest | Two facts at one (segment, position) with different ids | A forked total order; restore-from-backup must open a new epoch. |
| P2-NF-11 | ingest | A peer delivering a segment it does not own | Segment ownership is what makes in-segment order total. |
| P2-NF-12 | ingest | A replication stream with a positional gap accepted silently | An incomplete replica that answers confidently. |
| P2-NF-13 | decode | An append targeting an existing `id` | Ids are never reused; this is an edit wearing an append's clothes. |
| P2-NF-14 | decode | An `id` outside the appender's namespace | A cross-machine collision must be a refusal, not a manufactured conflict. |
| P2-NF-15 | arch | A fact-store port exposing more than one mutating method, whatever its name | Append-only is held by shape, not by vocabulary. |
| P2-NF-16 | test | An out-of-band segment mutation surviving watermark-boot and full-sweep verification | The chain re-verification catches what no code path did. |
| P2-NF-17 | decode | A body containing a live credential value | Rule 100; screened first, on raw bytes, so it is never retained. |
| P2-NF-18 | build | A fact kind declaring a secret-valued field | The same violation, one layer earlier. |
| P2-NF-19 | build | A free-text body field undeclared or unclamped in its schema | The scan needs an enumerated, bounded surface. |
| P2-NF-20 | decode | A fact of an unregistered `kind` | The registry is the closed set. |
| P2-NF-21 | decode | A `schemaVersion` with no migration forward | Part one's versioning convention. |
| P2-NF-22 | test | A hash verified after migration rather than against as-appended bytes | A hash only verifies over the bytes it was taken over. |
| P2-NF-23 | decode | A causally-bound kind missing its registry-declared reference | Omission is the cheapest evasion of ordering; standing-gated kinds are always causally bound. |
| P2-NF-24 | decode | A non-genesis fact missing its in-segment predecessor | Each machine's own history is always totally ordered. |
| P2-NF-25 | ingest | A replication-path dangling reference refused or dropped instead of held, below the pending set's declared bound | Ordering accidents — a not-yet-arrived grant included — hold in the pending set, escalate on TTL, never lost; at the bound, refusing back to replication for redelivery is the designed behaviour. |
| P2-NF-26 | decode | An appender without live standing for the kind and scope | Appending must not be minting. |
| P2-NF-27 | decode | An authority-bearing fact appended under requester standing | Part one's floor, applied at the record. |
| P2-NF-28 | decode | A constitutional value in a body decoded without the fact's provenance | Part one's refusals apply inside bodies. |
| P2-NF-29 | test | An unresolvable-principal input dropped instead of wrapped as an unattributable observation | Rule 14: preservation is the fail direction for intake. |
| P2-NF-30 | test | A refusal retained with body bytes | Metadata only — the guard must not store what it caught. |
| P2-NF-31 | build | A refusal store or pending set without a registered bound | Rules 46/60: nothing accumulates unboundedly, least of all evidence of malfunction. |
| P2-NF-32 | decode | A retraction by a principal without standing over the named fact | Unsaying takes standing. |
| P2-NF-33 | decode | A correction to an authority-conferring fact without the original grant's standing | Correction must not be a cheaper path than the authorization machinery. |
| P2-NF-34 | test | A retraction that removes the retracted fact from readability | Rule 7: never deletion. |
| P2-NF-35 | test | A projection dropping a retracted fact without recording the retraction applied | Rule 24: hidden corrections hide recurrence. |
| P2-NF-36 | test | A fold delivering a fact and its correction as independent occurrences | The fold owns corrections; double-counting survives rebuild-equivalence otherwise. |
| P2-NF-37 | decode | A redaction without operator standing | The only byte-removal in the system is the most gated act in it. |
| P2-NF-38 | decode | A governing version whose `approvedIn` is a merge event | Part one: a merge event is never an explicit yes; the agent merges. |
| P2-NF-39 | build | A `landedIn` that is not a real merge commit on `main` | Rule 90's locator, generated from git. |
| P2-NF-40 | decode | A version whose content hash differs from the hash its approval binds | Rule 82: approval is bound to exact content. |
| P2-NF-41 | decode | A version landed on a moved `base` without re-issue | A stale approval does not transfer. |
| P2-NF-42 | build | A `supersedes` naming a version that does not exist | The chain must walk. |
| P2-NF-43 | build | An in-place edit to a governing thing producing no new version | Rule 90 forbids it. |
| P2-NF-44 | test | A concurrent chain fork producing a wedge instead of a recorded `Conflict` with the incumbent in force | Governance degrades to a flagged, already-reviewed state, not an outage. |
| P2-NF-45 | decode | A fork-merge version appended without operator standing in scope | Only the operator reunifies a governing chain. |
| P2-NF-46 | arch | A projection whose storage is writable by anything but its own fold | The fold is the only writer. |
| P2-NF-47 | build | A projection folding a kind it did not declare | The consumer graph must be real. |
| P2-NF-48 | build | A registered kind with no folds/ignores decision from some projection — or a fold with no quarantine path for a poison fact | Silent ignorance and silent wedging are the two ways a fold lies. |
| P2-NF-49 | build | A projection reading a clock | Purity; part one's time convention. |
| P2-NF-50 | arch | A fold signature admitting anything beyond facts and the register generation | No channel for derived-on-derived. |
| P2-NF-51 | test | A projection whose output changes under an adjacent transposition (or sampled permutation) of concurrent facts without emitting `Conflict` | Fold order must not be able to become a value; the bound makes the check runnable. |
| P2-NF-52 | test | A fold resolving a same-identity immutable-field disagreement silently | Conflicts are recorded through part one's equality primitives, never absorbed. |
| P2-NF-53 | build | A monetary or countable quantity accumulated in binary floating point | Cross-architecture determinism; spend is a projection. |
| P2-NF-54 | test | A view served without its folded-through vector and known-lineage set, or an unknown-staleness lineage read as current | A scalar cannot express "I have never seen machine C"; an unobserved registered machine is not a current one. |
| P2-NF-55 | test | An authority-answering projection serving past its staleness bound | The absence of a revocation must not read as permission. |
| P2-NF-56 | test | A conflicted authority-bearing record served as live | Contested authority serves the narrower answer. |
| P2-NF-57 | test | A rebuild compared against a live view at a different vector | The comparison must be pinned or it measures lag, not divergence. |
| P2-NF-58 | test | A pinned rebuild differing from the live view | The view drifted from its evidence — the real failure. |
| P2-NF-59 | test | A checkpoint that licenses removing facts beneath it | That is compaction; a checkpoint is a projection. |
| P2-NF-60 | test | A compaction that removes facts | Rule 7, with `holdsAgentMemory: yes` declared — forbidden, not declined. |
| P2-NF-61 | build | A fact schema declaring machine-local scope | This design's stricter-than-32 choice, marked as a Value above. |
| P2-NF-62 | test | Replication removing or rewriting a fact on the receiver | Replication is additive. |
| P2-NF-63 | test | An irreversible effect on a fact whose durability state is below the operation's declared demand | Named here with the durability states; owned by part eight. |
| P2-NF-64 | decode | A capture reference that does not resolve at append | Verify the state, not the symbol: a hash pointing nowhere proves nothing. |
| P2-NF-65 | test | A capture deleted under a live reference without a tombstone fact | The audit trail must not rot silently. |
| P2-NF-66 | decode | A redaction whose reason is not on the closed list | The byte-destruction primitive is bounded to its motivation. |
| P2-NF-67 | decode | A redaction of a capture referenced by an `Authorization`'s provenance, an open `Conflict`, or an unresolved judgment record | Redaction must not un-verify an approval or destroy contested evidence. |
| P2-NF-68 | decode | A retraction without a `reason` | Rule 112's recorded reason, made mechanical. |
| P2-NF-69 | ingest | A fact verifying only against a key outside its segment-position validity range | Key windows are causal; a backdated clock cannot reach an old key. |
| P2-NF-70 | test | Facts at or after an operator-attested compromise position not quarantined as a conflict class | Compromise recovery is defined, not improvised. |
| P2-NF-71 | decode | An identical-content, identical-approval duplicate version forking a chain instead of collapsing | A replay cannot manufacture a governance fork. |
| P2-NF-72 | test | A standing resolution keyed on the appender's `at` rather than causal position | A backdated clock must not resurrect revoked standing. |
| P2-NF-73 | test | A `provisional`-marked fact's authority feeding an irreversible effect before reconciliation clears it | Partition-local standing is usable, never spendable; owned by part eight with P2-NF-63. |
| P2-NF-74 | build | A projection folding a kind with no declared merge class | Commutativity is declared per kind, not assumed per author. |
| P2-NF-75 | test | A provisional mark surviving after every held revocation in the fact's grant scopes fails the reconciliation predicate at the horizon | Clearing must happen and be correct — the complement of P2-NF-73. |
| P2-NF-76 | test | A projection emitting untainted authority output computed from provisional or contested input | Taint propagates through the fold or authority output refuses; it never launders. |
| P2-NF-77 | decode | A fact appended at origin whose declared frontier omits a relevant revocation head its own machine had folded | Omitting what the appender provably held is evasion, not an ordering accident; checked at origin only, where it is deterministic. |

---

## The terms this part introduces

One collision is surfaced rather than papered over: the glossary's term-kind value `fact` ("a
profile field or required fact") and this part's noun **fact** are different senses of one word,
and the resolver that walks terms cannot hold both. The parent design uses "fact" for the record
sense throughout, so this part keeps it and proposes the *glossary kind* be renamed (`fact` →
`field`) through its own supersedes chain — a question at the end, since renaming a glossary kind
is the operator's call. **Correction** below is likewise distinguished from rule 85's
user-correction sense.

| Term | Kind | Definition |
|---|---|---|
| **fact** | noun | An immutable, signed, attributable record that something occurred, carrying the envelope above. Never a statement of what is currently true. |
| **envelope** | noun | The fields every fact carries regardless of kind, sufficient to attribute, place, order, and verify it without knowing the kind. |
| **segment** | noun | An append-ordered, hash-chained sequence owned by exactly one machine, one epoch of that machine's lineage. Order within is total; across, partial. |
| **lineage** | noun | A machine's segments in epoch order, each genesis bound to its predecessor's closing head — one auditable history per machine across restores. |
| **causal order** | noun | The partial order given by `predecessors` and in-segment position. The only ordering a decision, a projected value, or an authority resolution may rest on. |
| **fold order** | noun | The deterministic linearization used only to make projection output identical across machines at equal vectors. Structurally unable to select a value or resolve authority. |
| **fold-key instant** | noun | The clock measurement's value normalized to one canonical unit and encoded fixed-width, so byte order over it is time order. Pinned by the preimage rules; unnormalizable readings refuse. |
| **admission** | noun | The single boundary through which a fact enters — local append and replication receipt run the same ladder with different fail directions. |
| **pending set** | noun | The bounded, deduplicated hold for replication-path facts whose causal references have not yet arrived. Admits or escalates; never drops; refuses new holds at its bound. |
| **projection** | noun | A pure, deterministic, declared-input fold over facts producing a disposable view. Never written to by a caller, never an authority about what occurred. |
| **checkpoint** | noun | A projection's persisted state at a folded-through vector. A projection in every respect; never a license to remove facts. |
| **folded-through vector** | noun | Per-machine (epoch, position) high-water marks over each lineage plus the known-lineage set, carried on every view, so currency is always relative to a stated horizon. |
| **retraction** | noun | A standing-gated fact, with a required reason, asserting a named fact should not be relied on. The retracted fact remains readable, visibly retracted. |
| **correction** | noun | A standing-gated fact of the same kind superseding a named fact's content in the fold. Distinct from rule 85's user correction, which is about feedback becoming durable improvement. |
| **redaction** | noun | The operator-standing, closed-reason, delay-windowed tombstone of capture *bytes* under a permanent record that the redaction occurred. The only byte removal in the system; cooperative, with no proof of erasure. |
| **version chain** | noun | `since` / `supersedes` / `approvedIn` / `landedIn` / `base` — how a governing thing carries its history as a lookup. |
| **durability state** | noun | What `append` returns: `local-durable` or `replicated(n)`. The effect doorway names its demand per operation. |

---

## The parent's rule list, discharged one by one

The big picture's §2 names eighteen rules under "history is reconstructable." A blanket citation
would repeat 1.x's disease — a rule listed against a check that cannot fail for it — so each is
answered:

| Rule | Verdict here |
|---|---|
| 7 (never delete) | **Held**: no delete exists; P2-NF-34/59/60; redaction removes capture bytes only, under a permanent record, resting on the stated scope reading marked as a Value. |
| 15 (always reachable) | **Engaged, part-bounded**: checkpoints + watermark boot verification + the boot-rebuild measurement keep boot off the genesis-replay curve; the live-session guarantee itself is part eleven's. |
| 24 (distrust temporary success) | **Partially held**: fold-owned corrections + visible retractions make recurrence *visible* (P2-NF-35/36); fingerprint comparison across recurrences needs the judgment doorway — part seven. |
| 32/33 (scope, agreement) — plus 31, from the parent's §11 rather than its §2 list | **Held**: register table declarations; reconciliation + partition fixtures; pinned rebuild-equivalence as the tested agreement. |
| 41/58 (observable, reviewable judgment) | **Substrate held, doorway deferred**: judgments land as attributable facts with pinned provenance; the doorway that writes them is part seven; the capture-retention tension is stated, not hidden. |
| 45 (consumers move with sources) | **Held**: declared inputs + the folds/ignores decision per kind are the consumer graph (P2-NF-47/48). |
| 69 (references both ways) | **Held for what this part declares**: the register table's `standards` column names each entry's rules and checks; every Rule block names fixtures. |
| 75 (token audit) | **Deferred to part seven** — nothing here makes a model call. |
| 85 (never-waste feedback) | **Deferred to part nine**, and the term collision with this part's *correction* is named in the terms table so the deferral cannot hide behind the homonym. |
| 89 (truthful provenance) | **Substrate held**: signature + pinned provenance on every fact — automatic signing at the record layer; the message-surface obligation itself is the intake part's. |
| 90 (history is a lookup) | **Held**, with the two-anchor reading (`approvedIn` + `landedIn`) flagged for the operator's confirmation. |
| 94 (waiver before the act) | **Substrate only**: a waiver is an `Authorization` fact; the waiver-count review is a projection part nine names. |
| 100 (secret stored before spent) | **Held with a stated residual**: three-layer check; prose leaks rotate-and-record, never delete. |
| 108 (conclusion and reason separate) | **Deferred to part seven** with its type already fixed in part one. |
| 112 (green history preserved) | **Append-only half held here** — everything is; and the recorded-reason half is mechanical via the retraction's required `reason` (P2-NF-68). The CI-record fact kind itself is a named part-three deliverable, so the verdict is substrate-plus-mechanism, not "built". |
| 113 (declared multi-machine posture) | **Held**: the posture section and register table. |

---

## What this part makes checkable

Rule 90 moves from "needs the register" to held by the chain and its walker — an in-place edit, a
dangling supersession, a merge-event approval, a moved base, all refuse mechanically. Rule 7 gains
a mechanical form — there is no delete to call, and the one byte-removal that exists (redaction)
is operator-gated, closed-reasoned, delay-windowed, and permanently recorded. Rule 45's consumer
graph becomes real and two-sided: declared inputs plus a mandatory decision per new kind. Rules
31/32/33 gain their subject and their tested agreement. Rule 112 gains its recorded-reason
mechanism. Rule 89 gains automatic signing at the record layer. Authority resolution gains a time
base an appender cannot choose. And the two properties 1.x could never distinguish — integrity
and authenticity — are separate fields with separate fixtures, so "the bytes are intact" can never
again impersonate "the author is proven."

What this part deliberately does not hold, it names: recurrence fingerprinting (24), the judgment
doorway's own duties (41/58/75/108), feedback-into-improvement (85), the waiver review (94), the
runtime approval anchor (parts nine/eleven), the CI-record kind (part three), and the
live-reachability guarantee (15).

---

## What I want from you on this document

1. **Unbounded growth, now with a gauge.** No deletion, no compaction; the record only grows. The
   instruments section attaches the measurements and a replay-duration threshold that mechanically
   re-opens the compaction question as a registered loop. Do you accept unbounded growth on those
   terms — and is replay-duration (rather than bytes) the right trigger?

2. **The two-anchor reading of rule 90.** `approvedIn` is the host's review-approval record (the
   authority — a merge event never qualifies, per part one), `landedIn` is the merge commit (the
   locator rule 90's text names). I believe this reads the rule faithfully alongside part one;
   the alternative is a formal amendment to rule 90's wording through its own version chain.
   Confirm the reading, or direct the amendment?

3. **Retraction visibility and its audience.** A retracted fact stays visible as retracted —
   hidden corrections hide recurrence. But visible *to whom* is a real question: an
   operator-facing view showing repudiated history is honest; the same in a user-facing view may
   be noise or harm. Default: operator surfaces show retractions; user surfaces show them only on
   request. Right line?

4. **The redaction carve-out, and the register amendment it needs.** For incidental third-party
   content, an operator-standing redaction — reason from a closed list, protected references
   unredactable, a surfaced delay window — tombstones capture *bytes* while every envelope, hash,
   and the redaction record stay permanent. It is cooperative deletion with no proof of erasure,
   and the document says so. It also needs one register-shape amendment: a `growth: redacts`
   value for the capture store, since the existing closed list cannot describe "deletes bytes
   only under a permanent operator tombstone." Do you want the mechanism, this narrow, and do
   you approve routing the register amendment with it?

5. **No machine-local facts — stricter than rule 32.** A machine-local *store* is permitted with
   a reason; a machine-local *fact* is forbidden outright. Keep the stricter line?

6. **Full history on every machine.** Every machine holds all segments — each can audit, rebuild,
   and serve alone (bounded by capture availability, stated in the text), at the cost that the
   smallest disk governs fleet retention and storage is machine-count × history. The alternative
   (bounded local suffix, older segments fetched on demand) stays open behind the same
   measurements. Start with full copies?

7. **Authority fails closed on staleness — and partitions flag retroactively.** Standing,
   authorization, ownership, and spend projections refuse past a staleness bound and serve the
   narrower answer under conflict. Admission itself carries the one carve-out: a partitioned
   machine keeps appending within locally-provable standing, and a late-arriving revocation
   retroactively flags the facts it undercuts as conflicts rather than silently invalidating or
   silently keeping them. Accept the split, including the retroactive-flagging trade?

8. **The capture-retention tension, stated not solved.** The big picture promises judgment
   captures are machine-local with bounded retention; this part makes facts that reference them
   permanent. A retention-expired capture leaves a permanent fact pointing at absent bytes, so
   facts must carry enough in-body to stay *reviewable* after capture expiry — but the full
   reconciliation of rule 7 with bounded capture retention is carried to part nine, explicitly.
   Accept carrying it?

9. **The glossary homonym.** This part keeps **fact** for the record (matching the approved
   parent's usage) and proposes renaming the glossary's term-kind value `fact` to `field` through
   its own supersedes chain. Approve routing that small amendment?

10. **A third category for rule 4's blocking sites.** The admission ladder (and every decoder
    part one already ships) blocks deterministically without a model, yet is neither on rule 4's
    ruled-three list nor "names the model that decides." Rather than game the `decidesAlone`
    field, this part proposes amending rule 4 / the register's blocking-site kind with a third
    recognized category — *deterministic enforcement of recorded governed state* (an exact test that
    refuses malformed, unverifiable, or standing-uncovered input and preserves it — covering the
    integrity/decode rungs and the standing rungs alike) — under which part one's decoders and
    this boundary both register honestly. Approve routing that amendment?

---

*Depends on: the approved rules, register, glossary, big-picture design, and part one, and their
changelogs. Next after approval: part three, declarations, the register generator, the terms
resolver, and the rule/holder graph, built on this envelope and version chain.*
