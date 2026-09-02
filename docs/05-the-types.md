# Part one — the constitutional types and the decoding boundary

**Status: draft, awaiting approval. Governed. No later part design or code is built on top of this until it is approved.**

The big-picture design puts a small package at the very center of the system: the constitutional
types. Everything else depends on it and it depends on nothing. Its job is to make the mistakes the
constitution forbids hard or impossible to write down. A name copied out of a message cannot be
passed where a verified person is required. A refusal cannot be turned into a success on its way
up the stack. Two numbers that measured different things cannot be compared. An approval cannot be
made out of silence.

This document is the design for that package and for the boundary that guards it: the decoders
that turn bytes from the outside world into these types, and refuse anything that does not fit.
It chooses no programming language. It does fix what the language must be able to express, and it
lists the exact invalid shapes every implementation must reject.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this package is, in one paragraph

It is a set of immutable values and pure functions. It reads no clock, opens no file, makes no
network call, spawns no process, and calls no model. Every function in it is total: given any
input it returns a value, and when the input is not acceptable that value is a typed refusal
rather than an exception. It is the same on every machine and it carries no machine's identity.
A test can construct every value in it by hand, so every invariant is exhaustively testable
without starting the system.

**Rule — the center is pure.** Rules 1, 30, 41, 69, and 113 require the dependency direction the
big picture fixes in its section 12. **Check:** the package's import graph is empty apart from
the language's own standard library, and even there the I/O, clock, process, and network modules
are on a refused list the dependency lint walks.

**Value — immutable data plus pure functions.** The constitution requires invariants, not a
programming style. Immutability is chosen because it makes every value safe to share across
workers and machines, and purity because it makes the negative fixtures at the end of this
document runnable in isolation.

---

## The conventions every type follows

Every constitutional type is listed in the inventory at the end of this section, and each would
be tedious to trust if it invented its own rules for construction, equality, versioning, time,
and failure. So the rules are fixed once here and
every type inherits them. A reviewer checks a type against this list, not against its author's
taste.

### 1. Construction is closed

A value of a constitutional type can be made in exactly two ways: by a **decoder** at an adapter
boundary, which reads bytes and either produces the value or refuses, or by a **pure derivation**
inside the package, which computes one value from others already trusted. There is no third
door. Code outside the package cannot assemble the fields by hand.

A decoder for a value that carries authority — a principal, a grant, a revocation, an
authorization — takes a second input the message bytes cannot supply: a **Provenance** value
(see the supporting types). Provenance is itself decoded, inside the package, from
**authentication evidence** the adapter hands over. The package verifies what it can verify on
its own — a signature against a key in the registered key set, including a host's signed
delivery (a webhook body signed with a secret the key set holds, a signed commit or approval
event), and a session token the package itself minted — and marks the result `verified`. A
record the adapter merely fetched, even with a hash that matches its bytes, is **not**
verified: hash agreement proves the bytes were not altered after the adapter produced them, not
that the host produced them, and a faulty adapter can fabricate both. Such evidence, and a
platform's sender id inside an update the adapter received over a channel it authenticated,
yields provenance marked `channel-attested`: the adapter attests that the value arrived through
a channel it authenticated, and the package records that attestation without being able to
re-check it. The two classes are distinct values.

What each class may produce follows the glossary's own definition of *verified* — "resolved to a
known identity from an authenticated channel, never from a name that appears in content". A
`channel-attested` provenance from an authenticated channel may produce a `VerifiedPrincipal`
with **requester** standing and nothing more; a name that appears in content, or a channel the
adapter did not authenticate, produces an `UnresolvedInput`, never a principal. **Every value
that confers or exercises standing above requester — a grant, a revocation, an authorization, an
operator or delegate principal — decodes only from `verified` provenance.** The decoder then
cross-checks every identity-bearing field in the bytes against the provenance and refuses on any
disagreement.

This is the honest shape of the guarantee. A faulty adapter can lie about what channel it
authenticated, so the package does not promise to catch every lie; it promises that nothing the
package cannot verify itself can mint operator or delegate standing, an authorization, or a
revocation, and that requester standing rests on an attested authenticated channel, never on
content. Whether requester standing should also require package-verified evidence is put to the
operator as an open question below.

**Rule — no open constructors, and no authority from bytes alone.** Rules 13, 28, 29, 42, and
98 each depend on a value that cannot be made casually. **Check:** every constitutional type's
constructor is private to the package; a negative fixture that assembles the fields from outside
fails to compile; the Provenance decoder is the only producer of a Provenance; a fetched record
with an internally matching hash decodes as `channel-attested`, never `verified`; decoders for
grants, revocations, authorizations, and non-requester principals refuse `channel-attested`
provenance, refuse when the bytes disagree with the provenance, and refuse when no provenance is
supplied; a sender from an unauthenticated channel or from content yields `UnresolvedInput`.

### 2. Equality is declared, three ways

Every type declares three separate comparisons, and each type section below names which of
them it supports:

- **identity** — the same durable thing: same `id`. Says nothing about content.
- **version** — the same thing at the same point in its history: same `id`, same schema
  version, same canonical content hash.
- **value** — the same content, field for field, regardless of `id`.

The comparison domain is fixed once: two values are comparable only when they are the same
type at the same schema version. A value at an older schema version is first migrated forward
(convention 3), then compared; migration is not a conflict, even when it adds or renames
fields. Comparing two values of different types, or of the same type but different subject
kinds or scopes where the type declares those, is refused rather than answered, because `false`
would let a caller treat a category error as an ordinary mismatch.

Within the domain, two records with the same `id` whose *immutable* fields disagree are never
equal and never silently resolved to the newer one: the comparison yields a **Conflict** value
naming both, and the fact spine of part two records it, as the big picture requires for
cross-machine reconciliation. Each type section names its immutable fields.

**Rule — conflict is recorded, not resolved.** Rules 31 and 33 require that divergent records
be surfaced. **Check:** fixtures compare the same `id` from two machines with an
incompatible immutable field and assert a `Conflict`; fixtures compare the same `id` across two
schema versions and assert that migration precedes comparison and does not by itself produce a
`Conflict`.

### 3. Every value carries its schema version

Every serialized value names its type and schema version. A decoder accepts its own version and
any earlier version it can migrate forward; each migration is a pure function from the old shape
to the new. A version the decoder does not know is refused. Nothing is edited in place: a new
version of a type is a new schema version, and the old decoders remain so old facts stay readable.

**Rule — versioned by construction.** Rule 90 requires everything governing to be versioned, and
rule 7 forbids losing what was recorded. **Check:** the schema registry lists every type and
version; a decoder for version N without a migration from every prior version fails the build; a
recorded fixture from each prior version still decodes.

