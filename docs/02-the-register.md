# Step two — the register of the things being governed

**Status: approved. Governed.**

Step one found that fourteen rules all say *"every X must do Y"* and none can be checked, because
nothing lists the X. This document is the design for that list. It is deliberately boring. It is
also the single highest-value piece of machinery in the project, because building it once makes
fourteen rules enforceable and gives every later rule something to be *about*.

Plain language throughout, per the rule we corrected in step one.

---

## What a register is, and what it is not

A register is **the authoritative list of every thing of a given kind that exists in the
system**, with a few required facts about each one. "Every store." "Every place that can block."
"Every action the operator has to take." When a rule says *every X*, the register is where a
check goes to find out what *every* means.

It is not documentation. Documentation describes; a register *enumerates*, and a check that reads
it can fail the build when something is missing, mis-declared, or contradicts the code.

It is not hand-maintained. Step one's rules 78 and 84 name exactly how 1.x lost its capability
list: someone had to remember to update it, so it drifted. A register entry is **declared in the
code, next to the thing it describes**, and the register is *generated* from those declarations.
The hand-written part is only the facts the code cannot know about itself — and each of those is
required, so a missing one is a build failure, not a gap nobody notices.

---

## The one design decision in this document

**One register with many kinds, or many registers?**

One register. Every governed thing — a store, a blocking site, an operator action — is an entry
in the same register, with a `kind` field. Reasons:

1. Several rules span kinds. Rule 8 (close the loop) applies to promises *and* dark features
   *and* flagged issues. Rule 33 (two stores must agree) needs stores to reference each other. A
   single register lets an entry point at another entry regardless of kind.
2. The checks are the same shape for every kind: *walk the entries of kind K, assert each has
   fact F.* One walker, many kinds, instead of fourteen walkers.
3. A new kind is a new value for one field, not a new subsystem. The thirteen kinds below are the
   ones the constitution already needs; the register does not stop there.

The cost is that entries of different kinds carry different required facts. That is handled by
giving each kind its own list of required facts, below.

---

## What every entry carries, regardless of kind

| Fact | What it is | Who supplies it |
|---|---|---|
| `id` | A stable name. Never reused, never renamed silently. | The code |
| `kind` | One of the kinds below. | The code |
| `owner` | The module that declares it. Where to look. | Generated from the declaration site |
| `standards` | The rule numbers this entry is governed by — the governed-by half of rule 69, made mechanical: the code names the standard it answers to. Enforcement edges are minted only by a holder's `holds` fact, never by `standards`. | The author, required |
| `since` | When it first appeared. | Generated from history |
| `status` | `live`, `dark`, `soaking`, or `retired`. Retired entries stay in the register forever — rule 7 says archiving never means deleting, and that applies to the register itself. | The author, required |

---

## The thirteen kinds, and which rules each unblocks

### 1. Stores — *every place state lives*

Unblocks rules 7, 32, 33.

| Required fact | Why |
|---|---|
| `growth` — `unbounded`, `compacts`, `summarizes`, `deletes`, or `redacts` (deletes bytes only under an operator-standing tombstone fact, with the envelope, hash, and redaction record retained) | Rule 7: a store holding agent memory that says `deletes` fails the build. |
| `holdsAgentMemory` — yes or no | The subject of rule 7's ban. |
| `machineScope` — `shared` or `machine-local` plus a stated reason | Rule 32: shared is the default; machine-local must justify itself. A store with no scope fails. |
| `agreesWith` — other store ids and the invariant that must hold | Rule 33: two stores answering the same question declare how they agree, and a scheduled check tests it. |

### 2. Blocking sites — *every place code can refuse, gate, or block without asking the mind*

Unblocks rules 4, 66, 86.

