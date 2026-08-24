# Step two — the register of the things being governed

**Status: draft, awaiting approval. Nothing is built on top of this until it is approved.**

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
3. A new kind is a new value for one field, not a new subsystem. The eleven kinds below are the
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
| `standards` | The rule numbers this entry exists to satisfy. This is rule 69 (references run from both ends) made mechanical: the code names the standard. | The author, required |
| `since` | When it first appeared. | Generated from history |
| `status` | `live`, `dark`, `soaking`, or `retired`. Retired entries stay in the register forever — rule 7 says archiving never means deleting, and that applies to the register itself. | The author, required |

---

## The eleven kinds, and which rules each unblocks

### 1. Stores — *every place state lives*

Unblocks rules 7, 32, 33.

| Required fact | Why |
|---|---|
| `growth` — `unbounded`, `compacts`, `summarizes`, or `deletes` | Rule 7: a store holding agent memory that says `deletes` fails the build. |
| `holdsAgentMemory` — yes or no | The subject of rule 7's ban. |
| `machineScope` — `shared` or `machine-local` plus a stated reason | Rule 32: shared is the default; machine-local must justify itself. A store with no scope fails. |
| `agreesWith` — other store ids and the invariant that must hold | Rule 33: two stores answering the same question declare how they agree, and a scheduled check tests it. |

### 2. Blocking sites — *every place code can refuse, gate, or block without asking the mind*

Unblocks rules 4, 66, 86.

| Required fact | Why |
|---|---|
| `authority` — `signal` or `block` | Rule 86: only a full-context intelligent gate may block; a brittle filter may only signal. |
| `exactMatchOnly` — yes or no | Rule 4: the only site allowed to decide alone is an exact whole-message match against a closed list. Any `block` site that is not the mind and not `exactMatchOnly` fails. |
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

### 11. Sentinels — *every focused background intelligence*

This kind is new; it has no 1.x rule because 1.x never listed its own watchers, which is how
guards went dark unnoticed. It is what step one's "held by the mind" group needs.

| Required fact | Why |
|---|---|
| `watches` — the rule or duty it holds | Every held-by-the-mind rule names its watcher, and every watcher names its rule. Both directions must resolve. |
| `lastRan` — when it last actually ran, from its own record | A sentinel that exists but never runs is a dark guard. The check is on this field, not on config. |
| `scope` — live or retrospective | Step one's rule: retrospective by default; live only for the irreversible. A live sentinel must name the irreversible moment it guards. |

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
2. **The eleven kinds.** Anything governed that isn't listed? Anything listed that isn't real?
3. **Sentinels as a kind of their own.** This is the one addition with no 1.x ancestor. It exists
   so the held-by-the-mind rules have a named, running holder — your point from the step-one review.
4. **Generated, never hand-written.** This is the strongest claim in the document and the one most
   worth challenging: it means every governed thing has to be declared *in code*, which is a cost
   on every author. I think the cost is the point. Say so if you disagree.

---

*Depends on: `01-the-rules.md` (approved 2026-08-23). Next: `03-the-glossary.md` — the
definitions of the words the register's required facts lean on: significant, critical,
user-facing, irreversible.*