### 4. Time is an argument, never a lookup

No type asks what time it is. Anything that depends on time — an expiry, a freshness window, a
stale base — is a pure function that takes the current instant as an explicit argument. The
intake doorway reads the real clock once and hands that reading in as a measurement whose subject
is the clock. A test can therefore replay any decision at any instant, and the system cannot
quietly assume that no time has passed.

**Rule — the clock is read, not assumed.** Rule 96 requires a session to read the actual clock;
rules 93, 98, and 104 make expiry and freshness matter. **Check:** the package has no reference to
a clock; every time-dependent function has a `now` parameter typed as a clock measurement.

### 5. Failure is a value

No function in the package throws across its boundary. A partial operation returns a `Result`,
described below, and a refusal names why. This is the type-level form of rule 42: a failure that
travels as an exception can be caught and swallowed by any intermediate layer; a failure that
travels as a value must be matched and handled by name.

### 6. Canonical bytes

Some types are bound to the exact content of something — an authorization to an artifact, a piece
of evidence to its raw capture. Content is identified by a hash over a **canonical encoding**: a
deterministic byte form with a fixed field order, no optional whitespace, and the schema version
inside it. The hash algorithm is named in the schema and can change only by a schema version. Two
machines encoding the same value produce the same bytes, so a hash made on one machine verifies on
another.

**Rule — one artifact, one hash.** Rules 82, 90, and 109 require binding to exact content and
versions.
**Check:** a fixture set of values with their expected canonical bytes and hashes is part of the
package tests; a change in encoding without a schema version bump fails.

---

## The types

Each type is given in the same shape: what it is in plain words, what it holds, the mistake it
makes impossible, how it comes into being, which equality it supports, and which rules it
carries. The field lists are the
design, not a language; a field named here is a field the implementation must have, whatever it
is called.

### VerifiedPrincipal — who this is, as proven by an authenticated channel

A verified principal is a person, an agent, or the system itself, resolved to a known identity by
an adapter that authenticated the source. A name that appeared in a message, a document, or a
prompt is a string, not a principal.

| Field | Meaning |
|---|---|
| `id` | The stable identity within the system's own registry. Never a display name. |
| `kind` | `person`, `agent`, or `system` (the scheduler, a recovery signal, a sentinel). |
| `provenance` | A `Provenance`: the adapter, the authentication method (`telegram-sender`, `signed-envelope`, `dashboard-pin`, `github-merge`, `os-scheduler`, … — a closed list the register owns), a reference to the authenticated record with its capture hash, the clock measurement at verification, and the machine that verified. Established outside the bytes; never read from them. |

Equality: identity by `id`; value field for field. Immutable fields: `id`, `kind`, and the
provenance's record reference; two principals with the same `id` and a different `kind` are a
`Conflict`.

**What it makes impossible.** There is no function from a string to a `VerifiedPrincipal`. The
only producers are the intake adapters' decoders, and each names its authentication method. A
function that grants authority, records an approval, or credits a decision accepts only this type.
Session input is a principal too: an auto-responder, a relay, another machine's forward, or a
sentinel pressing keys is verified through the same door with `kind: system` or `kind: agent`,
never treated as "the user typing".

**Rule — know your principal.** Rules 28, 29, and 103 require it. **Check:** compile-time negative
fixtures pass a display name, a message body, and an unverified sender record where a principal is
required and fail to type-check; the decoder refuses a `verifiedBy` value the register does not
list.

### StandingGrant — what a principal may decide, and where

Standing is not a property of a person. It is something a principal holds, in a scope, because
someone with the authority to grant it did so. The glossary names three standings: `operator`,
`delegate`, and `requester`. Being a verified principal at all is `requester` standing and needs
no grant. The other two exist only as recorded grants.

| Field | Meaning |
|---|---|
| `id` | Identity of the grant. |
| `grantee` | A `VerifiedPrincipal`. |
| `standing` | `operator` or `delegate`. (`requester` is never granted; it is implied.) |
| `scope` | A `Scope` — see the supporting types. |
| `actions` | For `delegate` only: the closed list of registered action kinds the grant permits. Nothing outside it. |
| `grantor` | Exactly one of: `org-intent { documentVersion, approvedIn }` — the organization's declared intent, at a named approved version, names the holder; or `principal { who, authorization }` — a `VerifiedPrincipal` who held a standing able to delegate it, and the `Authorization` id that recorded the delegation. A grantor without its source reference does not decode. |
| `source` | A `Provenance` for the record that created the grant: the intent document's approval, or the authorization record. |
| `issuedAt` | Clock measurement. |
| `expiresAt` | Optional clock instant. A grant with no expiry is allowed only for `grantor: org-intent`. |

A **Revocation** is its own value: `{ id, grantId, by: VerifiedPrincipal, at, reason, source: Provenance }`.

Equality: identity by `id`; version by `id` and content hash; value field for field. Every field
of a grant is immutable, so two records with the same `id` and any differing field are a
`Conflict`.

A grant is never edited. Revocation is a separate value, `Revocation { grantId, by, at, reason }`,
and the question "is this grant live now?" is a pure function over the grant, the set of
revocations, and `now`. Nothing in the package deletes a grant, so a revoked grant remains readable
and its history remains a lookup.

**What it makes impossible.** A message cannot confer standing, because the only producers of a
grant are the decoder of an approval record and the decoder of the organization's intent file. A
delegate cannot act outside its listed actions, because the check is a set membership on this
value, not a judgment. A delegate cannot re-delegate unless the organization's intent says so; the
package leaves that policy to the intent document and only supplies the check.

**Rule — standing is recorded, never inferred.** Rules 28, 98, 103, and 104 require it.
**Check:** decoders refuse a grant whose grantor lacks a live standing able to delegate the
requested standing, a grant whose `grantor` carries no source reference, and a grant whose
`source` provenance disagrees with its fields; a negative fixture with a grant "from the
conversation" (no approval, no intent source) fails to decode; the liveness function returns
`revoked` or `expired`, never `false`.

### Intent and Directive — what was asked, and the line it descends from

An **intent** is one authenticated request: who asked, through what, for what, when. A
**directive** is a standing instruction the operator has given that shapes how requests are
carried out. Directives form a lineage: a new one may supersede an old one, and a directive is
closed only by supersession or by completion. There is no expiry, because the operator's
instructions do not lapse on a timer.

| Intent field | Meaning |
|---|---|
| `id`, `principal`, `receivedAt`, `via` | The authenticated request and the adapter it came through. |
| `raw` | A content hash of the input exactly as it arrived, before interpretation. |
| `ask` | The interpreted request — a value the judgment doorway may later refine, always separate from `raw`. |
| `under` | The directive ids in force for this principal and scope when the intent arrived. |

