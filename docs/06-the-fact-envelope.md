# Part two — the fact envelope, the version chain, and the projection contract

**Status: draft, awaiting approval. Governed. No later part design or code is built on top of this until it is approved.**

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
readable, hash-verifying, and at its original position (P2-NF-16); and boot plus a scheduled sweep
re-verify each segment's hash chain so an out-of-band mutation of the underlying storage is
detected even though no code path performed it (also P2-NF-16). A lint on exported names (update,
delete, truncate, prune, vacuum, rewrite) runs as a secondary tripwire and is labelled as such —
per rule 26, the name lint is the symbol and the contract test is the state.

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
reviewers can import known failure modes instead of rediscovering them.

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
| `at` | A clock measurement, in part one's sense: a reading taken by a named holder, not an assumed instant. |
| `machine` | The stable opaque key of the machine that appended it. A rename changes a nickname elsewhere, never this key. |
| `principal` | The `VerifiedPrincipal` that caused it. System-originated action uses `kind: system` through the same door, per part one — there is no bare-identifier alternative. |
| `provenance` | Part one's `Provenance` for that principal, pinned at append: the adapter, method, authenticated-record reference and capture hash, time, verifying machine, and class (`verified` or `channel-attested`). A replicated fact decodes to a principal *pinned at origin* — a distinct decode path from live intake, which never re-mints authority from bytes. |
| `segment` | The append segment this fact belongs to, and its position within it. Positions are dense: a gap is detectable and refused (P2-NF-12). |
| `prevInSegment` | The `contentHash` of the previous fact in this segment (a defined genesis value for the first). This makes each segment a strict hash chain, so a fork — two facts at one position — breaks the chain visibly at every receiver (P2-NF-09, P2-NF-10). Distinct from `predecessors`, which is causal. |
| `predecessors` | The set of fact ids this one causally follows: always the in-segment predecessor's id, plus every other segment head the appender had folded when it appended. A merge after a partition is therefore expressible. Kinds the schema registry marks *causally bound* (an authorization, a supersession, a revocation-dependent act) must include their required reference or be refused (P2-NF-23). |
| `body` | The kind-specific payload, whose shape the registered schema fixes. |
| `contentHash` | The canonical hash over every field above — excluding itself. |
| `signature` | The appending machine's signature over `contentHash`, verifying against that machine's key in part one's registered key set. `machine` must equal the signing key's registered owner (P2-NF-07, P2-NF-08). |

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
survives the fact boundary instead of being silently undone by it. A fact that cannot be placed:
`machine`, `segment`, `at`, `prevInSegment` all required. A forged or quietly altered fact:
alteration breaks `contentHash` (integrity), and authorship is carried by `signature` +
`provenance` (authenticity) — the hash alone is never claimed as proof of origin.

**Rule — every fact is attributable and verifiable.** The parent's §2 requires every fact to carry
id, causal predecessor, machine, principal, schema version, and content hash; rules 28 and 29
require every principal — human, agent, or system — verified through one door; rule 89 requires
provenance to be truthful and signing to be automatic. **Check:** the decoder refuses an envelope
missing any field (absent-as-value is a defined encoding, not an omission); `principal` admits
only `VerifiedPrincipal` (P2-NF-03); a fact whose effect exceeds requester standing carries
`verified` provenance or is refused (P2-NF-04); signatures verify against the registered key set
(P2-NF-07, P2-NF-08); a recomputed `contentHash` mismatch is refused at ingest and at read
(P2-NF-05).

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

- **Causal order** is the partial order above. It is the only ordering a decision or a projected
  value may rest on.
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
fold order, it must emit a `Conflict` instead of a value.** **Check:** the permutation test — every
projection's fixture set is replayed under permutations of its concurrent facts, and any output
difference that is not a `Conflict` fails (P2-NF-51); the reconciliation suite (reorder,
duplication, partition, conflict, late-segment insertion) produces byte-identical output on every
machine *at the same folded-through vector*.

