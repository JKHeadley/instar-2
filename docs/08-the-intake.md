# Part four — intake, and the resolution of identity and standing

**Status: draft, awaiting approval. Governed. No later part design or code is built on top of this until it is approved.**

Everything the system ever does begins with a stimulus: a person's message, a scheduled tick, a
webhook, a peer agent's request, an operator's approval, a recovery signal. The big picture gives
all of them exactly one way in — the intake doorway — and this part designs that doorway: how a
raw stimulus is preserved before anyone interprets it, how the sender becomes a verified
principal or is honestly held as unresolved, how what the sender *may decide* is resolved from
recorded grants rather than from how the request is phrased, and how a request beyond the
sender's standing is routed to whoever holds the standing instead of being guessed into
permission or thrown away.

The failure this part exists to prevent has a name and a date in 1.x: the identity-bleed incident
(2026-06-05), when an agent seated someone in the operator's chair from context alone — a name in
a document, a confident tone, a plausible claim. The rule book answered with "Know Your
Principal" (rule 28) and its siblings; parts one and two built the types and the record; this
part is where those defenses stand in the doorway, because the doorway is where the attacker
knocks. **Nothing that arrives as prose ever confers authority; everything that arrives is
preserved; and the one channel that must never go silent — the operator's — fails toward
delivery, always.**

Four things are deliberately separated throughout, because blurring any two of them is how
doorways lie: **what arrived** (the raw bytes, hashed before interpretation), **who
authenticated** (the principal, with its provenance), **what they asked** (the interpretation,
always revisable, never confused with the bytes), and **what standing permits** (resolved from
the record of grants at causal position). A doorway that mixes "what they asked" into "what they
may do" is an escalation engine; one that mixes "what arrived" into "what we understood" cannot
be audited when understanding was wrong.

This document chooses no transport and no chat platform. It fixes the contract every adapter must
satisfy, and it lists the exact shapes every implementation must refuse.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

One port, one sequence, one routing rule. The **port** is the single intake doorway; **adapters**
translate each transport into the port's one shape and are register entries whose contract suite
and captured-bytes fixtures are the price of existing. The **sequence** is fixed: preserve, then
authenticate, then resolve, then ground, then admit — raw bytes get a durable reference before
any interpretation; the principal is decoded or honestly wrapped as unresolved; standing is read
from the grant record at causal position, never from prose; the clock is read once; the
conversation's recoverable history is loaded with its coverage stated; and the accepted intent
becomes durable work that someone owns. The **routing rule** closes the loop the identity-bleed
opened: a request beyond the sender's standing becomes a pre-filled authorization request to
whoever holds the standing — neither refused, nor guessed, nor forgotten — and silence on that
request is never a yes.

---

## The port and its adapters

**One doorway, by construction.** Every stimulus class — user message, scheduled tick, webhook,
peer-agent request, operator-surface action, recovery signal, and anything that can type into a
live session (rule 29: a relay, an auto-responder, a sentinel pressing keys) — reaches the system
through the intake port. There is no second entrance: session input rides the same port with
`kind: system` principals, and part three's governed ports make an adapter unbuildable without
its declaration, so an unregistered way in cannot exist in code that builds.

**An adapter is a register entry, and its facts are its leash.** Each adapter declares (per part
three's machinery): its kind (parsers — it reads untrusted real-world text, so rule 36's
captured-bytes fixtures are required, never hand-typed approximations); the authentication class
it can honestly provide per stimulus type (`verified` — the adapter re-checks a signature, a
host-signed event, a token the package minted — or `channel-attested` — the adapter's word that
the message came through a channel it authenticated, part one's ceiling for today's chat
platforms); its profile (an intake adapter's runaway case is a flood, and its bound entry is
load-bearing); and the intake contract suite as its `inspectedBy`.

**Rule — every adapter passes one shared contract suite.** The big picture names this check;
rules 36 and 42 give it teeth. **Check:** the suite is a fixture set every adapter must pass
before its entry is `live`: raw-preservation before interpretation (P4-NF-01), refusal-as-value
on every failure path (no adapter throws across the port boundary), the authentication-class
honesty fixtures (an adapter claiming `verified` for a stimulus it can only attest fails —
P4-NF-02), duplicate-delivery idempotency (P4-NF-03), and the flood-bound fixture from its
profile. An adapter is not done when it works; it is done when it refuses correctly.

