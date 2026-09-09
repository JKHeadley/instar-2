**Status: draft, awaiting approval. Governed.**

# Part twelve — the conversation adapters

**Value — purpose.** A person should be able to write to Instar on Telegram and receive one
attributable answer without a worker holding a bot credential, a transport inventing authority,
or a crash turning uncertainty into a duplicate message. This part makes Telegram the reference
conversation adapter and applies the same family contract to Slack, WhatsApp, iMessage, and web.
The adapters remain replaceable edges. They translate authenticated platform evidence into part
four intake and translate part eight effects into platform operations. Whether these five
platforms are the right product set is an operator judgment, not an automatic check.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 89, 91, 105, 111
and 113; **checks: P12-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Every claim
belongs to its nearest Rule or Value block. A named contract check is a requirement for later
implementation, not evidence that code exists or ran. Present-tense Instar 1.x claims in section
ten come only from the named modules in the required layer-below audit. Measured means recorded
execution on named hardware, platform mode, account, workload, and fault schedule. A configured
target, a mock, a fixture replay, and an estimate are not measurements of a live adapter.

---

## 1. Ownership and boundaries

**Rule — part twelve defines no new core type.** Rules 1, 30, 49, 69 and 90; **checks:
P12-NF-01–03**. A conversation adapter is a concrete package behind public ports already owned by
earlier parts. Adapter methods, platform constants, and private protocol state are implementation
details. Durable records use the following owned types. This part creates no second message,
principal, binding, queue, retry, effect, receipt, verification, assembly, or surface schema.

