# Part two — the fact envelope, the version chain, and the projection contract

**Status: draft, awaiting approval. Governed. No later part design or code is built on top of this until it is approved.**

The big-picture design gives the system one logical append-only sequence of facts, and says that
every current view — active runs, open commitments, standing grants, register entries, spend,
last-known ownership — is a projection computed from it. Part one built the values a fact can
carry. This part builds the record itself: what a fact must say about its own origin before it is
allowed into the sequence, how a thing that governs carries its history, and what a projection is
permitted to be.

The failure this part exists to prevent is the one 1.x actually has. In 1.x the current view *is*
the truth: a store holds today's answer, the history is whatever a log happened to catch, and when
the two disagree there is no way to tell which is wrong. Anything derived that can also be written
to is a second authority, and two authorities are two answers. So the contract here is narrow and
unpleasant on purpose: facts are appended and never changed, every view is a pure function of
facts, and a view that cannot be thrown away and rebuilt is not a view.

This document chooses no database, no wire format, and no ordering service. It fixes what any
implementation must guarantee, and it lists the exact shapes every implementation must refuse.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

It is three contracts and one write port. The **envelope** is the set of fields every fact carries
regardless of what it says, so that any fact can be attributed, ordered, and verified without
knowing its kind. The **version chain** is how a thing that governs — a rule, a term, a register
entry, a governed document — carries its own history, so that "which version was in force when
this happened" is a lookup rather than a reconstruction. The **projection contract** is what a
derived view may and may not do, so that nothing derived can quietly become a second source of
truth. The write port is `append`, and it is the only one.

**Rule — append is the only write.** Rules 7 and 90 forbid losing or editing what was recorded;
rule 33 requires two stores that answer the same question to declare how they agree, which is
unanswerable if either can be edited behind the other's back. **Check:** the fact-store port
exposes exactly one mutating operation, `append`; a lint fails any implementation exporting an
update, delete, or truncate; the negative fixtures below include an attempted in-place edit.

**Value — one logical sequence, many physical segments.** The constitution requires reconstructable
history, not a single database. Segments are chosen so a machine can keep appending while
partitioned, at the cost of a partial rather than total order, which the ordering section pays for
explicitly.

---

## The envelope every fact carries

A fact says that something occurred. It is never a statement about what is currently true — that
is what a projection is for. The distinction is load-bearing: "the run is active" is not a fact,
"the run was started" is.

| Field | Meaning |
|---|---|
| `id` | Stable, globally unique, assigned at append and never reused. Not a sequence number. |
| `kind` | The registered fact schema this fact is an instance of. |
| `schemaVersion` | The version of that schema, per part one's versioning convention. |
| `at` | A clock measurement, in part one's sense: a reading taken by a named holder, not an assumed instant. |
| `machine` | The machine that appended it. |
| `principal` | Who or what caused it: a `VerifiedPrincipal`, or the register id of the holder that appended on the system's own behalf. |
| `segment` | The append segment this fact belongs to, and its position within that segment. |
| `predecessor` | The id of the fact this one causally follows, when the appender knew of one. |
| `body` | The kind-specific payload, whose shape the registered schema fixes. |
| `contentHash` | The canonical hash, in part one's sense, over every field above. |

**What the envelope makes impossible.** An anonymous fact: `principal` is required and has no
"unknown" value — an event whose cause cannot be attributed is recorded as a fact *about an
unattributable observation*, made by the observing holder, which is a different and honest claim.
A fact that cannot be placed: `machine`, `segment`, and `at` are all required. A fact that was
quietly altered: `contentHash` covers the whole envelope, so any change produces a different hash
and therefore a different fact.

**Rule — every fact is attributable and verifiable.** Rules 89 and 41 require that what the system
did is traceable to who did it; rule 90 requires versioning by construction; rule 58 requires a
judgment's inputs and outputs to be recoverable. **Check:** the decoder refuses an envelope missing
any field; `principal` has no anonymous variant in the schema; a fixture whose recomputed
`contentHash` differs from the stored one is refused at read, not merely flagged.

**Rule — a fact carries no secret.** Rule 100 requires a secret to be stored before it is spent and
never to travel through incidental surfaces. **Check:** a fact body may hold a `SecretRef` and never
a secret value; the schema registry refuses a fact kind declaring a secret-valued field; the
negative fixtures include a body carrying a live credential shape.

