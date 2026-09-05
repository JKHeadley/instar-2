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
(2026-06-05), when an agent seated someone in the operator's chair from context alone. The rule
book answered with "Know Your Principal" (rule 28) and its siblings; parts one and two built the
types and the record; this part is where those defenses stand in the doorway. **Nothing that
arrives as prose ever confers authority; everything that arrives is preserved; and the one
channel that must never go silent — the operator's — fails toward delivery, always.**

Four things are deliberately separated throughout, because blurring any two of them is how
doorways lie: **what arrived** (the raw bytes, hashed at arrival), **who authenticated** (the
principal, with its provenance), **what they asked** (the interpretation, always revisable, never
confused with the bytes), and **what standing permits** (resolved from the record of grants at
causal position). And one discipline the first review of this document made its spine: at a
doorway, **the attacker's prose must never choose anything** — not the approver who is asked, not
the words the approver reads as the system's own, not the scope of a grant, not which message of
someone else's gets silently dropped. Every mechanism below is shaped so that what a sender
writes can only ever be *quoted*, and what the system decides is computed from what the system
itself recorded.

This document chooses no transport and no chat platform. It fixes the contract every adapter must
satisfy, and it lists the exact shapes every implementation must refuse.

Every claim below is marked **Rule** (with the rules that require it and the check that holds it)
or **Value** (a deliberate choice the constitution does not force). There is no third category.

---

## What this part is, in one paragraph

One binding, one port, one sequence, one routing rule. The **conversation binding** is the
anchor operator standing hangs from — a recorded, verified-provenance grant, never an inference
from who spoke first or loudest. The **port** is the single intake doorway; **adapters**
translate transports into its one shape and are register entries whose contract suite is the
price of existing. The **sequence** is fixed per stimulus class: preserve, then authenticate,
then resolve, then ground, then admit — with every failure a value that keeps the input. The
**routing rule** closes the identity-bleed loop: a request beyond the sender's standing becomes
a pre-filled authorization request to whoever holds the standing — neither refused, nor guessed,
nor forgotten — with the sender's words quoted as untrusted data, the needed standing computed
from the system's own classification of the operation, and silence never becoming a yes.

---

## The conversation binding — the anchor, anchored

The glossary says an operator "within a conversation … is bound from the authenticated sender,"
and left the binding itself undefined. This part defines it, because a pin that anchors operator
standing must itself be anchored outside what it pins.

**A conversation binding is a recorded grant.** It names a conversation (by the platform's
authenticated conversation identity), the principal who holds operator standing within it, and
the scope that standing covers — and it is established only by an act with `verified`
provenance: the organization's declared intent naming the holder, or an operator-standing action
on an authenticated non-chat surface (a signed or PIN-gated operator surface, whose design is
part eleven's). **A conversation's first sender never self-binds** — a new conversation with no
binding has no operator, only a requester, until a verified act binds it (P4-NF-04).

**How this composes with part one's wall — stated, not slipped.** Part one, approved: a value
that confers standing above requester decodes only from `verified` provenance. Today's chat
platforms give the adapter only `channel-attested` evidence per message. The composition this
part proposes: the **operator principal's provenance is the binding grant's** — the verified,
recorded act that bound the conversation — and the per-message `channel-attested` sender
evidence does one job only: it *selects* the already-bound principal within the already-granted
scope. Prose never enters it; the message's attestation elevates nothing — it locates. The
residual is named rather than implied away: **a platform bot-token takeover collapses every
attestation on that transport**, so an attacker holding the token speaks as any bound sender —
which is why the binding's scope bounds the blast radius (that conversation's standing, nothing
wider), and why the walls and the highest-stakes operator actions live on surfaces whose
provenance the package itself verifies, never on chat attestation. Whether this composition is a
faithful reading of part one or needs a formal amendment through part one's version chain is
question 1 — the exact discipline the two-anchor reading of rule 90 set.

**Rule — operator standing resolves only through a binding.** Rules 28 and 104; part one's
provenance floor. **Check:** the standing resolution's operator arm consults the binding-grant
record and nothing else — a fixture in which the sender's message asserts, implies, or documents
operator status without a binding must resolve requester (P4-NF-05); the self-binding fixture
(P4-NF-04); re-binding and revocation ride the same grant machinery as any standing change, so
they are facts with provenance, never adapter state.