| Owner | Names consumed here |
|---|---|
| One | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Authorization`, `Scope`, `Result`, `Outcome`, `Evidence`, `Measurement`, `Profile`, `Decision`, `Conflict`, `UnresolvedInput`, provenance and secret references |
| Two | fact envelope, durability state, capture reference/status, causal frontier, lineage, projection, checkpoint, folded-through vector, taint, redaction and replay |
| Three | declaration, parser entry, register generation, governed port, check-run record, rule graph, freshness and activation state |
| Four | intake port, conversation binding, event-id authority, acknowledgment policy, operation classification, authorization request and session-start evidence |
| Five | durable run, run step/transition/exit, `SessionGrounding`, agent-transport envelope and delivery evidence; `ContinuityAccounting` is designed by Five but is not in its landed record union |
| Six | lease, fence token, admission reservation, operation and delivery-attempt identity, dispatch-claim, loop record, recovery record and custody receipt |
| Seven | judgment request/resolution, advisory decision, benchmark record and measured hold cost |
| Eight | `OperationDefinition`, `EffectRequest`, `EffectValidation`, `OperationObservation`, `EffectSettlement`, `OutboundMessage` and `OperationAdapterPort` |
| Nine | verification plan/request/assessment, probe record, semantic review, grade, assessment closure and independent witness posture |
| Ten | `AdapterEvidenceContract`, `AdapterConformance`, `AssemblyManifest`, `AssemblyAdmission`, `HarnessLaunchSpec`, `HarnessObservation`, `AssemblyHistoryReadPort`, concrete binding, confinement and package lifecycle |
| Eleven | verified pairing/binding surfaces, minimal-plane dependencies, operator views and whole-slice acceptance |

Two required owner additions are not in the landed contracts. Secret-bearing intake depends on
`design-conversation-adapters-seam-request-intake-custody.md`. The Four-owned consumer is granted in
`seam-response-intake-followup.md`, and the Ten-owned custodian is granted by reference in
`seam-response-assembly-followup.md`. P12-NF-12's secret-safe positive is non-executable until both
grant files land and their implementations are integrated. The operation keeps original secret
bytes exclusively in secret custody and gives ordinary intake consumers only a redacted capture.

Slack direction, organization permission, and ambient handling depend on
`design-conversation-adapters-seam-request-intake-policy.md`. Four's structural direction,
organization-permission, and channel-policy record and consumer are granted in
`seam-response-intake-followup.md` (SEAM-LEDGER row 18). Seven's versioned intake-policy judgment
consumer, which does not require an existing Part Eight effect request, is granted in the dated
addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35). P12-NF-19/20's policy-bearing
positives and Slack activation are non-executable until both named grant files land and their
implementations are integrated. None of these granted but unlanded records or operations is
treated as present in the executable slice.

Slack ephemeral delivery has its own Part Eight audience dependency. The single-member payload and
evidence contract is granted in the 09:10Z addendum to `seam-response-effects-followup.md`
(SEAM-LEDGER row 53), extending the conversation variants in
`seam-response-effects-payloads.md`. P12-NF-32's positive is non-executable until both grant files
land and their implementations are integrated. The operation names exactly one channel member
resolved from signed Part Four history, reports unsupported when private delivery to that member is
unavailable, records the audience actually reached, and never widens to channel text on retry or
fallback.

Five's landed `SessionGrounding` describes the history, clock, worker, harness, and current-work
coverage for `start`, `recovery`, and `resume`. Its landed consumption validator, however, accepts
only a flat compatibility receipt with top-level `worker`, `harness`, and JSON-string `hashes` and
`classes`. Ten's production evidence is instead a signed `HarnessObservation` stored under
`body.record` and resolved through Ten's public `AssemblyHistoryReadPort`. The initial-context arm
follows its admitted `HarnessLaunchSpec` under the dated 06:33Z grant in
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 38). The later-delivery contract is refined by
the 08:48Z grants in `seam-response-assembly-followup.md` and
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 45). Ten's immutable context-delivery
specification binds the current candidate step, intake/input and digest, ordered current manifest,
generation, execution context, unchanged incarnation, delivery reason, admitted delivery
operation, one-use claim, and predecessor delivery. Five resolves that current specification and
its consumption observation rather than requiring later input or context to equal the launch's
original input or manifest.

The `GroundingReadPort.read` invoked by `RunGraphPort.ground()` owns one complete actual-start
sequence: sample the fresh clock and current history/run/directive/register/pending-work state;
append and resolve the current Ten delivery specification; drive its admitted delivery; witness and
re-resolve `context-consumed`; then return `SessionGrounding` with the clock sampled inside that
read. `transition(start)` repeats resolution of the launch, current delivery specification,
consumption observation, grounding, current step/input, and current Six execution context. The
initial input, a second distinct inbound, and changed post-compaction context therefore produce
three immutable, distinct delivery records on one unchanged incarnation. P12-NF-43/44/48's
production positives are non-executable until both row-45 grant files land and their Ten/Five
implementations are integrated; row 38 remains the initial-context arm only. The flat receipt
remains valid only for isolated compatibility fixtures. Stale, wrong-kind, partial, conflicted,
mismatched, non-consumed, incomplete-manifest, pre-completed, or retimestamped evidence refuses.

Compaction has a separate dependency. Five's `ContinuityAccounting` producer is granted in
`seam-response-run-closure.md`, its public producer/reader follow-up is granted in
`seam-response-rungraph-followup.md`, and Eight's first-reply consumer requested by
`design-conversation-adapters-seam-request-rungraph-continuity.md` is granted in
`seam-response-effects-followup.md`. The complete compaction case in P12-NF-43 is non-executable
until all three grant files land and their implementations are integrated. Part Twelve retains the
final family obligation but does not call the missing record existing.

Two further owner gaps block the real positive chain. The Nine/Eight outcome-consumption contract
requested in `design-conversation-adapters-seam-request-effect-assessment-consumption.md` is granted
in `seam-response-effects-followup.md`. P12-NF-35/44's settlement positive is non-executable until
that grant file lands and its Nine/Eight implementations are integrated. It preserves Nine's
original predicate-shaped evidence.

The Seven/Eight provider operation requested in
`design-conversation-adapters-seam-request-model-provider-effect.md` is granted on Seven's side in
`seam-response-judgment.md` and on Eight's side in `seam-response-effects-followup.md`.
P12-NF-43/44/48's real-model positives are non-executable until both grant files land and their
implementations are integrated. Neither the Nine stand-in nor Seven's reference executor is
treated as a landed positive.

Item-level ordinary-service fairness has a separate Part Six gap. The landed `LoopPolicy` has no
per-route backlog or eligible-route capacity. Its `BoundedDueScanPort` pages caller-supplied keys
but does not admit an item, establish first-in-first-out route position, freeze item-level round
membership, refuse overload, or record first service. The separately granted `pageBatch` arm in
`seam-response-loop-followup.md` bounds enumeration only and expressly remains selection-only.
P12-NF-40 therefore depends on the Part Six route-service policy, `admitRouteServiceItem`, and
round open/opportunity/close contract granted in the dated 08:03Z addendum to
`seam-response-loop-followup.md` (SEAM-LEDGER row 43). Its positive is non-executable until that
grant file lands and the resulting owner implementation is integrated.

Idempotent held and expired intake recovery has a separate Part Four gap. The landed duplicate
branch joins only an `intake-admitted` item. A matching redelivery of an `intake-held` item creates
another receipt and another hold with a later expiry. `IntakePort.recover(receiptId)` calls
`receive` again, so recovery of the original receipt does the same. The required Four-owned
receipt-continuation operation is granted in the dated addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 46). P12-NF-09/38 and the held-or-expired
redelivery and recovery arms of P12-NF-13/19/20/22/51 are non-executable until that grant file
lands and its implementation integrates. An adapter-local cache or private terminal filter
cannot satisfy this dependency.

**Rule — translation cannot become policy.** Rules 4, 28, 30, 42, 63, 66, 89 and 103;
**checks: P12-NF-03–05**. An adapter may authenticate a protocol exchange, preserve bytes, expose
capabilities, render an already admitted message, invoke one admitted platform operation, and
return observations. It may not select standing, establish a conversation binding, classify an
ask by prose, turn an advisory into a wall, turn a refusal into success, choose a retry, mint a
replacement effect, or bypass the register. Core packages contain no Telegram, Slack, WhatsApp,
iMessage, or browser-protocol branch. Part ten binds exactly one concrete adapter instance to each
declared account and mode.

**Value — a narrow adapter is easier to replace.** Platform libraries often offer routing,
authorization, retries, queues, formatting, commands, and session management in one object. This
design accepts the extra composition work of separating them. That cost buys one authority model
and one recovery model across every channel.

---

## 2. The family contract and capability declaration

**Rule — each instance declares its exact platform contract.** Rules 5, 30, 36, 44, 69, 89
and 105; **checks: P12-NF-03/04/48/49**. Each account-and-mode instance supplies part ten's
`AdapterEvidenceContract` and `AdapterConformance`. The required fields are grouped by the owner
that consumes them:

| Field group | Required instance facts and their use |
|---|---|
| Package and mode | Package and artifact digests, platform application programming interface and mode, parser declaration, and credential reference; Ten binds the exact implementation and custodian. |
| Authenticated identity | Account and tenant namespaces, sender and conversation identity sources, identity stability and churn rules, forwarding treatment, impersonation treatment, and event-id authority; Four resolves provenance, identity, binding, and deduplication. |
| Intake policy | Acknowledgment policy and disclosure scope; Four applies the declared intake behavior without letting the adapter confer authority. |
| Operations and evidence | Registered operation declarations, supported evidence stages, and unsupported evidence; Eight admits effects and Nine assesses only the declared stage. |
| Limits | Rate, byte, item, concurrency, and platform-specific bounds; Six and the owning doorway apply the registered ceilings. |
| Conformance evidence | Captured fixtures, live probes, check runs, limitations, and freshness; Nine and Ten decide whether this exact instance has current evidence for activation. |

A family default cannot fill an omitted instance field. Unknown support is unsupported for
activation.

**Rule — capabilities describe mechanics, never authority.** Rules 26, 28, 42, 63 and 89;
**checks: P12-NF-04/05/34**. The capability declaration may say that an instance can receive text,
fetch an attachment, post, edit, react, reply in a thread, query a receipt, or observe a status
callback. These entries describe platform mechanics only. The landed Part Eight path can execute
only one ordinary-text `OutboundMessage`; every other outbound capability remains unsupported in
this slice. The broader closed operation payloads and ordered aggregate are an explicit dependency
on `design-conversation-adapters-seam-request-effect-doorway.md`. A capability may not say that a
sender is an operator, that an effect is permitted, or that a platform acceptance is human receipt.
Every executable operation maps to a landed registered `OperationDefinition`. An unsupported
operation returns `Refused` through the effect doorway and does not disappear behind a no-op
adapter.

**Rule — transport and formatting terms are literal.** Rules 13, 36, 69 and 89; **checks:
P12-NF-04/18/20/29**. A webhook is a provider-pushed HTTP callback to a configured endpoint. Long
polling is an adapter-held, bounded HTTP request for new events, repeated from a durable cursor only
after prior events cross their custody boundary. Baileys is the linked-device WhatsApp client
library used by the audited 1.x backend; its behavior is not a provider guarantee. HTML and
Markdown are text-markup syntaxes. Telegram accepts declared subsets of them; Slack's `mrkdwn` is
Slack's separate markup syntax. A mode name or library name never substitutes for captured protocol
evidence.

**Rule — authentication strength is bounded by re-checkable evidence.** Rules 28, 29, 36 and
89; **checks: P12-NF-07/08/17/19/21/23/25**. A valid bot token, workspace token, webhook
signature, device account, or web session authenticates only the fields its protocol covers.
Ordinary provider-delivered chat events are at most channel-attested unless a registered stronger
source exists. Display names, usernames, phone labels, quoted authors, forwarded headers, message
text, local process identity, and adapter self-report never select a principal. The part-four
decoder re-resolves provenance from captured evidence and signed history at use.

**Rule — one conformance suite has mode-specific fixtures.** Rules 34, 36, 37, 62, 69 and 105;
**checks: P12-NF-01/04/45/46/48**. Every instance runs preservation, authentication, identity,
deduplication, binding, acknowledgment, formatting, limit, refusal, restart, uncertainty,
attribution, and evidence-stage cases. Bot, workspace, device-backed, and web modes use their own
captured wire bytes. One Telegram pass does not cover Slack. One WhatsApp backend does not cover
another. A live label additionally requires the production assembly, an authenticated real
account, fresh probes, and an independent part-nine witness.

---

## 3. Inbound custody before platform acknowledgment

**Rule — bounded routing extraction precedes the first durable receipt; every lossy choice follows
it.** Rules 7, 14, 29, 42, 46, 95 and 100; **checks: P12-NF-06/12/13/18/20/48**. The callback order
is physical capture, bounded route extraction, then intake receipt. Physical capture means holding
the bounded original transport bytes without changing them inside the designated ingress custodian;
it is not yet a fact receipt or recoverable drain. Route extraction may read only the structural
fields that the landed `IntakePort.receive(raw, route)` requires: `channel`, `sender`,
`identityEpoch`, and provider `eventId`. It reads declared envelope fields and authenticated
connection metadata. It does not interpret message content, deduplicate, filter, fetch an
attachment, acknowledge, or advance a cursor.

For a captured non-secret fixture, the landed path calls `receive` with unchanged bytes. Part
Four's landed capture port preserves those bytes, requires its capture hash to equal the raw input
hash, and Part Two appends the route-bearing `intake-receipt`. Only that fact receipt supplies a
recoverable drain. A fixture proves only its own bytes; it cannot certify that future production
input contains no secret. A crash after extraction but before the receipt leaves the provider event
unacknowledged and relies on provider redelivery; a crash after the receipt is recovered through
`IntakePort.recover(receiptId)`.

A matched secret cannot enter that landed call. The current implementation would place the original
bytes in its ordinary capture, pass them to authentication and parsing, and later recover by reading
them again. Production secret-bearing intake and P12-NF-12's two-artifact positive case therefore
depend on `design-conversation-adapters-seam-request-intake-custody.md`. The Four consumer is
granted in `seam-response-intake-followup.md`; the Ten custodian is granted by reference in
`seam-response-assembly-followup.md`. P12-NF-12's positive is non-executable until both grant files
land and their implementations are integrated. The boundary keeps the original only in secret
custody, commits its arrival hash, and supplies a separately hashed redacted capture for every
ordinary authentication, parse, recovery, and audit consumer. Until then, a mode that may receive
secret-shaped bytes cannot be called production ready. An over-limit event produces a bounded
preserved refusal with provider identity and available digest evidence; it is not partly
interpreted as a smaller message.

**Rule — protocol acknowledgment means only the declared custody stage.** Rules 26, 42, 46
and 89; **checks: P12-NF-06/11/18/20**. Slack envelope acknowledgment, webhook HTTP success, web
client receipt, Telegram offset advance, WhatsApp callback response, and an iMessage poll cursor
advance occur only after the exact event has a recoverable Part Four receipt. A level-triggered
drain means that repeated bounded scans rediscover every pending receipt until an owned terminal
disposition exists; it is not a one-shot in-memory notification. The acknowledgment policy still
decides whether an unbound or unresolved sender receives a conversational acknowledgment. A
protocol acknowledgment never means that a
principal resolved, a run began, a worker consumed input, or an answer was sent. If durable
capture fails, the adapter leaves the platform event unacknowledged where redelivery exists and
records the scoped outage through an independently durable path where it does not.

**Rule — deduplication follows capture and keeps its scope.** Rules 31, 33, 36 and 42;
**checks: P12-NF-09/10**. Part four's landed logical identity is the canonical tuple
`(adapter, channel, sender, identityEpoch, eventId)`. The adapter instance is `adapter`. The
`channel` value encodes the authenticated account or tenant and authenticated conversation
namespace in one unambiguous, versioned string. `sender` is always present, even where the provider
claims a globally unique event id. `identityEpoch` identifies the authenticated identity era so
provider reassignment cannot collide with earlier history. `eventId` is the provider-minted id
under the declared authority. Part twelve creates no second deduplication key. Same tuple and same
arrival hash joins the original state only after the landed owner has written `intake-admitted`.
Same tuple and different bytes records `Conflict` and an attack signal. An expired acceleration
cache cannot make an old event new because consumers re-resolve against durable history.

The family contract also requires a matching redelivery or receipt recovery to join an original
active hold or its expired terminal. It retains every arrival capture, the first logical
obligation, and the first hold's deadline. It does not append a fresh hold or turn an expired
terminal back into pending work. That behavior is not in the landed port: held state is absent
from its duplicate lookup, and recovery creates a new receipt by calling `receive`. The held and
expired positive therefore depends on the receipt-continuation addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 46) and is non-executable until that grant file
lands and its Four-owned implementation integrates.

**Rule — intake owns authentication, standing, and draining.** Rules 28, 42, 46, 68, 83 and
104; **checks: P12-NF-07/08/13–15**. After capture, the adapter supplies evidence to the part-four
port. First, the port authenticates the route and resolves a `VerifiedPrincipal`; otherwise it
preserves an `UnresolvedInput`. Next, it resolves the current conversation binding and grants at
the fact's causal frontier. It then mints the `Intent`. Finally, it creates owned durable work. An
unbound conversation remains requester-only. A stale or contested binding cannot select new
operator standing. Refusal, unresolved identity, rate refusal, consent requirements, and
unsupported content are explicit intake results with owners and drains; the adapter cannot
silently drop them.

**Rule — conversational acknowledgments are ordinary effects.** Rules 14, 42, 52, 63 and 87;
**checks: P12-NF-11/32/41/53**. A “got it” text and a fixed cold-start limited response both fit the
landed Part Eight `OutboundMessage` when they are attributable `ordinary-reply` text with a durable
`sourceResult`. The latter is produced only by Eleven's admitted minimal responder under its own
system-principal grant; an adapter does not invent it. A reaction, read receipt, typing indicator,
or non-text authorization notice remains unsupported by the current effect slice. Those forms are
granted in `seam-response-effects-payloads.md` and are non-executable until that grant file lands
and its implementation is integrated. Once integrated, they follow
the instance's acknowledgment policy and Part Eight's validation, ownership, notification bound,
and settlement. Fire-and-forget is never valid. Failure of a decorative acknowledgment cannot hide
or terminalize the accepted intake.

---

## 4. Durable conversation identity and binding selection

**Rule — a platform conversation key is stable, scoped, and separate from a sender.** Rules
28, 31, 33, 69, 89 and 104; **checks: P12-NF-14–16/19/21–26**. The adapter supplies the
platform-authenticated tuple from which part four selects the conversation named by a binding.
The tuple includes the adapter instance and authenticated account or tenant so equal provider ids
in two installations never collide. The sender identity is a separate field. Deletion, archival,
rename, worker restart, machine transfer, and cursor reset do not mint a replacement conversation.
A provider-reassigned account, address, or identifier triggers the declared churn path and
requires a new verified binding act.

| Platform mode | Conversation evidence carried to part four | Sender evidence kept separate |
|---|---|---|
| Telegram bot | Bot/account identity, chat id, and forum topic id; the general topic has one canonical normalized representation | `from.id`, or the distinct authenticated channel/sender-chat fields when no human sender exists |
| Slack workspace | Verified team id, channel id, and thread-root timestamp in thread-scoped mode; verified team id and channel id in declared channel-scoped mode | Slack member id; bot/app authors remain non-human sources |
| WhatsApp Business | Business account/phone-number identity and chat or group id | Provider sender id and group participant id |
| WhatsApp linked device | Enrolled device/account identity and chat or group Jabber identifier (JID), the provider routing address | Authenticated sender/participant JID; a linked-identity alias is evidence, not a guessed phone owner |
| iMessage device | Enrolled device/account/service identity and stable chat globally unique identifier (GUID) | Actual sender handle plus its churn evidence; a normalized phone or email is not the conversation |
| Web | Installation/tenant and server-minted conversation id bound to the authenticated account/session | Authenticated account principal; anonymous and expired sessions remain authority-inert |

**Rule — thread policy is declared before the first event.** Rules 31, 33, 44 and 89;
**checks: P12-NF-16/19/26**. Telegram forums always use the authenticated topic identity. A Slack
instance declares channel-scoped or thread-scoped directed work. In thread-scoped mode, a top-level
message's own timestamp is its thread root from the first intake, so the first reply cannot move
the work from a channel identity into a new thread identity. WhatsApp quoted-message ids and
iMessage reply relations remain reply links unless the provider exposes and the contract declares
a durable thread namespace. A web tab is not a conversation identity.

**Rule — aliases preserve history but cannot merge authority.** Rules 7, 28, 32, 33 and 90;
**checks: P12-NF-14/15/26**. A platform migration, imported legacy numeric id, or corrected
provider alias is an append-only mapping with provenance and conflict handling. It never edits
old facts. Cross-platform bridges preserve original source and forwarder as separate evidence and
do not merge bindings because content or display names match. Only part eleven's verified binding
surface can bind, transfer, or supersede the operator selection. The first sender never self-binds.

**Rule — the 1.x conversation registry migrates without inventing missing evidence.** Rules 7,
33, 44, 45, 46 and 90; **checks: P12-NF-26/49/52**. Migration reads the exact
`ConversationRegistry` and `conversationIdentity` journal and snapshot shapes. A bind pin is the
1.x record that retains the Slack tuple resolved for a numeric id, plus a reference count. It is
route evidence only; it is not a verified operator binding. The imported classes have these exact
destinations and missing-data dispositions:

| Legacy class | Exact destination | Missing-data disposition |
|---|---|---|
| Snapshot metadata (`version`, high-water sequence, workspace pin) | Retained import capture and compatibility-decoder checkpoint only | It scopes replay of the captured 1.x files. A configured or locally observed workspace pin is not current authentication, binding, or live evidence. |
| Positive Telegram id held by an existing consumer | Part Twelve compatibility lookup to the authenticated Telegram account/chat/topic tuple | Preserve the original reference. Do not infer a topic, sender, identity epoch, or binding that the consumer did not store. |
| `mint` record or snapshot conversation entry | Part Twelve compatibility lookup from the negative id and canonical Slack key to its recorded team/channel/thread tuple and origin | Preserve the raw record and recorded tuple. A missing or placeholder team stays unresolved and cannot select an intake route. |
| One-hop `alias` | Part Twelve compatibility lookup from loser id to winner id, retaining the raw record | A missing target, chain, cycle, or conflicting tuple becomes an inert capture and owned migration block; it is never flattened by guess. |
| `bind-pin` / `bind-release` and snapshot bind pin | Part Twelve compatibility lookup retains the referenced tuple and count; Part Eleven may present it as evidence during a new verified binding act | Never construct Part Four's authority-conferring `conversation-binding` from the pin. An unmatched release or absent tuple remains inert. |
| `reachability` | Historical, local 1.x observation in the retained import capture | It does not become Part Nine delivery evidence, a live probe, or current route authority. Current reachability must be observed again. |
| `send-intent` or snapshot send intent | Inert captured legacy-send evidence linked to owned blocked migration work | A send key, lane, sequence, timestamp, or target cannot supply the payload, 2.0 run, `OperationDefinition`, reservation, claim, digest, assessment, or provider receipt required by Six and Eight. Create no `EffectRequest`, claim, observation, or provider call. |
| `ambiguous-send` or snapshot ambiguous send | The same inert captured legacy-send evidence, explicitly `uncertain` and suppressed from invocation | Missing payload or provider evidence stays missing. A time-to-live, abbreviated TTL, is the configured retention or suppression interval; its expiry is not non-occurrence proof and cannot authorize replay. |
| `send-intent-resolved` | Retained historical assertion that the 1.x intent left its pending set | It is not a Part Eight settlement or proof of non-occurrence. Reassessment requires real evidence under the current owner contract. |
| `send-retire` | Retained historical assertion that 1.x retired the send guard | It is not a delivery assessment, approval, or settlement. No 2.0 terminal is invented. |

The landed core cannot represent an authority-inert legacy conversation reference together with
owned blocked migration work, nor can its closed Part Eight records represent a payload-less
legacy send. Migration activation therefore depends explicitly on
`design-conversation-adapters-seam-request-legacy-import.md`. Four's authority-inert reference is
granted in `seam-response-intake-followup.md`, Five's owned blocked work in
`seam-response-rungraph-followup.md`, and Eight's non-executable send evidence in
`seam-response-effects-followup.md`. P12-NF-52's import positive is non-executable until all three
grant files land and their implementations are integrated. Until then, the supported action is a
read-only dry run that reports every exact record and why it is unmappable; it neither imports nor
replays it. After integration, the source bytes remain in Part Two custody and the additive owner
records link to that capture. Existing `deliverToConversation` consumers and every caller that
stores a numeric conversation id move in the same migration. This consumer set includes
`PromiseBeacon`, its server composition, conversation lookup surfaces, and durable commitment or
follow-through records carrying a topic id.

That migration preserves PromiseBeacon's separate outer output gate. Missing or false
`userOutputEnabled` keeps both conversation output and Attention output silent, including summaries
already queued before migration. Only explicit `userOutputEnabled === true` permits pending beacon
work to enter the normal effect path. P12-NF-49/52 exercise opted-out and opted-in pending work so
importing a queue cannot silently enable notices. This policy is independent of the old delivery
funnel's dark or dry posture. The 1.x files retire as an authority only after every reference
resolves or has an owned inert disposition and no unresolved legacy send can reach a provider.

---

## 5. Telegram as the reference adapter

**Rule — one Telegram instance uses one admitted intake mode.** Rules 30, 36, 43, 62 and 89;
**checks: P12-NF-16–18/46**. A Telegram bot instance declares webhook or long-poll mode, its bot
identity, token reference, API version, cursor/callback contract, limits, and supported operations.
A fresh authenticated platform identity probe must match the declared bot before the instance is
admitted. A present token or running process is not life. Two modes may not consume the same bot's
updates concurrently unless the platform contract proves a single durable delivery stream.

**Rule — deployment constraints select the Telegram ingress mode.** Rules 26, 36, 42 and 43;
**checks: P12-NF-18/46**. If the deployment is permitted to operate a public ingress endpoint and
records acceptable endpoint availability plus capture-before-response behavior, it selects webhook
mode. Otherwise it selects long polling and proves capture-before-offset behavior. Exactly one mode
is admitted per bot. The adapter declaration records the constraint and the measured evidence; an
implementer does not ask the operator to choose between equivalent mechanics after those facts are
known.

**Rule — Telegram update identity and topic routing are exact.** Rules 28, 33, 36 and 89;
**checks: P12-NF-16/17**. The provider `update_id`, scoped to the verified bot instance and
authenticated chat, is the event identity. The conversation evidence uses chat id plus normalized
forum topic id. A direct chat and a forum's general topic have declared canonical forms. Replies,
callbacks, edited-message events, channel posts, service events, media metadata, and unsupported
update kinds each have captured fixtures and an explicit intake or ignored-with-record disposition.
Forwarded origin and quoted author remain untrusted content. A channel-post identity cannot be
coerced into a human principal.

**Rule — Telegram never advances beyond uncaptured work.** Rules 14, 42 and 46; **check:
P12-NF-18**. Long polling commits an offset only through the last consecutively durable captured
update. A handler, parser, run, or worker failure after capture leaves a due drain obligation and
may redeliver the same event safely. A webhook returns protocol success only after that boundary.
Process restart reconstructs both positions from facts; it does not trust an in-memory set or a
newest timestamp.

**Rule — Telegram media keeps original custody and derived provenance.** Rules 7, 29, 36, 42,
46 and 75; **checks: P12-NF-12/13/17/18/51**. Instar first captures the original update containing
the authenticated file reference before acknowledging it. Media fetching and voice transcription
remain unsupported in the landed ordinary-text slice. The executable neighbor preserves the
original update, then Part Four's closed classifier returns `needs-judgment`. Its landed port writes
an `intake-held` fact with the configured work owner and finite expiry. If unresolved, that hold
ends as the explicit `expired-judgment` terminal. This path makes zero file-fetch,
transcription-provider, or fallback-send calls; it does not claim a distinct unsupported-content
result that Four cannot produce. That single-arrival neighbor is executable. Its redelivery and
receipt-recovery arm is non-executable until the receipt-continuation addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation
integrates; it must retain the first hold and deadline. Successful media handling depends on the requested Part Eight
`fetch-inbound-media` and `derive-transcript` operations. After that seam is accepted and
implemented, Part Six owns their claims, bounds, and recovery. The confined Part Ten custodian uses
the bot credential. Part Two holds downloaded bytes and provider responses by capture reference. If
transcription uses a model doorway, Part Seven owns its provider attempt and receipt. Part Five owns
the run step that consumes the captured result. A transcript is derived evidence linked to the
original `Intent`; it is never injected as a new verified sender message. Download, type, size, or
transcription failure leaves the original intake preserved with an explicit owner and result. The
adapter neither sends a private fallback reply nor deletes the obligation.

**Rule — Telegram outbound operations are individually registered.** Rules 30, 52, 63 and 66;
**checks: P12-NF-27–36**. Post text, post media, edit, `delete-message` where separately authorized,
react, create topic, and send a conversational acknowledgment are distinct planned operation
declarations. Only post text is executable through the landed Part Eight ordinary-reply contract.
Post media, edit, react, topic creation, and non-text acknowledgment depend on the granted typed
payloads in `seam-response-effects-payloads.md`. The additive `delete-message` operation, including
its target observation, platform deletion scope, and Part Nine-witnessed non-existence result, is
granted in `seam-response-effects-followup.md`. Every non-text positive in P12-NF-27–36 is
non-executable until its named grant file lands and the implementation is integrated. The reference
reply path accepts an already validated `OutboundMessage` and no raw bot credential. It returns
capture-backed provider bytes or typed transport uncertainty. A successful Bot API post is evidence
for Part Nine to assess; it is not itself a delivered or read stage. Telegram exposes no assumed
human-read receipt.

**Value — Telegram goes live before breadth.** Telegram is the reference because its bot and forum
semantics exercise authenticated sender ids, durable topics, polling or callbacks, formatting,
media, rate limits, and a real phone surface. The other adapters can be developed while dark, but
none inherits Telegram's activation evidence.

---

## 6. Slack, WhatsApp, iMessage, and web

**Rule — Slack preserves before persistent-stream acknowledgment.** Rules 14, 36, 42, 46 and 89;
**checks: P12-NF-19/20**. Slack Socket Mode is Slack's persistent authenticated WebSocket envelope
stream. Slack authenticates the app connection and verifies the connected team identity. The outer
event or interaction id is scoped to that team and app; a message timestamp is also scoped to its
channel. Socket Mode acknowledges an envelope only after durable capture.
Webhook mode verifies the registered signature and replay window before supplying provenance.
Reconnect history is a recovery source, not permission to make new semantic ids. Thread replies
retain the root identity and outbound posts use the same channel and root tuple.

**Rule — Slack admission separates structural direction, permission, and semantic judgment.**
Rules 4, 10, 14, 28, 42, 46, 57, 66, 86 and 87; **checks: P12-NF-19/20/41**. The landed Part Four
port cannot yet record whether an authenticated Slack event is a direct message, an explicit
mention, a registered command, or undirected channel traffic. It also cannot consume an
organization-permission decision or record a `speak`, `react`, or `silent` disposition. Its closed
slice accepts ordinary requester text or creates the generic owned `needs-judgment` hold described
above. That narrow behavior is the only current positive; it must make no private permission,
direction, ambient, reaction, or send decision. Its single-arrival hold is executable. Its
held-or-expired redelivery and receipt-recovery arm is non-executable until the
receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and
its Four-owned implementation integrates.

The broader Slack policy and Slack activation depend on
`design-conversation-adapters-seam-request-intake-policy.md`. Four's structural direction,
organization-permission, and channel-policy record and consumer are granted in
`seam-response-intake-followup.md` (SEAM-LEDGER row 18). Seven's versioned intake-policy judgment
consumer, which does not require an existing Part Eight effect request, is granted in the dated
addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35). The Four-owned policy record
binds the intake receipt, authenticated structural direction evidence, signed organization-policy
and standing inputs, current policy generation, any Seven judgment reference, and one closed
disposition. Four re-resolves permission and standing and consumes the disposition for admission or
held work. Seven owns any semantic ambient judgment within the registered `speak`, `react`, or
`silent` floor. Five consumes admitted or context-only work, and Eight alone can execute `react` or
`speak`. Unavailable judgment keeps directed conversation deliverable with a recorded uncertainty
under its declared fail-open policy, while ambient work selects the registered conservative
disposition without erasing the capture. P12-NF-19/20's broader direction, permission, and ambient
cases are non-executable until `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the dated
intake-policy addendum in `seam-response-judgment.md` (SEAM-LEDGER row 35) land and their
implementations are integrated. No Slack instance may activate on them.