| Directive field | Meaning |
|---|---|
| `id`, `principal`, `scope`, `statement`, `issuedAt` | Who gave it, where it applies, what it says. |
| `supersedes` | The directive it replaces, when any. |
| `closedBy` | Absent while live. Otherwise exactly one of `Superseded { by }` or `Completed { evidence }`. |

Equality, both types: identity by `id`; version by `id` and content hash; value field for field.
Immutable fields: an intent's `raw`, `principal`, and `receivedAt`; a directive's `principal`,
`scope`, `statement`, and `issuedAt`. Differing immutable fields under one `id` are a `Conflict`.

**What it makes impossible.** A directive cannot expire: the type has no such variant, so no code
path can time one out. An intent cannot lose its raw form, because `raw` is required and hashed
before `ask` exists. Interpretation and arrival are separate fields, so "what they said" and "what
we understood" cannot be confused in a record.

**Rule — a directive holds until superseded or done.** Rules 93, 96, 110, and 4 (a block preserves
its input) require it. **Check:** a negative fixture that closes a directive for any reason other
than supersession or completion fails to type-check; the intake decoder refuses an intent without
a raw hash; the lineage function detects a cycle in `supersedes` and refuses it.

### Result — success or refusal, with no way from one to the other

Every operation that can fail returns a `Result<T>`. As the big picture fixes it, the type has
two arms:

- `Success<T>` — the operation did what was asked. It carries a required `capacity` field:
  `none`, or `applied { bound, action }` when a declared capacity bound acted as designed — a
  store trimmed to its limit, a notifier coalesced, a loop hit its cap — naming the bound (a
  register id) and what it did. A budget applied as designed is therefore a *kind* of success,
  distinguishable by every consumer that cares and indistinguishable from plain success to one
  that does not; it can never be routed as an error, because it is not on the `Refused` arm.
- `Refused` — the operation did not happen.

`Refused` carries: `reason` from a closed list (`standing`, `decode`, `floor`, `stale-base`,
`lease`, `budget-exhausted`, `integrity`, `policy`); `site` (the register id of the blocking site
or doorway that refused); `failDirection` (`open` or `closed`, the one that site declared); and
`preserved` (a reference to where the refused input was kept). A refusal without a preserved input
cannot be constructed.

**What it makes impossible, and what it only makes visible.** The compiler holds *recognition*:
the two arms are a closed union, a match that forgets one does not build, and the package
contains no function from `Refused` to `Success`. The compiler cannot hold *behaviour*: a caller
can match `Refused` and go on to report success by some other path, and no handler signature
prevents that, because a handler can return whatever the caller's reporting path accepts. This
package therefore claims only *centralization*: one **consumption function** through which a
caller obtains the `T`, with one handler per arm, and an architecture lint that refuses a direct
match on `Refused` anywhere else, so every place a refusal is handled is enumerable. Rule 42 is
held across parts, not here alone: the `Result` itself is appended to the fact spine (part two)
before any report can be made, so a report that contradicts the recorded `Result` is a
detectable lie for the verification holders (part nine), not an undetectable conversion. A
refusal cannot forget its input: `preserved` is required.

Equality: value, field for field. A `Refused` is never equal to any `Success`.

**Rule — a refusal stays a refusal; a budget applied is a success.** Rules 40, 42, 4, 86, and 95
require it. **Check:** a compile-time fixture that omits an arm from a match fails to build; a
lint fixture that matches `Refused` outside the consumption function fails the build; a lint
fixture that treats `capacity: applied` as an error fails; the decoder refuses a `Refused` whose
`reason`, `site`, or `preserved` is missing or whose `failDirection` disagrees with the site's
register entry. The cross-part check — recorded `Result` versus later report — belongs to part
nine and is named there, not claimed here.

### Measurement — a number that knows what it measured

A measurement is a value, its unit, the subject it measured, when it was taken, and how. "Thirty
minutes" is not a measurement. "Thirty minutes of detection latency for the silence sentinel on
this machine, sampled by this probe at this instant" is.

| Field | Meaning |
|---|---|
| `subject` | A registered subject kind plus the instance measured: `detection-latency` of sentinel X; `free-memory` of machine Y; `clock` of machine Y. |
| `value`, `unit` | The number and a unit from the subject kind's allowed units. |
| `at` | When it was taken — itself a clock measurement, so the recursion bottoms out at the clock. |
| `by` | The producer: a probe, check, adapter, or command, by register id. |

**What it makes impossible.** Comparison, subtraction, and ordering are defined only between two
measurements of the same subject kind and unit; the subject kind is a type parameter, so a
comparison across subjects is a compile-time error, and a comparison across instances of the same
kind is a decode-time refusal unless the function is explicitly the cross-instance one. The
README's own test — "every claim about 1.x carries the number and the command that produced it" —
is this type applied to documents: `value`, `subject`, `by`.

Equality: value, and only between the same subject kind, instance, and unit.

**Rule — a number binds its subject.** Rules 13 and 26 require it. **Check:** a
compile-time fixture comparing a latency to a remaining-time fails; a decoder refuses a
measurement whose unit is not on its subject kind's list, or whose `by` is not a registered
producer.

### Profile — the four plain facts the derived words are computed from

A profile is the glossary's four declared facts about a governed thing: `consequence`,
`reversibility`, `reach`, and `surface`, each from its closed list, plus the runaway declaration
the glossary's runaway rule requires.

| Field | Meaning |
|---|---|
| `consequence`, `reversibility`, `reach`, `surface` | Exactly the glossary's allowed values. |
| `repeats` | `no`, `bounded { by }` naming the register entry of the cap, coalescer, or breaker, or `unbounded`. |

The adjectives — *critical*, *user-facing*, *significant*, *irreversible* — are **not fields**.
They are pure functions over a profile, and each function is generated from the term entry's
`derivedFrom` so that the code, the build, and the briefing evaluate one rule. A profile with a
field named `critical` does not decode.

**What it makes impossible.** Declaring the adjective instead of the facts. Claiming `attention`
for a path that can repeat without a bound: the decoder refuses `consequence: attention` together
with `repeats: unbounded`, because the glossary already says that combination is `control`.

Equality: value, field for field.

**Rule — derive, never declare.** Rules 34, 38, 43, 62, 76, and the glossary's derivation rule
require it. **Check:** the schema has no adjective field; the derivation functions are generated
from the terms registry and a diff between them and the term entries fails the build; a fixture
with `attention` plus `unbounded` is refused.

### Evidence — a claim, its source, and how fresh it is

Evidence is never "the truth". It is a claim about a subject, made by a named holder, at a time,
with a bound on how long it can be relied on, and a hash of the raw capture behind it.