---

## The port and its adapters

**Rule — one doorway, with its edges enumerated.** Every stimulus class — user message,
scheduled tick, webhook, peer-agent request, operator-surface action, recovery signal, and
anything that can type into a live session (rule 29: a relay, another agent, a sentinel pressing
keys — part one's `kind: system` *and* `kind: agent` principals) — reaches the system through
the intake port; rules 28, 29, and 66 require it. The claim is enforced to exactly the extent it
can be, and no further: part three's governed ports make an adapter unbuildable without its
declaration, and an **entry-point enumeration fixture** walks every externally-triggered
execution path the tree carries — file watchers, subprocess callbacks, migrations, operator
tooling, debug surfaces — and fails any that neither routes through the port nor carries a
declared exemption with its reason (P4-NF-06). What enumeration cannot see (a genuinely dynamic
path) is the retrospective review's named residual, as part three assigned it.

**An adapter is a register entry, and its facts are its leash.** Each adapter is a parsers-kind
entry (it reads untrusted real-world text; rule 36's captured-bytes fixtures are its floor) —
and this part routes the **two shape amendments** its facts need, in part three's bundle
convention: the parsers kind gains `authenticationClass` (the class the adapter can honestly
provide per stimulus type — `verified` where it re-checks evidence, `channel-attested` where it
can only vouch for its channel) and `eventIdAuthority` (who mints the stimulus id and its
uniqueness scope, replay window, and fallback fingerprint policy — the dedup contract below
consumes this); and the glossary's profile-declaring kind list gains parsers, because an intake
adapter's runaway case is a flood and its bound entry is load-bearing. **The port itself is a
blocking site** and declares the full kind-2 facts in part two's own format: `authority: block`;
`decidesAlone` per gate — `ruled-three` for the secret scan and the emergency stop,
`governed-state` for dedup, authentication, resolution, and admission; `criticality`: this is
the door authority enters through; `failDirection` per consumer — **open toward delivery** for
the operator and user channel, **closed** for standing and admission; `preservesInput`: the
capture store and the held queue, named below; `inspectedBy`: the contract suite.

**Rule — every adapter passes one shared contract suite.** The big picture names this check;
rules 36 and 42 give it teeth. **Check:** the suite every adapter passes before its entry is
`live`: preservation-before-interpretation (P4-NF-01), refusal-as-value on every path,
authentication-class honesty (claiming `verified` for attestable-only stimuli fails —
P4-NF-02), the dedup contract against its declared `eventIdAuthority` (missing, reused,
unstable, and replayed ids each have a fixture — P4-NF-03), and the flood bound from its
profile. Adapters without sender-shaped stimuli satisfy the suite per the stimulus-class table
below rather than vacuously.

**Value — adapters are thin, and the port is where the thinking is.** Nothing forces this
split; it is chosen so authentication, dedup, preservation, and resolution are implemented once,
behind the port. The cost is that a new transport must fit the port's shape or extend it through
review.

---

## The intake sequence

Fixed, in order. The sequence composes part one's decoders and part two's record; the table
after it says which steps apply per stimulus class, because a doorway that pretends a cron tick
has a sender is lying about something easy.

1. **Receive; read the clock.** One clock measurement, taken at receipt, handed to every later
   step as an argument — nothing downstream asks the time again; steps 2–4 stamp this reading.
2. **Preserve, before everything else that can lose it.** The raw bytes get their arrival hash
   and a durable reference, and the receipt is appended as a fact — before deduplication,
   before any interpretation (P4-NF-01: any drop or interpretation reachable first). **When the
   secret scan matches** (it runs on the raw bytes here, deterministically): the matched spans
   are routed to the secret store, and **two artifacts** result — the original bytes, held only
   in secret-store custody under its access rules, and the redacted intake capture, which is
   what every ordinary consumer sees, carrying `SecretRef`s in place of the spans plus the
   arrival hash of the true bytes, so an auditor can verify what arrived without any consumer
   touching plaintext (P4-NF-07: an inbound secret span reachable outside secret-store custody).
   `Intent.raw` is the arrival hash; the capture reference resolves to the redacted artifact.
   The residual is part two's, restated: the scan is shape-based and best-effort — a secret in
   prose that matches no shape lands in the capture, and its remedy is rotate-retract-record,
   never deletion.
3. **Deduplicate — after preservation, scoped by channel.** Admission is idempotent on
   (adapter, authenticated channel, event id), under the adapter's declared `eventIdAuthority`
   — an id a sender can influence never keys dedup across senders, so no one can pre-admit an
   id to swallow someone else's message. A collapse compares the redelivery's arrival hash
   against the original admission: a match collapses silently and the duplicate's capture
   points at the original's; **a mismatch is an attack signal, recorded as a fact and
   surfaced** — same id, different bytes is part two's fork posture, not a retry (P4-NF-03,
   P4-NF-08). Every collapse is recorded; nothing is dropped unrecorded, ever.
4. **Authenticate the source.** The adapter supplies its evidence; the port decodes provenance
   through part one's boundary — the class is what the evidence supports, never what the
   adapter asserts (P4-NF-02). **System-class stimuli authenticate like everything else:** a
   tick, a recovery signal, a relay, a sentinel's keystroke carries `verified` provenance from
   a package-minted token or signed source — locality is not authentication, and a local
   process that can reach the port is exactly rule 29's threat, not its exemption (P4-NF-09).
5. **Resolve the principal.** Part one's decoder: a `VerifiedPrincipal`, or the honest hold —
   an unresolvable sender's input becomes part one's `UnresolvedInput`, wrapped per part two as
   an unattributable observation: preserved, authority-inert, queued (P4-NF-10: dropped or
   answered as if verified). No principal from a string, by type.
6. **Resolve standing, at the fact's own causal position.** From the grant record, at the same
   causal frontier the minted intent will declare — so the resolution recorded on the intent
   and the cone rung 9 later verifies are one position, and a revocation folding between
   resolution and admission cannot open a gap (the append-side rung-9 check is the floor under
   this step, not a re-run of it). The operator arm resolves only through the conversation
   binding; delegate through recorded grants' named actions; requester is the floor. A standing
   *claim* in content is content (P4-NF-05). A system principal's standing is the recorded
   grant of the job, holder, or run that registered it — a tick acts under its job's grant,
   never under an ambient "the system may".
7. **Ground, where a session starts.** For a stimulus that starts or resumes a session, the
   conversation's recoverable history loads to the declared threshold with rolling summaries
   beyond it, and the **session-start evidence** is assembled *at the session's actual start*:
   history coverage achieved, a fresh clock measurement, the authenticated principal, the last
   inbound id — the doorway supplies the substrate (last-inbound id, coverage index); the
   session-side read is fresh, because evidence assembled at admission can be stale by the time
   part five starts the worker. A session resuming from compaction says so and accounts for the
   last inbound message before the pause (rule 110; P4-NF-11).
8. **Mint the intent and admit it.** The `Intent` — its principal (carrying provenance), the
   arrival hash as `raw`, the interpreted `ask` (a separate, revisable field; the doorway's
   interpretation is deterministic — anything needing a model waits for the judgment doorway,
   which no feature calls directly), the directive ids in force (`under`, resolved at the same
   causal position as standing) — is appended through part two's admission as durable work
   **with a declared owner and blocked-on state, refused at creation without them** (rule 83's
   own check, held here by fixture — P4-NF-12). The run graph that executes it is part five's.
9. **Acknowledge — as a Value, with its costs named.** For conversational stimuli from
   resolved principals, an ack; for a beyond-standing ask, the honest receipt. **For
   unresolved senders the ack is an adapter-profile choice**: a holding notice where the
   relationship warrants it, silence on public-facing transports — because an unconditional
   ack is an enumeration oracle ("a live agent is here, your probe was queued") handed to
   whoever knocks. For senderless stimuli, the admission record is the ack. No rule forces
   acking; what rule 46 forces is that accepted input drains, and what rule 14 forces is that
   the *protected channel's* messages are never swallowed — neither obliges the doorway to
   announce itself to strangers.

**Which steps apply to which stimulus class** — the sequence's honesty table:

| Stimulus | Dedup id (step 3) | Principal (4–5) | Standing (6) | Ground (7) | Ack (9) |
|---|---|---|---|---|---|
| User/operator message | platform event id per `eventIdAuthority` | adapter evidence → principal, or held | binding / grants / requester floor | on session start or resume | conversational ack |
| Webhook | sender-independent id per `eventIdAuthority`, else the port's fallback fingerprint | service principal via its registered credential | the service's recorded grant | none | transport response |
| Scheduled tick | the port mints (job id, scheduled instant) | `kind: system`, package-minted token | the job's recorded grant | scoped to the run the tick names | the admission record |
| Peer-agent request | the peer protocol's signed message id | `kind: agent`, signed | the peer's recorded grant | the thread it names | protocol ack |
| Operator-surface action | the surface's minted action id | `verified` by the surface itself | operator, per the surface's binding | the affected scope | the surface's receipt |
| Recovery signal | the port mints (source, incident id) | `kind: system`, signed source | the recovery holder's grant | the affected run | the admission record |

**Rule — the protected channel fails toward delivery, and only the protected channel.** Rule 14
governs "the user's inbound messages" — the resolved principals this agent serves — and this
part keeps its scope exactly there: for a resolved user or operator sender, every gate at this
doorway defaults to delivery-with-flags on a *cannot-decide* signal (P4-NF-13), and the
enumerable gate list is the port's blocking-site declaration. Two boundaries are drawn, because
the first review found both being blurred: **cannot-decide is not decided-unresolved** — an
unresolvable sender is a *decided* outcome whose direction is the hold, and holding it does not
violate a rule about the user's channel (the unresolved sender is not yet anyone's user); and
**the deterministic refusals that may stand even against the protected channel are exactly part
two's admission ladder** (its `policy`, `integrity`, `decode`, `standing` reasons — the secret
scan among them), every one preserving its input. The outbound credential wall is rule 4's and
the outbound doorway's, and is deliberately not in this inbound enumeration.