**Rule — WhatsApp backends are different evidence modes.** Rules 28, 36, 44, 89 and 105;
**checks: P12-NF-21/22**. The Business API verifies its webhook signature, business account,
phone-number identity, provider event id, sender id, conversation id, and status callbacks. A
linked-device backend declares its enrolled device/account proof and the weaker provenance that
proof supports. A Linked Identity identifier (LID) is WhatsApp's opaque linked-device JID ending in
`@lid`; it does not contain a verified phone number. A LID, other linked-identity JID, phone
normalization, self-chat heuristic, contact label, or group name cannot establish a principal.
Group identity and participant identity remain separate.
Consent and allowlists are grants or intake policy resolved by their owners, not mutable private
adapter authority.

The audited 1.x Business backend also accepts interactive button and list replies. It sends the
reply id and title to its button callback, then forwards the title into ordinary message routing.
The server's wired button callback only logs the reply id; the ordinary-message forwarding is the
path that reaches conversation handling.
Part Twelve instead preserves the complete authenticated webhook event before any projection.
Button type, reply id, title, account, sender, event id, and signature evidence stay linked in the
intake capture. A title exposed as text remains quoted pre-decision input. It cannot become a
verified approval, an `Authorization`, a binding act, or an exact registered command merely
because it came from a button. The current narrow Part Four slice may hold that shape as
`needs-judgment`; the held redelivery and recovery neighbor remains non-executable until the
granted receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46)
lands and its Four-owned implementation integrates.

The 1.x `BusinessApiBackend` implements named-template and interactive-button send methods.
`CrossPlatformAlerts.sendAttentionItem` can call the interactive method and then fall back to
text. Those methods are not demonstrated as live production paths in the audited composition:
the template method has no production caller, the attention helper has no caller, and the server
does not supply its required owner WhatsApp destination. Part Twelve does not retain either
special send in the 2.0 slice. Named-template and interactive-button output are explicitly
unsupported and return `Refused` before provider dispatch. The closed payload list granted in
`seam-response-effects-payloads.md` does not include them. An interactive failure cannot trigger
an automatic text fallback; any ordinary text notice is a separately admitted Part Eight effect.