**Value — adapters are thin, and the port is where the thinking is.** Nothing forces this split;
it is chosen so that authentication evidence, dedup, preservation, and resolution are implemented
once, behind the port, and an adapter's whole job is transport translation plus honest
authentication — the shape 1.x's messaging adapters converged toward after every alternative
failed. The cost is that a new transport must fit the port's shape or extend it through review.

---

## The intake sequence

Fixed, in order, with each step's failure direction named. The sequence is the doorway's
equivalent of part two's admission ladder, and its steps compose part one's decoders and part
two's record rather than inventing parallel machinery.

1. **Receive and deduplicate.** The adapter hands the port the raw stimulus with its transport
   event id. Admission is idempotent on (adapter, event id): a redelivery collapses (P4-NF-03),
   so a platform that retries cannot make the system act twice — the 1.x per-message ledger,
   made structural.
2. **Preserve, before anything.** The raw bytes get a capture-store reference and a content
   hash — part one's `Intent.raw`, required before `ask` exists — and the receipt is appended as
   a fact, so "what actually arrived" survives every later failure including the port's own
   (P4-NF-01: any interpretation reachable before preservation). Rule 4's block-preserves-input
   is thereby a property of the doorway itself: every refusal below leaves the input held.
3. **Authenticate the source.** The adapter supplies its authentication evidence; the port
   decodes provenance through part one's boundary — the class is what the evidence supports,
   never what the adapter asserts (P4-NF-02).
4. **Resolve the principal.** Part one's decoder: a `VerifiedPrincipal` from authenticated
   evidence, or a refusal. **An unresolvable sender is held, not dropped** — the input becomes
   part one's `UnresolvedInput`, wrapped per part two as an unattributable observation:
   preserved, authority-inert, queued for resolution (P4-NF-04: an unresolved sender's message
   dropped or answered as if verified). A name in the content changes nothing at this step, by
   type: there is no way to make a principal from a string.
5. **Read the clock, once.** One clock measurement, taken here, handed onward as an argument —
   part one's convention; nothing downstream asks the time again.
6. **Resolve standing.** From the standing projection at causal position (part two's rung-9
   discipline: the grants the resolution rests on are named, and a backdated clock cannot
   resurrect revoked standing). The result is one of the three standings the glossary fixes —
   operator (within this conversation's binding), delegate (within a recorded grant's named
   actions), requester (the floor every verified principal holds) — and the resolution is
   recorded with the intent, so "what standing permitted this" is a lookup at audit time. A
   *claim* of standing in the message body is content, and content confers nothing
   (P4-NF-05: a standing resolution that consulted the message text).
7. **Ground.** The conversation's recoverable history is loaded up to the declared threshold,
   with rolling summaries beyond it (rule 96), and the session-start evidence is assembled: the
   history coverage actually achieved, the clock measurement, the authenticated principal, and
   the last inbound id. A session resuming from compaction says so and accounts for the last
   inbound message before the pause — continuity is disclosed, never bluffed (rule 110;
   P4-NF-06: a post-compaction first reply that does not account for the last inbound id).
8. **Mint the intent and admit it.** The `Intent` — principal, provenance, raw hash, the
   interpreted `ask` (separate field, revisable later by the judgment doorway, never
   overwriting `raw`), the directive ids in force for this principal and scope (`under`) — is
   appended through part two's admission as durable work with a declared owner and blocked-on
   state (rule 83: a commitment cannot exist without declaring who carries it). The run graph
   that executes it is part five's; this part ends at the handoff, and says so.
9. **Acknowledge.** The sender learns the system has their input — an ack, or the honest
   holding notice for an unresolved sender. Silence at the doorway is a failure mode, not a
   policy option.

**Rule — the operator channel fails toward delivery.** Rule 14: a gate on inbound messages must
never swallow a message on a weak or failed signal. **Check:** every inbound gate at this
doorway — dedup, authentication, resolution, any future filter — defaults to delivery-with-flags
when it cannot decide, and the gates are enumerable because each is a blocking-site entry
(rule 66); the fixture drives each gate's cannot-decide path and fails any that withholds
(P4-NF-07). The two deterministic walls that may refuse outright are part two's, unchanged: a
live credential in outbound text, and the admission ladder's integrity refusals — and both
preserve.