**Rule — the operator's emergency stop is recognized at the doorway.** Rule 4 names it among
the ruled three: exact test, irreversible miss. **Check:** a deterministic stop surface — a
dedicated command shape the port recognizes without interpretation, honored only from the
conversation's bound operator or a verified operator surface — bypasses the ordinary sequence's
tail: it is preserved, deduplicated, authenticated, and then acts *before* grounding, minting,
or any queue, with its own fixture measuring recognition-to-halt (P4-NF-14). An ambiguous
"maybe stop" rides the ordinary sequence; the deterministic path exists precisely so the
unambiguous one never waits behind it.

**Rule — accepted intake drains, including the held and the awaiting.** Rule 46. **Check:**
every queue at this doorway — the unresolved-sender hold, the awaiting-authorization set — is a
registered store with declared growth, a backlog-age measurement, and a bound; at the
unresolved queue's bound, part two's coalescing budget applies (sustained unresolvable traffic
collapses per channel and window into counted observation facts, raw items in the redactable
capture store) — held items age to a **named terminal**: expired-unresolved, preserved and
receipted, never silently gone (P4-NF-15). A held input whose sender is later verified re-runs
steps 6–9 **at resolution-time causal position** — current grants, current directives, fresh
clock — with both instants recorded on the intent, so a replayed message can neither act under
since-revoked standing nor pretend it arrived now.