**Rule — family media preserves custody before any private retrieval or source-text injection.**
Rules 7, 29, 36, 42, 46, 66, 75 and 105; **checks: P12-NF-12/13/20–22/51**. A Slack file event and a
WhatsApp linked-device audio event first enter Part Four as their unchanged original platform
event, including authenticated attachment metadata. In the current landed slice, Part Four's closed
classifier produces a generic `needs-judgment` hold with the configured owner and expiry; if still
unresolved it records `expired-judgment`. No Slack private-file download, `files.info` lookup,
process-local path marker, source-text injection, Baileys media download, transcription-provider
call, placeholder reply, or fallback private send occurs. This current positive case preserves the
original event, records the owned hold, and makes zero media-fetch, transcription, or outward
provider calls. Its single-arrival arm is executable. Its held redelivery and receipt-recovery arm
is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md`
(SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. Successful retrieval and transcription are separate seam-dependent cases. They
require the accepted Part Eight `fetch-inbound-media` and `derive-transcript` payloads, Part Ten
credential confinement, Part Six claims and recovery, and Part Seven provider accounting where a
model doorway is used. Derived text remains evidence linked to the original intake; it never
becomes a new verified sender event.

**Rule — iMessage remains device-backed without a private effect escape.** Rules 28, 30, 36,
63 and 89; **checks: P12-NF-23/24**. Reading the enrolled Messages database supplies
device/channel-attested evidence, not a verified human signature. The poll cursor advances after
durable capture. Chat GUID, service, account, message id, sender handle, attachment evidence, and
database epoch are preserved. Phone or email reuse invalidates selection until re-verification.
If platform permissions require a session-side helper to send, that helper is a confined concrete
`OperationAdapterPort` implementation. It consumes one part-six dispatch-claim, has no general
shell interface, and returns its observation through part eight. Immediate acknowledgments use
that path too.

**Rule — web events are server-minted and session-bound.** Rules 28, 29, 36, 82 and 89;
**checks: P12-NF-25/26**. A web adapter authenticates the account session, origin and request
integrity, then mints the action/event id on the server and binds it to the request digest,
conversation, account, and replay record. A client id, cookie text, tab id, display name, page
view, link click, or successful WebSocket connection cannot select authority or suppress another
sender's event. Reconnect resumes from the durable server cursor. Anonymous messages may be
preserved as authority-inert input under declared policy; they cannot bind a conversation.

**Rule — platform-specific user experience remains an effect, not an exception.** Rules 30, 42, 52, 63,
79 and 105; **checks: P12-NF-22/24/25/32**. An ephemeral notice is a notice visible only to one
named user in a channel. Slack reactions, WhatsApp read receipts and reactions, iMessage immediate
texts, and web delivery indicators use registered operations with their real audience and evidence
after `seam-response-effects-payloads.md` lands and its granted Part Eight implementation is
integrated. Slack ephemeral notices additionally depend on the single-member audience contract in
the 09:10Z addendum to `seam-response-effects-followup.md` (SEAM-LEDGER row 53). The intended member
is resolved from signed Part Four history, never a display name. The Slack adapter reports the
variant unsupported unless it can keep the notice private to that member, and returns `Refused`
with no public-text fallback. Delivery evidence records the audience actually reached as
single-member, unsupported, or uncertain; retry, fallback, and rendering may never widen it to the
channel. P12-NF-32's one-member positive is non-executable until both named grant files land and
their implementations are integrated. The landed slice supports only ordinary text replies. Every
listed non-text form is currently unsupported. A bridge or fallback cannot silently replace an
unsupported form with a broader message, a different audience, or another platform.

---

## 7. Outbound effects, formatting, and platform limits

**Rule — the immutable outbound subject exists before dispatch.** Rules 33, 42, 52, 60, 63
and 89; **checks: P12-NF-27/28/33**. The worker proposes part eight's `OutboundMessage` with
exactly the landed fields: semantic message identity, run, speaker, account, conversation, text,
the `ordinary-reply` purpose, and source-result reference. The account and conversation identify
the route. The speaker identifies the speaking principal. Existing run, result, authority,
provenance, disclosure, notification, decision, and landed start/recovery/resume grounding facts
are linked through the `sourceResult` lineage and `EffectRequest.closure`; they are not extra
`OutboundMessage` fields.
Attachments are unsupported and non-executable until `seam-response-effects-payloads.md` lands and
its granted Part Eight implementation is integrated. Part Eight hashes the
canonical whole message, and the request retains that digest. Current standing, binding,
lease/fence, stop state, register generation, durability demand, and resource reservation are
revalidated immediately before the dispatch-claim. After the claim commits, the exact closure that
includes the reservation and newly committed claim must meet the operation's durability demand;
authority, stop state, and validation expiry are then checked again. After the claim is consumed
once, the executor-acceptance observation and its causal reservation state meet the same demand and
the current operation and expiry are checked once more before the provider call. The stable effect
identity is recorded before the first provider call and survives worker death, machine transfer,
route recovery, and receipt loss.

**Rule — attribution is recorded even when display is compact.** Rules 28, 42 and 89;
**checks: P12-NF-27/42/43**. `OutboundMessage.speaker` names the speaking principal, while the
signed fact envelope and referenced `sourceResult` carry its provenance. The run and referenced
facts carry any agent, machine, harness, model, or fixed-template source evidence they actually
prove. `OperationDefinition.account` and `OutboundMessage.account` bind the transmitting platform
account. Unknown remains unknown. A display policy may omit an origin footer, but cannot erase the
referenced evidence or let a worker invent it. A session credential proves only the enrolled
session and operation preparation it actually covers.

**Rule — production grounding and compaction accounting are separate dependencies.** Rules 47, 96
and 110; **checks: P12-NF-42–44/48**. Five's landed `SessionGrounding` shape can record the actual
clock, full supported history coverage, current binding, and a consumption reference for a fresh
`start`, `recovery`, or `resume`. Its landed validator can prove consumption only with the flat
worker/harness/JSON-string receipt used by isolated compatibility fixtures. That receipt is not
Ten's production contract. The production path instead re-resolves the signed
`assembly-HarnessObservation` referenced by `SessionGrounding.consumption` through Ten's injected
public `AssemblyHistoryReadPort` and requires an admitted observation at phase
`context-consumed`. For initial context, the launch-based arm granted at 06:33Z in
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 38) follows the admitted
`HarnessLaunchSpec`. For a later inbound or post-compaction context, the 08:48Z grants in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45)
require Five to follow the observation's immutable current context-delivery specification. The
launch continues to bind the process, run, harness artifact, machine, and unchanged incarnation;
the current specification and observation bind the candidate step, exact intake/input and digest,
ordered current context manifest, current generation, execution context, boundary evidence,
message digests, briefing classes, delivery reason, admitted operation and one-use claim.

Inside the single `GroundingReadPort.read` invoked by `RunGraphPort.ground()`, Five samples the fresh
clock and current history/run/directive/register/pending-work state, asks Ten to append and resolve
the current delivery specification, drives the already-admitted delivery, witnesses and re-resolves
consumption, and only then returns the candidate grounding stamped with that sampled clock.
`transition(start)` repeats current signed-history resolution. P12-NF-43/44/48's production
positives are non-executable until both row-45 grant files land and their public Ten/Five
implementations are integrated; row 38 remains sufficient only for its initial-context schema.
Stale, wrong-kind, partial, conflicted, mismatched, missing-or-duplicate-manifest-row,
non-consumed, pre-completed, or retimestamped evidence refuses; the flat receipt cannot activate
production.

The landed record union also has no `ContinuityAccounting`, and its decoder expressly rejects
compaction accounting. A post-compaction first reply is therefore unsupported, not treated as an
ordinary resume and not made compliant by provenance fields. The final family design depends on
Five producing `ContinuityAccounting` and Eight requiring its exact reference before the first
post-compaction send, as requested in
`design-conversation-adapters-seam-request-rungraph-continuity.md`. Five's record is granted in
`seam-response-run-closure.md`, Five's public operations in `seam-response-rungraph-followup.md`,
and Eight's consumer in `seam-response-effects-followup.md`. P12-NF-43's compaction positive is
non-executable until all three grant files land and their implementations are integrated.

**Rule — formatting is a deterministic, recorded preparation step.** Rules 30, 33, 36, 42
and 89; **checks: P12-NF-29/31**. A formatter consumes admitted source text and produces exact
rendered text before the outbound decoder runs. That exact rendered string becomes
`OutboundMessage.text`, and Part Eight's request digest covers the whole closed message. Formatting
mode, safe-link decisions, and transformation evidence live in an existing source-result or
closure-referenced fact, not as undeclared message fields. Telegram HTML/Markdown and Slack's
`mrkdwn` markup syntax have captured real-byte fixtures for nesting, code, tables, Unicode, hostile
links, control characters, the formatter's temporary placeholder characters that protect extracted
code and table spans during transformation, and adversarial lengths. WhatsApp, iMessage, and web
declare their own modes. Applying the formatter twice, using a legacy pass-through mode, or
skipping conversion is explicit. Formatting cannot remove refusal wording, change speaker or
audience, interpret standing, add a command, or convert a held result into a sent one.

**Rule — platform limits produce an explicit plan, never silent loss.** Rules 42, 52, 60 and
77; **check: P12-NF-30**. The adapter declares exact text, byte, entity, attachment, recipient,
rate, and ordering limits for the active API mode. In the landed slice, preparation either fits
one ordinary-text reply under `OperationDefinition.maxBytes` and the closed message's 4096-character
limit, or returns `Refused` with a usable remedy. It does not chunk, attach media, or truncate. A
finite ordered chunk/media expansion and its partial aggregate state depend on the requested Part
Eight seam. If that seam is accepted, every child needs its own immutable digest, observation, and
settlement, and aggregate completion requires every required child at its demanded stage. Partial
delivery stays partial. Any future truncation mode must be explicit in its operation definition,
retain the full source by reference, and place an honest visible marker in the rendered bytes.

**Rule — alternate rendering is unsupported in this slice.** Rules 42, 55, 60 and 63;
**checks: P12-NF-31/36/37**. A provider's definitive parse rejection is captured as evidence about
that exact immutable request. It does not authorize changed bytes. The landed settlement always
has `retryEligible: false`. Therefore the adapter returns the parse failure and usable remedy to
the owning run and makes no plain-text resend. Timeout, connection loss, or missing response
remains uncertain and also makes no resend. The retry contract granted in
`seam-response-effects-followup.md` and `seam-response-loop-followup.md` applies only to a new
attempt for the same logical request, semantic-message identity, and digest after decisive
closure. It does not permit a changed rendering, replacement payload, new digest, or distinct
operation for the same intended reply. This design defines no changed-rendering successor and
keeps that behavior unsupported. A provider software development kit (SDK) is the client library
used to call its API; its hidden retry is disabled or exposed as an unchanged-digest attempt
governed by the same records.

**Rule — advisory judgment cannot swallow the reply.** Rules 10, 12, 42, 46, 57, 67 and 86;
**checks: P12-NF-29/41**. A registered pre-send tone or clarity review goes through part seven and
returns its declared advisory decision. An unavailable ordinary advisory follows that consumer's
registered deliver-with-flags or no-objection policy. Deterministic credential, authority, stop,
and effect walls continue to apply independently. A hold or refusal returns to the owning run with
the exact reason and next permitted action. The adapter cannot loop for a different answer, treat
“not sent” as success, or discard the pending message.

---

## 8. Delivery evidence, durable recovery, and no silent loss

**Rule — delivery claims are distinct and source-bound.** Rules 9, 26, 42, 62 and 89;
**checks: P12-NF-34/35**. The landed `OperationObservation` contains only its record identity,
request, operation, claim, digest, account, conversation, recorder stage, wake, capture reference
and hash, and the `local-recorder` attestation. Its stage names the recorder phase. The allowed
values mean: `executor-accepted`, the local executor consumed the claim; `response`, invocation
returned captured response bytes; `unknown`, invocation produced no conclusive response;
`observer-accepted`, a six-owned read-only observation wake was consumed; and `lookup`, that query
returned captured bytes. None of these values means delivered, displayed, or read.

The surrounding signed fact envelope supplies recorder principal, provenance, clock, and causal
predecessors. Provider receipt identifiers and response details remain inside the immutable bytes
named by `capture.reference` and `capture.hash`; they are not extra observation fields. Part Nine's
registered evidence decoder authenticates those bytes, binds them to the observation's exact
account, conversation, operation, and digest, and emits `Evidence` references. Here, quiescence
means evidence that an old executor can no longer apply the operation. The current
`VerificationAssessment` applies the plan's stage-specific bar as separate occurrence,
non-occurrence, quiescence, and charge predicates, naming missing evidence and limitations in each
predicate reason. A Bot API response can therefore support “provider accepted this exact post”
without supporting “a person received or read it.” A later delivery, display, or read claim needs
its own authenticated callback or lookup capture and an assessment bar that admits that source.

A P12-NF-34 observation case records this exact closed shape inside its fact envelope:

```json
{
  "type": "OperationObservation",
  "schemaVersion": 1,
  "id": "observation:example",
  "request": "request:example",
  "operation": "operation:example",
  "claim": "claim:example",
  "digest": "sha256:example",
  "account": "telegram:bot-example",
  "conversation": "telegram:chat-example:topic-example",
  "stage": "response",
  "wake": "",
  "capture": { "reference": "capture:provider-response", "hash": "sha256:response" },
  "attestation": "local-recorder"
}
```

The referenced bytes contain the provider's message id and acceptance response. Part Nine accepts
only the provider-acceptance occurrence predicate; the human-delivery and read claims remain
insufficient. HTTP success, socket write, local log, or adapter return alone cannot be promoted
further, and the adapter cannot grade itself.

The landed positive stops at that assessment. Nine accepts occurrence Evidence whose predicate is
`operation-occurred` and whose object-valued claim contains the exact digest. Its returned
`Outcome` retains those source Evidence ids. Eight currently requires each retained Evidence claim
to use the digest itself as predicate and `happened` as its value before it will append settlement.
One immutable Evidence record cannot satisfy both contracts, and an adapter-created replacement
would usurp Nine. P12-NF-35's real settlement positive and P12-NF-44's settled Telegram path
therefore depend on `design-conversation-adapters-seam-request-effect-assessment-consumption.md`.
That contract is granted in `seam-response-effects-followup.md`, and P12-NF-35/44's settlement
positive is non-executable until that grant file lands and its Nine/Eight implementations are
integrated. It keeps every original observation and Evidence record unchanged, gives Nine one current
owner-validated outcome view bound to the operation, attempt, digest, bar, and source evidence, and
lets Eight consume that view without applying a second predicate convention. Acceptance requires a
joint real Nine/Eight settlement fixture; the landed Nine stand-in in Eight's fixture is not that
evidence.

**Rule — unsupported negative evidence leaves an owned uncertainty.** Rules 26, 42, 63
and 68; **checks: P12-NF-34–36**. Each mode declares whether it supports stable receipt lookup,
decisive non-occurrence, exclusion of delayed execution, and any final charge. Telegram and other
send-only modes do not gain those capabilities by belonging to the conversation family. A timeout,
eventual search miss, missing chat display, expired history, local process death, or new credential
does not prove the old send failed. The original operation remains owned, its maximum application
and charge exposure remains visible. No replacement effect runs in the landed slice. A future
successor for the unchanged logical request and digest requires the shared Part Eight/Six retry contract requested in
`design-harness-adapters-seam-request-retry.md`, granted by `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`, plus current Part Nine evidence.

**Rule — the durable outbox is a projection of facts, not a private queue.** Rules 7, 32, 33,
42, 45, 46 and 68; **checks: P12-NF-33/37–39**. Prepared operations, claims, observations,
settlements, recovery episodes, and notification duties live on the fact spine. An adapter-local
queue may accelerate dispatch but is disposable and cannot acknowledge custody by itself. Restart
and takeover rebuild due work from facts, preserving original semantic and attempt identities.
Every accepted item is due, claimed under a current fence, settled, explicitly refused, or held
with an owner. “Dead letter” is a visible retained terminal or pending obligation, never deletion
of the message or evidence.

**Rule — current send recovery observes; it does not retry.** Rules 8, 42, 46, 55, 60, 61, 68
and 88; **checks: P12-NF-36–40**. Part Six owns cadence, backoff, concurrency, elapsed-time,
resource, and breaker limits for repeated observation. Rate-limit hints are observations supplied
to that loop, not policy executed inside a platform client. Repeated bounded scans rediscover due
unknown operations. Each wake may call only the landed read-only `OperationAdapterPort.observe`
for the unchanged operation and digest. It makes zero additional `invoke` calls. One failing
account or conversation cannot starve another eligible one. Zero is a valid configured cap.
Exhaustion keeps the operation, uncertainty, evidence, and owner visible and creates Part Five's
bounded follow-through rather than silence or an infinite timer. The landed `EffectSettlement`
always has `retryEligible: false`, and Six's accounting preserves that restriction. No successful
send-retry case exists in the executable slice. A future unchanged-request, unchanged-digest attempt after proved non-occurrence,
old-executor quiescence, and final charge closure depends on the shared additive owner contract in
`design-harness-adapters-seam-request-retry.md`, granted by `seam-response-effects-followup.md` and
`seam-response-loop-followup.md`. P12-NF-37's successful successor positive is non-executable until
both grant files land and their implementations are integrated. An adapter or Six cannot create
that permission itself.

**Rule — a service round has item membership, bounded backlog, and a finite service bound.** Rules
13, 14, 46, 55, 60, 61 and 77; **check: P12-NF-40**. The deterministic stop path is outside service
rounds. A first-service head is the earliest admitted intake, dispatch, or observation item on that
route that has neither received its first service opportunity nor reached an owner-derived terminal
disposition. It becomes eligible when it is due, its owner state permits ordinary service, and it
is not already under a live ordinary claim. Eligibility belongs to that item, not to the route in
the abstract. Its first-service membership ends after that opportunity even when the owner result
is uncertain. The underlying intake or operation remains owned and unresolved; it is not marked
complete to advance the route.

At round opening, the loop records the causal frontier and freezes at most the eligible
first-service head from each admitted route. Each frozen member is an exact item identity paired
with its route and eligibility clock. The round ends only when every member has received one
bounded service opportunity or has a recorded owner-derived reason it ceased to be eligible. An
item that becomes a first-service head after opening enters the first later round opened after its
eligibility clock. It does not enlarge the current frozen population.

Later observation wakes for an uncertain operation obtain service membership as distinct,
already-preserved observation items. Each wake keeps the same operation and immutable digest,
records its own stable owner reference and due clock, and enters through
`admitRouteServiceItem` at the route tail. It may be selected after its predecessors have each
received a first opportunity or reached an owner-derived terminal disposition. Re-admitting the
same wake is idempotent. Serving a wake permits only its registered observation action; it neither
replays the uncertain invocation nor declares the underlying operation complete.

Each exact adapter mode uses a Part Six route-service policy with a positive maximum round duration,
positive maximum selection count, positive maximum admitted item count per route, and finite maximum
eligible-route count. The eligible-route count must fit within the round selection count. Ordinary
service admission records an item's stable owner reference, route, admission clock, first-in-first-out
predecessor, and bounded backlog position. An item admitted at position `p` receives its first
service opportunity within at most `p + 1` declared round durations from admission. The extra round
is the worst case for admission immediately after a round opens. Once the item becomes first-service head,
it receives its first opportunity by the close of the first round opened after that eligibility
clock.

An item beyond the per-route or eligible-route cap is not admitted into ordinary service. Part Six
returns an explicit `budget-exhausted` refusal to the owning intake or run, which retains the
already preserved owner record and records the disposition. The item never enters an unbounded private queue.
Continued overload therefore cannot lengthen an admitted member's deadline or create an ownerless
item. Coalescing means only that notices sharing one declared episode identity occupy one bounded
notification item; it never removes an admitted service item.

The measurement records item identity, route, admission clock, backlog position, eligibility clock,
round open and close clocks, frozen item population, selection count, first-service clock, and every
timeout or refusal. P12-NF-40 fails and activation is inhibited if the head deadline, the positional
backlog deadline, or either capacity invariant fails. These records require the additive Part Six
route-service contract granted in the dated 08:03Z addendum to
`seam-response-loop-followup.md` (SEAM-LEDGER row 43). P12-NF-40's positive is non-executable until
that grant file lands and its owner implementation is integrated.

Every platform sends its native deterministic stop affordance directly through Four's intake path,
outside ordinary service scheduling. Stop recognition occurs only after Four preserves, deduplicates,
authenticates, and resolves the binding. A recognized bound-operator stop appends Four's local-durable
stop fact first and applies Six's local halt immediately.
Neither a live ordinary claim on that route, an open round, the ordinary eligibility set, nor a
replication peer may delay that fact or halt. A resolved requester's stop-shaped signal also bypasses
the ordinary claim and round, but remains Four's highest-priority non-authorizing signal: it surfaces
immediately and cannot halt by itself. An ambiguous “maybe stop” remains ordinary intake. The stop
measurement records recognition, the stop fact, halt application, and their precedence over every
ordinary selection on the affected scope.

**Rule — failure notices do not create a recursive message storm.** Rules 14, 52, 53, 54, 87
and 95; **checks: P12-NF-40/41**. The original operation is repaired when safe. A required notice
uses part eight, the existing alert destination, stable coalescing identity, and finite episode
budget. It never creates one topic or notice per retry. If the conversation route itself is down,
the notice remains a visible obligation on an independent operator surface. Failure to send the
failure notice cannot mark the original delivered or launch an unbounded notice-about-notice loop.

---

## 9. The real worker-to-conversation path

**Rule — Claude Code, Codex, and every harness use one path.** Rules 29, 30, 63, 105 and
115; **checks: P12-NF-42/43**. A harness receives part five's grounded intake and may propose an
`OutboundMessage` through the public effect doorway. It does not receive platform credentials,
raw account sessions, arbitrary provider clients, or a general send script. The executable
assembly binds a confined conversation adapter custodian that accepts only a current validated
operation and consumed dispatch-claim. Framework hooks may steer attempted direct writes to the
public doorway, but a hook's presence is not confinement proof. Every enabled harness must pass
the same isolation and lifecycle checks. A real model-backed answer also requires the requested
Seven/Eight provider-effect seam. Seven's half is granted in `seam-response-judgment.md`, and
Eight's half is granted in `seam-response-effects-followup.md`. P12-NF-43/44/48's real-model
positives are non-executable until both grant files land and their implementations are integrated.
Seven's landed reference executor reserves and invokes its model
without Eight's provider-operation admission, observation, or settlement, while Eight's landed
`EffectRequest` and adapter invocation accept only an ordinary `OutboundMessage`. Supplying real
credentials to that executor would not satisfy this path.

Production worker grounding is independently non-executable until the 08:48Z Part Ten and Part
Five arms in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md`
(SEAM-LEDGER row 45) land and integrate. `RunGraphPort.ground()` must invoke the single actual-start
read that samples current history and clock, creates and resolves the current delivery
specification, performs its admitted delivery, and witnesses consumption. `transition(start)` then
re-resolves the launch, that current specification and its observation. The 06:33Z row-38 arm in
`seam-response-rungraph-followup.md` remains the initial-context schema; it does not make the
launch's original input or manifest authoritative for a second inbound or changed post-compaction
context. The flat compatibility receipt does not satisfy this production path.