**Rule — accepted intake drains.** Rule 46. **Check:** backlog age per queue at this doorway
(the unresolved-sender queue included) is a registered measurement with a bound; a breach
surfaces as the bound's declared overdue action, and the queues are register entries with
declared growth (P4-NF-08: an intake queue without a bound or without its measurement).

**Rule — a secret arriving in content is stored before it is spent.** Rule 100. **Check:** the
secret-shape scan runs on inbound content at preservation time; a match routes the value to the
secret store and the preserved record carries the reference, never the value — the fact-spine
rule from part two, applied at the doorway where secrets actually arrive (P4-NF-09: an inbound
secret reaching any consumer as plaintext content). Collection *from* a person rides the
secret-drop shape: a one-time submission surface, never the chat transcript.

---

## Standing is resolved, and exceeding it routes

The doorway's answer to "may they?" has exactly three outcomes, and none of them is silence:

**Within standing** — the work proceeds, owned, under the directives in force.

**Beyond the sender's standing** — the request becomes a **pre-filled authorization request**
routed to the principal who holds the needed standing, in rule 82's shape: structured, complete,
approvable from a phone, authored by the system and never by the approver. The original ask is
preserved as durable work in an awaiting-authorization state with the routing recorded; the
sender gets the honest receipt ("this needs X's approval; it has been requested"); and the
sender is never told "no" on standing grounds alone, because a requester being unable to *bind*
the agent is not the agent being unable to *serve* the requester — the agent honors every
request to the full extent of its own standing first (rule 23's discipline: what the agent can
do within its permissions, it does before asking any human for anything). **Check:** the routing
fixture — a beyond-standing request neither executes, nor refuses, nor vanishes: it produces
exactly one authorization request plus one owned awaiting state (P4-NF-10); the
self-serve-first fixture — a request the agent's own standing covers is never routed for
approval it does not need (P4-NF-11).

**Unresolvable** — held as above, authority-inert, drained on a bound.

**Rule — silence is never the operator's consent.** Rule 98. **Check:** an
awaiting-authorization state has no timeout-to-yes transition — the type has no such arm, so no
code path can construct approval from absence (P4-NF-12); a *peer agent's* silence past a
deadline is concurrence only where the deadline was declared in the request itself, and the
concurrence record cites the declaration (P4-NF-13: peer-silence concurrence without a declared
deadline).

**Rule — every authorization that reaches an approver is a candidate standing grant.** Rule 104:
humans never have to remember they already said yes. **Check:** the authorization-request
surface carries the derived candidate grant (same principal, action class, scope, with a term)
as a one-tap option beside the one-time approval; a repeated identical request to the same
approver within the candidate's would-be term is surfaced with that history (P4-NF-14: a second
identical request rendered without the recurrence evidence).

**Rule — boundaries come from governance, never from the doorway's own taste.** Rule 103. The
doorway refuses only what a rule, a grant's absence, or a wall refuses; it invents no standard
of its own — a proposed new boundary is a question routed to the operator, exactly as a
beyond-standing request is. **Check:** every refusal at this doorway names the rule or the
missing grant it rests on; a refusal citing neither fails the fixture (P4-NF-15).

**Value — three standings are enough, here.** The glossary fixed operator, delegate, requester,
and this part deliberately adds none: every finer distinction observed in 1.x (mandates, trust
levels, per-service floors) is expressible as a delegate grant's named action set and scope.
The cost is that rich delegation must be spelled out per grant, which is the point — an implicit
tier is an unreviewed one.

---

## Directives at the doorway

An intent arrives *under* the directives in force — the operator's standing instructions for
this principal and scope — and the doorway resolves that set at minting so the work that follows
is shaped by what the operator already said, not by what a session happens to remember.

**Rule — a directive holds until superseded or done.** Rules 93 and 96; part one's type already
makes expiry unrepresentable. **Check:** the doorway's directive resolution reads the directive
projection (live directives for principal and scope) at the same causal position as standing;
the resolved set is recorded on the intent (`under`); a session acting on an intent whose
`under` omits a directive live at its position fails the grounding fixture (P4-NF-16).

---

## Multi-machine posture

Stated explicitly, as rule 113 requires:

- **Dedup is shared state.** The (adapter, event id) admission ledger rides the fact spine, so a
  redelivery to a *different* machine still collapses — exactly-once admission is a property of
  the record, not of a machine's memory. The residual window (two machines admitting the same
  event during a partition, reconciled as part two's duplicate-id refusal collapses them) is
  named, bounded by replication lag, and measured.