**Value — the payload is small and points outward.** Large content — a transcript, a captured page,
a diff — is stored by the capture mechanism part one defined for evidence, and the fact carries its
content hash and location. This keeps the sequence cheap to replay, at the cost of a second store
that must remain reachable for the capture to be re-read. That trade is recorded here rather than
assumed.

---

## Ordering, and what it honestly gives us

Within a segment, order is total: positions are assigned by the single appender that owns it.
Across segments there is no global clock and no ordering service, so the honest relation is a
partial order: fact A precedes fact B when A is an ancestor of B through `predecessor` links, or
when both are in the same segment and A's position is lower. Everything else is concurrent.

A projection nevertheless has to fold facts in *some* sequence and produce the same answer
everywhere. So the contract separates two things that are easy to confuse:

- **Causal truth** is the partial order above. It is what the system may reason with. A claim that
  A caused B is only sound when A actually precedes B in this order.
- **Fold order** is a deterministic total order used only to make projection results identical
  across machines. It orders concurrent facts by the tuple (`at` reading, `machine`, `id`), each
  compared as fixed-width canonical bytes.

**Rule — reconciliation is deterministic and records conflicts.** Rules 32 and 33 require shared
state to declare how it agrees, and the big picture requires reconciliation to record conflicts
rather than choose a winner silently. **Check:** a reconciliation fixture set covering reorder,
duplication, partition, and conflict produces byte-identical projection output on every machine;
a fixture where two segments disagree on an immutable field of the same identity produces a
`Conflict` record, and a projection that resolves it silently fails the fixture.

**Value — fold order is presentation, not causality.** The constitution requires determinism, not a
particular tiebreak. Ordering concurrent facts by a clock reading is chosen because it is usually
close to what a human expects; it is explicitly *not* a causal claim, and the fold order is
forbidden as an input to any decision. The alternative — refusing to fold concurrent facts at all
until a human orders them — is stricter and unusable for the same reason it is safe.

**What this does not give us.** Fold order does not make a later clock reading mean a later event;
machine clocks skew. Anything that must be genuinely ordered — an authorization against the base it
was granted on, a supersession against the version it replaces — carries an explicit reference to
what it follows, and the decoder refuses it when that reference is absent. The ordering section
cannot be used to rescue a record that failed to say what it depended on.

---

## Retraction, correction, and the thing that is never deletion

A fact is wrong sometimes: a probe misread, an adapter double-delivered, a principal was
mis-resolved. None of that is repaired by changing the record.

- A **correction** is a new fact of the same kind that names the fact it corrects. Both remain.
  Projections fold the correction; anything auditing the history sees both and the reason.
- A **retraction** is a fact asserting that a named fact should not be relied on, with the reason
  and the retracting principal. The retracted fact remains readable forever.
- A **conflict** is not resolved by either. It is recorded, surfaced, and waits for an authority
  with standing to settle it, which is itself a fact.

**Rule — archiving never means deleting.** Rule 7 permits compaction and summarization and forbids
deletion of what the agent knows. **Check:** the fact store declares `growth: unbounded` in the
register's store kind; there is no operation that removes a fact; a retraction fixture asserts the
retracted fact is still readable, and its `contentHash` still verifies, after the retraction is
folded.

**Rule — a retracted fact is visibly retracted, not invisible.** Rules 7 and 24 together: a system
that hides its corrected mistakes cannot see that the same mistake keeps recurring. **Check:** a
projection that drops a retracted fact from its output without recording that a retraction applied
fails the rebuild-equivalence fixture; the retraction count per fact kind is a measurement the
store emits.

**Value — no compaction in the first implementation.** Rule 7 allows compaction, and this part
deliberately does not use the allowance. A compaction that is provably lossless with respect to
every projection is a real design, and it is not this one; until that proof exists, compaction is
the mechanism by which "we still have the history" quietly stops being true. The cost is that the
sequence only grows, and that cost is accepted for now and revisited when a measured size problem
exists rather than an anticipated one.

---

## The version chain, for everything that governs

A rule, a term, a register entry, and a governed document are all the same shape of thing: something
that is in force, that used to be something else, and whose current form was approved somewhere.
They carry the same three fields.

| Field | Meaning |
|---|---|
| `since` | The fact that put this version in force. |
| `supersedes` | The version this one replaced, or nothing for the first version. |
| `approvedIn` | The approval record this version rests on: the pull request and the merge commit, resolved from the host, for a repository-governed thing; the authorization fact for anything else. |

