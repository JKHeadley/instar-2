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

Nine types are described below, and each would be tedious to trust if it invented its own rules
for construction, equality, versioning, time, and failure. So the rules are fixed once here and
every type inherits them. A reviewer checks a type against this list, not against its author's
taste.

### 1. Construction is closed

A value of a constitutional type can be made in exactly two ways: by a **decoder** at an adapter
boundary, which reads bytes and either produces the value or refuses, or by a **pure derivation**
inside the package, which computes one value from others already trusted. There is no third
door. Code outside the package cannot assemble the fields by hand.

**Rule — no open constructors.** Rules 13, 28, 29, 42, and 98 each depend on a value that cannot
be made casually. **Check:** every constitutional type's constructor is private to the package; a
negative fixture that assembles the fields from outside fails to compile.

### 2. Equality is declared

Every type says how two values compare. Most compare by value: same fields, same value. Types
that name a durable thing compare by identity: same `id`, whatever else changed. A type never
compares two values of different subject, scope, or schema as equal; the comparison is refused
rather than answered `false`, because `false` would let a caller treat a category error as an
ordinary mismatch.

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

**Rule — one artifact, one hash.** Rules 82, 100, and 109 require binding to exact content.
**Check:** a fixture set of values with their expected canonical bytes and hashes is part of the
package tests; a change in encoding without a schema version bump fails.

---

## The types

