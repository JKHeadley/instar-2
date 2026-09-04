# Part three — declarations, the register generator, the terms resolver, and the rule graph

**Status: draft, awaiting approval. Governed. No later part design or code is built on top of this until it is approved.**

The register (step two) and the glossary (step three) were approved as designs for *lists*: every
governed thing enumerated with required facts, every load-bearing word defined once. This part
designs the machinery that makes those lists true without anyone remembering anything: how a
governed thing is **declared** in code beside the thing itself, how the register is **generated**
from those declarations so a hand edit is impossible rather than discouraged, how every term a
rule leans on is **resolved** to exactly one live definition, and how the **rule graph** — every
rule naming what enforces it, every enforcer naming what it enforces — is walked in both
directions with an honesty class on every edge.

The failure this part exists to prevent was measured, not imagined: of 92 guards in the running
1.x system, 20 were confirmed on. The gap was never malice; it was that the capability list was
hand-maintained (rules 78 and 84 name the mechanism), the words were defined nowhere, and a rule
could cite an enforcer that could not fail for it — so coverage reports said *held* where nothing
was holding. Every mechanism below exists to make one of those three lies unwritable.

One inheritance governs everything here. Part two fixed that the register is a **projection**:
the authoritative index of what *exists*, never a second authority about what *occurred*, taken
as an explicit input by every fold that needs governed metadata. This part designs the generator
that produces that projection and the identifier by which everything else pins it.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

Four mechanisms and one identifier. A **declaration** is a constitutional value, authored in code
beside the thing it describes, carrying the facts only its author can know; everything else about
an entry is computed. The **generator** is a pure build function from (the declarations at a
commit, the version-chain record) to the register — its output is never edited, only regenerated.
The **terms resolver** walks every rule and every required fact, finds each load-bearing term,
and resolves it to exactly one live term entry — computing derived adjectives from declared
profiles rather than trusting anyone's judgment of a word. The **rule graph** is the both-ways
map between rules and their holders, where every edge carries a declared honesty class and an
edge that cannot fail for its rule is a lint error, not a coverage point. The identifier is the
**register generation**: a content hash over the generated register, which part two's projections
and decoders take as their explicit governed-metadata input — so "which register was in force"
is always an argument someone passed, never ambient state someone read.

---

## The declaration

A declaration is how a governed thing enters the register. It is a constitutional value in part
one's full sense — closed construction, schema-versioned, canonical bytes, decoded with refusal —
and it lives **in the code, beside the thing it describes**, because distance is drift: a list
maintained away from the thing it lists is the mechanism by which 1.x lost its capability map.

| Field | Meaning |
|---|---|
| `id` | The entry's stable name. Never reused; a rename is a supersession, not an edit. |
| `kind` | One of the register's kinds. A kind the register's shape does not carry refuses at decode — the author is forced into the shape-change flow, never into the nearest wrong slot. |
| `requiredFacts` | The kind's required facts, complete. A missing one is a decode refusal, which surfaces at build as the failure the register documents promise. |
| `profile` | For the kinds the glossary names (features, blocking sites, judgment points, critical outcomes, operator actions): the four plain facts — consequence, reversibility, reach, surface — from their closed lists, profiled for the runaway case per the glossary's rule. |
| `standards` | The rule numbers this entry exists to satisfy — the author's half of rule 69. |
| `declaredBy` | Generated from the declaration site: module, path. Never typed. |