A version is never edited. A change to a governing thing produces a new version whose `supersedes`
names the old one, and the old one stays readable. "Which rule was in force when this decision was
made" is answered by walking the chain to the version whose `since` precedes the decision — a
lookup, which is what rule 90 asks for by name.

**Rule — history is a lookup.** Rule 90 requires everything governing to be versioned by
construction, with when it began, what it replaced, and the approval that landed it, generated from
git rather than typed. **Check:** the build refuses an in-place edit to a governing entry that does
not produce a new version; every `approvedIn` resolves to a real merge commit on `main`; every
`supersedes` resolves to a version that exists; the chain for each governed thing is walked and any
cycle, gap, or fork fails.

**Rule — a document under review does not move.** Rule 109 freezes a document while reviewers read
it, and rule 82's authorization binds to exact content and base. **Check:** the approval a version
rests on carries the content hash it was granted against; a version whose content hash differs from
the one in its `approvedIn` record does not decode, so an edit after approval fails rather than
silently inheriting the approval.

**Value — approval records differ by host, the chain does not.** A repository approval resolves
through git; a dashboard approval resolves through an authorization fact. Both populate the same
three fields, so a reader never has to know which kind of thing it is holding. The cost is one
indirection at resolution time.

---

## The projection contract

A projection is a pure fold over facts producing a view. That is the whole of what it is permitted
to be, and each clause below removes a way it could become something else.

1. **It is a pure function of facts.** Same facts, same view, on any machine, at any time. It reads
   no clock, no configuration, and no other projection's storage.
2. **It declares its inputs.** Every projection names the fact kinds it folds. A fact kind it does
   not name cannot affect it, and a new fact kind that should affect it fails the build until it is
   named. Silent ignorance of an unknown fact kind is the failure mode this clause exists for.
3. **It is disposable.** Deleting a projection's storage entirely and rebuilding from facts must
   produce the same view. This is a test that runs, not a property that is asserted.
4. **It is never written to.** There is no operation that sets a value in a projection. Anything
   that would want one appends a fact instead.
5. **It is not an authority about what happened.** The register is the authoritative *index* of
   governed things — it answers "what exists" — and is not a second answer to "what occurred".
6. **It says how stale it is.** A view carries the position in the sequence it was folded through,
   so a reader can tell current from lagging, and a reader that requires currency can say so.

**Rule — projections rebuild and are compared.** The big picture requires exactly this check, on
rules 7, 15, 24, 32, 33, 41, 45, 58, 69, 75, 85, 89, 90, 94, 100, 108, 112, and 113. **Check:**
every registered projection has a scheduled rebuild-and-compare against its live view; a divergence
is a failure with both views captured; a projection with no declared inputs, or holding a fact kind
it did not declare, fails the build.

**Rule — a consumer moves with its source.** Rule 45 requires everything reading a source of truth
to move when the source is replaced. **Check:** each projection's declared inputs form the consumer
graph; changing a fact schema without updating every projection that declares it fails.

**Rule — every store declares its scope and its agreements.** Rules 32 and 33. **Check:** the fact
store and every projection are register entries of the store kind, each declaring `growth`,
`holdsAgentMemory`, `machineScope`, and `agreesWith`; the `agreesWith` invariant between a
projection and the facts it folds is the rebuild-equivalence test above, named rather than implied.

**Value — reading a lagging view is allowed and labelled.** The alternative, refusing every read
until the fold is current, converts every partition into an outage. A reader that genuinely cannot
tolerate lag asks for a position and gets a refusal instead of stale data, which keeps the choice at
the call site rather than in the store.

---

## Multi-machine posture

Stated explicitly, as rule 113 requires, and not as an afterthought:

- **The fact sequence is shared.** Each machine owns its own append segments and never appends to
  another's. Segments replicate; replication is additive and cannot remove or rewrite.
- **Projections are machine-local and rebuildable.** They are derived, so replicating them would be
  replicating a conclusion instead of its evidence. Each machine folds the facts it holds and says
  how far it has folded.
- **A partitioned machine keeps working.** It appends to its own segment. On reconnection the
  segments merge by the ordering rules above, and genuine divergence surfaces as a `Conflict`.
- **No fact is machine-local.** A machine-local *store* is permitted under rule 32 with a stated
  reason; a machine-local fact is not, because a fact that only one machine can ever see cannot be
  reconciled and cannot be audited from anywhere else.