---

## Standing is resolved, and exceeding it routes

The doorway's answer to "may they?" has exactly three outcomes, and none of them is silence:
within standing, the work proceeds, owned, under the directives in force; unresolvable, held as
above; and beyond standing — the case this section exists for.

**First, the floor under all of it: the agent's own operating standing.** The routing rule
turns on the agent serving every requester "to the full extent of its own standing," and that
phrase now has a definition instead of an aura: **the agent's operating standing is the set of
recorded grants whose grantee is the agent principal** — from the organization's declared
intent and from delegation — resolved exactly as any principal's standing is, from the record,
at causal position. It is a term this part registers, and the confused-deputy residual is named
rather than implied away: any verified requester can direct the agent's *entire* operating
standing at their ask, by design (the employee model — the glossary chose it); what bounds the
blast radius is everything the constitution already wraps around the agent's own actions — the
directives in force, the organization's intent constraints, the judgment doorway's floors, the
effect doorway's profile-gated irreversibles — and *those* are the answer to "what stops a
requester misusing the agent," not a standing check this doorway does not have.

**Rule — a beyond-standing request routes; it is never refused on standing alone, and never
guessed into permission.** Rules 82 and 79; rule 23's discipline (what the agent's own standing
covers, it does — an unnecessary approval is a burden shifted to a human, P4-NF-16). The
request becomes a **pre-filled authorization request** — a kind-4 operator-action entry,
structured, completable from a phone, authored by the system. Three hard edges, each the answer
to an attack the first review named:

