# Part three — declarations, the register generator, the terms resolver, and the rule graph

**Status: approved. Governed.**

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

And one discipline governs every mechanism, because the first review of this document found its
absence to be the common root of every serious defect: **a pin must be anchored outside the thing
it pins.** A hash nobody re-derives at the point of use is a name; a check whose code rides the
same change it checks is self-attestation; a claimed record that does not exist yet is prose.
Each section below says where its check runs, what anchors it, and what happens at the boundary
moments — first generation, a landing, a partition — where the anchor is being established rather
than consulted.

One inheritance frames everything. Part two fixed that the register is a **projection**: the
authoritative index of what *exists*, never a second authority about what *occurred*, taken as an
explicit input by every fold that needs governed metadata. This part designs the generator that
produces that projection and the identifier by which everything else pins it — and the generator
itself is *not* a part-two projection: it is a build function with its own closed inputs, named
below, and its output enters force through the same version-chain machinery as everything else
that governs.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

Four mechanisms and one identifier. A **declaration** is a constitutional value, authored beside
the thing it describes — in code for code-borne things, in a data file beside the document for
document-borne things — carrying only the facts the author alone can know; everything else is
computed. The **generator** is a deterministic build function over closed, named inputs — the
declaration set at a commit and a pinned extract of the version-chain record — whose output is
never edited, only regenerated, and whose entering-into-force is itself recorded so a generation
hash can be verified against the record rather than against itself. The **terms resolver** walks
the structured term references in rules and required facts — never typography — and resolves each
to exactly one live entry, computing the derived adjectives from declared profiles. The **rule
graph** is the both-ways map between rules and their holders: the holder side is declared, the
rule side is derived (a rule does not get to claim children — the glossary's own principle),
every edge carries an honesty class, and an edge that cannot fail for its rule is a lint error.
The identifier is the **register generation**, and it is a pin with an anchor: recorded when it
enters force, verified where it is consumed.

---

## The kind roster, fixed by name

The register document defined thirteen kinds and the glossary added two more — terms and rules —
reusing the numerals 12 and 13, so the corpus holds four kinds under two numbers. The collision
is display-level, not conceptual, and this part resolves it the durable way: **a kind's identity
is its name, never a numeral.** The roster this part's shape entries seed is fifteen: stores,
blocking sites, features, operator actions, loops, duties of observation, parsers, critical
outcomes, judgment points, model doorways, sentinels, protected artifacts, governed documents,
terms, and rules. Numerals in the parent documents remain readable as their local ordering;
nothing resolves through them.

---

## The declaration

A declaration is how a governed thing enters the register. It is a constitutional value in part
one's full sense — closed construction, schema-versioned, canonical bytes, decoded with refusal —
and it lives **beside the thing it describes**, because distance is drift: a list maintained away
from the thing it lists is the mechanism by which 1.x lost its capability map. For a code-borne
thing that means in the code; for a document-borne thing — a rule, a term, a governed document —
it means a structured data file beside the document, of which the rendered markdown is an output.

| Field | Meaning |
|---|---|
| `id` | The entry's stable name. Never reused; a rename or replacement is a supersession, not an edit. Two declarations claiming one `id` at the same commit refuse generation, naming both sites (P3-NF-16); an `id` matching a retired or superseded entry without a declared `supersedes` relationship refuses (P3-NF-17) — a resurrected name must not inherit a dead entry's standing citations without its history. |
| `kind` | One of the roster's kinds, by name. A kind the shape entries do not carry refuses at decode — the author is forced into the shape-change flow, never into the nearest wrong slot. |
| `requiredFacts` | The kind's required facts, complete, values from their closed lists. |
| `profile` | For the kinds the glossary names: the **five** plain facts — consequence, reversibility, reach, surface, and `repeats` (`no` / `bounded { by }` / `unbounded`) — profiled for the runaway case per the glossary's rule. A `bounded` repeats names its bound as a reference to a declared bound entry, required at decode and resolved at generation (P3-NF-06); `attention` with `repeats: unbounded` is refused outright — the glossary's rule says that combination cannot be honest. |
| `standards` | The rule numbers this entry is *governed by*. Present on every entry; **never** a source of rule-graph edges (see the graph section — conflating governed-by with enforces is how a coverage report inflates). |
| `holds` | Holder kinds only (blocking sites, sentinels, parsers-as-fixture-holders, critical-outcome probes, duties of observation): the rules this entry *enforces*, each with its honesty class and can-fail evidence. This is what mints graph edges. A `holds` citation is lint-checked against a **per-kind enforceable-subject table**, seeded as shape data by this part — which rules each holder kind may claim to enforce. The register document's "unblocks" headers record which rules a kind's *existence* makes checkable, which is a different fact, and sentinels have no such header at all; the enforceable-subject table is therefore its own shape entry set — minimal by design: one row per holder kind, listing the rule numbers entries of that kind may claim to enforce, seeded from the parents' per-kind rule discussions and reviewed like any shape change — never a reuse of the wrong table, and never a second policy language: it is a lookup, and everything with judgment in it stays in the rules themselves (P3-NF-18). |
| `declaredBy` | Generated from the declaration site. Never typed. |

**What a declaration is not.** It is not prose (it decodes or it refuses); it is not the entry
(the entry is generated, and carries generated facts — `owner`, `since`, `supersedes`,
`approvedIn`, `landedIn`, `base` — the author cannot supply and therefore cannot fake); and it is
not optional at the boundary. The enforcement of that last clause is structural, not textual:
**governed constructs are constructible only through core ports that demand a declaration id** —
the governed ports are defined by *this* part and built from part one's types under part one's
own closure sentence (register entries and their machinery "belongs to the later parts and is
built from these"): each governed kind's port is a constructor whose signature requires the
declared id, so building a store or a blocking site without a declaration is a type error, not a
convention violation. The diff-scoped static sweep (a governed-port call with no declaration in the tree,
P3-NF-04) is the belt over those braces, and what neither can see — a construct reached through
genuinely dynamic paths — is the retrospective review's named residual, exactly as the register
document's third signal assigned it. And the residual is *measured*, never waved at: each
language or runtime the system is built in carries an **enforcement-boundary declaration** —
which construct forms the governed ports make impossible, which the sweep catches, and which
remain residual (reflection, config-loaded routes, plugin registration) — and the coverage
report annotates every kind with its boundary strength, so a residual-heavy kind can never
render as completely enumerated (P3-NF-29). Cardinality is fixed so "beside the thing" has one meaning
for every shape of thing: **one declaration per governed thing**; a construct *class*
instantiated many times — a shared decoder, a middleware, a generated family — declares the
class once, at the class's definition site, and the generator emits the instance entries from
it — the family declaration names its **instance source** (the closed input the generator
enumerates instances from) and that source must be deterministic over (C, E) like every
generator input; a family whose instances are enumerable only at runtime cannot be a family
declaration — its instances register through the governed port at construction like any other
governed thing, and a family declaration citing a runtime-only source refuses (P3-NF-30). A
family is thus governed without a hand-written declaration per instance, and an instance can
never exist outside either its family's enumeration or the port's demand.

**Declarations must be live, both ways.** The sweep pairs constructs to declarations; the pairing
is bidirectional. A declaration no construct pairs with is a loud warning — a phantom guard
inflates every denominator the coverage report renders. And where a declaration is *cited as
load-bearing by another check* — above all a bound entry cited by an `attention` profile — an
unpaired citation is a failure, not a warning (P3-NF-19): a cap declared in dead code bounds
nothing, and P3-NF-06 must not be satisfiable by one. A declared bound is additionally a
critical-outcome entry with a probe, so a bound that exists but never exercises surfaces at
runtime rather than resting on its declaration.

**Rule — governed things are declared beside themselves, and the register is generated.** Rules
78 and 84 name hand-maintenance as the failure; rule 90 requires versions generated from git; the
register document's three properties require generation, required facts, and both-directions
resolution. **Check:** the register and every rendering are build outputs; a hand edit is
overwritten and CI fails a diff between the committed copies and a fresh generation, with exactly
one sanctioned exception — the landing completion defined below (P3-NF-01); a declaration missing
a required fact refuses at decode (P3-NF-02); an unknown kind refuses against the shape entries
(P3-NF-03); the sweep holds P3-NF-04; closed-list violations refuse (P3-NF-05).

**Rule — a declaration is decoded, never trusted.** Rule 28 and part one's decoding boundary;
the glossary's runaway rule (with part one's repetition fixtures) for the profile. **Check:**
declarations decode through part one's decoders with the build's provenance; the five-fact
profile with its bound-reference requirement holds P3-NF-06; cross-field invariants per kind —
`deletes` with `holdsAgentMemory: yes` fails (rule 7), a dark feature without a gate-and-deadline
fails (rules 72/73), a user-facing feature without `liveProof` fails (rule 62), an empty `metrics`
fails (rule 39) — are decoder invariants in part one's established cross-field pattern, named
here as the **per-kind invariant layer** so the register document's conditional checks have a
component instead of an implication (P3-NF-20: a kind's documented cross-field invariant with no
decoder invariant implementing it).

**Value — the author declares little, the build derives the rest.** The constitution requires the
facts to exist, not who writes them. The split is chosen so the fakeable surface is minimal: what
the author supplies is what only the author knows; what the build can know is generated and
therefore un-fakeable. The cost is generator complexity, priced next.

**Value — known machinery, named.** This is a schema registry plus a generated catalog plus
policy-as-code, and saying so imports the right lessons: adopted — declarations beside code
(annotation systems), generated catalogs with required fields, policy evaluated from data rather
than prose; declined, with reasons — an external policy engine (the rules must live in the same
version chain and decode boundary as everything else, or they become a second constitution) and
a standalone schema registry service (the register is a projection with a pinned generation, not
a network dependency). The delegable layer is the catalog tooling, never the contract.

---

## The generator

The register is generated by a function that is **deterministic over closed, canonical inputs** —
"pure" would overclaim, because reading a tree and a record is exactly where operational
ambiguity hides, so the inputs are enumerated and everything else is refused:

    register = generate(declaration set at commit C, chain extract E)

**Inputs, exactly.** The **declaration set** is every declaration in the tree at C, read through
a canonical walk (normalized paths and encodings; a shallow or partial checkout refuses — an
incomplete input is a refusal, never a smaller register). The **chain extract E** is the
version-chain record — each entry's `since`, `supersedes`, `approvedIn`, `landedIn`, `base` —
pinned by an explicit fact-position vector in part two's sense, and **committed beside the
register**: the extract is part of the repository, mirrored from the fact spine by the landing
machinery below, so CI and every machine generate from the same named record rather than from
whatever their local replica holds. Git supplies location and lineage; the extract supplies
authority; a commit alone never names a record position, so the generator takes both and the
generated register **carries both** — C and E's vector — in its header. Two machines with the
same C and E produce the same bytes; a machine whose extract trails its own spine is generating
an honest register *at a stated horizon*, visibly, not a divergent one silently — and
consumption applies part two's staleness rule to that horizon: an authority-bearing consumer
refuses a generation whose extract vector trails the newest entering-force record the consumer
holds past the declared bound, at build, at runtime, and in review alike.

**Output, exactly.** One register: every entry of every kind with its author-declared facts, its
generated facts, and its full version history as a lookup. Plus the renderings — the capability
briefing (rule 84), the glossary document, **the rule book**, and the coverage report — each a
rendering of entries under the same regenerate-and-compare check. For runtime bootstrap,
the approved rule book, glossary, and register document become the first rules,
terms, and shape entries — the glossary already mandates exactly this for itself — **together
with the shape entries this part seeds**: the holder fields (`holds`, `semanticallyReviewed`,
the sentinel `freshnessProbe` that supersedes the old run-record fact under this bundle's
amendments), the enforceable-subject table, and the generation-record and check-run-record
kinds, so the first generation's holder declarations validate against a shape that carries
them.

**Rule — repository replay publication uses approved sources.** For repository design publication, the authored Markdown remains the source and the existing replay converter derives the register and its views. The anchor's document map, rule declaration hashes and checker constant are derived pins, refreshed together by the desk in the same reviewed rule-book change. Only the exact operator-approved change may enter the published register; draft regeneration is a reviewable candidate, never approval. The desk records the authentic approval and reviewed head/base in the existing PR and changelog history. Replay remains a shape-only projection with pending runtime provenance and visible prerequisites. Its publication never appends or substitutes for an entering-force record. Runtime bootstrap still requires the actual approved conversion and verified absence of a first entering-force record; after anchoring, runtime changes use the verified parent and ordinary version-chain path. **Check:** existing independent review, operator approval at landing, and deterministic regenerate-and-compare.

The runtime anchoring transition follows this linear sequence, once: (1) this part is approved — inputs: the approved markdown corpus; every
check below suspended, because nothing is generated yet. (2) The one-time conversion emits the
first declaration set from the approved documents — shape entries (kinds, facts, holder fields,
the enforceable-subject table, the generation-record and check-run-record kinds), rules, terms.
(3) The first generation runs over that set with an empty chain extract — validation reads the
shape entries just converted; P3-NF-01/07/16/17 active from here. (4) The first entering-force
record is appended under the minimal plane's genesis grants, anchoring the first generation —
P3-NF-21 active from here. (5) Every later change is an ordinary declaration or shape change
against the parent generation, with the full ladder active. Nothing in the sequence consults a
register that does not yet exist, and each step names the checks it turns on.

**The register generation, anchored.** The generator's output is canonically encoded and hashed;
that hash is the **register generation**. Two anchors keep it from being a self-consistent name:
**at entry into force**, the landing machinery appends a fact recording the new generation (its
hash, C, and E's vector), so "is G a real generation" is a lookup against the record — a minted
hash matching no recorded generation refuses (P3-NF-21); **at every point of use**, register
content reaches a consumer only through a register decoder at part one's boundary that takes G as
its argument and refuses content whose canonical hash differs (P3-NF-08 is that decoder's
fixture, staged where consumers load — not only in a test harness). A projection or decoder
reading register state through any other channel already fails part two's import lint (P2-NF-50,
restated not re-owned).

**Landing, in two phases — because a change cannot carry the record of its own approval.** A
PR's committed register carries its new or superseded entries with the landing-dependent facts
(`approvedIn`, `landedIn`, and the chain-extract rows they will occupy) in a declared
`pending-landing` state — visible, reviewable, incomplete by design. The merge appends the real
version-chain facts (approval resolved once, at append, per part two). The **landing completion**
is then a mechanical step whose authority is inherited, not fresh: the completion commit is
authored by the landing machinery's **system principal** — a `VerifiedPrincipal` of part one's
`kind: system`, whose standing to append the version-chain, **generation-record**, and
check-run-record kinds is granted in the minimal plane's genesis grants — and its *repository*
authority derives from the approved merge itself, because the approved content declared exactly
these `pending-landing` completions and rule 82's binding covers what was reviewed; no fresh
approval exists to need. CI regenerates, and the only diff the completion may produce is the
completion of `pending-landing` fields and the extract-mirror rows — a lint enforces exactly
that shape, and P3-NF-01 is defined to accept that one transition and nothing else (P3-NF-22).
The generation-record fact kind (the generation hash, C, E's vector, the clock measurement) is
a shape entry this part seeds, beside check-run-record. **And the completion cannot jam
governance, by construction:** `pending-landing` is a legal interim state of main, so a failed,
delayed, or crashed completion blocks nothing — the merge stands, consumers see pending fields
honestly, and the completion is level-triggered and idempotent (its diff is a deterministic
function of the merged state, so re-running it converges and two runs cannot produce conflicting
completions — the second finds nothing left to complete). An overdue completion is re-surfaced
by a generated loop entry rather than remembered, and rollback is never needed because nothing
provisional was asserted as final. The same two-phase shape governs changelog entries for amended documents: the entry
lands in the PR with `approvedIn` pending, and the completion fills it — which is how this pull
request's own five changelog entries are written.

**Rule — the generator is deterministic and its output is anchored.** Rules 90 and 33; rule 26
(the generation is verified where used, never trusted as a symbol); part two's projection
contract clauses 3 and 4. **Check:** the determinism fixture — same C, same E, two architectures,
byte-identical output and hash (P3-NF-07, conditioned on *both* inputs); the entering-force
record and the consumer-side decoder (P3-NF-21, P3-NF-08); incomplete-input refusals (P3-NF-23:
a generation attempted over a partial checkout or an extract whose vector cannot be verified).

**Rule — the register's own shape is in the register.** The register document's closing design.
**Check:** kind and fact validation reads the shape entries, and the code constants doing the
checking are generated from them (P3-NF-09); a shape-changing pull request validates its
declarations against the **parent commit's generation** for everything except the shape entries
the change itself introduces, which validate against the shape-change document in the same PR —
so the bootstrap is ordered, not circular, for every shape change after the first, and the first
is the approved register document itself, per the bootstrap above.

**Rule — the toolchain is protected.** Rule 82 as ruled (the operator is asked about changes to
the constitution and the protected list); part two's carried limit. The generator, the resolver,
the graph walker, the canonical encoder, and the P3 fixture suite are **protected artifacts**
(kind: protected artifacts) from the moment they exist — a change to the checker rides operator
approval, never plain green-merge, because a check whose code rides the same authority it checks
is self-attestation. **Check:** their paths are protected-artifact entries; the honest caveat
part two carried still holds and is still named — until parts nine and eleven land the external
anchor, the agent authors the checkers, and this protection is enumerable but not yet
independently enforced.

**Value — generation runs at build, and the register is a committed output.** Reviewable diffs
(the entry a declaration adds, the version a supersession creates, the pending-landing rows) in
the same pull request as the change, and a doctored-copy check with teeth. The cost is merge
noise in generated files and the two-phase landing machinery above, accepted for the
reviewability.

---

## The terms resolver

The resolver makes the glossary's promise mechanical: an undefined load-bearing term is not yet a
rule, and a defined one has exactly one live meaning shared by the build, the code, and the model
briefing.

**Structured references are the source; typography is a rendering.** A rule entry and a
required-fact entry carry their term references as structured data — the term ids they lean on —
and the rendered markdown's italics and backticks are generated *from* those references. The
resolver walks references, never formatting, so an author cannot introduce a load-bearing term
the build cannot see by leaving it unstyled (P3-NF-10: a term reference with no live entry fails,
naming the use sites). The honest residual is inherited and named: prose can still *use* a
defined term without referencing it; the resolver greps rule statements and fact descriptions for
unreferenced occurrences of known term names and warns — human review of governing prose owns the
rest, as the glossary already assigns.

**Derived adjectives are computed, not judged.** An `adjective` entry's `derivedFrom` is data — a
rule over profile fields. The resolver evaluates it against each entry's declared profile, and
*significant*, *critical*, *user-facing*, *irreversible* are outputs; a derived word asserted
anywhere it is not computed fails (P3-NF-11).

**One kind value, renamed.** The glossary's term kinds were `adjective`, `fact`, `noun`,
`standing`. Part two surfaced the homonym — `fact` the term-kind collides with `fact` the record
— and the operator approved routing the rename. This pull request carries it: the kind value is
now **`field`**, amended in the glossary through its version chain, with part one's two affected
term rows updated in the same change. The resolver recognizes only `field`; the superseded value
survives in history, and nowhere else (P3-NF-12, a decode refusal like its closed-list siblings).

**Rule — every load-bearing term resolves, both ways.** Rule 69; the glossary's finding-4
machinery; rule 90 for the supersedes chain. **Check:** P3-NF-10; the generated `usedBy` on each
term entry; the supersedes walker shared with every governing chain (P2-NF-42/43 unchanged).

**Value — dead terms warn, missing terms fail.** A missing definition makes a rule unenforceable
now; an unused definition is clutter whose removal deserves a decision. The asymmetry is chosen.

---

## The rule graph

The graph is rule 69 made mechanical over the whole constitution — with the glossary's own
asymmetry kept, because it was a design decision, not an accident: **the holder side is declared,
the rule side is derived.** A holder's `holds` names the rules it enforces, with an honesty class
and evidence per edge; a rule's `enforcedBy` is computed from every holder that names it — a rule
does not get to claim children. The walker fails a `holds` citation naming a rule that does not
exist, and renders — never fails — a rule whose derived `enforcedBy` is empty, because that is
what `gap` means (P3-NF-13, restated for the declared side only).

**Every edge carries an honesty class, and `held` shows its review state.**

| Class | Meaning |
|---|---|
| `held` | The holder can fail for this rule; the failing fixture, probe, or record is named. Every `held` edge also carries `semanticallyReviewed: <generation or never>` — and the coverage report's **totals never merge the two**: `held-reviewed` and `held-unreviewed` (`held*`) are separate counted columns beside `partial`, `deferred`, and `gap`, so mechanical holding cannot inflate a headline number from the first day, not merely after part nine ships. |
| `partial` | The holder covers a named portion; the remainder is a sibling edge or a named gap, carried on the same `holds` declaration. |
| `deferred` | The holder is a named later part — validated against the declared part plan (an unknown part number refuses), with the loop entry's `dueBy` bound to that part's landing **and to a calendar ceiling**: when the named part lands, every edge deferred to it must flip to `held`, `partial`, or an honest `gap`, or the build fails — and a part that never lands cannot park the rule forever, because the ceiling date is compared by the deadline walker like any other and a passed ceiling fails the build the way a passed rule deadline does (P3-NF-24 covers both arms). Deferral is honest the way a feature gate is — it has a deadline, not just a cadence. |
| `gap` | Not an edge at all, structurally: a **synthetic rule-side record** the generator emits for every rule whose derived `enforcedBy` is empty — there is no holder to declare it, so nothing declares it; it is computed. Its loop entry is generated with it, from the rule's own deadline. Reconciled with the approved rule-book machinery rather than replacing it: a rule with empty `enforcedBy` must carry a **future deadline**, and a past deadline *fails the build* — so a `gap` builds only while its rule's deadline is in the future; the 20-of-92 number is a permanent, current dashboard fact *within deadlines the operator set*, never an indefinitely tolerable one. |

**The can-fail test is the edge's admission bar — split by what each stage can see.** A `held`
edge must name its failing evidence, and evidence must be *wired*, not merely present: the walker
verifies a named fixture exists at its declared stage **and appears in the check-run records of
the current branch's runs** — a fixture no run has ever executed is named but not wired, and the
edge renders **`declared`**, a mark below `held*`, until a run record carries it (P3-NF-28); a
named probe declares its cadence; a named sentinel *has a declared freshness probe*. What a tree cannot verify — that the sentinel actually ran within its
window — is runtime state, and a build that read it would be non-hermetic and machine-relative;
that check belongs to the runtime guard-posture holder the big picture's §7 names (part nine),
whose verdicts feed the coverage report's rendering, never the build's exit code (P3-NF-14 covers
the tree-checkable claims; P3-NF-25: a `held` edge citing runtime evidence with no declared
freshness probe). The *semantic* adequacy of a held edge — the fixture genuinely covers the rule
— is the retrospective review's duty, declared as a duty-of-observation entry whose proof
artifact is the per-generation review record and whose cadence covers every `held` edge within a
stated window; until that duty's holder ships, every `held` edge honestly renders `held*`.

**The CI record is a fact kind, designed here.** Part two named it a part-three deliverable, and
the graph needs it: a `held` edge whose evidence is a CI check resolves to **check-run-record**
facts — kind-registered per part two, carrying the subject commit and branch, the provider's run
reference, the outcome, and the clock measurement — append-only like everything on the spine, so
rule 112's green-history preservation has its record and a history-erasing redo is expressible
only as a retraction with its reason. The kind's schema is a shape entry this part seeds.

**Rule — references run from both ends, with an honesty class.** Rules 69 and 26; rule 8 (every
`gap` and `deferred` edge is also a loop entry — generated, with its deadline, **an owner** (the
standing route accountable for it), and the expected overdue action, so a passed deadline fails
the build at a named door rather than freezing everyone's work anonymously).
**Check:** P3-NF-13, P3-NF-14, P3-NF-24, P3-NF-25, and the loop-entry cross-check (P3-NF-15,
covering `gap` and `deferred` alike).

**Value — gaps are loud and cheap to declare, within deadlines.** Forcing every rule to `held`
before building would force dishonest edges, which is the disease; letting gaps rest forever
would be 1.x with better bookkeeping. The reconciliation — cheap to declare, impossible to keep
past its rule's deadline — is chosen.

---

## The six routed amendments, executed atomically

Part two surfaced three constitutional amendments and the operator approved routing them; this
part's own review surfaced three more that its holder-graph and profile designs require of the
parents — a redesign a part builds must be propagated into the documents it rewrites, or the
corpus contradicts itself. All six ride this pull request through their documents' own version
chains, and the bundle is
**atomic**: one approval event covers part three and the amendments together, and striking any
item returns the whole pull request to review — there is no partial merge of a reviewed bundle
(the approval binds to exact content, so this is rule 82's binding restated, not new machinery).

**Amendment one — rule 4 gains its third category, as a reference rather than an adjective.**
The category is **deterministic enforcement of recorded governed state**, and admission into it
is checkable, not claimable: a blocking-site entry declaring `decidesAlone: governed-state` must
carry a companion required fact, `enforces` — a resolvable reference to the governed record it
enforces (a register entry, fact kind, or schema, whose own version chain shows its approval) —
and must name the part-one decoder that implements the exact test. A `governed-state` site naming
no record, or naming one its code does not read, refuses (P3-NF-26); and the enforced record's
writes must require standing that the site's **executing principal** — the system principal the
site runs under — does not hold and cannot be granted short of the operator, so a site can never
enforce a record it can also author — deterministic enforcement of one's own blocklist is the
censorship shape this bound exists to refuse (P3-NF-27, whose test is a standing comparison
between two named principals, never a property of code). Applied to `01-the-rules.md` rule 4's row and the
register document's kind-2 table, which also gains the per-rung sub-declaration rule: a
multi-rung boundary is one entry whose `decidesAlone` is carried per rung, exactly as part two
already carries `failDirection` per consumer — and part two's admission declaration is amended in
the same change (`ruled-three` for the secret-scan rung, `governed-state` for the rest),
superseding its pre-amendment `yes`, with its changelog entry riding this PR's two-phase landing.

**Amendment two — the glossary kind `fact` becomes `field`.** As designed in the resolver
section; applied to `03-the-glossary.md` and part one's two affected term rows.

**Amendment three — the register's `growth` list gains `redacts`.** Part two's capture store
declared it and formally proposed it; the closed list in the register document now carries it:
`redacts` — deletes bytes only under an operator-standing tombstone fact, with the envelope,
hash, and redaction record retained. Without this the approved part-two register table cites a
value the closed list lacks, which this part's own P3-NF-05 would refuse.

**Amendment four — `enforcedBy` derives from `holds`, not from `standards`.** The glossary's
rules kind derived `enforcedBy` from every entry whose `standards` names the rule — under which
anything *governed by* a rule counts as *enforcing* it, nearly every rule reads enforced, and
the deadline check never bites: the exact coverage inflation this part exists to kill. The
glossary's bullet and the register document's `standards` row are amended so governed-by and
enforces are different facts with different sources, and only `holds` mints edges.

**Amendment five — the glossary profile gains `repeats`.** Part one's approved `Profile`
already carries five fields; the glossary's table carried four, with boundedness living in the
runaway rule's prose. The table now carries `repeats` (`no` / `bounded { by }` / `unbounded`) as
a declared, closed-list fact — the runaway rule's subject made checkable at the field, which is
what P3-NF-06 refuses against.

**Amendment six — the sentinel kind's facts align with the graph.** `watches` becomes `holds`
(one vocabulary for enforcement, both directions resolving as before), and `lastRan` — runtime
state no deterministic generator can consume — becomes `freshnessProbe`: the build checks the
probe is declared, the runtime guard-posture holder checks it fires. The dark-guard check the
old fact wanted is kept, and moved to the stage that can actually run it.

**Rule — an amendment is a version, never an edit.** Rule 90. **Check:** each amended document's
changelog entry lands in this pull request with `approvedIn` in the `pending-landing` state and
is completed by the landing step; the supersedes walker holds; the governed-document checks
pass. A document's status line states the latest *approved* version's status — a pending entry
in its changelog never flips it, and the completion diff cannot touch status prose (P3-NF-22's
shape excludes it), so an approved document carrying a pending bundle entry reads approved,
honestly, until the bundle lands.

---

## Multi-machine posture

Stated explicitly, as rule 113 requires — including an honest limit a naive reading would miss:

- **The generator is machine-independent over named inputs.** Same C, same E → same bytes and
  hash everywhere (P3-NF-07, two architectures). What *is* machine-relative is a machine's
  ability to *produce* a current E from its own spine replica: the extract's vector states the
  horizon, a register generated at a stale horizon says so on its face, and authority-bearing
  consumers apply part two's staleness rule to it — nothing silently diverges, but "nothing
  machine-local exists here" would be false and is not claimed.
- **Renderings are generated locally, pinned globally** — the generation hash in every
  rendering's header is what makes two machines' briefings comparable, and the runtime freshness
  checks that feed the coverage report read the spine with part two's staleness semantics.
- **The chain extract rides the repository; the record rides part two's replication.** The
  extract is a mirrored, committed projection of spine facts — disposable and regenerable like
  any projection, never a second authority: a divergence between extract and spine is resolved by
  regeneration from the spine, and the landing lint refuses an extract edit outside the
  completion step. The verification loci are named honestly, and so is their authority: CI,
  holding only the repository, verifies shape and lint — and a repo-only generation is therefore
  a **shape verdict, explicitly non-authoritative**: it can fail a pull request but can never
  mint an entering-force record, so a merge blesses the shape and nothing more. The
  generation-record fact that gives a generation force is appended only by a spine-holding
  machine that has verified the extract's rows against the spine — the same machines whose
  register decoders compare on every generation they consume, where P3-NF-23's
  "unverifiable vector" verdict actually runs. A false extract can thus waste a merge; it cannot
  govern anything.

---

## One sentinel, worked end to end

Adding a watcher, walked once through every mechanism above. An author writes the sentinel and,
beside it, its declaration: kind `sentinels`, the required facts (`holds: rule 24` with class
`held`, its fixture named; `freshnessProbe` naming its probe entry; `scope`, `authority`), the
five-fact profile, `standards: 9`. The governed port refuses to construct the sentinel without
the declared id, so the code cannot ship undeclared. At decode, the declaration's facts check
against their closed lists; at build, the `holds` citation lint-checks against the
enforceable-subject row for sentinels, the fixture is verified to exist at its stage, and the
freshness probe is verified declared; at generation, the id is checked unique and unresurrected,
and the entry appears in the register diff the pull request carries — its `approvedIn` and
`landedIn` in `pending-landing`, visible to the reviewer beside the code. The rule graph gains a
declared holder edge for rule 24; rule 24's derived `enforcedBy` becomes non-empty, and if this
was its first holder, its `gap` record and generated loop close. The merge lands; the landing
machinery's system principal appends the version-chain and generation-record facts; the
completion commit fills the pending fields and the extract rows, and nothing else. The next
coverage report renders the edge `held*` — mechanically verified, awaiting semantic review — and
the runtime guard-posture holder begins checking that the probe actually fires. Every step names
the machinery that performed it, and no step asked anyone to remember anything.

---

## What is rejected where

Refusals surface at the stage that can see them, in a stable order. At decode, through part
one's boundary: unknown kind (against the shape entries), missing required fact, closed-list
violation (the superseded `fact` kind-value included), an `attention` profile with an unbounded
or unnamed repeat. At build, where the tree is visible: the sweep, over-claiming `holds`,
unanchored `governed-state`, unresolved term references. At generation, where the register and
record are visible: duplicate or resurrected `id`, unresolvable references, incomplete inputs,
unrecorded generations. At landing: completion commits exceeding their permitted shape. The
refusal output names the declaration site: the point of declaring beside the thing is that the
failure lands where the author is.

---

## The negative contract fixtures

Continuing the cross-part convention: **P3-NF-nn**, each with its stage (`decode`, `build`,
`test`, `arch` as in part two; `generation` for checks that run when the register is generated;
`landing` for the completion step's lint).

**Rule — the fixtures are the contract.** Rules 34, 36, 37, 69. **Check:** as parts one and two.

| # | Stage | Shape | Refused/failed because |
|---|---|---|---|
| P3-NF-01 | build | A committed register, extract, or rendering differing from a fresh generation, outside the sanctioned landing completion | Generated means generated; the one exception is defined and lint-shaped. |
| P3-NF-02 | decode | A declaration missing a required fact of its kind | Required means refused, not warned. |
| P3-NF-03 | decode | A declaration whose kind is absent from the shape entries | The shape-change flow is the only door. |
| P3-NF-04 | build | A governed-port construct with no declaration in the tree | The sweep; the ports themselves demand a declaration id by type. |
| P3-NF-05 | decode | A required-fact value outside its closed list | Closed lists are what make declarations checkable. |
| P3-NF-06 | decode / generation | An `attention` profile with `repeats: unbounded` or an absent bound reference (decode); a bound reference that does not resolve (generation) | The glossary's runaway rule, made refusable at the field — absence is visible to a decoder, resolution needs the register. |
| P3-NF-07 | test | Two generations at one (C, E) differing across machines or architectures | Deterministic over both named inputs, not over a commit alone. |
| P3-NF-08 | decode | Register content reaching a consumer whose canonical hash differs from the generation it was loaded under | The register decoder at part one's boundary — verification at use, not only in a harness. |
| P3-NF-09 | build | Kind or fact validation reading constants not generated from the shape entries | The shape's authority is the register. |
| P3-NF-10 | build | A structured term reference with no live term entry | An undefined term is not yet a rule; references, not typography, are the source. |
| P3-NF-11 | build | A derived adjective asserted rather than computed from a profile | The word is derived or it is nothing. |
| P3-NF-12 | decode | A term entry declaring the superseded kind value `fact` | The rename is total in the live set. |
| P3-NF-13 | build | A `holds` citation naming a rule that does not exist | The declared side must resolve; the derived side renders. |
| P3-NF-14 | build | A `held` edge naming a fixture absent at its stage, or a probe with no declared cadence | The tree-checkable half of the can-fail bar. |
| P3-NF-15 | build | A `gap` or `deferred` edge with no loop entry | Uncovered rules re-surface; they do not rest in a report. |
| P3-NF-16 | generation | Two declarations claiming one `id` at one commit | A silently-won duplicate is a forged entry that passed every decode check. |
| P3-NF-17 | generation | An `id` matching a retired or superseded entry without a declared supersession | A resurrected name must not inherit a dead entry's history-free reputation. |
| P3-NF-18 | build | A `holds` citation for a rule the entry's kind may not enforce per the enforceable-subject table | Governed-by is not enforces; the enforceable-subject shape data is the lint table, never the unblocks headers. |
| P3-NF-19 | build | A bound entry cited by a profile that no construct pairs with | A cap in dead code bounds nothing. |
| P3-NF-20 | build | A kind's documented cross-field invariant with no decoder invariant implementing it | The per-kind invariant layer is named, so its absence is checkable. |
| P3-NF-21 | generation | A generation hash passed as input that no recorded entering-force fact matches | A pin is anchored in the record, or it is a name. |
| P3-NF-22 | landing | A completion commit whose diff exceeds pending-field and extract-mirror completion | The zero-authority step has exactly one permitted shape. |
| P3-NF-23 | generation | A generation attempted over a partial checkout or an unverifiable extract vector | An incomplete input refuses; it never yields a smaller register. |
| P3-NF-24 | build | An edge deferred to an unknown part, still deferred after its named part landed, or past its calendar ceiling with the part unlanded | Deferral has a deadline in both arms, like every dark feature. |
| P3-NF-25 | build | A `held` edge citing runtime evidence with no declared freshness probe | The build checks declarations; the runtime holder checks freshness. |
| P3-NF-26 | build | A `governed-state` blocking site naming no enforced record, or whose named decoder its code does not invoke | Admission to rule 4's third category is a reference, not an adjective; reference presence refuses at decode via the required-fact machinery, the invocation check runs where code is visible. |
| P3-NF-27 | build | A `governed-state` site whose enforced record is writable under the site's own standing | A gate must not enforce a list it can author. |
| P3-NF-28 | build | A `held` edge whose named fixture appears in no check-run record of the branch | Named is not wired; unexecuted evidence renders `declared`, below `held*`. |
| P3-NF-29 | build | A kind rendered as completely enumerated under a residual-heavy enforcement boundary | The boundary declaration is what keeps coverage denominators honest. |
| P3-NF-30 | decode | A family declaration citing a runtime-only instance source | Family enumeration is deterministic over the generator's inputs, or it is the port's job. |

---

## The terms this part introduces

| Term | Kind | Definition |
|---|---|---|
| **declaration** | noun | The constitutional value, authored beside a governed thing (in code, or in data beside a document), from which its register entry is generated. Carries only what the author alone knows. |
| **register generation** | noun | The content hash of a generated register, carried with the commit and extract vector that produced it, recorded at entry into force, and verified by the register decoder wherever content is consumed. |
| **chain extract** | noun | The committed, repository-mirrored projection of the version-chain record the generator consumes, pinned by a fact-position vector. Disposable and regenerable from the spine; never a second authority. |
| **landing completion** | noun | The mechanical, zero-authority post-merge step that fills `pending-landing` fields and extract rows — the only sanctioned diff against a committed generation. |
| **pending-landing** | noun | The declared state of landing-dependent facts inside a pull request: visible, reviewable, incomplete by design, completed at landing. |
| **rendering** | noun | A generated document over register entries — the capability briefing, the glossary, the rule book, the coverage report. Editing one fails regenerate-and-compare. |
| **rule graph** | noun | The map between rules and holders: holder side declared via `holds`, rule side derived, every edge classed. |
| **honesty class** | noun | The declared strength of a holder edge: `held` (with its review state), `partial`, `deferred` (part-bound deadline), or `gap` (within its rule's deadline). |
| **per-kind invariant layer** | noun | The decoder invariants implementing each kind's documented cross-field checks. |
| **governed port** | noun | The typed constructor through which alone a governed thing can be built, whose signature demands a declaration id. |
| **check-run record** | noun | The append-only fact kind carrying a CI check's subject, provider reference, outcome, and clock measurement — rule 112's record. |

---

## What this part makes checkable

The register document promised 21 rules move to checkable — 4, 7, 8, 9, 32, 33, 34, 36, 38, 39,
43, 56, 57, 62, 66, 72, 73, 76, 79, 82, 86 — and this part is that machinery, with each rule's
home component named rather than waved at: single-fact and closed-list checks land as declaration
decode refusals; conditional checks (7's memory-and-deletes, 39's empty metrics, 62's liveProof,
72/73's gate) land in the per-kind invariant layer; enumeration completeness (4, 66, 86) lands in
the sweep plus the governed ports; agreement and scope (32, 33) land in the generated entries
part two's fixtures already test; and the **time-dependent checks** — 56's verification windows,
72/73's deadlines, the `gap` deadlines — land in a named **deadline walker**: a build-stage check
that takes `now` as an explicit argument in part one's convention, runs beside the generator, and
never writes into the register bytes, so determinism (P3-NF-07) and time-awareness coexist
instead of contradicting. Rules 78 and 84 become free (the briefing is a rendering). Rule 69
moves to held globally, with the honesty classes and the `held*` rendering keeping the report
from becoming the lie it replaces. Rule 90's generator is built here for every governing kind;
rule 112 gains its check-run record; rule 26 gets its subject in both the anchored generation and
the report's verified-not-asserted edge states.

What this part does not hold, named: the semantic adequacy of `held` edges (the retrospective
duty, part nine — rendered as `held*` until then); the runtime freshness holder (part nine); the
external anchor for protected-artifact enforcement (parts nine and eleven, carried from part
two); dynamic-path constructs the sweep cannot see (the retrospective review's residual).

---

## What I want from you on this document

1. **The register is a committed, generated file with a two-phase landing.** Reviewable diffs
   and a doctored-copy check, at the cost of merge noise plus the pending-landing machinery.
   Right trade?
2. **Gaps live within deadlines you set.** A `gap` builds while its rule's deadline is in the
   future — the approved glossary machinery — and a past deadline fails the build. The red count
   is permanent and current, but never indefinitely tolerable. Accept?
3. **Dead terms warn; missing terms fail.** The asymmetry as designed. Right line?
4. **The six amendments ride this pull request atomically.** One approval event covering the
   three routed from part two and the three this part's own review surfaced; striking any item
   returns the whole to review. Confirm this as the standing convention for routed amendments?
5. **The author-supplied surface is minimal by design.** Authors declare only what the build
   cannot know; everything else is generated and unfakeable. Accept the split, with its generator
   complexity?
6. **`governed-state` requires separation of powers.** A gate may only enforce a record it
   cannot author (P3-NF-27). This is stricter than the amendment's minimum reading and closes
   the self-authored-blocklist shape. Keep the stricter line?
7. **The toolchain is protected from day one.** Generator, resolver, walker, encoder, and
   fixtures on the protected-artifact list — every change to a checker asks you, within the
   rare-approval scope, because those files are the constitution's teeth. Accept the added
   approval surface?

---

*Depends on: the approved rules, register, glossary, big-picture design, parts one and two, and
their changelogs. Next after approval: part four, intake and identity/standing resolution.*