**Rule — every change declares its multi-machine posture.** Rules 113 and 32. **Check:** the store
registry entries above carry it; a fact schema declaring machine-local scope fails the build.

---

## What is rejected where

The boundary that admits a fact is the same shape as part one's decoding boundary, and it refuses
in a fixed order so that a refusal reason is stable:

1. **Unknown or unregistered `kind`** — refused before the body is parsed. A fact of a kind the
   schema registry does not carry never enters the sequence.
2. **Unknown `schemaVersion`** — refused unless a migration from that version to the decoder's
   version exists.
3. **Malformed envelope** — any missing or ill-typed envelope field.
4. **Failed `contentHash`** — the recomputed canonical hash differs.
5. **Unresolvable `principal`** — refused, with the message preserved by the intake doorway's
   existing mechanism rather than discarded.
6. **Dangling `predecessor` or `supersedes`** — refused: a chain reference that does not resolve is
   the thing rule 90's check exists to catch.
7. **Body-level schema violation** — refused last, so a body error is never reported for a fact
   that was going to be refused for a stronger reason anyway.

A refusal is a value, never an exception, per part one. A refused fact is retained by the boundary
with its refusal reason, because a stream of refusals is itself evidence that something upstream is
broken.

---

## The negative contract fixtures

Each of these must be refused by any implementation. They are the executable form of everything
above.

| # | Shape | Must be refused because |
|---|---|---|
| NF-1 | A fact with no `principal` | Attribution is required; there is no anonymous variant. |
| NF-2 | A fact with `principal` set to a name lifted from message content | Part one: a name is not a `VerifiedPrincipal`. |
| NF-3 | An envelope whose stored `contentHash` does not match a recomputation | The record was altered. |
| NF-4 | An append that targets an existing `id` | Ids are never reused; this is an in-place edit wearing an append's clothes. |
| NF-5 | Any operation named update, delete, or truncate on the fact port | Append is the only write. |
| NF-6 | A fact body containing a live credential value | Rule 100: a secret is stored before it is spent. |
| NF-7 | A fact kind whose registered schema declares a secret-valued field | The same violation, one level earlier. |
| NF-8 | A fact of an unregistered `kind` | The registry is the closed set. |
| NF-9 | A `schemaVersion` with no migration to the decoder's version | Part one's versioning convention. |
| NF-10 | A `predecessor` that does not resolve | A dangling causal reference. |
| NF-11 | A governing version with `supersedes` naming a version that does not exist | Rule 90's chain must walk. |
| NF-12 | A governing version whose `approvedIn` is not a merge commit on `main` | Rule 90 names this exactly. |
| NF-13 | A governing version whose content hash differs from the one its approval was granted against | Rules 82 and 109: the approval bound to content that has since moved. |
| NF-14 | A second version of a governing thing created by editing the first in place | Rule 90 forbids in-place edits. |
| NF-15 | A projection exposing a write operation | Projections are never written to. |
| NF-16 | A projection folding a fact kind it did not declare | The consumer graph would be wrong and rule 45 unenforceable. |
| NF-17 | A rebuilt projection differing from the live projection | The view has drifted from its evidence. |
| NF-18 | A projection that reads the clock | Purity; part one's time convention. |
| NF-19 | A projection that reads another projection's storage | Derived-from-derived hides the real input set. |
| NF-20 | A view served with no folded-through position | A reader cannot tell current from lagging. |
| NF-21 | Two segments disagreeing on an immutable field of one identity, resolved silently | Reconciliation records conflicts; it does not pick winners. |
| NF-22 | A decision whose inputs are ordered only by fold order | Fold order is presentation, not causality. |
| NF-23 | A retraction that removes the retracted fact from the readable sequence | Rule 7: never deletion. |
| NF-24 | A projection dropping a retracted fact with no record that a retraction applied | Rule 24: hidden corrections hide recurrence. |
| NF-25 | A fact schema declaring machine-local scope | A fact only one machine can see cannot be reconciled or audited. |
| NF-26 | A replication operation that removes or rewrites a fact on the receiver | Replication is additive. |
| NF-27 | A segment appended to by a machine that does not own it | Segment ownership is what makes in-segment order total. |
| NF-28 | A compaction that removes facts | This implementation does not compact; the allowance is unused. |

---

## The terms this part introduces