- **The approver reads the system's words; the sender's are quoted.** The request's frame — the
  operation, its classification, its profile, what approving grants — is system-authored from
  the register; the sender's ask appears only as delimited, quoted, untrusted content, never
  blended into the frame (P4-NF-17).
- **The needed standing is computed, never phrased.** Which standing the operation requires
  derives from the system's own classification of the operation — its register profile and
  kind — not from how the ask was worded; the holder set comes from the grant record; selection
  takes the *narrowest* standing that covers the operation, tied to the operator of the
  affected scope. And the approval is re-validated at the effect doorway against the *actual*
  operation — an approval harvested for a narrower-sounding classification does not transfer
  (P4-NF-18).
- **Routing is bounded.** Authorization requests coalesce per (requester, operation class) —
  the recurrence machinery below defines identity by classification, not wording — and a
  per-requester rate bound holds, so a verified requester cannot turn drip-fed asks into a
  denial-of-attention on the approver's surface (P4-NF-19).

The original ask is preserved as owned durable work in an **awaiting-authorization** state, and
the sender gets the honest receipt — which says an approval was requested and does *not* name
the holder (who approves is org structure; a requester learns it when the org chooses, not from
the doorway — the naming is a per-org Value, off by default). Awaiting-authorization has **no
timeout-to-yes arm, by shape** (rule 98; P4-NF-20 — the type is part five's, named here the way
part two named part eight's) — and it has explicit non-yes terminals: **declined** (a recorded
no, receipted) and **expired** (aged out at its bound, receipted), so rule 46's drain covers it
and "silence is never a yes" never becomes "silence is an immortal queue entry."

**Rule — every authorization that reaches an approver is a candidate standing grant, bounded by
what was actually approved.** Rule 104. **Check:** the candidate grant is derived from the
system's operation classification — same principal, the *exact* action set and scope the
individual approval covers, with a term — and a candidate whose action set or scope exceeds the
approval it derives from is a refused shape (P4-NF-21): rule 104 spares human memory; it does
not install an escalation ratchet beside the approve button. The candidate is surfaced **on
genuine recurrence only** (second identical classification within the would-be term), with the
recurrence history rendered (P4-NF-22) — which also shrinks the grooming surface a
first-contact candidate would offer.

**Rule — silence is never the operator's consent, and a peer's silence counts only when the
peer provably heard.** Rule 98. **Check:** the no-timeout-to-yes shape (P4-NF-20); peer-silence
concurrence requires the request's *declared* deadline (cited in the concurrence record), a
deadline floor, and proof the request reached a delivery state the peer answers for — a
partitioned peer never went silent; it never heard (P4-NF-23) — and concurrence can never
substitute where part one requires an `Authorization`.

**Rule — boundaries come from governance, never from the doorway's taste.** Rule 103.
**Check:** every refusal at this doorway names the rule or the missing grant it rests on
(P4-NF-24).

**Value — three standings are enough, here.** The glossary fixed operator, delegate, requester;
this part adds none. Finer tiers are delegate grants with named actions; an implicit tier is an
unreviewed one.

---

## Directives at the doorway

An intent arrives *under* the directives in force — resolved at the same causal position as
standing, recorded on the intent — so the work that follows is shaped by what the operator
already said, not by what a session happens to remember.