**Rule — the end-to-end transition order is fixed.** Rules 14, 15, 26, 28, 33, 41, 42, 46,
58, 62, 63, 68, 75 and 89; **checks: P12-NF-28/43/44**.

1. Capture the authenticated platform event before protocol acknowledgment.
2. Let part four deduplicate, resolve principal and current binding/standing, and append the intake.
3. Let part five create or resume the durable run and record actual-start grounding.
4. Let the worker produce a bounded answer. If it needs model judgment, Seven first prepares and
   records the actual provider-submitted bytes, their digest, and the judgment attempt.
5. For the requested provider-effect seam, perform these boundaries in order:
   1. Let Eight prepare the provider operation from the Seven record.
   2. Let Six reserve and claim that operation.
   3. Let the confined Ten adapter invoke it once.
   4. Let Seven record the provider receipt.
   5. Let Eight record the operation observation.
   6. Let Nine assess that observation.
   7. Let Eight settle from Nine's assessment.
   8. Let Five conditionally accept Seven's resolution.
   9. Without the requested seam, make no real judgment dispatch.
6. Prepare exact rendered conversation bytes and Part Eight's attributable reply operation from the
   accepted answer or already durable fixed result.
7. Let Part Eight prepare the request and let Part Six reserve it. Repeat current definition,
   payload, authority, binding, fence, stop, generation, evidence, expiry, and resource validation,
   then commit the one reply dispatch-claim. Satisfy the operation's durability demand for the exact
   causal closure including the request, verification obligation, reservation, and newly committed
   claim. Recheck current authority, stop state, and validation expiry after that wait; invalid state
   reconciles the claim without invocation.
8. Consume that exact claim once and record the executor-acceptance observation. Satisfy the same
   durability demand for the consumed reservation state and executor-acceptance observation, then
   perform the final current operation-definition, adapter-binding, and expiry recheck. Only then
   invoke the concrete conversation adapter once and record its exact response or uncertainty
   observation.
9. Let Part Nine independently assess the demanded delivery stage and let Part Eight settle through
   the requested owner-validated assessment-consumption seam.
10. Return the result to Part Five and rebuild every disposable view from the causally linked facts.

The real-model positive of P12-NF-43/44/48 is non-executable until
`seam-response-judgment.md` and `seam-response-effects-followup.md` land and their Seven/Eight
implementations are integrated. The real settled-delivery positive of P12-NF-35/44 is
non-executable until `seam-response-effects-followup.md` lands and its Nine/Eight implementations
are integrated. These are owner integrations, not adapter implementation choices.

**Rule — ordinary-worker failure still has one bounded conversation answer while the minimal path
is admitted.** Rules 14, 15, 42, 46, 63, 77 and 95; **check: P12-NF-53**. The landed public
`AssemblyComposition` binds only harness, model, persistence, and independent-protection providers.
It cannot bind or return the minimal responder and dependency-cut handles required here. Production
wiring therefore depends explicitly on `part-eleven-seam-request-assembly.md`. Its owner acceptance
is `part-eleven-seam-response-assembly.md`, and the seam ledger records it BUILT but not integrated
on this HEAD. P12-NF-53 and the affected production-wiring positives in P12-NF-43/44/48 are
non-executable until `part-eleven-seam-response-assembly.md` lands and the BUILT seam is integrated.
A valid `OutboundMessage` alone is not production-assembly proof.

After that integration, Part Ten's production assembly binds Eleven's minimal responder separately
from ordinary workers and their model or business-effect dependencies. When an authenticated intake
is preserved but the ordinary worker cannot start or restart, the minimal responder records one
Part One `Result` for the limited response, naming the blocked work and owned repair. It then uses
the landed Part Eight
`ordinary-reply` path: one `OutboundMessage` whose speaker is the minimal system principal, whose
text is the fixed bounded
explanation, and whose `sourceResult` names that durable result. No new effect payload is needed.
The same authority, current conversation binding, exclusive lease and fence, replicated(1)
durability, route, provider observation, and independent assessment requirements apply. A private
adapter send or a model-dependent tone gate is not this path.

This guarantee is conditional on Eleven's enumerated minimal dependencies. If the minimal fact
segment, register/decoder generation, identity key, clock, system grant, current binding, lease,
fence, required peer acknowledgment, conversation route, or evidence service is unavailable, the
adapter preserves whatever intake its available custody can honestly preserve, records an owned
minimal-path outage and makes zero reply or replay calls under a fresh identity. The independent
recovery surface remains the only promised report path. Recovery re-resolves the original intake
and operation; missing dependencies never become permission to fabricate a reply.

**Rule — Telegram proves the first real slice under crash cuts.** Rules 34, 37, 43, 62, 68
and 105; **checks: P12-NF-44/46–48**. The production initialization path uses a real Telegram test
bot, authenticated sender, pre-existing verified binding, real Claude Code or Codex harness, real
registered model doorway, real persistence, and an independent recipient-side witness. The fixture
kills the worker or adapter after every adjacent durable boundary in the sequence above, including
after provider application before local observation. Passing requires one admitted intake, one
durable run, stable identities within the execution, no more than one externally observed semantic
reply, evidence no stronger than its source, every obligation owned, and equal rebuilt projections
at one vector. If the platform cannot resolve a cut, the correct result is retained uncertainty and
zero replay, not forced green. This positive cannot run against the landed contracts alone. It is
non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land for
the real model call and real-owner settlement, and until the BUILT production assembly accepted in
`part-eleven-seam-response-assembly.md` is integrated. Its production start/recovery/resume arms are
also non-executable until the 08:48Z current-context delivery grants in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45)
land and integrate the public Ten reader and Five consumer. Row 38 remains the initial-context arm
only. Stand-ins and the flat compatibility receipt do not satisfy P12-NF-44/48.

**Rule — Telegram precedes the family; later activation is evidence-independent, not list-gated.**
Rules 44, 62, 72, 73, 76, 84 and 105; **checks: P12-NF-04/45/46/48/49**. Telegram must first pass the
reference slice. A live canary is a bounded real test operation with an independent witness. After
that, Slack, WhatsApp, iMessage, and web may each activate when that exact
mode passes the shared suite, production wiring, account-level live canaries, independent
delivery-stage assessment, migration compatibility, and platform-limit tests. The written list is
work priority, not an activation prerequisite between later adapters. No later adapter borrows
Telegram or a sibling's evidence. A platform API change invalidates only the affected conformance
subject and inhibits unsupported operations. It does not silently downgrade authentication,
discard inputs, or close other healthy adapters. Strict serialization of every later adapter is a
separate operator policy, not this proposed baseline. An exact mode must also have every owner seam
its declaration consumes.
In particular, Slack remains inhibited until the Four half granted in
`seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy
judgment consumer granted in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35)
land, are implemented, and are covered by P12-NF-19/20.

Part Three's existing generated capability briefing is the agent-awareness surface. At the active
register generation, the feature declarations for every installed adapter mode, every supported or
inhibited operation, and the public Part Four intake and Part Eight effect doorways appear in that
briefing with their current status. P12-NF-04 fails if an installed mode, operation, inhibition, or
public doorway is absent or misstated. P12-NF-49 fails if a platform, application programming
interface, package, mode, or operation change leaves the generated briefing at the prior generation.
No adapter keeps a separate hand-maintained capability list.

---

## 10. What Instar 1.x does today and what carries forward

**Rule — layer-below claims stay tied to the modules and incidents that earned them.** Rules
89 and 111; **checks: P12-NF-02/49/51/52**. The required read-only audit found the following behavior.
The carry-forward column states the required property, not a requirement to reuse the 1.x code.
The audited 1.x source is `/Users/dabombstudio/.instar/agents/echo` at Git HEAD
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`. The separately audited `CLAUDE.md` has SHA-256
`d3579c945b59200b9b2e62b444b1a0140dc84f862e08aa35a198a1d1f9712389`. Each positive runtime
claim remains pinned to the named module body below because documentation and repository identity
alone do not prove execution.

That `CLAUDE.md` snapshot documents additional Telegram sender modes and origin guarantees that
the supplied source snapshot does not establish. A source search found no implementation of
`/telegram/browser`, `/telegram/origins`, `postOriginAutomationReply`, or
`sendOriginSetupGreeting`. The only `messageOrigin` match in `SendGateway` selects the unrelated
`agent`, `system`, or `bridge` source label. The rows below record each discrepancy explicitly.