| Field | Meaning |
|---|---|
| `claim` | A typed statement: the subject, the predicate, and the value observed. |
| `source` | The holder that produced it, by register id: a check, sentinel, probe, adapter, or a `VerifiedPrincipal` who attested it. |
| `observedAt` | Clock measurement. |
| `freshFor` | The window after `observedAt` during which the claim may be relied on. A freshness of "forever" is not a value. |
| `capture` | Content hash of the raw bytes or record the claim was read from, and where they are kept. |
| `strength` | `proof` (a deterministic check ran), `observation` (a probe or adapter saw it), `attestation` (a principal said so), or `inference` (a model concluded it). |

**What it makes impossible.** A claim with no source, no time, or no capture. A stale claim being
read as current: the only function that hands a claim to a consumer takes `now`, and it returns
`Refused { reason: stale }` past the window rather than the claim.

Equality: identity by `id`; version by `id` and `capture` hash; value field for field. Immutable
fields: `claim`, `source`, `observedAt`, `capture`. A differing immutable field under one `id`
is a `Conflict`.

**Rule — evidence carries its provenance.** Rules 26, 36, and 70 require it. **Check:** decoders
refuse evidence missing any field; a fixture with `freshFor` unbounded fails; a fixture that reads
a claim past its window without going through the freshness function fails the lint; every
`source` resolves to a register entry.

**Value — an aggregate keeps the weakest strength.** No rule fixes how strengths combine. This
package chooses the conservative rule: an aggregate over evidence reports the weakest strength
present, so a proof and an inference combined can never report as proof. Tested as a fixture.

### Decision — a conclusion and a reason, each falsifiable on its own

A decision is what something concluded, and separately why. Refuting the reason must be able to
reopen the decision even when the conclusion still looks right.

| Field | Meaning |
|---|---|
| `id`, `at` | Identity and time. |
| `by` | A `VerifiedPrincipal`, or a registered judgment point plus the model and route that answered. |
| `conclusion` | A claim, with the evidence ids it rests on. |
| `reason` | A second claim, with its own evidence ids — never the same object as the conclusion. |
| `floor` | For a model decision: the `ActionFloor` it was given, and the action chosen from it. |
| `standsOn` | The evidence ids from both claims, derived, so a retracted piece of evidence can be traced to every decision it touched. |

**What it makes impossible.** A decision with a conclusion and no reason, or with the reason
folded into the conclusion. A model choosing an action outside its floor: the chosen action is
typed as a member of the floor's list, so an outside action does not decode.

Equality: identity by `id`; version by `id` and content hash; value field for field. Every field
is immutable; a differing field under one `id` is a `Conflict`.

**Rule — conclusion and reason are separate claims.** Rules 57, 58, 108, and 41 require it.
**Check:** a compile-time fixture with `reason` absent fails; a fixture whose chosen action is not
in the floor is refused; the `standsOn` derivation is tested against hand-computed sets.

### Authorization — an explicit yes, bound to who, what, exactly which, and on what base

An authorization is the only way a governed action that needs approval gets it. It is always a
yes. There is no "no" variant (a decline is a `Refused` on the request) and no "implicit" variant.
It is bound to the exact content approved and to the base that content was reviewed against, so
it expires the moment either moves.

| Field | Meaning |
|---|---|
| `id`, `at` | Identity and time. |
| `approver` | A `VerifiedPrincipal`. |
| `under` | The `StandingGrant` id the approver used — which must be live and must cover the action's scope. |
| `action` | The registered action kind, and its `Scope`. |
| `artifact` | The canonical content hash of exactly what was approved: a PR head commit, a plan's rendered text, a request record. |
| `base` | The base the artifact was reviewed against: a merge target's head commit, a fact-sequence position, a register generation. |
| `kind` | `approval`, `waiver { rule }`, or `grant`. A waiver names the rule it waives and must precede the act it waives. |
| `requestedBy` | The `VerifiedPrincipal` who asked. Must differ from `approver` for a protected artifact. |
| `explicitYes` | A `Provenance` for the authenticated record in which the approver said yes: a host's review-approval event, a dashboard action, a signed reply. For a repository-protected artifact it must be `verified` and must be an approval or review record — a merge event never qualifies. Required. Absence, a timeout, or a default is not a record. |

Equality: identity by `id`; version by `id` and content hash; value field for field. Every field
is immutable; a differing field under one `id` is a `Conflict`.

A pure function `isValid(authorization, currentBase, artifactHash, now)` answers whether it still
holds. It returns a reason, not a boolean: `valid`, `artifact-moved`, `base-moved`, `standing-not-
live`, or `scope-mismatch`.

**What it makes impossible.** Approval from silence: there is no producer of an `Authorization`
from the absence of a reply, and the decoder's only inputs are records of an explicit yes from an
authenticated surface. Approval that outlives its proof: the base is a required field, and the
validity function refuses a moved base. Self-approval of a protected artifact: the decoder refuses
an authorization for a protected-artifact action whose `approver` and `requestedBy` are the same
principal, or whose approver is any `kind: agent` principal. A waiver after the fact: `kind: waiver`
requires `at` earlier than the act's evidence time, checked where the act is recorded.

**Rule — an approval is an explicit, bound yes.** Rules 82, 94, 98, 104, and 109 require it.
**Check:** compile-time fixtures constructing an authorization from a timeout, from a missing
reply, or without a base fail; decoders refuse an authorization without an `explicitYes` record,
one whose fields disagree with that record's provenance, a self-approved protected artifact, and
an agent-kind approver on one; the validity function is tested on every reason.

**Where the door for protected artifacts actually is — and where it is not.** The register
(kind 12) hands this design one open question: the agent writes the checkers, so the enforcement
of the protected list must sit outside the agent's write authority. This package answers it for
one class of artifact only. For a **repository merge**, the external anchor exists today, and
it is not the merge itself — rule 82 says the agent merges anything honestly green and the
operator never merges. The anchor is the host's **review-approval record**: the branch rules
require an approval from a non-agent account before a change to a protected path can merge,
the agent's account cannot change those rules, and the decoder's `explicitYes` provenance is
that approval record in a form the package can mark `verified`: a host-signed delivery of the
approval event, checked against the host's signing secret in the registered key set. A record
the adapter merely fetched over the host's API is `channel-attested` and does not qualify, so
the anchor stands only where the host signs its events. The agent then performs the merge,
exactly as rule 82 wants; the merge event proves nothing by itself and is not the record. For a **dashboard-governed artifact** or a
**runtime artifact on the agent's own machine**, no such anchor exists: an agent with filesystem
authority can edit the decoder, the list, or the artifact, and a probe that later notices the
edit is detection, not prevention. Listing the decoder on the protected list does not close
this, because the decoder would be enforcing the list that protects it. So the register's
question stays **open** for those classes. It is carried to part nine (verification holders and
probes) and part eleven (operator surfaces), which must name a reference monitor outside the
agent's write authority — a host-side rule, a separate signing principal, or a hardware-backed
approval — before any such artifact can be called protected. Until then, the constitution and
the repository are the only protected artifacts this design claims to hold.