- **The unresolved queue and grounding caches are machine-local, rebuildable** — declared per
  part three, derived from the spine.
- **Conversation ownership is not this part's.** Which machine serves a conversation — leases,
  handoffs, the one-voice discipline — belongs to parts five and six with the run graph; this
  doorway's obligation is only that admission is idempotent wherever it happens, and it says so
  rather than quietly assuming a single machine.

---

## What is rejected where

Refusals at this doorway are values, never exceptions, and every one preserves its input. At the
adapter: transport-invalid stimuli, with the adapter's fixtures as the contract. At the port:
duplicate events (collapsed, not errored), authentication evidence that does not support its
claimed class, principals that do not decode (held as unresolved, never dropped), standing
resolutions that would rest on content, intents without a raw hash. Downstream of the port,
nothing refuses on identity or standing grounds — the doorway is the *one* place those
resolutions happen (rule 66: a decision that can block lives where the checks can see it), and
everything after receives resolved values or does not run.

---

## The negative contract fixtures

Continuing the cross-part convention: **P4-NF-nn**, each with its stage (`contract` — the shared
adapter suite; `decode`; `test`; `build`).

**Rule — the fixtures are the contract.** Rules 34, 36, 37, 69. **Check:** as parts one through
three.

| # | Stage | Shape | Refused/failed because |
|---|---|---|---|
| P4-NF-01 | contract | Any interpretation reachable before the raw bytes have a durable reference and hash | What arrived must survive every later failure, including ours. |
| P4-NF-02 | contract | An adapter claiming `verified` provenance for a stimulus it can only attest | The class is what the evidence supports, never what the adapter asserts. |
| P4-NF-03 | contract | A redelivered (adapter, event id) producing a second admission | Exactly-once admission is the record's property; platforms retry. |
| P4-NF-04 | test | An unresolvable sender's message dropped, or answered as if verified | Held, authority-inert, drained — rule 14's direction with rule 28's floor. |
| P4-NF-05 | test | A standing resolution that consulted message content | A claim of standing is content; content confers nothing. |
| P4-NF-06 | test | A post-compaction first reply that does not account for the last inbound id | Continuity is disclosed, never bluffed. |
| P4-NF-07 | test | An inbound gate withholding a message on a cannot-decide signal | The operator channel fails toward delivery, every gate, enumerable. |
| P4-NF-08 | build | An intake queue without a declared bound or its backlog-age measurement | Accepted intake drains, provably. |
| P4-NF-09 | test | An inbound secret reaching any consumer as plaintext content | Stored before spent; the doorway is where secrets arrive. |
| P4-NF-10 | test | A beyond-standing request that executes, refuses, or vanishes instead of routing | Neither guessed into permission nor discarded — routed, owned, receipted. |
| P4-NF-11 | test | A request within the agent's own standing routed for approval anyway | Self-unblock before escalating; an unnecessary approval is a burden shifted to a human. |
| P4-NF-12 | build | An awaiting-authorization type carrying any timeout-to-yes arm | Approval cannot be constructed from absence, by shape. |
| P4-NF-13 | test | Peer-agent silence treated as concurrence without a declared deadline in the request | Rule 98's one carve-out is exactly as wide as its declaration. |
| P4-NF-14 | test | A repeated identical authorization request rendered without its recurrence history | Every yes is a candidate standing grant; the human never has to remember. |
| P4-NF-15 | test | A doorway refusal naming neither a rule nor a missing grant | Boundaries come from governance, not from the doorway's taste. |
| P4-NF-16 | test | A session acting on an intent whose `under` omits a directive live at its causal position | The operator's standing instructions shape the work, structurally. |

---

## The terms this part introduces

| Term | Kind | Definition |
|---|---|---|
| **intake port** | noun | The single doorway every stimulus enters through; adapters translate transports into its one shape. |
| **intake contract suite** | noun | The shared fixture set an adapter must pass before its entry is live — preservation, honesty of authentication class, idempotency, flood bounds, refusal-as-value. |
| **authorization request** | noun | The pre-filled, structured, phone-completable request the doorway routes to the holder of a standing the sender lacks. Rule 82's shape, minted by the system. |
| **awaiting-authorization** | noun | The owned, durable state of work paused on a routed authorization. Has no timeout-to-yes arm. |
| **candidate standing grant** | noun | The derived grant offered beside every approval, so a repeated yes can become a recorded standing instead of a remembered one. |
| **session-start evidence** | noun | What a session proves at grounding: history coverage achieved, the clock measurement, the authenticated principal, the last inbound id. |

