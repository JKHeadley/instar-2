# Step three — the glossary: the words the rules lean on

**Status: approved. Governed.**

Step one, finding 4: a rule that uses an undefined load-bearing term is not yet a rule. Five
rules hinge on *significant*, *critical*, and *user-facing*; the register (step two) added
*irreversible*. None is defined anywhere in 1.x, and 1.x's own registry says so in writing.

This document defines them. It also defines the handful of nouns the register's required facts
use, because a required fact that leans on an undefined noun is the same failure one level down.

---

## The design decision: don't define the adjectives, derive them

The obvious approach is to write a paragraph for each word — *"a feature is significant when…"*
— and ask authors to judge. That is how 1.x ended up with "a pipeline is critical when its author
says so," which the registry admits verbatim. An adjective judged case by case is a value dressed
as a rule.

The alternative, which 1.x designed but never built, is this: **every governed thing declares a
small profile of plain facts, and the adjectives are computed from the profile.** An author never
answers "is this significant?" They answer five narrower questions that have real answers, and
the word follows. The build can check the profile is complete; the word is then never argued
about, because it was never declared — it was derived.

The profile has five facts. Each is a closed list, so a declaration is checkable.

### The profile

| Fact | What it asks | Allowed values |
|---|---|---|
| `consequence` | What kind of thing goes wrong if this fails or misbehaves? | `none` · `attention` (a person is bothered — **bounded**: a finite number of times, and they can still use the channel) · `data` (something stored is lost or corrupted) · `money` (spend, quota, or billing) · `identity` (who someone is, or what they are allowed to do) · `control` (a session, run, machine, **or channel** starts, stops, moves, or stops being usable) · `security` (a secret, or access to one) · `external` (an effect outside the system — a message sent, a PR merged, a payment made) |
| `reversibility` | Once it has happened, can it be undone? | `reversible` (a later action fully reverses it) · `costly` (reversible, but with real cost or delay) · `irreversible` (no action reverses it — a sent message, a deleted secret, a spent dollar) |
| `reach` | Who or what does it touch? | `internal` (only the system's own state) · `agent` (the agent's own behavior or memory) · `user` (something a person sees, receives, or must do) · `operator` (something that needs a decision from whoever holds operator standing) · `world` (a third party or external service) |
| `surface` | Where does a person meet it, if anywhere? | `none` · `chat` (Telegram, Slack, any conversation channel) · `dashboard` · `link` (a page the agent sends) · `device` (a phone notification, a terminal) |
| `repeats` | Can the failure recur before anyone can stop it? | `no` · `bounded { by }` (naming the declared cap, coalescer, or breaker that bounds it) · `unbounded` — the runaway rule's subject, made a declared fact: `attention` with `unbounded` is not an honest combination |

Every entry in the register of kind *feature*, *blocking site*, *judgment point*, *critical
outcome*, *operator action*, or *parser* declares all five. A missing one fails the build —
an intake adapter's runaway case is a flood, and its bound entry is load-bearing.

*Why `reversible`.* The field is `reversibility` and the rule's word is *irreversible*; the
allowed values read as answers to the field and as the plain opposite of the rule's word, so
there is one vocabulary, not two.

### The runaway rule

A profile describes **the worst case the code can produce before anyone can stop it**, not the
single occurrence. Anything that repeats — a retry, a poll, a notifier over a collection, a loop
in the register's kind 5 — is profiled for its runaway, not for one iteration.

This is what makes a flood come out right. One unwanted notice bothers a person: `attention`,
bounded, not critical. A notifier that can post once per element, or once per tick, until the
channel is unreadable has **not** bothered them — it has taken the channel away, which is
`control`, and `control` is critical. The author does not get to declare the single-notice case
and hope; the profile asks what happens at N, and if N is unbounded the answer is not `attention`.

**Test.** If the failure can happen more times than a person could stop it, profile the
many-times case. If `attention` is the honest answer, say what bounds it (a cap, a coalescer, a
breaker) — that bound is itself a governed thing, and it is what keeps the word honest.

1.x learned this three times over (the 2026-05-22, 05-28, and 06-05 topic floods) and answered
with a ceiling at the topic-creation primitive. Here the ceiling is where it belongs: a repeating
code path with no declared bound cannot honestly claim `attention`, so it cannot escape *critical*.

---

## The four load-bearing words, derived

### Irreversible

**Definition.** A thing is *irreversible* when its profile says `reversibility: irreversible`.