**Rule — requester is never authorizer.** Rules 82 and 98 require it. **Check:** decoders refuse
a protected-artifact authorization whose approver equals the requester or is an agent-kind
principal, and one whose `explicitYes` is a merge event rather than an approval record; for a
repository merge, a probe on a cadence verifies the branch rules still require a non-agent
approval on protected paths, and the probe's absence is itself a critical outcome. No check is
claimed for the open classes.

---

## Supporting types

Seven smaller types carry pieces the core types share. They follow the same conventions.

**Provenance.** Where an authority-bearing value came from, as a value the package decoded from
authentication evidence: the adapter, the authentication method (a closed list the register
owns), a reference to the authenticated record with the canonical hash of its capture, the clock
measurement at verification, the machine that verified, and the class — `verified` when the
package re-checked the evidence itself (a signature against the registered key set, a host-signed
delivery or event, a session token it minted), `channel-attested` when the adapter attests the
value came through a channel it authenticated and the package cannot re-check it (a platform
sender id; a fetched record, even with a matching hash). A principal, a grant, a revocation, and
an authorization each carry one, and their decoders cross-check every identity-bearing field
against it. Anything above requester standing requires `verified`. (Rules 28, 29, 98.)

**Conflict.** The result of comparing two records with the same identity whose immutable
fields disagree: both versions, their origins, and the fields that differ. It is a value, not an
error, so the fact spine can record it and a person can resolve it. The package provides exactly
one resolution doorway. It takes the `Conflict`, a `Decision`, and the live `StandingGrant`
under which the decision is made, and it returns the chosen version only when that grant is live
at `now`, its scope covers the conflict's subject, and its standing is sufficient: any live
standing above requester for an ordinary record, and **operator** standing in that scope for a
conflict over a grant, a revocation, an authorization, or a principal. Identity alone never
resolves a conflict. An architecture lint refuses any other function that returns a side of a
`Conflict`. The compiler cannot hold the lint's part — a function can always return a value it
was handed — so that is a lint, not a compile fixture; the standing check is a decode-time
refusal. (Rules 31, 33, 28, 104.)

**UnresolvedInput.** A message whose sender could not be resolved to a principal: the raw hash,
the channel, the time, and the reason resolution failed. It carries no authority and cannot be
passed where a principal is required; it exists so the message is kept rather than dropped
(see the decoding boundary). (Rules 14, 28.)

**Scope.** Where a standing, directive, or authorization applies: a closed set of registered
scope kinds — a conversation id, a project, a repository, an artifact path pattern, a set of
action kinds, a machine, or `organization`. A scope compares by set inclusion, and inclusion is a
pure function. Standing in a narrower scope never implies standing in a wider one. (Rules 28,
103, 104.)

**ActionFloor.** The complete list of allowed actions for a judgment point, and the conservative
default. A model's answer is decoded into a member of this list; it can pick a subset, never add.
The floor is a value the register owns and the judgment doorway hands to the model. (Rule 57.)

**Outcome.** What an effect turned out to do in the world: `happened`, `did-not-happen`, or
`uncertain`. `uncertain` is not a failure and is never retried as one; it is the state until a
verification asks the external system. As with `Result`, the compiler holds recognition and a
consumption function plus lint hold behaviour: the only way to schedule a retry takes an
`Outcome` and refuses `uncertain`. This type is small, and it exists here rather than in the
effect doorway because it is a constitutional distinction, not an implementation detail. (Rules
24, 26, 42.)

**SecretRef.** A reference to a secret by vault name, never the value. No constitutional type has
a field that can carry secret bytes, and no decoder in this package produces one from input. A
secret arriving through intake is written to the vault by the adapter first and enters the core
as a `SecretRef`. (Rules 100 and 86.)

**Value — seven supporting types, not more.** Each is here because a type above cannot state its
invariant without it. Anything else — fact envelopes, register entries, run records, delivery
states — belongs to the later parts and is built from these.

### The inventory

Every value this package can produce is listed here, so "every type" in a check has a finite
meaning. A schema registered for a name not in this table, or a name here with no registered
schema, fails the build. Fixture coverage ranges over this table, not over a prose count.

| Name | Role | Constructed by |
|---|---|---|
| VerifiedPrincipal | core | decoder, with Provenance |
| StandingGrant | core | decoder, with Provenance |
| Revocation | core | decoder, with Provenance |
| Intent | core | decoder |
| Directive | core | decoder |
| Result (Success with `capacity`, Refused) | core | derivation |
| Measurement | core | decoder or derivation |
| Profile | core | decoder |
| Evidence | core | decoder |
| Decision | core | decoder or derivation |
| Authorization | core | decoder, with Provenance |
| Scope | supporting | decoder |
| ActionFloor | supporting | decoder |
| Outcome | supporting | derivation |
| SecretRef | supporting | decoder (after the vault write) |
| Provenance | supporting | the Provenance decoder, from authentication evidence |
| Conflict | supporting | derivation (the equality functions) |
| UnresolvedInput | supporting | decoder (the intake fallback) |

**Rule — the inventory is closed.** Rules 5, 69, and 90 require every governed thing to be
enumerated and versioned. **Check:** the schema registry and this table are compared by a build
step; every fixture names an inventory entry.

---

## The decoding boundary

Every adapter faces the outside world: a Telegram update, a signed envelope from another agent, a
GitHub webhook, a file on disk, a model's reply. None of those is a constitutional type. The
adapter's job is to hand the bytes to a **decoder**, and the decoder's job is to produce a value
or a refusal. Raw shapes exist only between the adapter and the decoder. After the decoder, the
core sees types.

A decoder is a total, pure function from bytes plus context to `Result<T>`. For a principal,
grant, revocation, or authorization the context includes a `Provenance` the adapter built from
the authenticated record, and the decoder refuses without it. It:

1. checks the schema version and migrates a known earlier version forward;
2. checks every required field is present and every closed-list value is on its list;
3. checks every cross-field invariant named in this document (a directive with no expiry, a
   refusal with a preserved input, a profile with no adjective fields, an authorization with a
   base and an explicit-yes record);
3a. for an authority-bearing value, cross-checks every identity-bearing field against the
   supplied provenance and refuses on any disagreement;