| Instar 1.x module and earned incident | Behavior or guarantee that carries forward | 2.0 disposition |
|---|---|---|
| `CLAUDE.md` “Telegram message origin”: enrolled relay/origin preparation, recorded machine/harness/model evidence, and an agent-authorship signature even when display is hidden | The documentation states these guarantees, but no corresponding origin-preparation or signature implementation was found in the supplied `src` snapshot. No runtime guarantee carries forward on documentation alone. | **Implementation unavailable in this source snapshot.** Part Eight's attributable reply facts remain the 2.0 requirement. No 1.x origin record is imported or treated as signed evidence until a concrete source decoder and captured migration fixture prove its bytes. |
| `CLAUDE.md` “Telegram message origin”: typed operator-account browser snapshot and send routes | The documentation names `/telegram/browser/PROFILE/snapshot` and `/telegram/browser/PROFILE/send`, but neither route nor its broker was found in the supplied `src` snapshot. | **Implementation unavailable in this source snapshot and unsupported in this design.** A future operator-account mode must be a separately declared, confined adapter instance with its own Part Eight operations and Part Nine evidence. It cannot reuse the bot adapter's proof or survive as a private browser-send escape. |
| `CLAUDE.md` “Telegram message origin”: `postOriginAutomationReply` and `sendOriginSetupGreeting` automated sender helpers | The documentation names both helpers, but neither helper was found in the supplied `src` snapshot. | **Implementation unavailable in this source snapshot; the helper authority is not migrated.** A required fixed automation or setup greeting must first create an attributable durable Part One `Result` and then use a registered Part Eight operation. Its fixed-template provenance must be proved by that path. |
| `CLAUDE.md` “Telegram message origin”: sealed original-text restart recovery and signed multipart recovery | The documentation promises exact-text rechecks and multipart retention with signed references, but no matching outbox implementation was found in the supplied `src` snapshot. | **Implementation unavailable in this source snapshot.** Ordinary text recovery keeps the fact-derived Part Eight outbox contract. Multipart conversation effects remain unsupported until `seam-response-effects-payloads.md` and the required Part Ten confinement land and run their own crash fixtures. No documented 1.x multipart row is imported as custody evidence. |
| `CLAUDE.md` “Telegram message origin”: origin status, detector canaries, activation observations, and release certification | The documentation names `/telegram/origins`, `/telegram/origins/status`, fresh writer observations, and certification, but the corresponding service and routes were not found in the supplied `src` snapshot. | **Implementation unavailable in this source snapshot.** Part Nine and Part Ten still require fresh exact-mode holder and activation evidence. The documented status or certification labels supply neither a migrated check-run nor proof that a sender mode ran. |
| `TelegramAdapter` | The ordinary long-poll loop awaits each update handler before advancing and saving its offset, and forum topics keep distinct routes. The offset-range repair branch is an exception: when received ids are far below the stored offset, it saves the maximum received update id before processing that batch, so a crash can cross the custody-before-cursor boundary. A placeholder token once left a moved session reporting success while no message could reach Telegram, so admitted life requires verified bot identity and a real route. | Preserve the ordinary handling order and topic identity. Retire the range-repair early offset save under P12-NF-18's capture-before-cursor contract, and replace local routing, authorization and success inference with parts four, eight, nine and ten. |
| `lifeline/TelegramLifeline`, `MessageQueue`, `ColdStartFallbackReply`, and the server composition | The independent Telegram poller enqueues an inbound message and writes a disk-backed queue when the ordinary server is down or forwarding fails, replays retained entries after recovery, and advances its offset only after each update handler returns. Queue writes log and continue on failure and do not return a write-synchronization durability receipt, so 1.x does not prove durable custody at that cut. Replay can deliberately retire a poison item after attempting to record the loss and notify the sender; if loss-record persistence fails, 1.x logs and reports that failure, still attempts the sender notice, and then still removes the queue item. It is not an absolute never-drop store. When an ordinary topic worker cannot start or restart, the wired fixed reply bypasses the model tone gate, states the classified reason, and points to the Lifeline route. These paths were earned by silent server-down queues, mid-replay loss, resource rejection, and model-gate silence. | Preserve the independent custody and responder authority as Ten's separately admitted minimal path, while strengthening capture to Four's receipt contract. Four owns the persisted intake and a durable loss disposition, Five owns minimal repair work and the Part One `Result` used as reply source, Eight sends that result through the landed ordinary-reply contract, Nine assesses its evidence, and Eleven owns the conditional reachability verdict. P12-NF-53 withholds any held/live claim until both the ordinary-worker-failure and required-minimal-dependency-outage neighbors run through the production assembly after `part-eleven-seam-response-assembly.md` is integrated. |
| `TelegramAdapter` media handlers | Voice, photo, and document updates are downloaded to local paths and routed to handlers. Voice invokes a configured Groq or OpenAI transcription provider directly, then injects `[voice]` text; photo and document handlers inject local-path markers. Download or transcription failure sends a direct fallback reply. | Preserve current custody by capturing the original update and using Four's landed generic `needs-judgment` hold and possible `expired-judgment` terminal with zero private fetch/provider/send calls. Retire direct download, provider, path-injection, cleanup, and fallback-send authority. Successful fetch/transcription remains gated on the requested Part Eight media operations; Seven owns applicable provider attempts and Five consumes the derived result. P12-NF-51 separates these cases. |
| `pending-relay-store`, `DeliveryFailureSentinel`, and `telegram-reply.sh` | Stable delivery identity, per-agent durable custody, fenced claims, ambiguous timeout handling, and loud recovery prevent silent loss and blind duplicate sends. A restoration purge once ate a quiet-hours-held notice. Minting an id only at enqueue left the first send outside dedup. Both incidents require identity before first dispatch and no purge of unresolved work. | Re-express the queue as fact-derived outbox/recovery under six and eight. Keep adapter storage only as disposable acceleration. |
| `telegram-reply.sh` | Wrong-port agent identity checks prevent cross-tenant sends. A tone flag placed after the topic id was delivered as user text while its effect vanished, causing a correct check to be graded wrong. Inputs that change send semantics must be typed, ordered, and refused when malformed. | Replace shell argument authority with the public effect port and typed operation input. A compatibility wrapper may only translate and return the core result. |
| `MessageRouter`, `MessageStore`, `DeliveryRetryManager`, and `SpawnRequestManager` | Save-before-send, both sides of conversation history, stable envelopes, queued spawn work, bounded attempts, and explicit delivery phases preserve continuity. Earlier one-sided history caused context loss. Refusing a system-channel registry write caused repeated session spawning. | Part two stores facts, part five owns runs, and part six owns loops and transport recovery. HTTP receipt and session injection no longer count as conversation delivery. |
| `ConversationRegistry` and `conversationIdentity` | A structured Slack channel/thread tuple joins a durable negative numeric id, canonical key, one-hop aliases, bind pins, origin, and crash-replayed journal/snapshot state. Its journal may retain only a send key, lane, sequence or timestamp. Positive Telegram ids pass through. These are the real cross-channel identity and alias authorities in 1.x, but a bind pin is only a retained tuple and send-guard rows do not retain the payload or provider receipt. | Preserve readable old ids, tuples, aliases, bind targets, and send-guard bytes through the compatibility decoder. Import no operator binding, effect, claim, assessment or settlement from insufficient evidence. The positive is non-executable until the legacy-import grants in `seam-response-intake-followup.md`, `seam-response-rungraph-followup.md`, and `seam-response-effects-followup.md` land; until then every numeric-id consumer stays migration-blocking under P12-NF-52. |
| `deliverToConversation`, `PromiseBeacon`, and the server composition | The shared funnel resolves Telegram ids and minted Slack ids, follows binding tuples, classifies non-delivery, records logical/content send guards, and routes pending beacon follow-through. The server wires `PromiseBeacon` through it. Separately, PromiseBeacon has an absolute outer gate: conversation and Attention output, including already queued summaries, stays silent unless `userOutputEnabled === true`. That explicit opt-in is distinct from the funnel's dark/dry and reachability behavior. | Move the beacon, server wiring, conversation lookup surfaces, and stored topic-id consumers to Part Eight. Preserve pending and ambiguous sends without replay. Preserve the default-silent outer gate and require explicit opt-in before imported pending work can notify. Test both opted-out and opted-in pending work. Retire the old funnel only after every stored conversation reference resolves through the new route. |
| `TelegramMarkdownFormatter` and `slack/SlackMrkdwnFormatter` | One outbound formatting funnel, safe URL schemes, escaped code/text, bounded parsing, and explicit pass-through modes prevent literal markup, unsafe links, double escaping, and parser resource abuse. | Keep deterministic transformations and captured real-byte fixtures, but validate the rendered digest through part eight before sending. |
| `slack/SocketModeClient` and `slack/SlackAdapter` | Fresh connected state, verified team identity, thread routing, reconnect recovery, and guarded socket writes are necessary. The adapter also has a fail-closed user check, an organization permission observer/enforcement gate, direct-message and mention-directed handling, mention-only ambient handling, and bounded `speak`/`react`/`silent` ambient decisions. It downloads attachments with the workspace credential and may inject retrieved or downloaded source text and process-local paths into the prompt. An unguarded acknowledgment during sleep/wake once crashed the server, stale socket callbacks once orphaned a healthy replacement, and a malformed live probe once marked a healthy application programming interface failed. | Preserve the state-machine and probe requirements now. Direction, permission, and ambient behavior are non-executable until the Four half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land; they are not silently moved into an adapter. Retire private file retrieval and prompt injection; current media receives the generic owned `needs-judgment` hold, while successful retrieval is non-executable until `seam-response-effects-payloads.md` and the required Part Ten confinement land. |
| `WhatsAppAdapter`, `backends/BusinessApiBackend`, `shared/CrossPlatformAlerts`, and the server composition | Backend capabilities, fail-closed configured contacts, group/participant separation, chunking, and connection state are useful platform mechanics. The linked-device Baileys backend also downloads audio to a local file, calls a configured transcription provider, injects `[voice]` text, and falls back to an `[Audio]` placeholder when unavailable or failed. The Business backend handles button and list replies, sends their ids and titles to a callback, and also forwards each title into ordinary message routing. The server callback only logs the id; the forwarded title reaches ordinary conversation handling. The backend implements named-template and interactive-button sends. The attention helper can call the interactive send and fall back to text. These are implemented methods, not demonstrated live paths: the template method and attention helper have no production callers, and the server does not configure the helper's owner WhatsApp destination. | Split Business and linked-device evidence modes. Preserve each original Business interaction event and its id/title evidence through Part Four; never treat the forwarded title as a verified approval or command. Move consent, authorization, acknowledgments, queues, limits and retries to their core owners. Retire local audio custody, direct transcription, source-text injection, and placeholder fallback as adapter authority; preserve the original event in Four's generic `needs-judgment` hold. Successful media derivation is non-executable until `seam-response-effects-payloads.md` and the required Part Ten confinement land. Named-template and interactive-button output remain unsupported because the granted closed payload list does not name them. Retire the private interactive-to-text fallback; a text notice must enter Part Eight as its own admitted effect. |
| `imessage/IMessageAdapter` | Unified inbound/outbound contact gating, send-disabled and proactive-disabled defaults, single-use send checks, stable chat evidence, and actual connection time are safety-relevant. A status getter once fabricated a new connection timestamp on every read. Platform permission constraints require a session-capable send helper. | Preserve conservative defaults and observed timestamps. Confine the helper behind the effect port; it cannot remain a private script escape. |
| `MessagingToneGate` | Advisory review must return an actionable result. A provider timeout in production showed that an unavailable language-model review cannot silently suppress ordinary communication, while deterministic credential exposure still needs a hard floor. | Part seven owns advisory judgment and defaults; parts three/eight own registered blocking checks and preservation. The platform adapter only receives the settled instruction. |

**Rule — 2.0 forecloses the 1.x ownership mistakes.** Rules 1, 30, 42, 45, 55, 63 and 69;
**checks: P12-NF-03/05/20/24/32–43**. A void-returning `send`, a green HTTP status, an in-memory
dedup set, an in-memory outbound queue, a fire-and-forget reaction, a post-ack exception, a session
registry, a local allowlist, or an adapter timer cannot be authoritative. The WhatsApp flush path
that clears its queue before sending and does not requeue failed flush items is structurally
impossible when the outbox rebuilds from unresolved facts. Slack cannot acknowledge then lose an
event in post-ack handling. iMessage cannot acknowledge outside the effect doorway. Telegram
cannot rely on every call site remembering the same guard. The assembly and register enumerate
the single intake and egress boundaries instead.

**Value — preserve lessons, not accidental topology.** Storage engines, log formats, process
hosts, shell wrappers, persistent streams, polling, and client libraries may still be sound
implementation choices. None is elevated to the constitutional contract by having carried an
important 1.x fix.

---

## 11. Non-functional checks and activation

**Rule — bounds name their subject, workload, and failure action.** Rules 13, 34, 39, 43, 55,
60, 61 and 64; **checks: P12-NF-30/39/40/46–48**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Capture-to-ack | Real platform events at idle, declared peak, boundary, and boundary-plus-one sizes; kill at write, flush, fact append, ack and cursor cuts | No protocol ack before durable custody; failed capture remains redeliverable or an owned outage |
| Ordinary service and backlog | Use a maximum of two eligible routes and two selections per round, with at most one first-service head selected from each route per round. Admit three items to route A under a per-route capacity of three. Add one healthy item to route B while continuously offering more work to A. Offer a fourth item to the full A route. Measure every item's admission, position, eligibility, round membership and first opportunity. Keep A1's owner result uncertain after its first opportunity and later admit a distinct observation wake for that same operation. | A1 and B1 receive opportunities in the first applicable round. A1 remains uncertain and owned. A2 and A3 still receive their first opportunities in the second and third rounds; A1 is not marked complete to free them. The later A1 observation wake receives membership under its own stable item identity without another invocation. Each first-service head is served by the first round close after eligibility. Every admitted item meets its `p + 1` round-duration admission bound. The fourth A item is preserved but receives `budget-exhausted` and never becomes an admitted member. P12-NF-40 is non-executable until the dated 08:03Z grant in `seam-response-loop-followup.md` (SEAM-LEDGER row 43) lands and its Part Six implementation integrates. |
| Stop precedence | Keep an ordinary claim live on one route during an open ordinary round. Send the same route an exact bound-operator stop and a resolved requester's stop-shaped signal in separate runs. | The exact operator stop bypasses eligibility and the live claim. It appends its local-durable stop fact and applies the local halt before further ordinary selection, without waiting for round close or replication. The requester signal also bypasses the round and claim, surfaces immediately, and never authorizes a halt. |
| Outbound uniqueness | Kill at preparation, claim, provider acceptance, observation, witness and settlement; lose and duplicate callbacks | At most one external semantic reply; unresolved cuts retain identity, exposure and zero replay |
| Formatting | Real captured bytes, malformed markup, unsafe links, Unicode, the null control character and other control data, adversarial nesting and declared size edges | Exact deterministic digest or explicit refusal; no meaning/audience/standing change and no unbounded parse |
| Conversation identity | Restart, reconnect, rename, archive, topic/thread roots, account churn, aliases and cross-platform forwards | Same authenticated tuple resolves the same history; churn holds binding; no content-based merge |
| Evidence honesty | Positive receipt, delayed receipt, forged callback, missing query, read/display signal, stale probe and unsupported stage | No stage promotion; nine records exact assessment or retained unknown |
| Recovery cost | Cold/warm rebuild of unresolved intake/outbox over release corpus on every deployment class | Recorded scanned facts/bytes, duration, peak memory and failures fit approved finite budgets; overrun blocks activation |
| Platform health | Cadenced authenticated identity, inbound and outbound canaries through production assembly with independent witness | Fresh exact-mode proof required; stale, failed or unavailable inhibits only unsupported scope and starts owned repair |
| Framework parity | Claude Code, Codex, and every enabled harness attempt the same reply and direct-credential escape cases | Public doorway succeeds; raw credential/provider access fails; missing harness evidence keeps that tuple dark |
| Notification bound | Many simultaneous permanent/transient failures, unavailable alert route and recovery flap | Existing alert destination, stable episode coalescing, finite attempts, no topic/notice storm or recursive send |
| Minimal conversation path | Kill an ordinary worker at start and restart; separately remove every required minimal dependency while sending authenticated messages | Fixed attributable ordinary reply within the measured bound only while every named prerequisite holds; otherwise preserved input where custody remains, one owned outage, and zero fabricated reply or replay |

**Rule — activation needs three tiers and fresh independent proof.** Rules 34, 37, 38, 43, 62,
72, 73, 81 and 105; **checks: P12-NF-12/19/20/44–50/53**. Unit checks cover pure identity, parser, formatter,
limit, dedup, and state-transition logic. Integration checks use actual persistence and every public
port, with a kill at each durable boundary. Live lifecycle checks use production initialization,
real platform credentials, real provider bytes, an authenticated test principal and conversation,
an enabled real harness, and part nine's independent witness. Critical inbound/outbound outcomes
also carry fresh probes and step supervision. Source inspection, a running process, a configured
token, a mock transport, or a self-reported green row cannot make an instance live. The remainder
of this block is the activation seam inventory referenced by the production fixtures.