**Rule — a directive holds until superseded or done.** Rules 93 and 104-adjacent; part one's
type makes expiry unrepresentable. **Check:** a session acting on an intent whose `under` omits
a directive live at its causal position fails (P4-NF-25).

---

## Multi-machine posture

Stated explicitly, as rule 113 requires:

- **Dedup is shared state with a named merge class.** The admission ledger is a projection over
  admission facts, folding (adapter, channel, event id) as **exclusive-singleton**: concurrent
  admissions of one key on two machines during a partition surface as part two's `Conflict` —
  and if both sides already acted, the second execution's effects carry the contested taint
  part two's fold provides, surfaced for reconciliation rather than silently kept. The residual
  window is replication lag, measured; the reconciliation is part two's machinery, correctly
  named this time (fact-id collapse cannot do this job — two machines minting two facts for one
  event have two different fact ids by construction).
- **The unresolved queue and grounding substrate are machine-local, rebuildable** — declared
  per part three, derived from the spine.
- **Conversation bindings ride the fact spine** — a binding is a grant, grants are facts, so
  the binding a machine resolves against is as current as its fold, with authority reads
  failing closed past staleness exactly as part two fixed.
- **Conversation ownership is not this part's.** Leases, handoffs, one-voice: parts five and
  six. This doorway's obligation is idempotent admission wherever it happens, and it says so.

---

## What is rejected where

Refusals at this doorway are values, never exceptions, and every one preserves its input. At
the adapter: transport-invalid stimuli, against its captured-bytes fixtures. At the port, in
sequence order: nothing before preservation refuses anything (there is nothing yet to lose);
dedup collapses (and flags mismatches) but never errors; authentication and resolution refuse
into the hold, not into the void; standing exceeds route into authorization; admission's
refusals are part two's ladder, unchanged. Downstream of the port, nothing decides identity or
standing — the doorway is the one place those resolutions happen (rule 66), and everything
after receives resolved values or does not run.

---

## The negative contract fixtures

Continuing the cross-part convention: **P4-NF-nn**, each with its stage (`contract` — the
shared adapter suite; `test`; `build`).

**Rule — the fixtures are the contract.** Rules 34, 36, 37, 69. **Check:** as parts one
through three.