4. verifies every content hash against the bytes it claims to hash;
5. checks every register reference resolves — the check takes the register generation as an
   argument, so it stays pure;
6. returns the value, or a `Refused { reason: decode, preserved }` naming the first failing check
   and where the raw input was kept.

Decoders live inside the types package, not in the adapters, so each invariant has exactly one
implementation. An adapter supplies bytes and the authentication context; it cannot relax a check.

**One deliberate softness, for the user channel.** A message from a person must never be lost
because its sender could not be resolved. The intake decoder therefore has two outputs: a
`VerifiedIntent` when the principal resolved, and an `UnresolvedInput` — the raw hash, the channel,
the time, and the reason resolution failed — when it did not. `UnresolvedInput` carries no
authority: it cannot be passed where a principal is required, so nothing can act on it as if it
were verified. But it is a value, not a refusal, so the doorway can still queue it, tell the sender
it was received, and let a human resolve the identity. This is rule 14's "when unsure, deliver"
without rule 28's "never trust a name" giving way.

**Rule — the boundary refuses what the types forbid.** Rules 14, 28, 36, 42, 46, and 110 require
it. **Check:** every adapter's contract suite runs the shared decoder fixtures against real captured
bytes; a decoder that accepts any negative fixture below fails; a decode refusal without a
preserved input cannot be constructed; the `UnresolvedInput` type is refused everywhere a principal
is required.

**Value — decoders in the package, adapters outside.** The constitution requires the invariant to
hold at every boundary, not where the code lives. Putting decoders in the package trades a slightly
larger central package for one implementation per invariant, which is the property the negative
fixtures depend on.

---

## What is rejected where

Some mistakes can be refused by the language before the program runs. Others only appear when
real values arrive and need the clock, the register, or the bytes. A third group cannot be held by
this package at all, and naming that group is part of the design.

| Refused at compile time — the program does not build | Refused at the boundary — the decoder returns `Refused` | Not held here — held by another part or outside the agent |
|---|---|---|
| A string, display name, or unverified sender record passed where a `VerifiedPrincipal` is required | A principal, grant, or authorization whose fields disagree with its provenance, or decoded with no provenance; an authentication method the register does not list | That the adapter's authentication is real — the adapter contract suite, real captured fixtures |
| A match that forgets a `Result` arm; a conversion function from `Refused` to `Success` (none exists in the package) | A refusal missing `site`, `reason`, or `preserved` | A caller that handles `Refused` and then reports success by another path — the recorded `Result` versus the report, part nine |
| — | A `capacity: applied` naming a bound the register does not know | A caller that treats `capacity: applied` as an error — the lint; that the bound really fires — the bound's own tests |
| Two measurements of different subject kinds compared | Two measurements of the same kind, different unit or instance, compared by the same-instance function | That the probe measured what it says — the probe's fixture |
| A `Directive` closed by anything other than supersession or completion | A `supersedes` cycle | Whether an operator meant to supersede — the mind |
| An `Authorization` built without `approver`, `artifact`, or `base` | No `explicitYes` record; a moved base, a moved artifact, a non-live standing, a self-approved or agent-approved protected artifact, a waiver dated after the act | For a repository merge: that the branch rules exist — the host and its probe. For dashboard and runtime artifacts: nothing yet — an open question carried to parts nine and eleven |
| Two values of different types compared; a `Provenance` built outside its decoder | Same `id`, incompatible immutable fields → `Conflict`, never equal; `channel-attested` provenance offered for standing above requester; a fetched record with a matching hash decoded as `verified` | Which side of a `Conflict` is right — a principal with standing in scope, through the resolution doorway; a function returning a side elsewhere — the lint |
| A `Decision` with no separate `reason` | A chosen action outside the floor | Whether the reason is true — the retrospective review |
| A `Profile` with an adjective field | `attention` with `unbounded` repetition; a value off its closed list | Whether the declared profile is honest — the review, and rule 24's recurrence signal |
| `Evidence` with no `source`, `observedAt`, or `capture` | A claim requested past its window (the freshness function refuses); a capture hash that does not match | A consumer that bypasses the freshness function — the lint; whether the source is trustworthy — the holder's own freshness proof |
| A field typed to carry secret bytes | A decoder input containing a secret value where a `SecretRef` is expected | That the vault write happened first — the intake adapter's contract test |

**Rule — every forbidden state names its rejection point.** Rules 1, 49, and 69 require that a
rule name its enforcer. **Check:** every cell in the first two columns of this table is covered
by at least one numbered negative fixture below (a build step maps cells to fixture numbers and
fails on an uncovered cell), and the fixture suite is the enforcer the rule book's rows 13, 28,
29, 40, and 42 name. The third column is, by definition, not held here.

---

## What the language must be able to express

This document chooses no language. It does fix three capabilities the language's static checker
must have, because the left column of the table above is empty without them:

1. **Nominal types with private constructors.** A type that can be named by everyone and built
   only inside its package. Without this, "no function from a string to a principal" is a
   convention.
2. **Tagged unions with exhaustive matching.** `Result`, `Outcome`, `closedBy`, and every
   closed list are unions, and the compiler must refuse a match that forgets a variant. Without
   this, a new `Refused` reason can be silently unhandled.
3. **Generics with a phantom parameter.** `Measurement<Subject>` and `Result<T>` carry a type
   parameter that exists only to make mismatches fail to compile. Without this, subject binding
   is a runtime check only.

A language that lacks any of the three moves that column into the middle one, and the design
becomes weaker than the big picture promised. The language choice is made when the first code
part is proposed, and it is made by compiling the negative fixtures: a candidate that cannot fail
the left column is not a candidate.

**Value — a capability floor instead of a language.** The constitution requires the invariants,
not a syntax. Naming the capabilities keeps the choice about evidence and leaves it to the part
that first needs to write code.

---

## Multi-machine posture

The types are machine-independent values. The same bytes decode to the same value on every
machine, because decoders are pure and canonical encoding is fixed. Where a machine matters it is a
field — `VerifiedPrincipal.on`, `Measurement.subject` for a machine-scoped subject, the machine
inside a clock measurement — never an ambient assumption. No type in this package is
machine-local, deliberately: the package holds nothing.

**Rule — the posture is declared.** Rules 32 and 113 require it. **Check:** the schema registry
marks every type `shared`; a type declared `machine-local` in this package fails the build.

---

## The negative contract fixtures

These are the invalid shapes every implementation must reject. Each is one test. The fixture
number is stable and is what a later part or a code review cites. "Compile" means the fixture is a
program that must fail to build; "decode" means the fixture is a byte record that must produce
`Refused { reason: decode }`; "lint" means a program that builds but must fail the architecture
lint; "test" means a runnable case whose assertion must hold.