**Value — the presentation tiebreak is the appender's clock, flagged when implausible.** No rule
forces a tiebreak; clock order is chosen because it is close to human expectation. It is also
appender-controlled, and the design treats it accordingly: it can no longer select an authoritative
value (the commutativity rule above), so what remains is presentation. A reading implausibly far
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
which causal references are mandatory — an authorization names its base, a supersession names its
predecessor, a revocation-dependent act names the revocation state it read — and the decoder
refuses a causally-bound kind whose reference is absent (P2-NF-23). The in-segment link is
mandatory for every fact (P2-NF-24), so each machine's own history is always fully ordered even
when nothing else is.

---

## Durability, replication, and what a segment owner owes

**Append returns a typed durability state, not a boolean.** `local-durable` means the fact
survives this machine's crash; `replicated(n)` means n peers have acknowledged holding it. The
effect doorway (part eight) must name which state an irreversible effect demands before it acts;
this part supplies the states and the measurement (replication lag per segment), and the fixture
for effects-on-insufficient-durability lands with part eight, named now (P2-NF-63). Without this,
"no fact is machine-local" is a statement about schemas wearing the costume of a statement about
reality: every fact is physically machine-local between append and replication, and the window is
now measured and bounded rather than unmentioned.

**Replication is additive, authenticated, and complete.** A peer delivers only segments it owns
(P2-NF-11), over an authenticated channel, and the receiver runs the same admission boundary as
local append — same decoders, same checks, different fail direction (see Admission). Receipt
verifies per-segment contiguity: positions are dense, so a gap is detectable, and a stream with a
hole is quarantined and surfaced, never accepted silently (P2-NF-12) — an incomplete replica that
answers confidently is worse than an unreachable one. Re-delivery collapses idempotently on `id`.
Catch-up after a long partition is rate-bounded (a declared ceiling, per rule 60) so a returning
laptop is not saturated by its own history.

**A fact whose causal reference has not yet arrived is held, not refused.** On the intake path a
dangling reference is a refusal — the client is talking about something that does not exist. On
the replication path it is an ordering accident: the fact is parked in a bounded, deduplicated
**pending set** keyed by the unresolved reference, admitted when the reference arrives, and
escalated as a conflict-class record when a declared TTL expires — never silently dropped
(P2-NF-25). The pending set is a registered store with a declared bound.

**Segment ownership survives restore, loss, and rename.** Machine identity is the stable opaque
key; a rename never moves ownership. A machine restoring from backup cannot prove it stands at its
own true head, so it must open a *new* segment — resuming the old one would fork a total order,
which the `prevInSegment` chain makes visible at every receiver as a chain break (P2-NF-09,
P2-NF-10) rather than a silent divergence. A machine that is permanently lost leaves its segment
open-ended; the folded-through vector says honestly "this segment's head is the last I saw," and a
deliberate operator fact may close a segment so readers can distinguish finished from partitioned.

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
audit, rebuild, and serve alone through a partition; the growth instruments below are what turn
"revisit this" into a real trigger instead of a hope.

---

## Admission — the one boundary a fact can enter through