| # | Stage | Shape | Refused/failed because |
|---|---|---|---|
| P4-NF-01 | contract | Any drop or interpretation reachable before the raw bytes have their arrival hash and durable reference | Preservation precedes everything that can lose the input — dedup included. |
| P4-NF-02 | contract | An adapter claiming `verified` provenance for a stimulus it can only attest | The class is what the evidence supports, never what the adapter asserts. |
| P4-NF-03 | contract | A missing, reused, unstable, or replayed event id under the adapter's declared `eventIdAuthority` escaping its declared handling | The dedup contract is declared per adapter and fixture-priced, not assumed. |
| P4-NF-04 | test | A conversation's first sender resolving as its operator without a binding grant | The anchor is a recorded verified act, never whoever spoke first. |
| P4-NF-05 | test | A standing resolution that consulted message content, or elevated on an asserted operator status | A claim of standing is content; content confers nothing. |
| P4-NF-06 | build | An externally-triggered entry point that neither routes through the port nor carries a declared exemption | One doorway, enforced by enumeration plus the ports — with the dynamic residual named, not denied. |
| P4-NF-07 | test | An inbound secret span reachable outside secret-store custody, including via the intake capture | Two artifacts: custody holds the original; every consumer sees the redacted capture. |
| P4-NF-08 | test | A dedup collapse whose redelivery hash differs from the original, handled as a silent duplicate | Same id, different bytes is an attack signal, recorded and surfaced. |
| P4-NF-09 | test | A system-class stimulus admitted on locality rather than a package-minted or signed credential | A local process reaching the port is rule 29's threat, not its exemption. |
| P4-NF-10 | test | An unresolvable sender's message dropped, or answered as if verified | Held, authority-inert, drained on a bound. |
| P4-NF-11 | test | A post-compaction first reply that does not account for the last inbound id | Continuity is disclosed, never bluffed. |
| P4-NF-12 | test | An intent admitted as durable work without a declared owner and blocked-on state | Rule 83's own check, held at minting. |
| P4-NF-13 | test | A gate withholding a resolved user's or operator's message on a cannot-decide signal | The protected channel fails toward delivery; cannot-decide is not decided-unresolved. |
| P4-NF-14 | test | An unambiguous operator stop riding the ordinary sequence behind grounding and minting | The one message whose latency matters most has the deterministic fast path. |
| P4-NF-15 | test | A held item aging past its bound without the coalescing budget and a receipted terminal | Accepted intake drains; nothing is silently gone. |
| P4-NF-16 | test | A request within the agent's operating standing routed for approval anyway | An unnecessary approval is a burden shifted to a human. |
| P4-NF-17 | test | An authorization request rendering sender prose outside the delimited untrusted envelope | The approver reads the system's words; the attacker's are quoted. |
| P4-NF-18 | test | A needed-standing determination derived from ask phrasing, or an approval accepted at the effect doorway for an operation exceeding its classification | Standing needs are computed from the register; approvals re-validate against the actual operation. |
| P4-NF-19 | test | A requester exceeding the authorization-request rate bound producing further approver interrupts instead of coalesced recurrence | Routing is bounded; attention is a finite surface. |
| P4-NF-20 | build | An awaiting-authorization type carrying any timeout-to-yes arm (type owned by part five, named here) | Approval cannot be constructed from absence, by shape. |
| P4-NF-21 | test | A candidate standing grant whose action set or scope exceeds the approval it derives from | Rule 104 spares memory; it does not install a ratchet. |
| P4-NF-22 | test | A candidate grant surfaced on first contact, or a recurrence rendered without its history | Candidates appear on genuine recurrence, with the evidence. |
| P4-NF-23 | test | Peer-silence concurrence without the declared deadline, the deadline floor, and proof of delivery | A partitioned peer never went silent; it never heard. |
| P4-NF-24 | test | A doorway refusal naming neither a rule nor a missing grant | Boundaries come from governance, not taste. |
| P4-NF-25 | test | A session acting on an intent whose `under` omits a directive live at its causal position | The operator's standing instructions shape the work, structurally. |

---

## The terms this part introduces

| Term | Kind | Definition |
|---|---|---|
| **conversation binding** | noun | The recorded, verified-provenance grant naming a conversation's operator and scope. The anchor operator standing resolves through; never established by a message. |
| **intake port** | noun | The single doorway every stimulus enters through; adapters translate transports into its one shape. |
| **intake contract suite** | noun | The shared fixture set an adapter passes before its entry is live. |
| **event-id authority** | field | An adapter's declared dedup contract: who mints stimulus ids, their uniqueness scope, replay window, and fallback fingerprint policy. |
| **the agent's operating standing** | noun | The recorded grants whose grantee is the agent principal, resolved as any principal's standing is. What the agent may do without asking anyone. |
| **operation classification** | noun | The system's own typing of a requested operation — register kind and profile — from which needed standing, recurrence identity, and candidate grants derive. Never a function of the ask's wording. |
| **authorization request** | noun | The pre-filled, phone-completable, kind-4 request routed to a standing holder; system-framed, sender-quoted. |
| **awaiting-authorization** | noun | The owned, durable state of work paused on a routed authorization. No timeout-to-yes; declined and expired are its receipted terminals. |
| **candidate standing grant** | noun | The grant offered beside a *recurring* approval — exactly the approved action set and scope, with a term. |
| **session-start evidence** | noun | What a session proves at its actual start: history coverage, a fresh clock measurement, the authenticated principal, the last inbound id. |

---

## The parent's rule list, discharged one by one

The big picture's §3 names sixteen rules over this doorway:

| Rule | Verdict here |
|---|---|
| 4 (structure decides alone on exact match) | **Held**: the port's kind-2 declaration classes every gate; the emergency stop gains its deterministic doorway path (P4-NF-14); every refusal preserves. |
| 14 (operator channel sacred) | **Held, scoped exactly**: fails-toward-delivery for resolved protected senders (P4-NF-13); the unresolved hold is a decided outcome, not a swallowed message. |
| 23 (self-unblock before escalating) | **Held at the doorway** (P4-NF-16, over the now-defined operating standing); the stored exhaustion-run machinery is part five's. |
| 28/29 (verified principals, session input included) | **Held**: the binding (P4-NF-04/05), system-class verified provenance (P4-NF-09), `kind: system` and `kind: agent` through one port. |
| 36 (parsers against captured bytes) | **Held**: adapter fixtures in the contract suite. |
| 42 (failure as value) | **Held**: no adapter throws across the port; every refusal preserves. |
| 46 (accepted intake drains) | **Held**: bounded, measured queues with receipted terminals (P4-NF-15); awaiting-authorization included. |
| 83 (the agent carries the loop) | **Held at minting, by fixture** (P4-NF-12); carriage is part five's. |
| 93 (directives hold until superseded or done) | **Held at the doorway** (P4-NF-25). |
| 96 (a session grounds in its full history) | **Held at the handoff**: the doorway supplies the substrate; the session-side fresh read at actual start is part five's obligation, named. |
| 98 (silence is never consent) | **Held**: P4-NF-20/23, with the delivery-proof floor. |
| 100 (a secret is stored before spent) | **Held with the stated residual**: two-artifact custody (P4-NF-07); shape-based scanning is best-effort, remedy rotate-retract-record. |
| 103 (boundaries from governance) | **Held**: P4-NF-24. |
| 104 (every authorization is a candidate grant) | **Held, bounded**: subset-of-approval candidates on recurrence (P4-NF-21/22). |
| 110 (compaction disclosed) | **Held at the doorway's substrate** (P4-NF-11); the resuming session's obligation rides part five. |

---

## What this part makes checkable

The identity-bleed class becomes unwritable end to end: no principal from a string (part one),
no operator without a binding (P4-NF-04/05), no authority from content, no approval from
silence, no candidate grant broader than its approvals (P4-NF-21), no attacker prose wearing
the system's voice (P4-NF-17), and no request lost between "not allowed" and "not done"
(routing, with bounds). The doorway's earliest drop point is behind preservation; its dedup
cannot censor; its secrets have custody; its one-doorway claim is enforced by enumeration plus
ports and honest about the dynamic residual.

What this part does not hold, named: the run graph, ownership, leases, the exhaustion-run
machinery, the session-side grounding read, and the awaiting-authorization type (part five);
conversation serving across machines (parts five and six); the judgment doorway that may refine
`ask` (part seven); the effect-doorway re-validation this part's P4-NF-18 names (part eight);
the operator surfaces where authorizations complete and bindings are established (part eleven).

---

## What I want from you on this document

1. **The conversation binding, and how it reads against part one.** Operator standing anchors
   to a recorded, verified-provenance binding; the per-message chat attestation only selects
   within it; a bot-token takeover therefore reaches one conversation's scope, never the walls
   or the PIN surfaces. I believe this composes faithfully with part one's provenance wall;
   the alternative is a formal part-one amendment through its version chain. Confirm the
   composition reading, or direct the amendment?
2. **Two shape amendments ride this bundle** (part three's convention): the parsers kind gains
   `authenticationClass` and `eventIdAuthority`; the glossary's profile-declaring kinds gain
   parsers. Approve the bundle?
3. **Beyond-standing requests route, bounded and quoted.** The approver sees the system's
   framing with the sender quoted as untrusted content; needed standing is computed from the
   operation, not the phrasing; requests coalesce per requester and class. The receipt does
   *not* name the approver by default. Right lines?
4. **Candidate standing grants appear only on recurrence, and never exceed the approval.**
   Less one-tap convenience on first contact, no grooming ratchet. Confirm?
5. **Unresolved senders: held, drained, and — on public transports — not acknowledged.** A
   holding notice where the relationship warrants it; silence toward strangers, because an
   unconditional ack is an enumeration oracle. Right default?
6. **The emergency stop's doorway fast path** — deterministic recognition from the bound
   operator, acting before grounding and minting. Confirm the shape?

---

*Depends on: the approved rules, register, glossary, big-picture design, and parts one through
three, and their changelogs. Next after approval: part five, the durable run graph, delegation
contracts, and the agent-transport port.*
