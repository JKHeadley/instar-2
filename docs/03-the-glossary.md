# Step three — the glossary: the words the rules lean on

**Status: draft, awaiting approval. Nothing is built on top of this until it is approved.**

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
answers "is this significant?" They answer four narrower questions that have real answers, and
the word follows. The build can check the profile is complete; the word is then never argued
about, because it was never declared — it was derived.

The profile has four facts. Each is a closed list, so a declaration is checkable.

### The profile

| Fact | What it asks | Allowed values |
|---|---|---|
| `consequence` | What kind of thing goes wrong if this fails or misbehaves? | `none` · `attention` (the user is bothered) · `data` (something stored is lost or corrupted) · `money` (spend, quota, or billing) · `identity` (who someone is, or what they are allowed to do) · `control` (a session, run, or machine starts, stops, or moves) · `security` (a secret, or access to one) · `external` (an effect outside the system — a message sent, a PR merged, a payment made) |
| `reversibility` | Once it has happened, can it be undone? | `undoable` (a later action fully reverses it) · `costly` (reversible, but with real cost or delay) · `irreversible` (no action reverses it — a sent message, a deleted secret, a spent dollar) |
| `reach` | Who or what does it touch? | `internal` (only the system's own state) · `agent` (the agent's own behavior or memory) · `user` (something a person sees, receives, or must do) · `operator` (something the operator must decide or authorize) · `world` (a third party or external service) |
| `surface` | Where does a person meet it, if anywhere? | `none` · `chat` (Telegram, Slack, any conversation channel) · `dashboard` · `link` (a page the agent sends) · `device` (a phone notification, a terminal) |

Every entry in the register of kind *feature*, *blocking site*, *judgment point*, *critical
outcome*, or *operator action* declares all four. A missing one fails the build.

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

**Definition.** A thing is *critical* when its `consequence` is `identity`, `security`, `money`,
`control`, or `external` — **or** when it is `data` and `reversibility` is `irreversible`.

In words: a failure that touches who someone is, what they may do, a secret, spend, the life of
a session or machine, or the world outside — or one that loses data for good.

**Used by.** Rule 38 (every critical pipeline has a model watching each step), rule 43 (every
critical outcome has a live probe), the register's *critical outcomes* kind.

**What it excludes, on purpose.** A feature whose failure merely bothers the user
(`consequence: attention`) is not critical, however visible. Visibility is *user-facing*; damage is
*critical*. 1.x blurred these, which is why the alerts channel was treated as critical and the
secret store was not.

### Significant

**Definition.** A thing is *significant* when it is *critical*, **or** *user-facing*, **or** its
`reach` is `world`.

In words: anything that can do real damage, anything a person meets, and anything that touches a
third party — whether or not it is dangerous.

**Used by.** Rule 34 (every significant feature has all three test tiers), rule 48's tier signal.

**What it excludes.** Purely internal, undoable, unseen work — a refactor, a cache, a log line.
Those get unit tests and a review; they do not pay for integration and live end-to-end proof.
That exclusion is the point of the word: it is where the process gets *cheaper*, and the derived
definition is what lets it be cheaper safely.

### The four together

| | Not user-facing | User-facing |
|---|---|---|
| **Not critical** | ordinary — unit tests, review | *significant* — three tiers, live proof before done |
| **Critical** | *significant* — three tiers, supervised, probed | *significant* — all of the above, and fixes ship live |

Add *irreversible* as a flag on any cell: it raises the review to live and the judgment floor to
its strictest.

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

**Operator.** The one verified person whose decisions bind this agent in a given conversation,
established from the authenticated sender — never from a name in content. (Rule 28.)

**User.** Any verified person the agent serves. Every operator is a user; not every user is an
operator.

**Dark.** A feature that is built and shipped but switched off by default. Dark is a *status*
with a *deadline*, never a resting state. (Rules 72, 73.)

**Done.** A feature is done when its register entry is `live`, its profile is declared, its
required facts are present, and — if user-facing — its live proof exists. "Done" said in chat is
a claim; "done" in the register is a fact. (Rule 62, and step one's "merged is approved".)

**Approved.** For a document: merged to main. For an operator action: the structured request has
the operator's recorded decision. There is no third form. (Step one, PR #1.)

---

## How the glossary stays true

1. **Every load-bearing term resolves.** A script walks every rule and every register fact, finds
   each italicized or backticked term, and confirms it has an entry here. A new term with no entry
   fails the build. This is step one's finding 4, mechanical.
2. **The derived words are never declared.** No register entry may carry a field named
   `significant`, `critical`, or `userFacing` as a *declared* value; they are computed from the
   profile. An author who wants a different answer changes the profile, and the change is visible.
   (The register's `userFacing` fact from step two becomes a derived column, not a declared one —
   that is a correction to step two, and it is noted there.)
3. **Definitions have owners and dates.** Each entry is itself a register entry (kind: *term*),
   with `since` and `standards`, so a definition can be amended through the approval flow and its
   history is never lost.

---

## What this makes checkable

Rules 34, 38, 43, 62, 76 — the five step one named — become checkable the moment the profile is
declared on the relevant register kinds. With steps one through three approved: **40 of 89** by
script, exactly as step two projected.

---

## What I want from you on this document

1. **Derive, don't declare.** The claim is that an author should never answer "is this
   significant?" — only the four narrower questions. Does that match how you want authors to
   think?
2. **The four profile facts and their allowed values.** Is anything missing from a list that
   would make a real change hard to classify honestly?
3. **The definition of *critical* excludes "merely bothers the user."** That is a deliberate
   split between visibility and damage. Say so if you think being bothered *is* damage.
4. **"Done" and "approved" now have exact definitions.** Both are stricter than everyday use.
   Are they the right strictness?

---

*Depends on: `01-the-rules.md`, `02-the-register.md` (both approved 2026-08-23). Corrects step
two in one place: `userFacing` on features is derived, not declared. Next: `04-the-types.md` —
the five rules that become a mistake you can't express.*