The admission boundary is a **blocking site** in the register's sense, and it declares the
register's required facts for that kind rather than describing itself only in prose: `authority:
block`; `decidesAlone: yes` for exactly one rung (the deterministic secret-shape scan — a live
secret leaving is one of the three ruled exceptions) and `no` elsewhere — every other rung is a
deterministic *decode*, not a judgment; `criticality`: the record is the substrate every audit
rule stands on; `failDirection`: **closed** for the mutation path (an unverifiable fact does not
enter), **toward preservation** for intake-origin input (the unattributable-observation wrap and
the metadata retention below — rule 14's direction); `preservesInput`: the refusal store, named
below; `inspectedBy`: the fixture suite.

The ladder, in refusal order — fixed so a refusal reason is stable, and each mapped onto part
one's closed `Refused` reason list rather than minting new reasons:

1. **Secret shape** (`policy`) — the deterministic scan, first so that what it catches is never
   retained below.
2. **Unknown or unregistered `kind`** (`decode`) — refused before the body is parsed.
3. **Signature** (`integrity`) — the appender's signature verifies against the registered key for
   `machine`; refused before anything downstream trusts a field.
4. **Content hash** (`integrity`) — recomputed over the as-appended canonical bytes **at the
   as-appended schema version, before any migration** — a hash can only ever verify against the
   bytes it was taken over, so verification precedes migration in every path (P2-NF-22).
5. **Unknown `schemaVersion`** (`decode`) — refused unless a migration forward exists; migration
   runs only after step 4 passed.
6. **Malformed envelope** (`decode`) — any missing or ill-typed envelope field, absent-as-value
   encodings included.
7. **Unresolvable `principal`** (`standing`) — refused *unless* wrapped as an
   `unattributable-observation`, which is the only door for unresolved input (P2-NF-29).
8. **Standing** (`standing`) — the appending principal holds live standing covering this kind and
   scope, resolved against the standing projection at the fact's `at`; without it, appending would
   be minting (P2-NF-26, P2-NF-27). A body field typed as a constitutional value decodes through
   part one's decoder with this fact's pinned provenance, so part one's refusals apply inside the
   body, not only at intake (P2-NF-28).
9. **Causal references** (`decode`) — the in-segment link always; per-kind mandatory references;
   dangling references refuse on intake and hold on replication (P2-NF-23, P2-NF-24, P2-NF-25).
10. **Body schema** (`decode`) — last, so a body error is never reported for a fact refused for a
    stronger reason.

**Rule — a refusal preserves metadata, never the body.** Rule 4 requires a block to preserve its
input; rules 60 and 61 bound what anything may accumulate; rule 100 forbids the guard that catches
a secret from becoming the thing that stores it. **Check:** the refusal store retains refusal
reason, submitting principal or peer, canonical hash, byte length, and first/last-seen with an
occurrence count — deduplicated on (hash, reason) so a loop collapses to one counted row — and
never the body bytes (P2-NF-30); it is a registered store with a declared bound, retention window,
and saturation behaviour that sheds the noisiest source first (P2-NF-31); the per-source refusal
rate is an emitted measurement, since a refusal stream is exactly the evidence the retention
exists to keep.

**Value — a fixed refusal order.** No rule forces this sequence. Stability of the reason is chosen
so a client can rely on which refusal it will see; secrets are screened first because rung 1 is
the one place where retention of the evidence would itself be the harm.

---

## Retraction, correction, redaction — and the thing that is never deletion

A fact is wrong sometimes. None of it is repaired by changing the record.

**Rule — unsaying takes standing.** A retraction asserts a named fact should not be relied on; a
correction is a new fact of the same kind naming the fact it corrects. Both are writes against the
*meaning* of the record — stronger than appending, as strong as resolving a conflict — and part
one already gates conflict resolution on live standing in scope. So: the retracting or correcting
principal must hold live standing covering the named fact's kind and scope, at least equal to the
standing its append required; retracting or correcting a fact that confers standing, authorization,
or ownership requires the standing of the original grant. Rules 28, 86, and 104 are what leak
without this. **Check:** decode-time standing resolution, as admission rung 8 (P2-NF-32,
P2-NF-33); a self-serving case — a component retracting the refusal or judgment records that name
it — is a fixture, not a hope.

**Rule — the fold owns corrections.** Left to each author, a projection that ignores the
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

**Rule — incidental third-party content has a lawful exit that is not deletion of history.**
Rule 7's subject is what the *agent knows* — its memory. A third party's personal data arriving
incidentally in a message body, a mis-routed private message, a sensitive claim mis-attributed to
a named person: none of that is agent memory, all of it can land in the record, and a design with
no exit forces the operator into emergency deletion — the exact act the rules forbid — the first
time an erasure obligation arrives. So bodies that can carry such content live in the capture
store by reference, and an operator-standing **redaction fact** tombstones the capture *bytes*
while the fact's envelope, hash, the reference, and the redaction itself remain permanent: the
history that something was recorded and redacted, by whom and why, is complete; the content is
gone. **Check:** redaction requires operator standing (P2-NF-37); a capture deletion without a
tombstone fails the capture-store agreement (P2-NF-65); the redaction path is the *only* byte
removal in the system, and the append-only contract test asserts exactly that carve-out.

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
wording) is one of the questions at the end.

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
head — and an adversary can do it deliberately. A permanent build failure would hand either of
them a durable denial of service against governance itself. **Check:** a concurrent fork yields a
recorded `Conflict` surfaced to the operator, with the *earlier-approved* version serving as the
in-force one until resolution (governing state fails toward the narrower, already-reviewed
answer); resolution is a **merge version** whose `supersedes` names both heads, appended under
operator standing in scope, carrying its own `approvedIn` (P2-NF-44, P2-NF-45); the chain walk
then passes. A cycle or a gap remains a hard failure — those cannot arise blamelessly.

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
   another projection's storage (P2-NF-50 — the fold signature admits facts and the generation,
   nothing else, so there is no channel for a peer view to arrive through). The register
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
   monotone high-water entry per *machine* (segments roll; machines are few — keying by machine
   bounds the vector) — plus the set of segments it knows to exist. "Current" is only ever
   relative to that set: a reader can see "I have never seen machine C's segment," which a scalar
   position cannot express (P2-NF-54).

**Rule — staleness is a value, and authority fails closed on it.** Rule 95 requires a declared
fail direction per consumer; rule 14 sets the user channel's. A projection answering an
**authority question** — standing live, authorization valid, ownership held, spend within cap —
refuses past a declared staleness bound on any known-but-unfolded segment, and serves the
*narrower* answer while a relevant record is in conflict (P2-NF-55, P2-NF-56): a revocation that
has not arrived is exactly the case where "current over what I hold" and "true" diverge, and the
absence of a negative fact must not read as permission. User-channel views keep serving, labelled.
**Check:** every registered projection declares its class (authority-answering or informational)
and its bound; the partition fixture — revocation on machine A, authority read on partitioned
machine B — fails any authority projection that answers live.

**Value — lagging reads are served, labelled, and the strong read is scoped to what exists.** A
reader may demand currency **relative to a position it has previously observed** — read-your-writes
and monotonic reads, both locally satisfiable — or relative to a named segment set. A demand for
global "now" is not offered: under a partial order with no ordering service, knowing the global
head requires every machine to answer, which converts the strong reader's partition into an
outage and is precisely what this design refuses to do. That limit is stated so callers design
against it rather than discovering it.

**Rule — every store this part creates is a register entry, with its facts actually supplied.**
Rules 32, 33, 69; the register's kind 1. The table below is the declaration, not a promise of one.
`standards` on each entry names the checks that enforce this document's rules against it — rule
69's both-ends resolution made mechanical. **Check:** the register build fails on a missing
required fact; the `agreesWith` invariants are the scheduled tests named here.

| Entry | `growth` | `holdsAgentMemory` | `machineScope` | `agreesWith` |
|---|---|---|---|---|
| fact store (segments) | `unbounded` | **yes** — learnings, commitments, corrections land here, so rule 7's ban attaches with full force | `shared` | projections, via pinned rebuild-equivalence; capture store, via reference resolution |
| capture store | `unbounded`, redaction-tombstones excepted | yes | `shared` (replicates with segments), machine-local capture classes carried to part nine's retention decision | fact store: every referenced capture resolves or carries a tombstone |
| refusal store | bounded, deduplicated, windowed | no — metadata only, never bodies | `machine-local`, stated reason: refusals are evidence about a *local* boundary's traffic | fact store: a refusal's hash never also admitted |
| pending set (replication holds) | bounded, TTL-escalated | no | `machine-local`, stated reason: an ordering accident is local to the receiving replica | fact store: a held fact either admits or escalates, never vanishes |
| projections (each) | per its declared retention rule | no — *the facts hold it*; the view is disposable | `machine-local`, stated reason: derived, rebuildable from the shared record | the fact store, via clause 5's pinned test |

(The register's `growth: deletes`-plus-`holdsAgentMemory: yes` build failure is what forces the
last row's posture: a projection never answers yes, because deleting a *view* of memory deletes no
memory — the spine still holds it. A projection kind whose view genuinely held memory the spine
did not would be mis-designed, and the build failure firing is the correct outcome.)

---

## Growth, and the instruments that make its costs visible

The record only grows; several checks replay it; boot rebuilds views from it. Every one of those
costs is measured, because "revisit when a problem is measured" is only honest if the measurement
exists and something re-surfaces it.

**Rule — the store emits its own cost curve.** Rule 13 (a measurement knows what it measured);
rule 8 (untracked is abandoned); rules 46 and 61 (bounded backlogs, bounded self-action).
**Check:** these are registered measurement subjects with a named producer: `sequence-length`
(facts, per segment), `segment-bytes`, `append-rate` (windowed), `genesis-replay-duration` (per
projection), `checkpoint-replay-duration` (per projection), `boot-rebuild-duration`,
`replication-lag` (per segment), `refusal-rate` (per source), `conflict-backlog-age`,
`pending-set-depth`, `historical-encoder-count` (every schema version's canonical encoder stays
load-bearing forever — the count is visible so its growth is a fact, not a surprise), and a
canonical-bytes re-encode fixture per *retired* schema version, since decode fixtures alone do not
keep an old encoder honest. The compaction question re-opens at a declared
**replay-duration threshold** — replay time, not byte count, is what actually breaks, and a faster
disk legitimately moves it — and that re-opening is a registered loop with a re-surfacing cadence,
per rule 8, opened by this document rather than deferred to memory.

**Rule — checkpoints exist, and a checkpoint is a projection.** Rule 15: boot time rides replay
cost, and an agent unreachable for the length of a genesis replay is the exact failure "the agent
is always reachable" forbids — the machine that can fix a resource problem must come up before its
history has been fully re-read. **Check:** a projection may persist checkpoints at a
folded-through vector; a checkpoint inherits every clause above — disposable, fold-written,
deterministic — and never licenses removing a fact beneath it (P2-NF-59: a checkpoint that does is
compaction wearing a costume). The rebuild check splits: **incremental** (from last checkpoint —
frequent, cheap, catches fold bugs) and **genesis** (from nothing — rare, budgeted, the only form
that catches checkpoint corruption and the only one that fully holds rule 33's agreement). The
minimal plane's projections are named by part eleven and their genesis-replay time is one of the
measurements above, so rule 15's boot path has a number attached instead of an assumption.

---

## Multi-machine posture

Stated explicitly, as rule 113 requires:

- **The fact record is shared.** Each machine owns its segments and never appends to another's —
  held by the signature (only the owner's key signs) and the chain (P2-NF-09, P2-NF-11), not by
  politeness. Replication is additive, authenticated, contiguity-checked.
- **Projections, the refusal store, and the pending set are machine-local, with their reasons
  declared in the register table above.** Derived or boundary-local state replicating would
  replicate conclusions instead of evidence.
- **A partitioned machine keeps working** — appending locally, serving labelled-stale views,
  failing closed only on authority questions past their bound. On reconnection segments merge by
  the reconciliation rules, and genuine divergence surfaces as `Conflict`s.
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
| P2-NF-07 | decode | A `signature` that does not verify against the registered key for `machine` | Authenticity, not integrity, is what proves origin. |
| P2-NF-08 | decode | `machine` differs from the signing key's registered owner | A valid signature under the wrong identity is a forgery. |
| P2-NF-09 | ingest | A fact whose `prevInSegment` does not extend the receiver's held head | Chain break: fork, tamper, or gap — surfaced, never merged silently. |
| P2-NF-10 | ingest | Two facts at one (segment, position) with different ids | A forked total order; restore-from-backup must open a new segment. |
| P2-NF-11 | ingest | A peer delivering a segment it does not own | Segment ownership is what makes in-segment order total. |
| P2-NF-12 | ingest | A replication stream with a positional gap accepted silently | An incomplete replica that answers confidently. |
| P2-NF-13 | decode | An append targeting an existing `id` | Ids are never reused; this is an edit wearing an append's clothes. |
| P2-NF-14 | decode | An `id` outside the appender's namespace | A cross-machine collision must be a refusal, not a manufactured conflict. |
| P2-NF-15 | arch | A fact-store port exposing more than one mutating method, whatever its name | Append-only is held by shape, not by vocabulary. |
| P2-NF-16 | test | An out-of-band segment mutation surviving boot and sweep verification | The chain re-verification is what catches what no code path did. |
| P2-NF-17 | decode | A body containing a live credential value | Rule 100; screened first so it is never retained. |
| P2-NF-18 | build | A fact kind declaring a secret-valued field | The same violation, one layer earlier. |
| P2-NF-19 | build | A free-text body field undeclared or unclamped in its schema | The scan needs an enumerated, bounded surface. |
| P2-NF-20 | decode | A fact of an unregistered `kind` | The registry is the closed set. |
| P2-NF-21 | decode | A `schemaVersion` with no migration forward | Part one's versioning convention. |
| P2-NF-22 | test | A hash verified after migration rather than against as-appended bytes | A hash only verifies over the bytes it was taken over. |
| P2-NF-23 | decode | A causally-bound kind missing its registry-declared reference | Omission is the cheapest evasion of ordering; the registry names what is mandatory. |
| P2-NF-24 | decode | A non-genesis fact missing its in-segment predecessor | Each machine's own history is always totally ordered. |
| P2-NF-25 | ingest | A replication-path dangling reference refused or dropped instead of held | Ordering accidents are held in the pending set, escalated on TTL, never lost. |
| P2-NF-26 | decode | An appender without live standing for the kind and scope | Appending must not be minting. |
| P2-NF-27 | decode | An authority-bearing fact appended under requester standing | Part one's floor, applied at the record. |
| P2-NF-28 | decode | A constitutional value in a body decoded without the fact's provenance | Part one's refusals apply inside bodies. |
| P2-NF-29 | test | An unresolvable-principal input dropped instead of wrapped as an unattributable observation | Rule 14: preservation is the fail direction for intake. |
| P2-NF-30 | test | A refusal retained with body bytes | Metadata only — the guard must not store what it caught. |
| P2-NF-31 | build | A refusal store or pending set without a registered bound | Rules 60/61: nothing accumulates unboundedly, least of all evidence of malfunction. |
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
| P2-NF-44 | test | A concurrent chain fork producing a wedge instead of a recorded `Conflict` | Governance must degrade to a flagged state, not an outage. |
| P2-NF-45 | decode | A fork-merge version appended without operator standing in scope | Only the operator reunifies a governing chain. |
| P2-NF-46 | arch | A projection whose storage is writable by anything but its own fold | The fold is the only writer. |
| P2-NF-47 | build | A projection folding a kind it did not declare | The consumer graph must be real. |
| P2-NF-48 | build | A registered kind with no folds/ignores decision from some projection — or a fold with no quarantine path for a poison fact | Silent ignorance and silent wedging are the two ways a fold lies. |
| P2-NF-49 | build | A projection reading a clock | Purity; part one's time convention. |
| P2-NF-50 | arch | A fold signature admitting anything beyond facts and the register generation | No channel for derived-on-derived. |
| P2-NF-51 | test | A projection whose output changes under permutation of concurrent facts without emitting `Conflict` | Fold order must not be able to become a value. |
| P2-NF-52 | test | A fold resolving a same-identity immutable-field disagreement silently | Conflicts are recorded through part one's equality primitives, never absorbed. |
| P2-NF-53 | build | A monetary or countable quantity accumulated in binary floating point | Cross-architecture determinism; spend is a projection. |
| P2-NF-54 | test | A view served without its folded-through vector and known-segment set | A scalar cannot express "I have never seen segment B." |
| P2-NF-55 | test | An authority-answering projection serving past its staleness bound | The absence of a revocation must not read as permission. |
| P2-NF-56 | test | A conflicted authority-bearing record served as live | Contested authority serves the narrower answer. |
| P2-NF-57 | test | A rebuild compared against a live view at a different vector | The comparison must be pinned or it measures lag, not divergence. |
| P2-NF-58 | test | A pinned rebuild differing from the live view | The view drifted from its evidence — the real failure. |
| P2-NF-59 | test | A checkpoint that licenses removing facts beneath it | That is compaction; a checkpoint is a projection. |
| P2-NF-60 | test | A compaction that removes facts | Rule 7, with `holdsAgentMemory: yes` declared — forbidden, not declined. |
| P2-NF-61 | build | A fact schema declaring machine-local scope | This design's stricter-than-32 choice, marked as a Value above. |
| P2-NF-62 | test | Replication removing or rewriting a fact on the receiver | Replication is additive. |
| P2-NF-63 | test (part eight) | An irreversible effect on a fact whose durability state is below the operation's declared demand | Named here with the durability states; the effect doorway owns the fixture. |
| P2-NF-64 | decode | A capture reference that does not resolve at append | Verify the state, not the symbol: a hash pointing nowhere proves nothing. |
| P2-NF-65 | test | A capture deleted under a live reference without a tombstone fact | The audit trail must not rot silently. |

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
| **segment** | noun | An append-ordered, hash-chained sequence owned by exactly one machine. Order within is total; across, partial. |
| **causal order** | noun | The partial order given by `predecessors` and in-segment position. The only ordering a decision or a projected value may rest on. |
| **fold order** | noun | The deterministic linearization used only to make projection output identical across machines at equal vectors. Structurally unable to select a value (the commutativity rule). |
| **admission** | noun | The single boundary through which a fact enters — local append and replication receipt run the same ladder with different fail directions. |
| **pending set** | noun | The bounded, deduplicated hold for replication-path facts whose causal references have not yet arrived. Admits or escalates; never drops. |
| **projection** | noun | A pure, deterministic, declared-input fold over facts producing a disposable view. Never written to by a caller, never an authority about what occurred. |
| **checkpoint** | noun | A projection's persisted state at a folded-through vector. A projection in every respect; never a license to remove facts. |
| **folded-through vector** | noun | Per-machine high-water marks plus the known-segment set, carried on every view, so currency is always relative to a stated horizon. |
| **retraction** | noun | A standing-gated fact asserting a named fact should not be relied on. The retracted fact remains readable, visibly retracted. |
| **correction** | noun | A standing-gated fact of the same kind superseding a named fact's content in the fold. Distinct from rule 85's user correction, which is about feedback becoming durable improvement. |
| **redaction** | noun | The operator-standing tombstone of capture *bytes* under a permanent record that the redaction occurred. The only byte removal in the system. |
| **version chain** | noun | `since` / `supersedes` / `approvedIn` / `landedIn` / `base` — how a governing thing carries its history as a lookup. |
| **durability state** | noun | What `append` returns: `local-durable` or `replicated(n)`. The effect doorway names its demand per operation. |

---

## The parent's rule list, discharged one by one

The big picture's §2 names eighteen rules under "history is reconstructable." A blanket citation
would repeat 1.x's disease — a rule listed against a check that cannot fail for it — so each is
answered:

| Rule | Verdict here |
|---|---|
| 7 (never delete) | **Held**: no delete exists; NF-34/59/60; redaction removes capture bytes only, under a permanent record. |
| 15 (always reachable) | **Engaged, part-bounded**: checkpoints + the boot-rebuild measurement keep boot off the genesis-replay curve; the live-session guarantee itself is part eleven's. |
| 24 (distrust temporary success) | **Explicitly not held here**: visibility of retractions/corrections is built; fingerprint comparison across recurrences needs the judgment doorway — part seven. |
| 31/32/33 (multi-machine coherence, scope, agreement) | **Held**: register table declarations; reconciliation + partition fixtures; pinned rebuild-equivalence as the tested agreement. |
| 41/58 (observable, reviewable judgment) | **Substrate held, doorway deferred**: judgments land as attributable facts with pinned provenance; the doorway that writes them is part seven; the capture-retention tension is stated, not hidden. |
| 45 (consumers move with sources) | **Held**: declared inputs + the folds/ignores decision per kind are the consumer graph (P2-NF-47/48). |
| 69 (references both ways) | **Held for what this part declares**: every register entry above carries `standards` naming its checks; every Rule block names fixtures. |
| 75 (token audit) | **Deferred to part seven** — nothing here makes a model call. |
| 85 (never-waste feedback) | **Deferred to part nine**, and the term collision with this part's *correction* is named in the terms table so the deferral cannot hide behind the homonym. |
| 89 (truthful provenance) | **Held at the record**: signature + pinned provenance on every fact; message-surface provenance is the intake part's. |
| 90 (history is a lookup) | **Held**, with the two-anchor reading (`approvedIn` + `landedIn`) flagged for the operator's confirmation. |
| 94 (waiver before the act) | **Substrate only**: a waiver is an `Authorization` fact; the waiver-count review is a projection part nine names. |
| 100 (secret stored before spent) | **Held with a stated residual**: three-layer check; prose leaks rotate-and-record, never delete. |
| 108 (conclusion and reason separate) | **Deferred to part seven** with its type already fixed in part one. |
| 112 (green history preserved) | **Held — built in this part**: a CI/check record is a registered fact kind; a history-erasing redo is expressible only as a retraction carrying its recorded reason; the CI record itself is append-only because everything here is. |
| 113 (declared multi-machine posture) | **Held**: the posture section and register table. |

---

## What this part makes checkable

Rule 90 moves from "needs the register" to held by the chain and its walker — an in-place edit, a
dangling supersession, a merge-event approval, a moved base, all refuse mechanically. Rule 7 gains
a mechanical form — there is no delete to call, and the one byte-removal that exists (redaction)
is operator-gated and permanently recorded. Rule 45's consumer graph becomes real and two-sided:
declared inputs plus a mandatory decision per new kind. Rules 31/32/33 gain their subject and
their tested agreement. Rule 112 gains its append-only CI record. Rule 89 gains automatic signing
at the record layer. And the two properties 1.x could never distinguish — integrity and
authenticity — are separate fields with separate fixtures, so "the bytes are intact" can never
again impersonate "the author is proven."

What this part deliberately does not hold, it names: recurrence fingerprinting (24), the judgment
doorway's own duties (41/58/75/108), feedback-into-improvement (85), the waiver review (94), the
runtime approval anchor (parts nine/eleven), and the live-reachability guarantee (15).

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

4. **The redaction carve-out.** For incidental third-party content (an erasure obligation, a
   mis-routed private message), an operator-standing redaction tombstones capture *bytes* while
   every envelope, hash, and the redaction record stay permanent. This is the only byte removal
   in the design, and it exists so the alternative is never emergency deletion. Do you want it,
   and do you want it this narrow?

5. **No machine-local facts — stricter than rule 32.** A machine-local *store* is permitted with
   a reason; a machine-local *fact* is forbidden outright. Keep the stricter line?

6. **Full history on every machine.** Every machine holds all segments — each can audit, rebuild,
   and serve alone, at the cost that the smallest disk governs fleet retention and storage is
   machine-count × history. The alternative (bounded local suffix, older segments fetched on
   demand) stays open behind the same measurements. Start with full copies?

7. **Authority reads fail closed on staleness.** Standing, authorization, ownership, and spend
   projections refuse past a staleness bound on known-but-unfolded segments and serve the narrower
   answer under conflict — so a partition can pause authority decisions rather than silently
   extend revoked authority. The user channel keeps failing open. Accept the split?

8. **The capture-retention tension, stated not solved.** The big picture promises judgment
   captures are machine-local with bounded retention; this part makes facts that reference them
   permanent. A retention-expired capture leaves a permanent fact pointing at absent bytes, so
   facts must carry enough in-body to stay *reviewable* after capture expiry — but the full
   reconciliation of rule 7 with bounded capture retention is carried to part nine, explicitly.
   Accept carrying it?

9. **The glossary homonym.** This part keeps **fact** for the record (matching the approved
   parent's usage) and proposes renaming the glossary's term-kind value `fact` to `field` through
   its own supersedes chain. Approve routing that small amendment?

---

*Depends on: the approved rules, register, glossary, big-picture design, and part one, and their
changelogs. Next after approval: part three, declarations, the register generator, the terms
resolver, and the rule/holder graph, built on this envelope and version chain.*