---

## The parent's rule list, discharged one by one

The big picture's §3 names sixteen rules over this doorway. Each is answered:

| Rule | Verdict here |
|---|---|
| 4 (structure decides alone on exact match) | **Held**: the doorway's deterministic refusals are part two's admission rungs under rule 4's amended third category; every one preserves (step 2 makes preservation prior to everything). |
| 14 (operator channel sacred) | **Held**: the fails-toward-delivery rule with enumerated gates (P4-NF-07). |
| 23 (self-unblock before escalating) | **Held at the doorway**: the self-serve-first fixture (P4-NF-11); the full exhaustion-run machinery is the run graph's (part five). |
| 28/29 (verified principals, session input included) | **Held**: steps 3–4; one port for session input; no principal from a string, by part one's types. |
| 36 (parsers against captured bytes) | **Held**: adapter fixtures in the contract suite. |
| 42 (failure as value) | **Held**: no adapter throws across the port; every refusal is a value that preserves. |
| 46 (accepted intake drains) | **Held**: bounded, measured backlogs (P4-NF-08). |
| 83 (the agent carries the loop) | **Held at minting**: an admitted intent is owned durable work with declared owner and blocked-on state; the loop's ongoing carriage is part five's. |
| 93 (directives hold until superseded or done) | **Held at the doorway**: resolution into `under` at causal position (P4-NF-16); the type is part one's. |
| 96 (a session grounds in its full history) | **Held**: step 7 with coverage evidence. |
| 98 (silence is never consent) | **Held**: no timeout-to-yes arm exists (P4-NF-12); peer-silence concurrence only as declared (P4-NF-13). |
| 100 (a secret is stored before spent) | **Held**: the doorway scan + secret-drop collection shape (P4-NF-09). |
| 103 (boundaries from governance) | **Held**: every refusal names its rule or missing grant (P4-NF-15). |
| 104 (every authorization is a candidate grant) | **Held**: the candidate-grant surface with recurrence history (P4-NF-14). |
| 110 (compaction disclosed) | **Held**: step 7's disclosure and accounting (P4-NF-06). |

---

## What this part makes checkable

The identity-bleed class of failure becomes unwritable end to end: no principal from a string
(part one), no authority from content (P4-NF-05), no operator from context (the conversation's
binding), no approval from silence (P4-NF-12), and no request lost in the gap between "not
allowed" and "not done" (P4-NF-10). Rule 14 gains its enumerated gates; rule 46 its measured
backlogs; rule 104 its structural memory; rule 110 its accounting fixture. The doorway composes
parts one through three rather than duplicating them — its checks are largely *placements* of
existing machinery at the boundary, which is why this part is smaller than its predecessors: the
constitution's front door was mostly built before the door was hung.

What this part does not hold, named: the run graph that executes admitted work, ownership,
leases, and the exhaustion-run machinery (part five); conversation-serving across machines
(parts five and six); the judgment doorway that may refine `ask` (part seven); the operator
surfaces where authorization requests are completed (part eleven).

---

## What I want from you on this document

1. **Beyond-standing requests always route; they are never refused on standing alone.** The
   sender gets service to the agent's own limit plus an honest receipt; the standing-holder
   gets a pre-filled request. This is the employee model made structural. Confirm?
2. **Every approval carries its candidate standing grant.** One tap turns a repeated yes into a
   recorded grant with a term — less interruption for you, more recorded authority. The
   alternative is approvals that stay one-time forever. Do you want the candidate surfaced
   every time, or only after a repeat?
3. **Unresolvable senders are held and drained, never dropped.** The queue is bounded and
   measured; past the bound, the overdue action fires. Right line for a public-facing doorway?
4. **Adapters may honestly claim only `channel-attested` for today's chat platforms.** That
   means operator standing in a conversation rests on the platform's authentication plus the
   conversation binding — the same ceiling 1.x lives with, now stated in the type. Accept, with
   the stricter classes arriving per-transport as they become checkable?
5. **Three standings, no more.** Finer tiers are delegate grants with named actions. Keep the
   floor this simple?

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
three, and their changelogs. Next after approval: part five, the durable run graph, delegation
contracts, and the agent-transport port.*