**What a declaration is not.** It is not prose (it decodes or it refuses); it is not the entry
(the entry is generated, and carries generated facts — `owner`, `since`, `supersedes`,
`approvedIn`, `landedIn` — the author cannot supply and therefore cannot fake); and it is not
optional at the boundary: code that constructs a store, a blocking site, a judgment point, or any
other governed kind without a declaration in the same change fails the build's undeclared-thing
sweep (the retrospective review's third signal, made a build check where statically visible).

**Rule — governed things are declared beside themselves, and the register is generated.** Rules
78 and 84 name hand-maintenance as the failure; rule 90 requires versions generated from git;
the register document's own three properties require it. **Check:** the register file is a build
output; a hand edit is overwritten by regeneration, and CI fails a diff between the committed
register and a fresh generation (P3-NF-01); a declaration missing a required fact refuses at
decode (P3-NF-02); an unknown kind refuses (P3-NF-03); the undeclared-thing sweep fails a
governed construct with no declaration in scope (P3-NF-04).

**Rule — a declaration is decoded, never trusted.** Rules 28 and 36; part one's boundary.
**Check:** declarations decode through part one's decoders with the build's provenance;
`requiredFacts` values outside a fact's closed list refuse (P3-NF-05); a profile that answers
the single-occurrence case where the runaway rule demands the many-times case is contestable by
the reviewers the glossary names, and the profile's bound — the cap, coalescer, or breaker that
keeps `attention` honest — must itself be a declared entry, so an unbounded repeater cannot
declare `attention` without naming the bound that makes it true (P3-NF-06).

**Value — the author declares little, the build derives the rest.** The constitution requires
the facts to exist, not who writes them. The split is chosen so the fakeable surface is minimal:
what the author supplies is what only the author knows (`standards`, the profile, kind-specific
facts); what the build can know (site, history, versions, usage) is generated and therefore
un-fakeable. The cost is a generator that must read git and the fact record, priced below.

---

## The generator

The register is generated by a pure function:

    register = generate(declarations at commit C, version-chain record as of C)

**Inputs, exactly.** The declarations are read from the tree at C. The version chain — each
entry's `since`, `supersedes`, `approvedIn`, `landedIn` — is read from the durable record part
two designed: when a governing change lands, the landing appends the version-chain facts (the
approval was resolved once, at append, per part two), and the generator *reads* them; it never
re-derives approval authority from git alone, because a merge commit locates a change but never
approves it (part two's two-anchor reading, operator-confirmed). Git supplies location and
lineage; the fact record supplies authority.

**Output, exactly.** One register: every entry of every kind, each carrying its author-declared
facts, its generated facts, and its full version history as a lookup. Plus the derived renderings
— the capability briefing rule 84 names, the glossary document, the rules coverage report — each
a rendering of entries, so editing a rendering fails the same check as editing the register
(P3-NF-01 covers all outputs).

**The register generation.** The generator's output is canonically encoded and hashed; that hash
is **the register generation** — the value part two's projections and part one's decoders take
as their explicit input. Two machines generating at the same commit with the same version-chain
record produce the same generation byte-for-byte, which is what makes "which register governed
this decision" a recorded argument everywhere.

**Rule — the generator is deterministic and pinned.** Rules 90 and 33; part two's projection
contract clauses 3 and 4 (an input parameter, deterministic to the byte). **Check:** the
determinism fixture — same inputs, two architectures, byte-identical output and generation hash
(P3-NF-07); the register generation is content-derived, so a doctored register fails its own
hash (P3-NF-08); a projection or decoder reading register state through any channel other than a
passed generation fails part two's import lint (P2-NF-50 already holds this; restated, not
re-owned).

**Rule — the register's own shape is in the register.** The register document's closing design:
each kind and each required fact is itself an entry, with `since` and `standards`, so the shape's
history is a lookup and a shape change rides the same approval flow as any governing change.
**Check:** the generator refuses a declaration whose kind or fact is absent from the shape
entries at the pinned generation (P3-NF-03, P3-NF-05 are evaluated against the shape entries,
not against code constants — the constants are generated *from* the shape entries, P3-NF-09).

**Value — generation runs at build, and the register is a committed output.** Nothing forces
committing a generated file; it is chosen so a reviewer sees the register diff a change produces
in the same pull request as the change — the entry a declaration adds, the version a supersession
creates — and so CI's regenerate-and-compare (P3-NF-01) can catch a stale or doctored copy. The
cost is merge noise in a generated file, accepted for the reviewability.

---

## The terms resolver

The resolver makes the glossary's promise mechanical: an undefined load-bearing term is not yet a
rule, and a defined one has exactly one live meaning shared by the build, the code, and the model
briefing.

**The walk.** From the rules entries and every kind's required facts, collect each italicized or
backticked term; resolve each against the terms entries at the pinned generation. A term with no
live entry fails the build, naming the term and the use sites (P3-NF-10). A term entry nothing
uses is flagged as dead weight — a warning, not a failure, because removal is a governed change
someone must decide (its loop entry keeps it from rotting silently).

**Derived adjectives are computed, not judged.** An `adjective` entry's `derivedFrom` is data — a
rule over profile facts. The resolver evaluates it against each relevant entry's declared
profile, and the words *significant*, *critical*, *user-facing*, *irreversible* are outputs. A
prose definition can never drift from the computation, because the briefing renders the same
entry the resolver evaluates (P3-NF-11: a derived word asserted anywhere it is not computed).

**One kind value, renamed.** The glossary's term kinds were `adjective`, `fact`, `noun`,
`standing`. Part two surfaced the homonym — `fact` the term-kind collides with `fact` the record
— and the operator approved routing the rename. This pull request carries it: the kind value is
now **`field`** (a profile field or required fact), amended in the glossary through its own
version chain, with part one's two affected term rows updated in the same change. The resolver
recognizes only `field`; the superseded value survives in history as rule 90 requires, and
nowhere else (P3-NF-12).

**Rule — every load-bearing term resolves, both ways.** Rule 69; the glossary's finding-4
machinery; rule 90 for the supersedes chain. **Check:** P3-NF-10 (unresolved term fails), the
generated `usedBy` on each term entry (a hand-written `usedBy` is overwritten), and the
supersedes walker shared with every governing chain (part two's P2-NF-42/43 apply unchanged).

**Value — dead terms warn, missing terms fail.** The asymmetry is chosen deliberately: a missing
definition makes a rule unenforceable *now*; an unused definition is only clutter, and deleting
clutter deserves a decision, not an automatic sweep.

---

## The rule graph

The graph is rule 69 made mechanical over the whole constitution: nodes are rules and holders
(checks, fixtures, sentinels, probes, register kinds); edges are declared in both directions —
a rule's row names its holders, a holder's `standards`/`watches` names its rules — and the walker
fails on any edge that resolves in only one direction (P3-NF-13).

**Every edge carries an honesty class.** Part two's discharge table taught the discipline this
graph generalizes: a rule listed against a check that cannot fail for it is worse than an
uncovered rule, because the coverage report then lies. Each edge declares one of:

| Class | Meaning |
|---|---|
| `held` | The holder can fail for this rule, and the failing fixture is named. |
| `partial` | The holder covers a named portion; the remainder's edge (or gap) is named beside it. |
| `deferred` | The holder is a named later part; the edge carries the part number. |
| `gap` | No holder exists. Visible by design — the 20-of-92 number, kept current instead of discovered. |

**The can-fail test is the edge's admission bar.** A `held` edge must name the fixture, probe,
or sentinel record that fails when the rule is violated — and the graph walker spot-checks the
claim mechanically where it can (a named fixture must exist at its declared stage; a named
sentinel must have a `lastRan` within its window; a named probe must have a cadence). What the
walker cannot verify — that the fixture *semantically* covers the rule — is the retrospective
review's assigned duty, declared as such (a duty-of-observation entry with its proof artifact),
so the gap between mechanical and semantic checking is owned rather than implied away
(P3-NF-14: a `held` edge naming a fixture that does not exist, a sentinel that never ran, or a
probe with no cadence).

**The coverage report is a rendering.** The per-rule state — held / partial / deferred / gap,
with counts and the named holders — is generated from the graph on every build. It replaces the
hand-written status the 1.x registry admitted was aspirational, and because `gap` is a first-
class edge, an honest zero is always representable: the report can say "twenty of ninety-two"
without anyone having to confess it.

**Rule — references run from both ends, with an honesty class.** Rules 69 and 26 (the report
must verify state, not symbols); rule 8 (every `gap` and `deferred` edge is also a loop entry
with a cadence, so uncovered rules re-surface instead of resting quietly in a report nobody
reopens). **Check:** P3-NF-13, P3-NF-14, and the loop-entry cross-check — a `gap` edge with no
loop entry fails (P3-NF-15).

**Value — gaps are loud and cheap to declare.** The alternative — refusing to build until every
rule is held — would force dishonest `held` edges, which is the disease. Making `gap` the honest,
low-friction default is chosen so the number stays true while it shrinks.

---

## The two routed amendments, executed

Both were surfaced by part two and approved for routing by the operator (2026-09-04); both are
constitutional edits, so they ride this pull request — one approval event, per the operator's
rare-approval direction — through their documents' own version chains.

**Amendment one — rule 4 gains its third category.** Rule 4's text recognized deciding-alone
only for the ruled three (secret, spend, emergency stop), leaving every deterministic decode or
integrity refusal — part one's decoders, part two's admission ladder — formally outside the
rule's categories. The amendment names **deterministic enforcement of recorded governed state**:
an exact test that refuses malformed, unverifiable, or standing-uncovered input and preserves
it, deciding alone without being on the ruled-three list, because it enforces what the record
already says rather than judging anything. The blocking-site kind's `decidesAlone` fact gains
the corresponding value. Applied to `01-the-rules.md` rule 4's row and the register document's
kind-2 table, with changelog entries in both.

**Amendment two — the glossary kind `fact` becomes `field`.** As designed in the resolver
section above; applied to `03-the-glossary.md`'s kind list and part one's two affected term rows
(`freshness`, `strength`), with changelog entries in both.

**Rule — an amendment is a version, never an edit.** Rule 90. **Check:** each amended document's
changelog gains an entry whose `approvedIn` binds to this pull request's approval; the
supersedes walker holds; the governed-document checks pass unchanged.

---

## Multi-machine posture

Stated explicitly, as rule 113 requires:

- **The generator is machine-independent.** Same commit + same version-chain record → the same
  register and the same generation hash on every machine (P3-NF-07 runs on two architectures).
  There is nothing to reconcile because there is nothing machine-local to diverge.
- **Renderings are generated locally, pinned globally.** A capability briefing or coverage
  report is rendered on the machine that needs it, from a named generation — the generation hash
  in the rendering's header is what makes two machines' briefings comparable.
- **The version-chain record rides part two's replication.** Nothing new crosses machines in
  this part; the generator consumes what part two already replicates.

---

## What is rejected where

Declaration decode refusals surface at build, through part one's boundary, in this order: unknown
`kind` (against the shape entries), missing required fact, closed-list violation, unbounded
repeater claiming `attention` without a declared bound, unresolved term, one-direction edge. The
build's refusal output names the declaration site — the point of declaring beside the thing is
that the failure lands where the author is.

---

## The negative contract fixtures

Continuing the cross-part convention: **P3-NF-nn**, each with its stage.

**Rule — the fixtures are the contract.** Rules 34, 36, 37, 69. **Check:** as parts one and two —
every number exists at its stage; a fixture that passes when it should refuse fails the build.

| # | Stage | Shape | Refused/failed because |
|---|---|---|---|
| P3-NF-01 | build | A committed register (or rendering) differing from a fresh generation | Generated means generated; a hand edit is overwritten and a stale copy fails CI. |
| P3-NF-02 | decode | A declaration missing a required fact of its kind | Required means the build refuses, not warns. |
| P3-NF-03 | decode | A declaration whose `kind` is absent from the shape entries | The nearest wrong slot is how registers rot; the shape-change flow is the only door. |
| P3-NF-04 | build | A governed construct with no declaration in the same change | The undeclared-thing sweep; distance is drift. |
| P3-NF-05 | decode | A required-fact value outside its closed list | Closed lists are what make declarations checkable. |
| P3-NF-06 | decode | A repeating code path profiled `attention` with no declared bound entry | The glossary's runaway rule, made refusable. |
| P3-NF-07 | test | Two generations at one commit differing across machines or architectures | The generator is deterministic and pinned. |
| P3-NF-08 | test | A register whose content does not match its generation hash | A doctored register fails its own name. |
| P3-NF-09 | build | Kind or fact validation reading code constants not generated from the shape entries | The shape's authority is the register, not a header file. |
| P3-NF-10 | build | A load-bearing term in a rule or required fact with no live term entry | An undefined term is not yet a rule. |
| P3-NF-11 | build | A derived adjective asserted rather than computed from a profile | The word was never declared; it is derived or it is nothing. |
| P3-NF-12 | build | A term entry declaring the superseded kind value `fact` | The rename is total; history holds the old value, the live set does not. |
| P3-NF-13 | build | A rule-holder edge resolving in only one direction | Rule 69 is bidirectional or it is decoration. |
| P3-NF-14 | build | A `held` edge naming a fixture that does not exist, a sentinel that never ran, or a probe with no cadence | The can-fail test is the admission bar for `held`. |
| P3-NF-15 | build | A `gap` or `deferred` edge with no loop entry | Uncovered rules re-surface; they do not rest in a report. |

---

## The terms this part introduces

| Term | Kind | Definition |
|---|---|---|
| **declaration** | noun | The constitutional value, authored in code beside a governed thing, from which its register entry is generated. Carries only what the author alone knows. |
| **register generation** | noun | The content hash of a generated register; the explicit input by which projections, decoders, and renderings pin which register governs them. |
| **rendering** | noun | A generated document over register entries — the capability briefing, the glossary, the coverage report. Editing one fails the regenerate-and-compare check. |
| **rule graph** | noun | The bidirectional map between rules and holders, every edge carrying an honesty class. |
| **honesty class** | noun | The declared strength of a rule-holder edge: `held` (can fail, fixture named), `partial`, `deferred` (part named), or `gap`. |
| **undeclared-thing sweep** | noun | The build check that fails a governed construct created without a declaration in the same change. |

---

## What this part makes checkable

The register document promised 21 rules move to checkable with the register and glossary built —
4, 7, 8, 9, 32, 33, 34, 36, 38, 39, 43, 56, 57, 62, 66, 72, 73, 76, 79, 82, 86 — and this part
is the machinery that promise named; each lands as generator decode refusals plus the walkers
above, and rules 78 and 84 become free (the briefing is a rendering). Rule 69 moves from "held
for what each part declares" to held globally: the graph is the both-ways check, and the honesty
classes keep it from becoming the lie it replaces. Rule 90's generator — versions from git,
authority from the record — is built here for every governing kind at once. Rule 26 gets its
subject in the coverage report: the report renders verified edge states, never asserted ones.

What this part does not hold, named: the *semantic* adequacy of a `held` edge (assigned to the
retrospective review as a declared duty, part nine); the protected-artifact enforcement sitting
outside the agent's write authority (part two carried it; still carried, parts nine and eleven);
the sentinels and probes the graph's edges name (their kinds exist, their designs are parts
seven and nine).

---

## What I want from you on this document

1. **The register is a committed, generated file.** Reviewable diffs and a doctored-copy check,
   at the cost of merge noise in generated output. Right trade?
2. **Gaps are cheap to declare and loud forever.** A `gap` edge builds fine but opens a loop
   with a cadence — the 20-of-92 number stays visible and current instead of being rediscovered.
   Accept that a red count is a permanent dashboard fact rather than a build failure?
3. **Dead terms warn; missing terms fail.** The asymmetry as designed. Right line?
4. **The two amendments ride this pull request.** One approval event covering part three plus
   the rule-4 category and the `fact`→`field` rename, per your rare-approval direction. Confirm
   this is how you want routed amendments bundled going forward?
5. **The author-supplied surface is minimal by design.** Authors declare only what the build
   cannot know; everything else is generated and unfakeable. The cost is generator complexity —
   it reads git and the fact record. Accept the split?

---

*Depends on: the approved rules, register, glossary, big-picture design, parts one and two, and
their changelogs. Next after approval: part four, intake and identity/standing resolution.*