| Term | Kind | Definition |
|---|---|---|
| **fact** | noun | An immutable record that something occurred, carrying the envelope above. Never a statement of what is currently true. |
| **envelope** | noun | The fields every fact carries regardless of kind, sufficient to attribute, place, order, and verify it without knowing the kind. |
| **segment** | noun | An append-ordered sequence owned by exactly one machine. Order within a segment is total; order across segments is not. |
| **fold order** | noun | The deterministic total order used only to make projection output identical across machines. Never an input to a decision. |
| **causal order** | noun | The partial order given by `predecessor` links and within-segment position. The only ordering a decision may rest on. |
| **projection** | noun | A pure fold over facts producing a view. Disposable, never written to, never an authority about what occurred. |
| **retraction** | noun | A fact asserting a named fact should not be relied on. The retracted fact remains readable. |
| **correction** | noun | A later fact of the same kind naming the fact it corrects. Both remain. |
| **version chain** | noun | The `since` / `supersedes` / `approvedIn` triple by which a governing thing carries its history as a lookup. |
| **folded-through position** | fact | How far through the sequence a view has been computed, carried with the view so a reader can tell current from lagging. |

---

## What this part makes checkable

With this part approved and implemented, rule 90 moves from "needs the register" to held by the
version chain and its walker: `since`, `supersedes`, and `approvedIn` are required fields whose
resolution is a build step, and an in-place edit to a governing thing fails rather than being
noticed later. Rule 7 gains a mechanical form — there is no delete to call — rather than a policy
someone has to honour. Rule 45's consumer graph becomes real: the declared inputs of every
projection *are* the graph, so replacing a source without moving its readers fails the build.

Rules 32 and 33 gain their subject: the fact store and every projection are register entries with a
declared scope and a declared agreement, and the agreement between a projection and its facts is the
rebuild-equivalence test rather than a sentence. Rules 41 and 58 gain the durable half of what they
need — every judgment's inputs and outputs land as attributable facts — though the doorway that
records them is part seven, so they are not yet fully held here.

One rule this part explicitly does not hold: rule 24's recurrence detection. This part makes
recurrence *visible* by keeping corrections and retractions rather than hiding them, but comparing
fingerprints across incidents needs the judgment doorway, and that is part seven's.

---

## What I want from you on this document

1. **No compaction, ever-growing history.** Rule 7 permits compaction; I have chosen not to use the
   permission, because a compaction that is provably lossless against every projection is a design
   we do not have, and the alternative is the mechanism by which history quietly stops being
   complete. The cost is unbounded growth. Do you accept that cost now and revisit on a measured
   problem, or do you want compaction designed before any code part starts?

2. **Fold order is by clock reading, and is not causal.** Concurrent facts are ordered for
   presentation by the appender's clock reading, which is close to human expectation and provably
   not a causal claim; a decision resting on it fails a fixture. The stricter alternative refuses to
   fold concurrent facts until a human orders them, which is safe and unusable. Is the labelled,
   non-causal tiebreak what you want?

3. **A retracted fact stays visible as retracted.** A reader of a projection sees that something was
   retracted rather than seeing nothing. This is deliberate — hidden corrections are how recurrence
   goes unnoticed — but it means an operator-visible view can carry a record of something the system
   now believes was wrong. Do you want that visible by default, or visible only on request?

4. **Lagging views are served with a staleness label rather than refused.** Refusing every read
   until the fold is current turns a partition into an outage. Serving labelled stale data means a
   careless reader can act on it. I have put the choice at the call site. Is that the right place?

5. **No fact is machine-local.** Rule 32 lets a *store* be machine-local with a reason; I am
   forbidding it for facts outright, because a fact one machine alone can see cannot be reconciled or
   audited from anywhere else. This is stricter than the rule requires. Do you want the stricter
   line?

6. **The payload points outward.** Large content lives in the capture store and the fact carries its
   hash and location, which keeps replay cheap but makes a second store load-bearing for audit. The
   alternative is fat facts and an expensive sequence. Which cost do you prefer?

7. **The register is an index, not a second history.** I have written the register as authoritative
   for "what exists" and explicitly not for "what occurred". That is a real constraint on later
   parts — anything wanting to ask the register what happened must ask the facts instead. Confirm
   that is the line you want held.

---

*Depends on: the approved rules, register, glossary, big-picture design, and part one, and their
changelogs. Next after approval: part three, declarations, the register generator, the terms
resolver, and the rule/holder graph, built on this envelope and version chain.*