That is the whole definition. It is a declared fact, and it is the one word in this glossary
that is *not* derived from a combination — it is a direct field, because reversibility is
something an author genuinely knows about their own change and nothing else can infer.

**Used by.** Step one's rule on when review is live ("only when the moment is irreversible"); the
register's judgment points (an irreversible allowed action needs a higher bar); rule 57's floor.

**Test.** If you cannot name the action that undoes it, it is irreversible. "We could restore
from backup" names an action; "we'd apologize" does not.

### User-facing

**Definition.** A thing is *user-facing* when `reach` is `user` or `operator`, **or** `surface`
is anything but `none`.

**Used by.** Rule 62 (live-user-channel proof before done), rule 76 (user-facing fixes ship
live), the register's `userFacing` and `liveProof` facts.

**Consequence of the definition.** A fix to a log format is not user-facing. A fix to what the
agent says in chat is. A change to the dashboard is, even if nobody has opened that tab. A change
to which machine serves a conversation is — the user meets it as a pause — and this is deliberate:
1.x classified several such changes as internal and shipped them dark, and users met the gap.

### Critical

**Definition.** A thing is *critical* for verification when, read
from its profile: its `consequence` is `identity`, `security`, `money`, `control`, or `external`,
**or** its `reversibility` is `irreversible`, **or** its `reach` is `world`.

These are verification risks, not sign-off conditions. The profile describes the worst failure
an operation can produce; it does not contain the person's current role, spending level or
sensitive-matter designations. `world` is reach, not proof of being outside a granted role;
`money` is a resource consequence, not proof of exceeding the person's level. Irreversibility
alone is not a sign-off condition. The effect doorway checks the purpose's five conditions
against the actual operation and current standing grants. Testing, supervision, durable cause,
secret protection, the spend cap and emergency stop keep their own requirements.

**Used by.** Rule 38 (every critical pipeline has a model watching each step), rule 43 (every
critical outcome has a live probe), the register's *critical outcomes* kind.

**What it excludes, on purpose.** A feature whose failure bothers the user a bounded number of
times (`consequence: attention`) and that can be undone is not critical, however visible.
Visibility is *user-facing*; verification risk is *critical*. 1.x blurred these, which is why the alerts
channel was treated as critical and the secret store was not.

**What this includes.** A failure that makes a channel unusable — a flood, a notifier with no
bound — is `control` under the runaway rule, and therefore critical. A single flood message
merely bothers; the flood takes the interface away, and taking the interface away *is* damage.
Anything declared `irreversible` is critical for verification whatever its consequence. A one-shot
notice inside the granted role remains ordinary for sign-off when none of the five conditions
holds; its irreversibility still requires durable cause and appropriate verification.

### Significant

**Definition.** A thing is *significant* for verification exactly when it is *critical*. A feature
is significant when at least one of its effects meets the critical verification profile.

In words: anything whose effect meets that verification profile. Being seen by a person is *user-facing*, which
carries its own obligations (live-surface proof, fixes ship live); it does not by itself make a
thing significant.

**Used by.** Rule 34 (every significant feature has all three test tiers), rule 48's tier signal.

**What it excludes.** Work outside that verification profile: reversible, bounded, within scope,
touching no policy-governed matter — a refactor, a cache, a log line, a reversible display change. Those get
unit tests and a review; they do not pay for integration and live end-to-end proof. A user-facing
ordinary change still needs its live-surface proof under rule 62.

### The four together

| | Not user-facing | User-facing |
|---|---|---|
| **Not critical for verification** | unit tests, review | *user-facing* — live proof through its surface before done, fixes ship live |
| **Critical for verification** | *critical and significant* — three tiers, supervised, probed | *critical and significant* — all of the above, and fixes ship live |

Add *irreversible* as a flag on any cell: it raises the review to live and the judgment floor to
its strictest.

### Consequential and ordinary

**Definition.** For sign-off, a *consequential* effect is one on the purpose's short, fixed list:
it commits money or a resource above the person's named level; it cannot be undone and falls
outside the agent's role; it speaks publicly in the person's name; it widens the agent's own
role or authority; or it touches a matter the person marked as sensitive. Everything else inside
the granted role is *ordinary*, including messages and use of the accounts that go with it.

**Test.** A message inside the role with none of these conditions needs no prompt. Public speech
in the person's name needs sign-off even when the account is granted. An irreversible action
inside the role does not need sign-off solely because it cannot be undone; the same action
outside the role does. Spending below the named level does not trigger the resource condition;
spending above it does. A sensitive matter or widening the agent's authority triggers sign-off
independently. An action outside every grant is refused and names the grant needed; absence
from the sign-off list never supplies missing standing.