| Required fact | Why |
|---|---|
| `authority` — `signal` or `block` | Rule 86: a brittle low-context filter may only signal, with exactly two ruled exceptions — secrets and money. A check is advisory because its entry says `signal`, never by habit. (Ruling 2 on the decision sheet.) |
| `decidesAlone` — `no` (names the model that decides), `ruled-three` (a live secret leaving, spend past a cap, the operator's emergency stop), or `governed-state` (deterministic enforcement of recorded governed state: an exact test that refuses malformed, unverifiable, or standing-uncovered input and preserves it) | Rule 4: a site may decide with no model behind it only on an exact test — the three irreversible-miss cases, or enforcement of what the record already says. Every other `block` entry names the model that decides. A multi-rung boundary is one entry carrying `decidesAlone` per rung, exactly as `failDirection` is carried per consumer. (Ruling 19.) |
| `criticality` — the assessment that justifies the power | Rule 4: the deciding list is driven by the formal assessment of how critical each scenario is, never hand-picked. The register's `block` entries *are* that list. (Ruling 19.) |
| `failDirection` — `open` or `closed` | Chosen from who bears the miss: reachability to the user fails open; change and release integrity fails closed. (Ruling 5.) |
| `preservesInput` — where a blocked input is kept | Rule 4: a block always preserves its input. A site that cannot say where fails. (Rulings 19 and 2.) |
| `inspectedBy` — the check that walks this site | Rule 66: a blocking decision the checks cannot see is unwatched by construction. |

This is the smallest kind and the most important one. In 1.x the number of places that could
silently block was never known. Here it is a number in the register, and adding one is a visible
event.

### 3. Features — *every capability the system offers*

Unblocks rules 39, 62, 72, 73, and (with the glossary) 34, 38, 76.

| Required fact | Why |
|---|---|
| `metrics` — the measurements it emits | Rule 39: every feature ships with metrics. Empty fails. |
| `userFacing` — yes or no, by the glossary's definition | Rules 62 and 76 hinge on this word. It is a declared fact, not a guess. |
| `significance` — by the glossary's definition | Rule 34's three test tiers apply above a threshold; the threshold needs the word defined. |
| `gate` — for a `dark` or `soaking` feature: the graduation test and the deadline | Rules 72 and 73: a dark feature with no deadline is the 20-of-92 failure. A deadline in the past fails the build. |
| `liveProof` — for a user-facing feature: the record of a real end-to-end run | Rule 62: not "done" until driven through its real surface. |

The capability briefing the agent reads at every session (rule 84) is **generated from this
kind**. That is what "free from the core" meant for rules 78 and 84.

### 4. Operator actions — *every action only the operator can take*

Unblocks rules 79, 82.

| Required fact | Why |
|---|---|
| `surface` — the dashboard page or link where it is completed | Rule 79: every one is completable from a phone. No surface fails. |
| `request` — the structured, pre-filled request the operator approves | Rule 82: the operator approves; they never author. |

### 5. Loops — *every thing opened that must be closed*

Unblocks rule 8.

| Required fact | Why |
|---|---|
| `cadence` — how often it re-surfaces | Rule 8: untracked is abandoned. |
| `dueBy` | An overdue loop is visible without anyone looking. |
| `closedBy` — the deliberate close, when it comes | The register never forgets a loop; it records how it ended. |

Promises to the user, dark features, flagged issues, and hypotheses are all entries of this
kind. A dark feature is therefore *two* entries — a feature and a loop — which is correct: it is
both a capability and an obligation.

### 6. Duties of observation — *every "the system must notice X"*

Unblocks rule 9.

| Required fact | Why |
|---|---|
| `proof` — the artifact that cannot exist unless the looking happened | Rule 9: a duty to notice without a required record is a wish. |
| `watcher` — the sentinel that owns it | Every held-by-the-mind rule from step one has a watcher; this is where the watcher is named. |

### 7. Parsers — *every reader of untrusted real-world text*

Unblocks rule 36.

| Required fact | Why |
|---|---|
| `fixture` — the captured real bytes it is tested against | Rule 36: no hand-typed approximations. Missing fixture fails. |

### 8. Critical outcomes — *every result that must provably still work in production*

Unblocks rule 43 (with the glossary defining "critical").

| Required fact | Why |
|---|---|
| `probe` — the live end-to-end check and its cadence | Rule 43: a canary per critical outcome. |

### 9. Judgment points — *every place a model makes a call*

Unblocks rule 57, and gives rules 41 and 58 their subject.

| Required fact | Why |
|---|---|
| `floor` — the complete safe action space and the conservative default | Rule 57: the mind narrows, never widens. A judgment point with no floor fails. |
| `irreversible` — whether any allowed action cannot be undone | Irreversible actions need a higher bar; the register knows which ones. |
| `benchmark` — the scenario class it is measured under, or `unmeasured` | Step one, finding 5: routing backed by a benchmark or labelled honestly. |

### 10. Model doorways — *every way the system reaches a model*

Unblocks rule 56, and is the subject of finding 5.

| Required fact | Why |
|---|---|
| `models` — the models behind this door, with exact ids and when last verified | Rule 56: a stale map is a defect. Older than its window fails. |
| `billing` — subscription or metered | Cost decisions need to know. |
| `subsidy` — the known discount or subsidy ratio on this door, with its basis (`researched`, `estimated`, or `measured`) and when last updated | Raised in review: a door's real cost is rarely its list price. Starts as a best guess or web research, and is replaced by measured data as the benchmark loop produces it. A stale or basis-less value is flagged, not trusted. |

### 11. Sentinels — *every focused background intelligence*

This kind is new; it has no 1.x rule because 1.x never listed its own watchers, which is how
guards went dark unnoticed. It is what step one's "held by the mind" group needs.

| Required fact | Why |
|---|---|
| `holds` — the rules or duties it enforces, with the honesty class and can-fail evidence | Every held-by-the-mind rule names its holder, and every holder names its rule. Both directions resolve — the holder side declared, the rule side derived. |
| `freshnessProbe` — the declared probe that proves it actually runs | A sentinel that exists but never runs is a dark guard. The build checks the probe is declared; the runtime guard-posture holder checks it fires, from the probe's own record, not from config. |
| `scope` — live or retrospective | Step one's rule: retrospective by default; live only for the irreversible. A live sentinel must name the irreversible moment it guards. Sending a message to the user *is* an irreversible moment — see the pre-send review team, below. |
| `authority` — signal or block | Same field as a blocking site, because a live sentinel that can hold a message is one. Almost every sentinel is `signal`; the `block` set is tiny and named. |

#### The pre-send review team (a named pattern, raised in review)

A message to the user cannot be unsent, so reviewing it *before* it goes is legitimately live
under step one's rule. The 1.x trap was never live review as such — it was *one* model reading
*one* message with *no* context, holding it, and going silent when the model failed. The pattern
we want instead:

1. The agent drafts the message.
2. A team of focused sentinels — one per pitfall or coherence check we have identified — each
   reads the draft *with the conversation* and returns an objection or nothing.
3. The agent revises against the objections. Repeat.
4. When no sentinel objects, the message sends.

With four bounds, each declared in the register so a check can see them:

- **Objections are signals, not holds.** Every sentinel on the team is `authority: signal`. The
  agent decides how to revise; a sentinel cannot rewrite or swallow the message. The only
  `block` sentinels are the irreversible-harm pair from step one (a credential in the text; an
  agent abandoning its own run), and they are deterministic, not judgment.
- **Bounded rounds.** A fixed maximum number of revise cycles (say three). After the last round
  the message sends with the surviving objections *attached to the record*, not with the message
  held. This is rule 14 (the operator channel fails toward delivery) applied to review.
- **A latency budget.** The whole loop has a time ceiling; a sentinel that has not answered by
  then counts as no objection. Silence from a sentinel can never become silence to the user.
- **Every round is recorded.** Draft, objections, revision, final — all of it lands in the record
  the retrospective review reads. That is how the team gets *tuned*: a sentinel whose objections
  are always overruled, or never raised when they should have been, shows up in the retrospective
  and becomes a benchmark scenario (step one, finding 5).

So the two reviews are not in tension. The live team catches the moment; the retrospective review
tunes the team.

### 12. Protected artifacts — *every path whose change needs the operator*

Unblocks rule 82 as ruled: the agent merges anything honestly green; the operator is asked only
about changes to the constitution and to this list — and the list is short by design, because
every entry costs a human approval. (Ruling 3 on the decision sheet.)

| Required fact | Why |
|---|---|
| `pattern` — the path or path pattern protected | The exception to agent merge authority must be enumerable, not felt. |
| `why` — what makes this the operator's | A protected path with no stated reason rots into superstition. |
| `surface` — where the approval is completed | Rule 79: completable from a phone. |

The constitution is always on this list; the register names the rest. One known limit, carried
from the re-sweep (#53701): the agent authors the checkers that would enforce this list, so the
enforcement must ultimately sit outside the agent's write authority. That design lands in the
types step; until it does, this kind lists the paths but cannot yet hold the door alone.

### 13. Governed documents — *every document that declares itself governed*

Unblocks rules 90 and 91, and records ruling 32: governed does not mean on main — what makes a
document governed is that the register records where it durably lives.

| Required fact | Why |
|---|---|
| `location` — the durable home of the document | Ruling 32. A governed document nobody can find is not governed. |
| `changelog` — the sibling history file | Rule 91: the body reads as its first version; the history lives beside it, validated. |

One entry of this kind is a plain recorded fact rather than an obligation: this constitution's
fork relationship to Instar 1.x's. The two are free to evolve apart — one may replace the other,
or they may borrow from each other indefinitely — and the register records the relationship as
a fact, never as an enforced synchronization loop. (Ruling 26 on the decision sheet.)

---

## When the shape of the register must change

The shape — the kinds and their required facts — should generalize for a long time, and the
thirteen kinds above are meant to. But "should" is not a check. Three signals tell us the shape no
longer fits, and each one is mechanical:

1. **A rule with no kind.** A new or amended rule says *every X* and the both-directions check
   finds no kind that lists X. The rule cannot be marked checkable until a kind exists.
2. **A declaration that does not fit.** An author declares an entry and needs a fact the kind
   does not have, or a kind that does not exist. The declaration fails the build. This is the
   important one: the author is forced to change the *shape* through the approval flow, rather
   than quietly cramming the new thing into the nearest existing slot — which is exactly how
   registers rot.
3. **A governed thing the retrospective review finds unregistered.** The review reads the real
   system; if it finds a store, a blocking site, or a watcher with no entry, that is a finding.

A shape change is a document, reviewed and approved like this one. The register's own shape is
in the register: each kind and each required fact is an entry, with `since` and `standards`, so
the history of the shape is never lost.

---

## How the register stays true

Three properties, each a build check:

1. **Generated, not written.** Entries are declared in code next to the thing they describe. The
   register file is an output. A hand edit to the output is overwritten on the next build, so the
   only way to change an entry is to change its declaration.
2. **Required facts are required.** A missing required fact is a build failure, not a warning.
   This is the whole difference between a register and a wish: rule 39 says "every feature ships
   with metrics," and the build now refuses a feature entry with an empty `metrics` field.
3. **Both directions resolve.** Every entry's `standards` field points at real rule numbers, and
   every rule in the constitution that says *every X* points at the kind that lists X. A rule with
   no kind, or a kind with no rule, is flagged. This is rule 69 applied to the register itself.

And one honest limit: the register can prove an entry *exists* and *declares* the right facts. It
cannot prove the declaration is *true* — that a store which says `compacts` really does. That is
what the tests, the probes, and the sentinels are for. The register tells them where to look.

---

## What this makes checkable

Before the register, from step one: **19 of 89** rules checkable by a script.

With the register and the glossary (step three): rules 4, 7, 8, 9, 32, 33, 34, 36, 38, 39, 43,
56, 57, 62, 66, 72, 73, 76, 79, 82, 86 move to checkable — **21 more, for 40 of 89**. Rules 78
and 84 become free, as step one predicted. The held-by-the-mind group gains a named watcher each.

---

## What I want from you on this document

1. **One register with kinds, rather than many registers** — does that sit right?
2. **The thirteen kinds.** Anything governed that isn't listed? Anything listed that isn't real?
3. **Sentinels as a kind of their own.** This is the one addition with no 1.x ancestor. It exists
   so the held-by-the-mind rules have a named, running holder — your point from the step-one review.
4. **Generated, never hand-written.** This is the strongest claim in the document and the one most
   worth challenging: it means every governed thing has to be declared *in code*, which is a cost
   on every author. I think the cost is the point. Say so if you disagree.

---

*Depends on: `01-the-rules.md` (approved 2026-08-23). Next: `03-the-glossary.md` — the
definitions of the words the register's required facts lean on: significant, critical,
user-facing, irreversible.*