| # | Type | The invalid shape | Rejected at | Rules |
|---|---|---|---|---|
| NF-01 | VerifiedPrincipal | A display name from a message body passed to a function that grants standing | compile | 28 |
| NF-02 | VerifiedPrincipal | A sender record from an unauthenticated channel passed as a principal | compile | 28, 29 |
| NF-03 | VerifiedPrincipal | `verifiedBy` names a method the register does not list | decode | 28 |
| NF-04 | VerifiedPrincipal | A relay or auto-responder's input decoded as `kind: person` | decode | 29 |
| NF-05 | StandingGrant | A grant whose only source is the conversation — no approval, no intent file | decode | 28, 103 |
| NF-06 | StandingGrant | A grantor whose own standing was not live at `issuedAt` | decode | 28, 104 |
| NF-07 | StandingGrant | `standing: requester` as a granted value | decode | glossary |
| NF-08 | StandingGrant | A delegate grant with an empty `actions` list, or an action kind the register does not know | decode | 57, 104 |
| NF-09 | StandingGrant | A grant from a principal grantor with no `expiresAt` | decode | 104 |
| NF-10 | StandingGrant | Liveness asked without `now` | compile | 96 |
| NF-11 | Directive | A directive closed with a variant other than `Superseded` or `Completed` | compile | 93 |
| NF-12 | Directive | A `supersedes` chain that loops | decode | 93 |
| NF-13 | Intent | An intent with `ask` but no `raw` hash | decode | 4, 110 |
| NF-14 | Result | A `Refused` matched into `Success<T>` by a function outside the package | lint | 42 |
| NF-15 | Result | A `Success<T>` with `capacity: applied` handled in the error branch | lint | 40 |
| NF-16 | Result | A `Refused` with no `preserved` reference | decode | 4, 86 |
| NF-17 | Result | A `Refused` whose `failDirection` disagrees with its `site`'s register entry | decode | 95 |
| NF-18 | Result | A `Refused` whose `reason` is off the closed list | decode | 42 |
| NF-19 | Measurement | Comparing detection latency to time remaining | compile | 13 |
| NF-20 | Measurement | A unit not on the subject kind's list | decode | 13 |
| NF-21 | Measurement | A `by` that is not a registered producer | decode | 13, 26 |
| NF-22 | Measurement | Same subject kind, different instances, compared by the same-instance function | decode | 13 |
| NF-23 | Profile | A field named `critical`, `significant`, `userFacing`, or `significance` | decode | glossary |
| NF-24 | Profile | `consequence: attention` with `repeats: unbounded` | decode | glossary runaway rule, 52 |
| NF-25 | Profile | `repeats: bounded` naming no register entry | decode | 52, 55 |
| NF-26 | Profile | Any of the four facts missing or off its list | decode | 34, 38, 43, 62, 76 |
| NF-27 | Evidence | Missing `source`, `observedAt`, `capture`, or `strength` | compile | 26, 70 |
| NF-28 | Evidence | `freshFor` unbounded | decode | 26 |
| NF-29 | Evidence | `capture` hash that does not match the stored bytes | decode | 36, 26 |
| NF-30 | Evidence | An aggregate that reports a strength stronger than its weakest member | test | Value (see Evidence) |
| NF-31 | Evidence | `isFresh` asked without `now` | compile | 96 |
| NF-32 | Decision | No `reason`, or `reason` is the same object as `conclusion` | compile | 108 |
| NF-33 | Decision | A model's chosen action outside the given `ActionFloor` | decode | 57 |
| NF-34 | Decision | `by` is a judgment point with no model and route recorded | decode | 41, 58 |
| NF-35 | Authorization | Built from a timeout, a missing reply, or a default | compile | 98 |
| NF-36 | Authorization | No `base`, or no `artifact` hash | compile | 82, 109 |
| NF-37 | Authorization | `artifact` no longer matches the current content | decode / validity | 82, 109 |
| NF-38 | Authorization | `base` has moved | decode / validity | 82 |
| NF-39 | Authorization | `under` names a grant not live at `at`, or not covering the action's scope | decode | 104, 28 |
| NF-40 | Authorization | Protected artifact with `approver` equal to `requestedBy` | decode | 82, 98 |
| NF-41 | Authorization | Protected artifact with an `approver` of `kind: agent` | decode | 82, 98 |
| NF-42 | Authorization | Protected artifact whose approver was not read from the external authenticated record | decode | 82, 98 |
| NF-43 | Authorization | `kind: waiver` with `at` later than the act it waives | decode | 94 |
| NF-44 | Authorization | A "no" or "declined" variant | compile | 98 |
| NF-45 | Scope | Standing in a narrower scope used to authorize a wider one | decode | 103, 104 |
| NF-46 | Outcome | `uncertain` retried as `did-not-happen` | lint | 24, 26 |
| NF-47 | SecretRef | A field typed to carry secret bytes anywhere in the package | compile | 100 |
| NF-48 | SecretRef | Decoder input carrying a secret value where a ref is expected | decode | 100, 86 |
| NF-49 | any | A serialized value with an unknown schema version | decode | 90 |
| NF-50 | any | A schema change that alters canonical bytes without a version bump | test | 90, 82 |
| NF-51 | any | A constructor called from outside the package | compile | 1 |
| NF-52 | any | A decoder that reads the clock, a file, or the network | build lint | 96, 1 |
| NF-53 | UnresolvedInput | Passed where a `VerifiedPrincipal` or `VerifiedIntent` is required | compile | 14, 28 |
| NF-54 | VerifiedPrincipal | Decoded with no `Provenance` supplied | decode | 28 |
| NF-55 | VerifiedPrincipal | `id` or `kind` in the bytes disagrees with the provenance's authenticated record | decode | 28 |
| NF-56 | StandingGrant | `grantor: org-intent` without `documentVersion` and `approvedIn` | decode | 103, 104 |
| NF-57 | StandingGrant | Grant fields disagree with the `source` provenance | decode | 28, 104 |
| NF-58 | Authorization | No `explicitYes` record | decode | 98 |
| NF-59 | Authorization | Fields disagree with the `explicitYes` provenance — ordinary action | decode | 98 |
| NF-60 | Authorization | Fields disagree with the `explicitYes` provenance — protected artifact | decode | 82, 98 |
| NF-61 | Result | A `Refused` missing `site` or `reason` | decode | 42, 95 |
| NF-62 | Result | A match that omits a variant | compile | 42 |
| NF-63 | Directive | A serialized directive carrying an `expiresAt` field | decode | 93 |
| NF-64 | any | A serialized value missing its type name or schema version | decode | 90 |
| NF-65 | Evidence | A claim read past its `freshFor` window through the freshness function | decode | 26 |
| NF-66 | Evidence | A consumer that reads `claim` without the freshness function | lint | 26 |
| NF-67 | any | Two values of different types compared | compile | 13 |
| NF-68 | any | Same `id`, incompatible immutable fields, from two machines — must yield `Conflict`; the same pair across two schema versions must migrate first and must not conflict on migration alone | test | 31, 33 |
| NF-69 | Conflict | A function other than the resolution doorway that returns one side of a `Conflict` | lint | 31, 33 |
| NF-71 | Provenance | A `Provenance` constructed anywhere but the Provenance decoder | compile | 28 |
| NF-72 | Provenance | `channel-attested` provenance offered to the grant, revocation, authorization, or operator/delegate principal decoders | decode | 28, 98 |
| NF-73 | Provenance | A signature that fails against the registered key set decoded as `verified`; a fetched record with an internally matching hash but no host signature decoded as `verified` | decode | 28 |
| NF-74 | VerifiedPrincipal | A sender from a channel the adapter did not authenticate, or a name from content, decoded as a principal of any standing | decode | 28 |
| NF-75 | Conflict | The resolution doorway accepting a `Decision` whose principal holds only requester standing, or a standing whose scope does not cover the conflict's subject | decode | 28, 104 |
| NF-76 | Conflict | The resolution doorway resolving a conflict over a grant, revocation, authorization, or principal on less than operator standing in that scope | decode | 28, 82 |
| NF-70 | Revocation | Decoded with no `Provenance`, or naming a grant id that does not exist | decode | 28, 104 |