Held-input redelivery and receipt-recovery positives are non-executable until
the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands
and its Four-owned implementation integrates. Production
secret-intake activation is non-executable until `seam-response-intake-followup.md` and
`seam-response-assembly-followup.md` land and integrate the granted Four/Ten custody seam. Slack
activation is non-executable until the Four half in `seam-response-intake-followup.md`
(SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum
to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. A Slack ephemeral positive
is separately non-executable until the audience addendum in `seam-response-effects-followup.md`
(SEAM-LEDGER row 53) lands and integrates; unsupported ephemeral delivery does not block Slack's
ordinary-text mode. A real model-backed lifecycle is non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land and integrate the Seven/Eight provider-effect seam. Real
effect settlement is non-executable until `seam-response-effects-followup.md` lands and integrates
the Nine/Eight assessment-consumption seam. P12-NF-43/44/48 stay declared and inhibited until those
integrations run with their real owners. Their production start/recovery/resume arms are separately
non-executable until the 08:48Z current-context delivery arms in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45)
land and integrate Five's public consumption through `AssemblyHistoryReadPort`. The original
`HarnessLaunchSpec` remains the process-launch subject; the current step, input and manifest bind
through the immutable current delivery specification and observation. The 06:33Z row-38 arm in
`seam-response-rungraph-followup.md` remains the initial-context schema only, and flat compatibility
receipts cannot supply production evidence. P12-NF-53 and
affected production-wiring checks are
non-executable until the BUILT assembly seam accepted in `part-eleven-seam-response-assembly.md` is
integrated; a 1.x source audit or valid reply payload does not satisfy production assembly.

**Rule — release evidence stays exact across upgrades.** Rules 44, 45, 62, 76, 90 and 105;
**checks: P12-NF-45/46/49/50/52**. An upgrade enumerates every installed adapter instance, parser,
operation, formatter, wrapper, credential custodian, platform mode, harness tuple, old fact decoder,
and projection consumer. It replays retained captures, preserves unresolved operations and bindings,
and runs the affected real-account probes. Removed platform support becomes an explicit inhibited
capability with readable history. No migration deletes an uncertain send or silently changes a
conversation key, acknowledgment policy, provenance ceiling, or rendered-byte identity.

---

## 12. Negative contract fixtures

**Rule — each negative has a realistic positive neighbor.** Rules 34, 36, 37 and 69;
**checks: P12-NF-01/50**.

| Fixture | Stage | Failure exposed; positive neighbor |
|---|---|---|
| P12-NF-01 | build/docs | Missing owner, section, check, duty or governed discipline; closed inventories and compliant document pass |
| P12-NF-02 | audit/docs | A 1.x runtime claim lacks a named module, incident, or pinned source snapshot, or documented origin/browser/automation/multipart/status behavior is silently treated as implemented. The positive checks the pinned source and `CLAUDE.md` digest, confirms the named module evidence, and records each documentation/source discrepancy as unavailable, carried forward, or retired without certifying execution. |
| P12-NF-03 | architecture | New core message/binding/queue/retry type or private import; earlier-owned types and public ports pass |
| P12-NF-04 | build/activation | Instance omits a contract field, parser, operation or unsupported capability, or the active-generation capability briefing omits or misstates an installed mode, supported/inhibited operation, or its public intake/effect doorway; complete exact-mode feature declarations and the regenerated briefing pass |
| P12-NF-05 | architecture | Adapter selects standing, binding, classification, retry or success; translation plus owner decision passes |
| P12-NF-06 | fault | Content interpretation, filtering, deduplication, acknowledgment or cursor advance is reachable before Part Four's route-bearing receipt, or route extraction reads message prose. A captured non-secret fixture passes through physical capture, bounded envelope extraction and landed `receive(raw, route)`. The secret-shaped neighbor is non-executable until the custody grants in `seam-response-intake-followup.md` and `seam-response-assembly-followup.md` land. A crash after extraction produces no acknowledgment and relies on provider redelivery; a crash after receipt drains through `recover(receiptId)` |
| P12-NF-07 | captured contract | Token/session/locality/display name inflated to stronger provenance; re-checkable exact evidence passes |
| P12-NF-08 | security | Adapter assertion or message content selects principal/standing; part-four decode against signed history passes |
| P12-NF-09 | dedup | Same id and changed bytes collapse, or a matching held redelivery creates a new logical obligation or deadline. The landed positive covers matching redelivery only after `intake-admitted`, while a mismatch conflicts. The held and expired positive is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. It must retain every arrival capture while joining the first hold or terminal. |
| P12-NF-10 | security | Sender-controlled id suppresses another sender/tenant or expired cache revives work; fully scoped durable key passes |
| P12-NF-11 | contract | Protocol ack reported as principal/run/worker/answer receipt or ackPolicy bypassed; exact custody meaning passes |
| P12-NF-12 | load/security | Oversize event is partly interpreted or a matched secret reaches ordinary capture/authentication/parsing. The landed positive covers only a captured non-secret fixture whose unchanged bytes and hash pass through `receive`. The secret-safe positive is honestly declared and inhibited: it is non-executable until `seam-response-intake-followup.md` and `seam-response-assembly-followup.md` land and integrate the granted Four/Ten boundary that keeps original bytes exclusively in secret custody and gives ordinary consumers a separately hashed redacted capture. Secret-intake production activation remains blocked until that evidence passes |
| P12-NF-13 | lifecycle | Unresolved/refused input drops or has no owner/drain. A single-arrival preserved authority-inert hold and terminal pass. The held redelivery and receipt-recovery neighbor is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. |
| P12-NF-14 | binding | First sender, adapter map or session registry establishes operator; verified binding facts pass |
| P12-NF-15 | race | Stale/contested binding selects newest claimant; conflict holds new authority while stop remains live |
| P12-NF-16 | Telegram identity | Bot/chat/topic collision or general-topic drift creates two histories; canonical scoped tuple passes |
| P12-NF-17 | Telegram security | Forwarded/channel-post identity becomes human principal or update kind disappears; explicit source/disposition passes |
| P12-NF-18 | Telegram fault | Offset/webhook success crosses uncaptured update; consecutive durable capture boundary passes |
| P12-NF-19 | Slack identity/admission | Root message changes from channel to thread identity, team is omitted, or direct-message, mention, command and undirected traffic are conflated. Current landed coverage proves only capture and the stable team/channel/root tuple, with one owned `needs-judgment` hold for a single policy-bearing arrival. Its held redelivery/recovery arm is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. The explicit-direction and ambient-disposition positive is non-executable until the Four half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. Slack activation is blocked until then. |
| P12-NF-20 | Slack fault | Envelope acknowledgment precedes receipt, post-ack failure loses an event, private permission drops it, or unavailable judgment silences a directed ask. The current single-arrival neighbor is receipt then acknowledgment followed by Four's generic owned `needs-judgment` hold and possible `expired-judgment`, with zero private permission/send calls. Its held redelivery/recovery arm is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. The declared directed/ambient fallback positive is non-executable until `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the dated intake-policy addendum in `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. |
| P12-NF-21 | WhatsApp security | Backend, group participant, LID, phone label, normalized address, button id, or forwarded button/list title is confused as a verified person, approval, `Authorization`, binding act, or exact command. The positive preserves the complete authenticated Business event and keeps any title projection as pre-decision input. |
| P12-NF-22 | WhatsApp lifecycle | Private consent/allowlist/queue/receipt bypasses a core owner; linked-device audio downloads, transcribes, injects, or falls back privately; or a Business named-template or interactive-button send uses the generic payload grant. Public intake/effect composition and the current single-arrival `needs-judgment` hold make zero private media/provider/send calls. The held redelivery/recovery arm is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. Named-template and interactive-button output remain explicitly unsupported; the positive is `Refused` before dispatch, with no automatic text fallback. |
| P12-NF-23 | iMessage identity | Phone reuse, chat-db access or fabricated connected time keeps binding/live claim; observed device/chat/churn evidence passes |
| P12-NF-24 | iMessage isolation | Helper sends without claim, standing, observation or audit; confined effect-port invocation passes |
| P12-NF-25 | web security | Client id/cookie/tab/click grants authority or dedups another user; server-minted session-bound event passes |
| P12-NF-26 | identity/migration | Rename, alias, bridge or forward merges histories/bindings; append-only explicit mapping with conflict passes |
| P12-NF-27 | effect contract | Reply adds provenance, audience, attachment, notification, continuity or other undeclared message fields, or omits a landed field; record identity plus the closed ordinary-reply fields semanticMessage, run, speaker, account, conversation, text, purpose and sourceResult pass |
| P12-NF-28 | effect admission | Stale binding/grant/fence/generation, a claim or reservation omitted from the demanded closure, authority expiring during the post-claim durability wait, or invocation before durable executor acceptance dispatches. The positive runs Part Eight's public `prepare` then `dispatch`/`handoff`: reserve; validate and commit the exact claim; meet durability for the closure including request, verification obligation, reservation and claim; recheck current authority/stop/expiry; consume once; durably record executor acceptance and its reservation state; recheck the current operation definition, adapter binding and expiry; invoke once. Kill or change state at every adjacent cut; each invalid neighbor makes zero provider calls and retains the owned claim disposition |
| P12-NF-29 | formatter | Rendering changes refusal, audience, link safety or meaning, or advisory disappears; exact rendered `text` plus a source-result/closure-referenced preparation fact preserves all |
| P12-NF-30 | limits/load | Oversize text is truncated or chunked through the landed single-message path; one fitting ordinary reply or explicit `Refused` passes. Ordered aggregate cases are non-executable until `seam-response-effects-payloads.md` lands and its granted implementation integrates |
| P12-NF-31 | format fallback | Parse rejection or timeout changes bytes, payload, digest or operation and resends the same intended reply; captured failure, unchanged digest, `retryEligible: false`, return to the owning run, and no second invocation pass. A changed-rendering successor remains unsupported and cannot use the same-identity retry grant. |
| P12-NF-32 | user-experience effect | Reaction/read receipt/typing, Slack ephemeral notice, or message deletion fires through the ordinary-text port; an ephemeral recipient is selected by display name or substituted after admission; a one-member notice is exposed to the channel by dispatch, rendering, retry, or fallback; or failure clears intake. Explicit unsupported `Refused` with no public-text fallback passes now. The Slack positive resolves exactly one intended channel member from signed Part Four history, delivers only to that member, and records the audience actually reached. Governed optional effects are non-executable until `seam-response-effects-payloads.md` lands; the Slack one-member positive is additionally non-executable until the audience addendum in `seam-response-effects-followup.md` (SEAM-LEDGER row 53) lands and integrates; `delete-message` is separately non-executable until that follow-up file lands and its granted operation integrates. |
| P12-NF-33 | crash | Effect identity minted after provider call or private queue is custody authority; pre-dispatch fact and rebuild pass |
| P12-NF-34 | evidence | HTTP/socket/local log/provider acceptance labeled delivered/read or encoded as an invented observation stage; an unchanged `response`/`lookup` observation with provider bytes in its capture and only the source-supported assessment passes |
| P12-NF-35 | verification | Adapter self-grades, stale/same-path probe certifies delivery, or Eight reinterprets Nine's immutable source Evidence under a second predicate convention. The landed real Nine path can decode the captured provider evidence and accept the exact `operation-occurred` predicate with an object-valued matching digest. The settlement positive is honestly declared and inhibited: it is non-executable until `seam-response-effects-followup.md` lands and integrates the granted Nine/Eight assessment consumer. That positive binds a current owner-validated outcome to the same operation, attempt, digest, bar, observations, and unchanged source Evidence, then settles exactly once |
| P12-NF-36 | uncertainty | Timeout/search miss/new route/local death proves non-occurrence and retries; owned unknown with zero replay passes |
| P12-NF-37 | retry | SDK/adapter invents backoff, invokes again, changes the request/digest, or mints a replacement identity; a Part Six bounded read-only observation wake for the unchanged operation/digest with zero additional invocations passes now. A successful same-logical-request, same-semantic-message, unchanged-digest successor is non-executable until `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land and integrate the granted shared retry contract from `design-harness-adapters-seam-request-retry.md` |
| P12-NF-38 | restart | Restart loses queued intake/send, resets attempts, changes identity, or recovers a held receipt as a new hold with a later deadline. The fact-derived admitted-intake and outbox recovery neighbor resumes exactly. The held and expired receipt-recovery positive is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. |
| P12-NF-39 | retention | Dead-letter, configured time-to-live (TTL), or purge deletes unresolved bytes, evidence or owner; retained terminal/pending obligation passes |
| P12-NF-40 | fairness/load | Under a declared maximum of two eligible routes, two selections per round and at most one selected head per route per round, admit A1, A2 and A3 to route A before opening the first round. Continuously offer more A items while route B has one healthy eligible item B1. A1 and B1 receive the first applicable opportunities. A1's owner result remains uncertain, but A2 and A3 still receive their first opportunities in rounds two and three without marking A1 complete. A later A1 observation wake enters as a distinct item for the same operation and digest and makes no second invocation. The positive records every admission clock, bounded position, eligibility clock, round membership, first opportunity, owner result, timeout, and refusal. A4 remains preserved, receives `budget-exhausted`, and never becomes a member. The fixture fails on a bare-route member, a missed head or positional deadline, advancement before every predecessor has an opportunity or terminal disposition, a cap beyond round capacity, a growing frozen population, replay of the uncertain operation, or ownerless overflow. Mid-round operator-stop and requester-signal neighbors keep their deterministic precedence. Notice coalescing remains bounded by episode identity. This positive is non-executable until the dated 08:03Z grant in `seam-response-loop-followup.md` (SEAM-LEDGER row 43) lands and its Part Six implementation integrates. |
| P12-NF-41 | failure path | Advisory, refusal or notice is swallowed, recursive or reported sent; explicit bounded result and owner pass |
| P12-NF-42 | isolation | Worker reads credential/raw account session or fabricates origin; scoped custodian and enrolled evidence pass |
| P12-NF-43 | wiring/e2e | Harness/direct script bypasses intake/effect/grounding, a model provider is invoked by Seven without Eight's admitted operation path, or a required port is null. The complete real-model public chain is non-executable until `seam-response-judgment.md` and `seam-response-effects-followup.md` land and integrate the granted provider effect. The production grounding positive is non-executable until the 08:48Z Part Ten and Five arms in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45) land and integrate. On one incarnation, initial input, a second distinct inbound, and changed post-compaction context each invoke one fresh actual-start read and produce immutable, distinct context-delivery specifications and signed consumption observations with predecessor order; each yields one grounding and one start transition. The original `HarnessLaunchSpec` remains unchanged and supplies the row-38 initial-context arm only. The instrumented positive proves the fresh clock/history read, Ten delivery, and witnessed consumption all occur inside the single read invoked by `ground()`, followed by current re-resolution at `transition(start)`. The flat receipt remains only a compatibility fixture; stale, retimestamped, pre-completed, wrong-kind, partial, conflicted, mismatched, non-consumed and manifest-gap observations refuse. The compaction accounting case is non-executable until `seam-response-run-closure.md`, `seam-response-rungraph-followup.md`, and `seam-response-effects-followup.md` land and integrate the granted producer and consumer. Production wiring is non-executable until the BUILT assembly seam accepted in `part-eleven-seam-response-assembly.md` is integrated. |
| P12-NF-44 | Telegram lifecycle | A crash cut duplicates a reply or model call, loses work, overstates evidence, bypasses demanded durability or a current-state recheck, accepts stale or retimestamped grounding, pins a second inbound or post-compaction context to the launch's original input/manifest, cannot settle real Nine evidence, or diverges on rebuild. The expected positive runs every adjacent cut in section nine. It produces one admitted intake, one durable run, no more than one externally observed semantic reply, source-bounded evidence, owned uncertainty, and equal rebuilt projections. Its grounding neighbor runs the initial, second-inbound and changed post-compaction delivery sequence from P12-NF-43 on one incarnation. The positive is non-executable until the grant files in section eleven's activation seam inventory, including both row-45 grant files, land and integrate. Stand-ins and flat compatibility receipts do not satisfy it. |
| P12-NF-45 | parity/activation | Any later adapter activates before Telegram proves the reference slice, borrows Telegram/sibling evidence, or lacks an owner seam its declared mode needs; after Telegram, each exact mode may activate on its own complete evidence regardless of another later adapter's state. Slack remains inhibited until the Four structural direction/organization-permission/channel-policy half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate |
| P12-NF-46 | live probe | File/token/process/config or malformed canary counts as life; real identity/inbound/outbound fresh proof passes |
| P12-NF-47 | measurement | Target/estimate/success-only percentile labeled measured or failed sample omitted; named hardware workload record passes |
| P12-NF-48 | three-tier | Mock-only or parser-only test makes a significant adapter live, secret-bearing production intake activates without the custody seam, a production start uses the flat compatibility receipt or validates current step/input/manifest only against the original launch, an actual-start receipt was completed before `ground()` or merely retimestamped, or a real-model lifecycle uses Seven's reference executor without Eight admission and settlement. Unit, integration and real lifecycle evidence pass only with every required owner implementation. The grounding positive includes the one-incarnation initial, second-inbound and changed post-compaction sequence from P12-NF-43. The production positive is non-executable until `seam-response-intake-followup.md`, `seam-response-assembly-followup.md`, `seam-response-judgment.md`, and `seam-response-effects-followup.md` land and integrate their granted custody, current-context delivery, provider-effect, and assessment-consumption operations; until the 08:48Z Five arm in `seam-response-rungraph-followup.md` (with the Part Ten arm in `seam-response-assembly-followup.md`, SEAM-LEDGER row 45) lands and integrates the public Ten reader and Five consumer; and until the BUILT seam accepted in `part-eleven-seam-response-assembly.md` is integrated. The 06:33Z row-38 arm remains the initial-context schema only. |
| P12-NF-49 | upgrade | Platform/API/package/mode change alters identity, provenance, acknowledgment or pending effect silently, or leaves the generated capability briefing at the prior generation; scoped inhibition, compatible replay, and a regenerated briefing with the exact current modes, supported/inhibited operations, and public doorways pass |
| P12-NF-50 | governance | A held or live claim without a current check-run and assessment fails, as does any implementation that implies approval. An honestly declared, inhibited fixture with its named approved dependency passes this check but cannot be promoted; for example, a P12-NF-53 declaration citing `part-eleven-seam-response-assembly.md` remains non-executable until that BUILT seam is integrated |
| P12-NF-51 | family media | Telegram, Slack, or linked-device WhatsApp media is acknowledged before original receipt, a file path substitutes for custody, source text is injected privately, transcription calls a provider privately, a fallback sends privately, or derived text becomes a fresh verified sender event. The current single-arrival positive preserves the original event, records Four's generic owned `needs-judgment` hold, may drain it to `expired-judgment`, and makes zero fetch/transcription/private-send calls. Its held redelivery and receipt-recovery arm is non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. Successful fetch/derivation is non-executable until `seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` land and the exact mode proves the integrated owner-governed path. |
| P12-NF-52 | 1.x migration | Old negative id, alias, bind pin, pending logical send, ambiguous send or `deliverToConversation` caller becomes unreadable, becomes authority, blindly replays, or imports queued PromiseBeacon work with user output enabled by omission. The import positive is non-executable until `seam-response-intake-followup.md`, `seam-response-rungraph-followup.md`, and `seam-response-effects-followup.md` land and integrate the granted authority-inert records. Until then, a read-only dry run reports the payload- and receipt-less send as unsupported. After integration it remains an inert capture linked to owned blocked work with zero effect/provider calls; absent/false PromiseBeacon output stays silent even for queued summaries, while explicit true exercises the ordinary effect path |
| P12-NF-53 | minimal response | An ordinary worker start/restart failure produces silence, uses an adapter-private or model-gated send, claims a response while any required minimal dependency is absent, or treats a valid ordinary-reply payload as production assembly proof. The positive is honestly declared and inhibited: with all minimal prerequisites admitted, one durable Part One `Result` and one attributable ordinary reply must pass, but the check is non-executable until the BUILT assembly seam accepted in `part-eleven-seam-response-assembly.md` is integrated. Removing each minimal fact, generation, identity, authority, peer-durability, lease/fence, route or evidence dependency then yields preserved input where custody remains, an owned outage, zero reply/replay, and recovery only after that prerequisite returns |

---

## 13. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 69 and 71; **checks:
P12-NF-01/44–50/53**.

| Duty | Disposition |
|---|---|
| Big picture section 10 — replaceable conversation edge and channel parity | **Held as a contract:** one family suite, no core platform branch, exact per-instance capabilities and individual activation through P12-NF-03–05/45/48. Runtime status remains declared until evidence runs. |
| Part four — concrete authenticated evidence, event-id authority and acknowledgment policy | **Held as a contract for the landed narrow intake:** bounded structural route extraction, non-secret `receive(raw, route)`, the landed `(adapter, channel, sender, identityEpoch, eventId)` key, per-platform identity matrices, current binding resolution, and single-arrival generic owned `needs-judgment` holds with `expired-judgment` terminals through P12-NF-06–26/51. Held/expired redelivery and receipt recovery are non-executable until the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands and its Four-owned implementation integrates. Secret custody is non-executable until its Four grant in `seam-response-intake-followup.md` lands and Ten's `seam-response-assembly-followup.md` also lands. Slack policy is non-executable until the Four half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. Legacy compatibility is non-executable until the three owner grants in `seam-response-intake-followup.md`, `seam-response-rungraph-followup.md`, and `seam-response-effects-followup.md` land and integrate. Four retains intake and standing ownership. |
| Part five/six — durable work, one voice, bounded observation recovery and stable operation identity | **Held as a contract for flat grounding compatibility fixtures and observation-only recovery:** fact-derived outbox, read-only observation wakes, stable identities and no replay on uncertainty through P12-NF-33/36–39/41–42. The item-level service-round and backlog positive in P12-NF-40 is declared but non-executable until the dated 08:03Z grant in `seam-response-loop-followup.md` (SEAM-LEDGER row 43) lands and its Part Six implementation integrates. That grant advances first-service membership after an opportunity without terminalizing an uncertain owner operation; a later observation wake is a distinct item. Production `start`/`recovery`/`resume` grounding is non-executable until the 08:48Z Part Ten and Five arms in `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45) land and integrate Five's public consumption through `AssemblyHistoryReadPort`; current step/input/manifest bind through the current immutable delivery specification, while the row-38 launch-based arm remains initial-context only. The flat receipt is excluded from activation. The real-model and real-owner-settlement crash path in P12-NF-43/44 is not held. Five/Six retain run, lease and loop ownership. Compaction accounting is non-executable until `seam-response-run-closure.md`, `seam-response-rungraph-followup.md`, and `seam-response-effects-followup.md` land. A successful unchanged-request, unchanged-digest successor send is non-executable until `seam-response-effects-followup.md` and `seam-response-loop-followup.md` land. Changed-rendering successors remain unsupported. |
| Part seven/eight — advisory judgment and attributable reply effect | **Held only for the landed narrow shapes:** one exact ordinary-text reply can be prepared, validated, claimed, invoked and observed; advisory/refusal and the generic owned media judgment hold preserve zero private provider or send calls through P12-NF-27–33/37/41–43/51. The real-model, real-owner settlement, delete, media/aggregate, Slack single-member ephemeral, and unchanged-request/unchanged-digest successor positives remain inhibited until their named grants in `seam-response-judgment.md`, `seam-response-effects-followup.md`, `seam-response-effects-payloads.md`, and `seam-response-loop-followup.md` land as applicable. The ephemeral positive specifically cites the audience addendum in `seam-response-effects-followup.md` (SEAM-LEDGER row 53) and never widens to public text. WhatsApp Business named-template and interactive-button effects remain unsupported because the granted typed-payload list does not include them. No changed-rendering successor is supported. The Slack-policy judgment positive remains inhibited until the Four half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. Seven retains judgment and receipt ownership; Eight retains effect and settlement ownership. |
| Part nine — independent evidence and live holder proof | **Held only for the landed assessment shape:** Nine can accept stage-specific source Evidence and retain unsupported negatives, but Eight cannot consume that real assessment into a positive settlement under the two landed predicate conventions. P12-NF-35/44 are non-executable until the Nine/Eight grant in `seam-response-effects-followup.md` lands and a joint real-owner fixture passes. Real canaries remain implementation obligations under P12-NF-46/48. Nine retains grades, assessment, and witness posture. |
| Part ten — remaining adapter evidence contracts and executable bindings | **Held only for the landed contract/conformance and harness-evidence shapes:** Telegram, WhatsApp, iMessage and web map to Ten's current assembly types. Ten's `HarnessObservation`, `HarnessLaunchSpec`, and `AssemblyHistoryReadPort` exist, but the immutable current delivery specification and Five's production consumer remain non-executable until `seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45) land and integrate; row 38 covers only the original initial-context schema. Slack identity capture maps to Ten's types, but Slack activation remains inhibited until the Four half in `seam-response-intake-followup.md` (SEAM-LEDGER row 18) and the Seven versioned intake-policy judgment consumer in the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. P12-NF-51's current case is a generic Four hold with zero private media/provider/send calls. Secret custody, successful media, legacy import, confined model execution, and production minimal-plane wiring remain excluded until their named grants land and integrate. No new core type is introduced here. |
| Part eleven — first vertical slice and minimal conversation route | **Declared, not held for runtime:** P12-NF-53 maps ordinary-worker failure to Eleven's limited responder and the landed ordinary-reply effect, and maps every required-minimal-dependency outage to preserved owned failure with zero fabricated response. P12-NF-53 and affected production wiring are non-executable until the BUILT production assembly accepted in `part-eleven-seam-response-assembly.md` is integrated. The Telegram production slice, real worker bridge, crash cuts and delivery witness remain implementation and evidence obligations under P12-NF-42–48/53. Eleven retains the whole-slice and operator-surface verdict. |