Each type is given in the same shape: what it is in plain words, what it holds, the mistake it
makes impossible, how it comes into being, and which rules it carries. The field lists are the
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
| `verifiedBy` | The adapter that authenticated the source and the method it used: `telegram-sender`, `signed-envelope`, `dashboard-pin`, `github-merge`, `os-scheduler`, and so on — a closed list the register owns. |
| `verifiedAt` | The clock measurement at verification. |
| `on` | The machine that performed the verification. |

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
| `grantor` | Either `org-intent` (the organization's declared intent names the holder) or a `VerifiedPrincipal` who held a standing able to delegate it. |
| `issuedAt` | Clock measurement. |
| `expiresAt` | Optional clock instant. A grant with no expiry is allowed only for `grantor: org-intent`. |
| `approvedIn` | For a grant issued through an approval, the `Authorization` that created it. |

A grant is never edited. Revocation is a separate value, `Revocation { grantId, by, at, reason }`,
and the question "is this grant live now?" is a pure function over the grant, the set of
revocations, and `now`. Nothing in the package deletes a grant, so a revoked grant remains readable
and its history remains a lookup.

**What it makes impossible.** A message cannot confer standing, because the only producers of a
grant are the decoder of an approval record and the decoder of the organization's intent file. A
delegate cannot act outside its listed actions, because the check is a set membership on this
value, not a judgment. A delegate cannot re-delegate unless the organization's intent says so; the
package leaves that policy to the intent document and only supplies the check.

**Rule — standing is recorded, never inferred.** Rules 28, 93, 98, 103, and 104 require it.
**Check:** decoders refuse a grant whose grantor lacks a live standing able to delegate the
requested standing; a negative fixture with a grant "from the conversation" (no approval, no intent
source) fails to decode; the liveness function returns `revoked` or `expired`, never `false`.

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

**What it makes impossible.** A directive cannot expire: the type has no such variant, so no code
path can time one out. An intent cannot lose its raw form, because `raw` is required and hashed
before `ask` exists. Interpretation and arrival are separate fields, so "what they said" and "what
we understood" cannot be confused in a record.

**Rule — a directive holds until superseded or done.** Rules 93, 96, 110, and 4 (a block preserves
its input) require it. **Check:** a negative fixture that closes a directive for any reason other
than supersession or completion fails to type-check; the intake decoder refuses an intent without
a raw hash; the lineage function detects a cycle in `supersedes` and refuses it.

### Result — success or refusal, with no way from one to the other

Every operation that can fail returns a `Result<T>`. It has three forms, and two of them are
successes:

- `Success<T>` — the operation did what was asked.
- `BudgetApplied<T>` — the operation did what was asked *and* a declared capacity bound acted as
  designed: a store trimmed to its limit, a notifier coalesced, a loop hit its cap. This is a
  success. It names the bound (a register id) and what the bound did.
- `Refused` — the operation did not happen.

`Refused` carries: `reason` from a closed list (`standing`, `decode`, `floor`, `stale-base`,
`lease`, `budget-exhausted`, `integrity`, `policy`); `site` (the register id of the blocking site
or doorway that refused); `failDirection` (`open` or `closed`, the one that site declared); and
`preserved` (a reference to where the refused input was kept). A refusal without a preserved input
cannot be constructed.

**What it makes impossible.** There is no function from `Refused` to `Success` anywhere in the
package, and the language must not allow one to be written outside it. A caller that wants the
`T` must match on the result and handle the refusal by name. A capacity bound acting as designed
cannot be routed as an error, because it is a success variant. A refusal cannot forget its input.

**Rule — a refusal stays a refusal; a budget applied is a success.** Rules 40, 42, 4, 86, and 95
require it. **Check:** compile-time fixtures that pattern-match `Refused` into a success value, or
that treat `BudgetApplied` as an error, fail to type-check; the decoder refuses a `Refused` whose
`reason`, `site`, or `preserved` is missing or whose `failDirection` disagrees with the site's
register entry.

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

**Rule — a number binds its subject.** Rules 13, 26, 64, and 75 require it. **Check:** a
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
read as current: `isFresh(evidence, now)` is the only way to use it, and it is a pure function.
Blending strengths: an aggregate over evidence keeps the weakest strength present, so a proof and
an inference averaged together cannot report as proof.

**Rule — evidence carries its provenance.** Rules 26, 36, 70, 107, and 111 require it. **Check:**
decoders refuse evidence missing any field; a fixture with `freshFor` unbounded fails; the
aggregation function is tested to keep the weakest strength; every `source` resolves to a register
entry.

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

**Rule — an approval is an explicit, bound yes.** Rules 82, 94, 98, 100, 101, 104, and 109
require it. **Check:** compile-time fixtures constructing an authorization from a timeout, from a
missing reply, or without a base fail; decoders refuse a self-approved protected artifact and an
agent-kind approver on one; the validity function is tested on every reason.

**Where the door for protected artifacts actually is.** The register (kind 12) hands this design
one open question: the agent writes the checkers, so the enforcement of the protected list must sit
outside the agent's write authority. This package cannot supply that alone, and it says so. What it
supplies is the invariant: an authorization for a protected artifact decodes only from an external
authenticated record — a merge on `main` performed by a non-agent account, or a dashboard action
completed with the operator's PIN — with the approver identity read from that external system, not
from the request. The anchor outside the agent is the external system's own protection: the
repository's branch rules require that record to exist before content reaches `main`, and the
agent's account cannot change those rules. The decoder verifies the anchor; it does not replace it.
If the anchor is ever removed, the decoder still refuses, but nothing then prevents the agent from
editing the decoder. That is the honest boundary, and it is why the protected list includes the
decoder itself.

**Rule — requester is never authorizer.** Rules 82, 98, and 103 require it. **Check:** the
protected-artifact list in the register includes this package's decoders and the external branch
rules are verified present by a probe on a cadence; the probe's absence is itself a critical
outcome.

---

## Supporting types

Four smaller types carry pieces the nine above share. They follow the same conventions.

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
verification asks the external system. This type is small, and it exists here rather than in the
effect doorway because it is a constitutional distinction, not an implementation detail. (Rules 24,
26, 42.)

**SecretRef.** A reference to a secret by vault name, never the value. No constitutional type has
a field that can carry secret bytes, and no decoder in this package produces one from input. A
secret arriving through intake is written to the vault by the adapter first and enters the core
as a `SecretRef`. (Rules 100 and 86.)

**Value — four supporting types, not more.** Each is here because a type above cannot state its
invariant without it. Anything else — fact envelopes, register entries, run records, delivery
states — belongs to the later parts and is built from these.

---

## The decoding boundary

Every adapter faces the outside world: a Telegram update, a signed envelope from another agent, a
GitHub webhook, a file on disk, a model's reply. None of those is a constitutional type. The
adapter's job is to hand the bytes to a **decoder**, and the decoder's job is to produce a value
or a refusal. Raw shapes exist only between the adapter and the decoder. After the decoder, the
core sees types.

A decoder is a total, pure function from bytes plus context to `Result<T>`. It:

1. checks the schema version and migrates a known earlier version forward;
2. checks every required field is present and every closed-list value is on its list;
3. checks every cross-field invariant named in this document (a directive with no expiry, a
   refusal with a preserved input, a profile with no adjective fields, an authorization with a
   base);
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
| A string, display name, or unverified sender record passed where a `VerifiedPrincipal` is required | A `verifiedBy` method the register does not list | That the adapter's authentication is real — the adapter contract suite, real captured fixtures |
| `Refused` converted to any success variant | A refusal missing `site`, `reason`, or `preserved` | That the refusing site's `failDirection` was the right choice — the register review |
| `BudgetApplied` handled as an error | A `BudgetApplied` naming a bound the register does not know | That the bound really fires — the bound's own tests and probes |
| Two measurements of different subject kinds compared | Two measurements of the same kind, different unit or instance, compared by the same-instance function | That the probe measured what it says — the probe's fixture |
| A `Directive` closed by anything other than supersession or completion | A `supersedes` cycle | Whether an operator meant to supersede — the mind |
| An `Authorization` built without `approver`, `artifact`, or `base` | A moved base, a moved artifact, a non-live standing, a self-approved or agent-approved protected artifact, a waiver dated after the act | That the branch rules exist and the agent cannot edit them — the external system and its probe |
| A `Decision` with no separate `reason` | A chosen action outside the floor | Whether the reason is true — the retrospective review |
| A `Profile` with an adjective field | `attention` with `unbounded` repetition; a value off its closed list | Whether the declared profile is honest — the review, and rule 24's recurrence signal |
| `Evidence` with no `source`, `observedAt`, or `capture` | A stale claim used as current; a capture hash that does not match | Whether the source is trustworthy — the holder's own freshness proof |
| A field typed to carry secret bytes | A decoder input containing a secret value where a `SecretRef` is expected | That the vault write happened first — the intake adapter's contract test |

**Rule — every forbidden state names its rejection point.** Rules 1, 49, and 69 require that a
rule name its enforcer. **Check:** every row in this table is a numbered negative fixture below,
and the fixture suite is the enforcer the rule book's rows 13, 28, 29, 40, and 42 name.

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
`Refused { reason: decode }`.

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
| NF-14 | Result | A `Refused` matched into `Success<T>` by a function outside the package | compile | 42 |
| NF-15 | Result | A `BudgetApplied<T>` handled in the error branch | compile | 40 |
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
| NF-30 | Evidence | An aggregate that reports a strength stronger than its weakest member | test | 107, 111 |
| NF-31 | Evidence | `isFresh` asked without `now` | compile | 96 |
| NF-32 | Decision | No `reason`, or `reason` is the same object as `conclusion` | compile | 108 |
| NF-33 | Decision | A model's chosen action outside the given `ActionFloor` | decode | 57 |
| NF-34 | Decision | `by` is a judgment point with no model and route recorded | decode | 41, 58 |
| NF-35 | Authorization | Built from a timeout, a missing reply, or a default | compile | 98 |
| NF-36 | Authorization | No `base`, or no `artifact` hash | compile | 82, 109 |
| NF-37 | Authorization | `artifact` no longer matches the current content | decode / validity | 82, 109 |
| NF-38 | Authorization | `base` has moved | decode / validity | 82 |
| NF-39 | Authorization | `under` names a grant not live at `at`, or not covering the action's scope | decode | 104, 28 |
| NF-40 | Authorization | Protected artifact with `approver` equal to `requestedBy` | decode | 82, 103 |
| NF-41 | Authorization | Protected artifact with an `approver` of `kind: agent` | decode | 82, 98 |
| NF-42 | Authorization | Protected artifact whose approver was not read from the external authenticated record | decode | 82, 101 |
| NF-43 | Authorization | `kind: waiver` with `at` later than the act it waives | decode | 94 |
| NF-44 | Authorization | A "no" or "declined" variant | compile | 98 |
| NF-45 | Scope | Standing in a narrower scope used to authorize a wider one | decode | 103, 104 |
| NF-46 | Outcome | `uncertain` retried as `did-not-happen` | compile | 24, 26 |
| NF-47 | SecretRef | A field typed to carry secret bytes anywhere in the package | compile | 100 |
| NF-48 | SecretRef | Decoder input carrying a secret value where a ref is expected | decode | 100, 86 |
| NF-49 | any | A serialized value with an unknown schema version | decode | 90 |
| NF-50 | any | A schema change that alters canonical bytes without a version bump | test | 90, 82 |
| NF-51 | any | A constructor called from outside the package | compile | 1 |
| NF-52 | any | A decoder that reads the clock, a file, or the network | build lint | 96, 1 |
| NF-53 | UnresolvedInput | Passed where a `VerifiedPrincipal` or `VerifiedIntent` is required | compile | 14, 28 |

**Rule — the fixtures are the contract.** Rules 34, 36, 37, and 69 require that the invariants
be tested and that the rule book's enforcer references resolve. **Check:** every fixture number
exists in the implementation's test suite; a fixture that passes (the invalid shape was accepted)
fails the build; the rule book's rows for 13, 28, 29, 40, and 42 cite this fixture suite as their
enforcer once code exists.

---

## The terms this part introduces

The glossary's rule is that a load-bearing term needs a definition before the rule that uses it
is a rule. This part uses seven terms the glossary does not yet carry. On approval they become
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
supplies the invariant and names the external anchor; the anchor itself is a probe in the
verification part and a rule in the repository host.

---

## What I want from you on this document

1. **The language capability floor.** Three static-checker capabilities are fixed here and the
   language is chosen later by compiling the fixtures. Is it right to constrain the choice this
   way now, or would you rather choose the language in this part?
2. **Requester is never authorizer, anchored outside the agent.** The design is honest that the
   decoder verifies the external anchor and cannot replace it. Do you accept that boundary, with
   the decoder itself on the protected list?
3. **`BudgetApplied` as a second success variant.** Rule 40 could be met by a flag on `Success`.
   A distinct variant is stricter and slightly noisier to handle. Which do you want?
4. **Decoders inside the types package.** One implementation per invariant, at the cost of a
   central package that knows every adapter's byte shape through its fixtures. Alternative: one
   decoder per adapter, with the fixtures shared. I recommend the first.
5. **`UnresolvedInput` as a value.** An unresolvable sender's message is kept and queued as an
   authority-free value rather than refused. This is the one place the boundary is soft, and it
   is soft toward delivery on purpose. Is that the right place for the softness?

---

*Depends on: the approved rules, register, glossary, and big-picture design, and their
changelogs. Next after approval: part two, the fact envelope, version chain, and projection
contract, built from these types.*