**Rule — the fixtures are the contract.** Rules 34, 36, 37, and 69 require that the invariants
be tested and that the rule book's enforcer references resolve. **Check:** every fixture number
exists in the implementation's test suite; a fixture that passes (the invalid shape was accepted)
fails the build; the rule book's rows for 13, 28, 29, 40, and 42 cite this fixture suite as their
enforcer once code exists.

---

## The terms this part introduces

The glossary's rule is that a load-bearing term needs a definition before the rule that uses it
is a rule. This part uses ten terms the glossary does not yet carry. On approval they become
term entries; until the register exists, they are defined here.

| Term | Kind | Definition |
|---|---|---|
| **decoder** | noun | A total, pure function from external bytes and context to a constitutional value or a typed refusal. The only producer of a constitutional value at a boundary. |
| **canonical encoding** | noun | The one deterministic byte form of a value, with fixed field order and the schema version inside it, over which content hashes are computed. |
| **artifact** | noun | The exact content an authorization binds to, identified by its canonical hash. |
| **base** | noun | The state an artifact was reviewed against — a target branch head, a fact-sequence position, a register generation. An approval expires when the base moves. |
| **scope** | noun | A closed set of registered places and action kinds where a standing, directive, or authorization applies. Compared by inclusion. |
| **freshness** | fact | The window after an observation during which its claim may be relied on. Never unbounded. |
| **strength** | fact | How an evidence claim was produced: `proof`, `observation`, `attestation`, or `inference`. An aggregate keeps the weakest. |
| **provenance** | noun | Where an authority-bearing value came from, as decoded by the package from authentication evidence: the adapter, the method, the authenticated record and its capture hash, the time, the machine, and its class — `verified` when the package re-checked the evidence (a signature, a host-signed event, a token it minted), `channel-attested` when the adapter attests an authenticated channel the package cannot re-check. |
| **explicit-yes record** | noun | The authenticated record in which an approver said yes: a host's review-approval event, a dashboard action, a signed reply. A merge event is not one. An authorization decodes only from one. |
| **conflict** | noun | Two records with the same identity whose immutable fields disagree. A value the fact spine records for a person to resolve, never a comparison result of true or false. |

---

## What this part makes checkable

The rule book's finding 3 named five rules that stop needing a check when the thing they govern
becomes a type: 13, 28, 29, 40, and 42. With this part approved and implemented, each of those
moves from "needs building" to "held by shape", and their enforcer is the fixture suite above.

Nine more rules gain their subject as a type rather than as prose: 57 (the floor), 90 (schema
versions), 93 (the directive's closed set), 96 (time as an argument), 98 (no approval from
absence), 100 (`SecretRef`), 103 and 104 (standing as a recorded grant with scope), and 108 (the
separate reason). They are not yet fully checkable — each needs the register or a doorway from a
later part — but the shape they need now exists, and a later part that weakens it fails a fixture.

One rule this part explicitly does not hold alone: 82's protected-artifact clause. The package
supplies the invariant and, for repository merges, names the external anchor the host provides.
For dashboard-governed and runtime artifacts it names no anchor, because none exists yet; that
question stays open and is carried to parts nine and eleven.

---

## What I want from you on this document

1. **The language capability floor.** Three static-checker capabilities are fixed here and the
   language is chosen later by compiling the fixtures. Is it right to constrain the choice this
   way now, or would you rather choose the language in this part?
2. **The repository anchor is the host's non-agent approval record, not the merge.** Rule 82
   has the agent merge; the branch rules require a non-agent approval on protected paths, and
   that approval record is what an authorization binds to. Is that the anchor you want, and
   should the constitution and `docs/` be the only protected paths at first?
3. **A budget applied as designed rides inside `Success`.** The approved parent fixes `Result`
   as two arms, so the capacity signal is a required field on `Success` rather than a third
   arm. Rule 40 is met (it cannot be routed as an error); do you accept this over amending the
   parent?
4. **Decoders inside the types package.** One implementation per invariant, at the cost of a
   central package that knows every adapter's byte shape through its fixtures. Alternative: one
   decoder per adapter, with the fixtures shared. I recommend the first.
5. **`UnresolvedInput` as a value.** An unresolvable sender's message is kept and queued as an
   authority-free value rather than refused. This is the one place the boundary is soft, and it
   is soft toward delivery on purpose. Is that the right place for the softness?
6. **Protected artifacts beyond the repository.** This part holds the protected list for
   repository merges only and says so; dashboard-governed and runtime artifacts have no anchor
   outside the agent's write authority yet. Do you accept carrying that open question to the
   verification and operator-surface parts, or do you want a reference monitor designed before
   any code part starts?
7. **Requester standing on an attested channel.** A principal with requester standing may rest
   on `channel-attested` provenance — the adapter's word that the message came through a channel
   it authenticated — which is what the glossary's definition of *verified* allows. The stricter
   reading would require package-verified evidence even for requester standing, which today's
   Telegram channel cannot provide. Which do you want?

---

*Depends on: the approved rules, register, glossary, and big-picture design, and their
changelogs. Next after approval: part two, the fact envelope, version chain, and projection
contract, built from these types.*