**Used by.** The purpose's onboarding and sign-off rules and the effect doorway's classification.
The verification adjectives above do not grant authority or add sign-off conditions.

---

## The nouns the register leans on

Shorter, because these are less contested — but each was used in steps one and two without a
definition, and the rule applies to us too.

**Governed thing.** Anything with an entry in the register. If it is not in the register, no
rule that says *every X* applies to it — which is a gap to fix, not an exemption to enjoy.

**Store.** Any place state outlives the process that wrote it: a file, a database, a keychain
entry, a remote service the system writes to. In-memory state is not a store. (Rules 7, 32, 33.)

**Feature.** A capability the system offers that has a name a person could ask for. A module is
not a feature; "private views" is. The test: could it appear in the agent's own briefing as
something it can do? (Rules 34, 39, 62, 72, 76.)

**Blocking site.** Any point in code where a decision can prevent something from proceeding —
a message from sending, a session from starting, a change from merging — without a model
reasoning about it first. A site that only *records* or *flags* is not a blocking site; it is a
signal. (Rules 4, 66, 86.)

**Sentinel.** A background intelligence with one declared responsibility, its own record of
having run, and a scope of *live* or *retrospective*. A scheduled script with no model behind it
is a check, not a sentinel. (Step one, held-by-the-mind; the register's kind 11.)

**Dark.** A feature that is built and shipped but switched off by default. Dark is a *status*
with a *deadline*, never a resting state. (Rules 72, 73.)

**Done.** A feature is done when its register entry is `live`, its profile is declared, its
required facts are present, and — if user-facing — its live proof exists. "Done" said in chat is
a claim; "done" in the register is a fact. (Rule 62, and step one's "merged is approved".)

**Approved.** For a document: merged to main. For an operator action: the structured request has
the recorded decision of someone with operator standing for it. There is no third form. (Step
one, PR #1.)

### People, and what they may decide

Two readings of *operator* pull against each other: "the one verified person" and "every operator
is a user," which reads as many. Both are half right, and the half each is missing is the same
thing: **operator is not a person, it is a standing** — something a verified person *holds* in a
scope, not something they *are*. Once that is said, the rest falls out, and the employee question
has a real answer.

**Principal.** Any verified party the agent serves, acts for, credits with a decision, or takes a
request from. A person, or another agent. *Verified* means resolved to a known identity from an
authenticated channel — never from a name that appears in content. An unverified party is not a
principal; it is a question to resolve. (Rule 28, and the type that enforces it in step four:
there is no way to make a `VerifiedPrincipal` from a string.)

**Standing.** What a principal may decide, in a scope. Standing is *granted* — by the
organization's declared intent, or by a principal who already holds a standing that can delegate
it — and every grant is recorded, bounded to a scope, and expires or is revoked. A message can
*claim* standing; it can never *confer* it. The agent resolves standing from the record of
grants, exactly as it would check whether a colleague is allowed to ask for something: by the
org's rules, not by how the request is phrased or how senior the requester sounds. Three
standings are enough for the rules written so far:

| Standing | What it lets a principal do | Where it comes from |
|---|---|---|
| **operator** | Bind the agent: approve an operator action, grant or revoke standing within their scope, set the agent's intent. | The organization's declared intent names who holds it and for what; within a conversation it is selected by the authenticated sender within the recorded conversation binding — the binding itself is established only by a verified act, never by a message. |
| **delegate** | Take a named, bounded set of actions the operator (or the org) has explicitly granted, for a term. | A recorded grant — 1.x's coordination mandate is the ancestor. The grant names the actions; nothing outside it. |
| **requester** | Ask. The agent does the work its own standing already allows, and surfaces anything beyond it to whoever holds the standing to decide. | Being a verified principal at all. A colleague, a user, a peer agent. |

**Operator.** A principal holding *operator* standing for a scope. **In one conversation there is
exactly one** — the verified person the conversation is bound to. **Across the organization there
may be several**, each for their scope. Both are true once operator is a standing.

**User.** A principal the agent serves — any standing. Every operator is a user; a user with only
requester standing is a user the agent works *for* but does not take *binding* decisions from.

**How the employee question resolves.** Treating the agent as a regular employee is the right
frame, and this is what it implies. A request from another employee is a request from a
*requester*: the agent honors it to the full extent of its own standing, and no further — it does
not decline because the requester is not its operator, and it does not escalate the requester's
authority because they said "the boss wants this." When a request needs a standing the requester
lacks, the agent does not refuse and does not guess; it *routes* — the structured request goes to
whoever holds the standing, pre-filled, as rule 82 already requires for operator actions.
Hierarchy enters through grants, not through inference: a manager who should be able to direct
this agent is given the standing by the org's intent or by delegation, and that grant is the
fact the agent checks. An org chart the agent has to *infer* from names and tone is exactly the
unverified identity rule 28 forbids. The identity-bleed incident in 1.x (2026-06-05) is what it
looks like when an agent seats someone in the operator's chair from context alone; standing as a
recorded grant is the structural answer.

Two things this deliberately does *not* decide, because they are policy and belong in the
organization's intent document, not a glossary: *who* holds which standing, and whether a
delegate may sub-delegate. The glossary fixes the nouns so that document can be written in them.

---

## The terms registry

Each definition is itself a register entry. For that to be a real structure — typed entities,
allowed values, human-readable fields, versioned — rather than a figure of speech, the register
needs a kind for it, and step two's eleven kinds do not include one. This section adds it, and it
is a correction to step two: **the register gains a twelfth kind.**

### 12. Terms — *every word a rule or a required fact leans on*

Unblocks step one's finding 4 (an undefined load-bearing term is not yet a rule), mechanically.

| Required fact | Why |
|---|---|
| `name` — the term, as it appears in rules and facts | The key the resolver looks up. |
| `kind` — `adjective` (derived), `field` (a profile field or required fact), `noun`, or `standing` | Each kind has a different shape below; the build checks the shape. |
| `definition` — the human-readable definition, as prose | The agreed, versioned explanation a person reads and a model is briefed with. Required, and reviewed by a human on every change, because it is what the change *means*. |
| `derivedFrom` — for an `adjective`: the rule over profile facts, as data (`consequence in {identity, security, money, control, external} or reversibility = irreversible or reach = world`) | The definition of a derived word is a computation, and it is stored as one — so the resolver, the build, and the briefing all evaluate the *same* rule, and a prose definition can never drift from the one the code runs. |
| `allowedValues` — for a `field`: the closed list, each value with its own one-line meaning | What makes a declaration checkable. The one-line meanings are what an author reads when choosing. |
| `usedBy` — the rule numbers and register facts that lean on this term | Rule 69, references run from both ends: a term nothing uses is dead weight to remove; a rule using a term with no entry fails the build. Generated, not hand-written. |
| `supersedes` — the previous entry, when a definition changes | A definition evolves by *replacing* its entry through the approval flow, never by editing in place; the old one stays, dated. |
| `since`, `standards` | As for every kind. |

Three consequences, stated plainly because they are the point:

1. **This document is generated.** The glossary you are reading is the rendering of the term
   entries, the same way the capability briefing is the rendering of the feature entries (rule 84).
   Once approved, this markdown becomes the *first* set of term entries, and from then on the
   entries are the source and the document is the output. Hand-editing the output fails the build.
2. **A new load-bearing term is a build requirement, and a review requirement.** Your reading of
   the last section was exact: a change that introduces a term in a rule, a required fact, or a
   register declaration, with no entry in the terms registry, fails the build until the entry
   exists — and the entry is a register change, so it goes through the same pull request and the
   same human approval. The term therefore *cannot* land without a person agreeing on what it
   means, which forces it to be stated plainly enough to be agreed on. That is a review cost, and
   it is the cost we want: it is where a reader of a pull request gets the vocabulary to
   understand the change.
3. **The same definition reaches the code, the build, and the model.** A derived adjective is
   evaluated from `derivedFrom` by the resolver at build time and by the register at runtime; the
   session briefing is generated from `definition`; a sentinel or judgment point that needs to
   know what *critical* means reads the entry. One source, three consumers — the alternative is
   1.x's condition, where the word was defined nowhere and each consumer guessed.

An entry's `definition` evolving over time — the sentinel definition is the example you flagged,
and it will move as the pre-send review team teaches us what a sentinel is — is exactly the
`supersedes` chain: the new entry is proposed, reviewed, approved, and the old one stays visible
with its dates. Which definition was in force when a given rule was written is a lookup, not an
argument.


## History is a lookup

The sentinel definition will move; so will *operator*, and so, eventually, will rule 28. The
first two drafts handled that for terms alone (`supersedes`), and left the most fundamental thing
in the system — the rules — as a hand-written file with no version, no date, and no record of
what it said before an edit. That is the glossary's own failure one level *up*, and it is the
same failure 1.x carries: its constitution's changelog is a table someone remembers to append to.

Your question was whether a standard requires this. None does, in either rule book. So this is
one, proposed as **rule 90** and written here because the glossary is where the nouns it needs
were just defined.

> **Rule 90 — History is a lookup.** Anything that governs — a rule, a term, a register kind, a
> required fact, an entry — is versioned by construction. Each version carries when it began,
> what it replaced, and the pull request and commit that approved it, all generated from git,
> never written by hand. Nothing is edited in place: a change is a new version that supersedes
> the old, and the old stays. "What did this mean on a given date?" is a lookup, never an
> argument.

Git already is the version store and the merge commit already is the version id; the register
only has to record it instead of discarding it. So this costs two facts, and they join the
common set every entry carries regardless of kind (a correction to step two's "what every entry
carries"):

| Fact | What it is | Who supplies it |
|---|---|---|
| `supersedes` | The previous version's id, when this entry replaced one. Absent on a first version. | Generated: the entry with the same `id` in the parent commit |
| `approvedIn` | The pull request and merge commit that approved this version. | Generated from history |

`since` (already in the common set) is then the first version's `approvedIn` date, and a
retired entry keeps every version it ever had. The build refuses an in-place edit to a governing
entry that does not produce a new version, and refuses any `approvedIn` that is not a real merge
commit on main.

### 13. Rules — *every rule in the rule book*

The consequence of rule 90 for the rules themselves: to be versioned by construction they have to
be entries, so **the register gains a thirteenth kind, and the rule book becomes a rendering of
it** — the same relation the glossary has to the terms and the briefing has to the features. Once
approved, `01-the-rules.md` becomes the first set of rule entries, and from then on the entries
are the source; hand-editing the rendered book fails the build.

This also answers the second thing you asked: whether the relationships between standards should
be in the register. 1.x is the evidence that they must be. Its constitution *has* a tree — but as
sentences: "tree placement: root," "a tree node under *Know Your Principal*," "merged into
*Observable Intelligence* as a named subsection." One article records that it said "Extends" for
weeks, which "reads as parentage to a human and is invisible to every check." A script cannot
walk that tree, so nothing can catch a missing parent, a cycle, an orphan, or a merged article
whose tripwires quietly vanished. Relationships are facts, and facts go in the register.

| Required fact | Why |
|---|---|
| `number`, `name`, `statement` — the rule as it reads in the book | The rendered book is produced from these. `statement` is prose, reviewed by a human on every version, as a term's `definition` is. |
| `held` — `script`, `shape`, or `mind` | Step one's first question, as a fact per rule. A `mind` rule must name its sentinel (kind 11) or it is a wish. |
| `parent` — exactly one rule number, or `root` with a stated reason | The tree. 1.x already demands the reason for a root; it just cannot check that it was given. |
| `mergedInto` — a rule number, when this rule has been folded under another | A merged rule stays live and binding as a named subsection of its parent and keeps its own tripwires. 1.x's merge model, made checkable: the merged rule's enforcers may never be removed on the strength of the merge. |
| `deadline` — for a rule with no enforcer yet: the date by which one must exist | A documented-only rule is a countdown, not a resting state (1.x's `STD-COUNTDOWN` idea, as a required fact). A deadline in the past fails the build, exactly as a dark feature's does. |
| `since`, `standards`, `supersedes`, `approvedIn` | As for every kind. For a rule, `standards` names the rule(s) it derives its authority from — normally its parent. |

Derived, never declared — the same principle as the adjectives:

- **`children`** and **`siblings`** — from `parent`. A rule does not get to claim children.
- **`enforcedBy`** — every holder entry whose `holds` fact names this rule: enforcement is
  declared by the holder and derived on the rule's side, and an entry's `standards` (what governs
  it) never mints an enforcement edge — a store governed by rule 7 does not thereby enforce rule
  7. This is rule 69 from the rule's side: a rule with an empty `enforcedBy` and no `deadline`
  fails the build, because a rule nothing enforces is a wish that has stopped admitting it.
- **`usedBy`** — every term, fact, and rule that references this rule in prose.

Any other relationship — "sharpens," "distinct from," "extends," "pairs with" — is either one of
the declared facts above or plain prose in the `statement` with no structural weight. A
relationship the build cannot check is not a relationship; it is a remark, and the two drafts of
1.x's constitution that grew by remarks are the reason to say so.

**What the build checks over kind 13.** No cycles through `parent` or `mergedInto`; every `root`
carries its reason; every rule is either enforced (`enforcedBy` non-empty) or has a future
`deadline`; a merged rule's enforcers are a superset of what they were at the merge; and the
rendered book's tree matches the graph — a diff between them fails the build.

**What this changes in step one.** Its form, not its content: the eighty-nine rules become
eighty-nine entries (ninety, with this one), each with a `parent` — and writing the parents down
is the first real audit of whether the rule book is a tree or a pile. I expect a handful of
roots with reasons and at least one rule that turns out to be two. That audit is the next
document's work, not this one's; this document only fixes the shape it runs in.

---

## How the glossary stays true

1. **Every load-bearing term resolves.** A script walks every rule and every register fact, finds
   each italicized or backticked term, and confirms it has a term entry. A new term with no entry
   fails the build. This is step one's finding 4, mechanical.
2. **The derived words are never declared.** No register entry may carry a field named
   `significant`, `significance`, `critical`, or `userFacing` as a *declared* value; they are
   computed from the profile via `derivedFrom`. An author who wants a different answer changes the
   profile, and the change is visible. The register's `userFacing` **and** `significance`
   facts on features, from step two, both become derived columns — a correction to step two,
   noted there.
3. **Definitions have owners, dates, and history.** Each is a term entry with `since`,
   `standards`, and `supersedes`, so a definition is amended through the approval flow and its
   history is never lost.
4. **Standing is never inferred.** No code path grants a standing from content; the only sources
   are the recorded grants. (Rule 28, made a type in step four.)
5. **Nothing governing is edited in place.** Every term, rule, kind, and fact is a
   versioned entry with `supersedes` and `approvedIn`; the rendered documents — this one, the
   rule book, the register's own description — are outputs, and hand-editing an output fails the
   build. (Rule 90.)

---

## What this makes checkable

Rules 34, 38, 43, 62, 76 — the five step one named — become checkable the moment the profile is
declared on the relevant register kinds. These are verification floors, not an acceptance score.
The [purpose, constraint 6](00-the-purpose.md#the-six-constraints) states: “The rule count is a floor beneath that, never the score.”
A ready claim needs a recorded real conversation judged against mission, agency and self-knowledge.
The terms registry adds finding 4 itself to the checkable set, and the runaway rule gives the flood ceiling (1.x's bounded-notification standard) a
definition to enforce against rather than a primitive to guard. Rule 90 makes rule 69
checkable from the rule's side (`enforcedBy`), and turns "is the rule book a tree?" from a
reading exercise into a build check.

---

## What I want from you on this document

1. **Operator as a standing, not a person.** Exactly one per conversation, several across the
   org, granted and recorded, never inferred. Does this match how you want the agent to sit
   inside a team of people?
2. **Requester by default.** A verified colleague's request is honored to the agent's own
   standing and routed beyond it — never refused for not being the operator, never escalated on
   the requester's say-so. Right default?
3. **The runaway rule.** A repeating path is profiled for its worst case before anyone can stop
   it, so a flood is `control` and critical. Is "bounded" the right line for `attention`?
4. **The terms registry as kind 12, with this document generated from it.** That puts a human
   approval on every new load-bearing word. Is that the cost you want, everywhere it applies?
5. **Rule 90 and the rules as kind 13.** The rule book becomes a rendering of versioned
   entries, with `parent` / `mergedInto` declared and `children` / `siblings` / `enforcedBy`
   derived. This changes the *form* of step one. Do you want the rule book generated, and are
   those the right edges — or is there a relationship you'd want the build to know about that I've
   demoted to a remark?
6. **The deadline fact on rules.** A rule with no enforcer must carry a date, and a past date
   fails the build — the same treatment as a dark feature. Is that the right strictness for a
   rule book that is still being written?

---

*Depends on: `01-the-rules.md`, `02-the-register.md` (both approved 2026-08-23). Corrects step
two in three places: `userFacing` and `significance` on features are derived, not declared;
`supersedes` and `approvedIn` join the common facts; and the register gains kinds 12 (terms) and
13 (rules). Changes the form of step one: on approval, the rule book becomes a rendering of kind
13. Next: `05-the-types.md` — the five rules that become a mistake you can't express, including
`VerifiedPrincipal` and standing — and the parent audit of the rule book that kind 13 forces.*