---

## 14. Operator decisions and honest limits

**Value — activation order.** Should platform activation be strictly Telegram, then Slack,
WhatsApp, iMessage, and web, or may later adapters go live as soon as their own evidence is ready?
Options: strict serial activation; independent activation after Telegram proves the reference
slice. **Recommendation:** require Telegram's slice first, then allow each later adapter to
graduate independently on its own evidence. Use Slack, WhatsApp, iMessage, and web as work
priority only; one later adapter does not gate another.

**Value — unresolved-sender acknowledgment.** What should the default part-four acknowledgment
policy be for public and group conversation modes? Options: always; bound-only; never.
**Recommendation:** bound-only. It preserves reachability for known relationships without sending
responses that let strangers discover which accounts already have an existing relationship with
the agent; deployments may approve a different declared policy per exact mode.

**Value — Slack conversation granularity.** Should directed Slack work bind to each thread or to
the whole channel? Options: thread-scoped directed work with channel-scoped ambient context;
channel-scoped work everywhere. **Recommendation:** thread-scoped directed work, using the root
message timestamp from first intake, because concurrent asks otherwise share one authority and
history domain.

**Value — conservative device-channel policy after admission.** Every option begins only after the
exact WhatsApp linked-device or iMessage mode passes the mandatory live send, confinement, and
isolation proof in section eleven; no policy choice can waive that gate. After admission, should
the mode be read-only, allow reactive replies to admitted inbound messages, or allow proactive
sending under a specified recorded standing grant? Options: read-only; reactive replies;
proactive sending under that grant. **Recommendation:** reactive replies after admission. Proactive
sending needs an explicit standing-grant scope and its own exact-mode evidence subject.

**Value — delivery wording.** What stage should ordinary user surfaces display when a platform
only returns a post acceptance and message id? Options: “sent”; “accepted by platform”; hide the
state. **Recommendation:** “accepted by platform,” upgrading to delivered/read only when part nine
has independent evidence for that exact stage. Familiar wording is not worth a false claim.

**Value — public Telegram ingress constraint.** May an installation expose and operate a public
authenticated webhook endpoint for Telegram? Options: permit it for installations that accept the
public-ingress exposure and pass the recorded endpoint checks; prohibit it and require long polling;
decide per installation. **Recommendation:** decide per installation, record the constraint, and let
section five's engineering rule select the mode from that fact and measured custody evidence.

**Value — uncertainty attention budget.** After a bounded observation episode ends while a send
remains uncertain, how should operator attention be scheduled? Options: one immediate coalesced
attention item followed by a daily digest while unresolved; daily digest only; pull-surface only.
**Recommendation:** one immediate coalesced item followed by a daily digest. The operation and its
evidence remain retained under the inherited Part Two and Part Eight contracts in every option;
this choice changes surfacing cadence, never truth or retention.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P12-NF-01/44/48/50–52** and the governed review process. This document claims no code,
deployment, runtime measurement, review convergence, or operator approval. Implementation is not
eligible until the independent desk converges on the exact document and the operator approves it.
No adapter is live until its real three-tier, platform, confinement, crash-cut, migration, and
independent-witness evidence exists at the active generation.

---

*Depends on: the governed purpose, rules, register, glossary, big-picture design, and parts one
through eleven at the exact versions reviewed with this document. Next after approval: implement
the Telegram reference slice through the existing public ports, then graduate the remaining
conversation adapters only on their own evidence.*
