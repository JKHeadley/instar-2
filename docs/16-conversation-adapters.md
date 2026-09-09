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
| Ten | `AdapterEvidenceContract`, `AdapterConformance`, `AssemblyManifest`, `AssemblyAdmission`, concrete binding, confinement and package lifecycle |
| Eleven | verified pairing/binding surfaces, minimal-plane dependencies, operator views and whole-slice acceptance |

The executable reference case consumes Five's landed `SessionGrounding` only for `start`,
`recovery`, and `resume`. Compaction accounting is unsupported until Five supplies the producer and
Eight consumes its reference on the first reply, as requested in
`design-conversation-adapters-seam-request-rungraph-continuity.md`. Part Twelve retains the final
family obligation but does not call the missing record existing.

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
`AdapterEvidenceContract` and `AdapterConformance`. The contract names its package and artifact
digests, platform API and mode, authenticated account and tenant namespaces, credential reference,
sender and conversation identity sources, identity stability and churn rules, forwarding rules,
event-id authority, acknowledgment policy, disclosure scope, parser declaration, operation
declarations, supported evidence stages, unsupported evidence, rate and size limits, captured
fixtures, live probes, and freshness. A family default cannot fill an omitted instance field.
Unknown support is unsupported for activation.

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
is physical capture, bounded route extraction, then `receive`. Physical capture means holding the
bounded original transport bytes without changing them; it is not a fact receipt or recoverable
drain. The adapter may then extract only the structural route that the landed
`IntakePort.receive(raw, route)` requires: `channel`,
`sender`, `identityEpoch`, and provider `eventId`. This extraction reads declared envelope fields
and authenticated connection metadata. It does not interpret message content, deduplicate, filter,
fetch an attachment, acknowledge, or advance a cursor. The adapter then calls `receive` with the
unchanged raw bytes and extracted route. Inside that call, Part Four's landed capture port preserves
the bytes and Part Two appends the route-bearing `intake-receipt`. Only that fact receipt supplies a
recoverable drain. A crash after extraction but before the receipt leaves the provider event
unacknowledged and must be recovered by provider redelivery; a crash after the receipt is recovered
through `IntakePort.recover(receiptId)`. Secret matches then take Part Four's two-artifact custody
path. An over-limit event produces a bounded preserved refusal with the provider identity and
available digest evidence; it is not partially interpreted as a smaller message.

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
arrival hash joins the original intake state. Same tuple and different bytes records `Conflict`
and an attack signal. An expired acceleration cache cannot make an old event new because consumers
re-resolve against the durable admission history.

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
**checks: P12-NF-11/32/41**. A “got it” text that qualifies as an ordinary reply can use the landed
Part Eight path. A reaction, read receipt, typing indicator, authorization notice, or cold-start
notice is also an outward operation, but is unsupported by the current effect slice. Those forms
depend on the requested Part Eight conversation-operation seam. Once that seam exists, they follow
the instance's acknowledgment policy and Part Eight's validation, ownership, notification bound,
and settlement. Fire-and-forget is never valid. Failure of a decorative acknowledgment cannot
hide or terminalize the accepted intake.

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
`design-conversation-adapters-seam-request-legacy-import.md`. Until that owner seam lands, the
supported action is a read-only dry run that reports every exact record and why it is unmappable;
it neither imports nor replays it. After the seam lands, the source bytes remain in Part Two
custody and the additive owner records link to that capture. Existing `deliverToConversation`
consumers and every caller that stores a numeric conversation id move in the same migration. This
consumer set includes `PromiseBeacon`, its server composition, conversation lookup surfaces, and
durable commitment or follow-through records carrying a topic id. The 1.x files retire as an
authority only after every reference resolves or has an owned inert disposition and no unresolved
legacy send can reach a provider.

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
remain unsupported in the landed ordinary-text slice. The current executable positive case keeps
the original update in custody, records an explicit unsupported result and accountable owner, and
makes zero file-fetch, transcription-provider, or fallback-send calls. Successful media handling
depends on the requested Part Eight `fetch-inbound-media` and `derive-transcript` operations. After
that seam is accepted and implemented, Part Six owns their claims, bounds, and recovery. The
confined Part Ten custodian uses the bot credential. Part Two holds downloaded bytes and provider
responses by capture reference. If transcription uses a model doorway, Part Seven owns its
provider attempt and receipt. Part Five owns the run step that consumes the captured result. A
transcript is derived evidence linked to the original `Intent`; it is never injected as a new
verified sender message. Download, type, size, or transcription failure leaves the original intake
preserved with an explicit owner and result. The adapter neither sends a private fallback reply nor
deletes the obligation.

**Rule — Telegram outbound operations are individually registered.** Rules 30, 52, 63 and 66;
**checks: P12-NF-27–36**. Post text, post media, edit, delete where separately authorized, react,
create topic, and send a conversational acknowledgment are distinct planned operation declarations.
Only post text is executable through the landed Part Eight ordinary-reply contract. Post media,
edit, delete, react, topic creation, and non-text acknowledgment remain unsupported until the
requested Part Eight conversation-operation seam is accepted and implemented. The reference reply
path accepts an already validated `OutboundMessage` and no raw bot credential. It returns capture-
backed provider bytes or typed transport uncertainty. A successful Bot API post is evidence for
Part Nine to assess; it is not itself a delivered or read stage. Telegram exposes no assumed
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
Rules 4, 10, 14, 28, 42, 46, 57, 66, 86 and 87; **checks: P12-NF-19/20/41**. Part Four records
whether the authenticated event is a direct message, an explicit mention, a registered command,
or undirected channel traffic. It resolves organization permission and current standing from
signed history; the adapter's private allowlist or a display name cannot decide either. Directed
DMs and mentions continue through intake even when a Part Seven advisory is unavailable, carrying
the declared uncertainty flag. An exact deterministic authority refusal remains a preserved
refusal. Undirected traffic is captured and receives an explicit owned disposition under the
declared channel policy: out of scope, retain as bounded ambient context, or ask Part Seven for one
closed `speak`, `react`, or `silent` advisory. An unavailable ambient advisory selects the declared
conservative `silent` neighbor and records that disposition; it does not erase the capture.
`speak` returns to the ordinary Part Four/Five intake path. `react` is an outward Part Eight effect
and is currently unsupported because the landed payload is text-only. Mention-only mode and system
channel policy are therefore registered intake/classification policy, not early adapter drops.

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

**Rule — family media preserves custody before any private retrieval or source-text injection.**
Rules 7, 29, 36, 42, 46, 66, 75 and 105; **checks: P12-NF-12/13/20–22/51**. A Slack file event and a
WhatsApp linked-device audio event first enter Part Four as their unchanged original platform
event, including authenticated attachment metadata. In the current landed slice, Part Four
preserves an explicit unsupported-content result with its accountable owner; no Slack private-file
download, `files.info` lookup, process-local path marker, source-text injection, Baileys media
download, transcription provider
call, placeholder reply, or fallback private send occurs. This current positive case preserves the
original event, records its owner and unsupported reason, and makes zero media-fetch,
transcription, or outward provider calls. Successful retrieval and transcription are separate
seam-dependent cases. They require the accepted Part Eight `fetch-inbound-media` and
`derive-transcript` payloads, Part Ten credential confinement, Part Six claims and recovery, and
Part Seven provider accounting where a model doorway is used. Derived text remains evidence linked
to the original intake; it never becomes a new verified sender event.

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

**Rule — platform-specific UX remains an effect, not an exception.** Rules 30, 42, 52, 63,
79 and 105; **checks: P12-NF-22/24/25/32**. Slack reactions and ephemeral notices, WhatsApp read
receipts and reactions, iMessage immediate texts, and web delivery indicators use registered
operations with their real audience and evidence once the requested Part Eight seam exists. The
landed slice supports only ordinary text replies. Every listed non-text form is currently
unsupported. A bridge or fallback cannot silently replace an unsupported form with a broader
message, a different audience, or another platform.

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
Attachments are unsupported until the requested Part Eight seam lands. Part Eight hashes the
canonical whole message, and the request retains that digest. Current standing, binding,
lease/fence, stop state, register generation, durability demand, and resource reservation are
revalidated immediately before the dispatch-claim. The stable effect identity is recorded before
the first provider call and survives worker death, machine transfer, route recovery, and receipt
loss.

**Rule — attribution is recorded even when display is compact.** Rules 28, 42 and 89;
**checks: P12-NF-27/42/43**. `OutboundMessage.speaker` names the speaking principal, while the
signed fact envelope and referenced `sourceResult` carry its provenance. The run and referenced
facts carry any agent, machine, harness, model, or fixed-template source evidence they actually
prove. `OperationDefinition.account` and `OutboundMessage.account` bind the transmitting platform
account. Unknown remains unknown. A display policy may omit an origin footer, but cannot erase the
referenced evidence or let a worker invent it. A session credential proves only the enrolled
session and operation preparation it actually covers.

**Rule — current grounding and future compaction accounting are different dependencies.** Rules
47, 96 and 110; **checks: P12-NF-42/43**. The current executable worker path consumes Five's landed
`SessionGrounding` only for a fresh `start`, `recovery`, or `resume`. It checks the actual clock,
the full supported history coverage, current binding, and the recorded consumption receipt before
ordinary work. The landed record union has no `ContinuityAccounting`, and its decoder expressly
rejects compaction accounting. A post-compaction first reply is therefore unsupported, not treated
as an ordinary resume and not made compliant by provenance fields. The final family design depends
on Five producing `ContinuityAccounting` and Eight requiring its exact reference before the first
post-compaction send, as requested in
`design-conversation-adapters-seam-request-rungraph-continuity.md`.

**Rule — formatting is a deterministic, recorded preparation step.** Rules 30, 33, 36, 42
and 89; **checks: P12-NF-29/31**. A formatter consumes admitted source text and produces exact
rendered text before the outbound decoder runs. That exact rendered string becomes
`OutboundMessage.text`, and Part Eight's request digest covers the whole closed message. Formatting
mode, safe-link decisions, and transformation evidence live in an existing source-result or
closure-referenced fact, not as undeclared message fields. Telegram HTML/Markdown and Slack's
`mrkdwn` markup syntax have captured real-byte fixtures for nesting, code, tables, Unicode, hostile
links, control characters, private sentinels, and adversarial lengths. WhatsApp, iMessage, and web
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

**Rule — alternate rendering is unsupported in this slice.** Rules 24, 42, 55, 60 and 63;
**checks: P12-NF-31/36/37**. A provider's definitive parse rejection is captured as evidence about
that exact immutable request. It does not authorize changed bytes. The landed settlement always
has `retryEligible: false`. Therefore the adapter returns the parse failure and usable remedy to the owning run and
makes no plain-text resend. Timeout, connection loss, or missing response remains uncertain and
also makes no resend. Any future governed successor with changed rendering must be a distinct
owner-approved operation linked to the settled original and may be invoked only after evidence
establishes non-occurrence, exclusion of delayed execution, and final charge closure through the
requested send-retry seam. A provider
software development kit (SDK) is the client library used to call its API; its hidden retry is
disabled or exposed as an attempt governed by the same records.

**Rule — advisory judgment cannot swallow the reply.** Rules 10, 12, 42, 46, 57, 67 and 86;
**checks: P12-NF-29/41**. A registered pre-send tone or clarity review goes through part seven and
returns its declared advisory decision. An unavailable ordinary advisory follows that consumer's
registered deliver-with-flags or no-objection policy; deterministic credential, authority, stop,
and effect walls still apply. A hold or refusal returns to the owning run with the exact reason and
next permitted action. The adapter cannot loop for a different answer, treat “not sent” as success,
or discard the pending message.

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
account, conversation, operation, and digest, and emits `Evidence` references. Its current
`VerificationAssessment` applies the plan's stage-specific bar as separate occurrence,
non-occurrence, quiescence, and charge predicates, naming missing evidence and limitations in each
predicate reason. A Bot API response can therefore support “provider accepted this exact post”
without supporting “a person received or read it.” A later delivery, display, or read claim needs
its own authenticated callback or lookup capture and an assessment bar that admits that source.

A positive P12-NF-34/35 case records this exact closed shape inside its fact envelope:

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

**Rule — unsupported negative evidence leaves an owned uncertainty.** Rules 24, 26, 42, 63
and 68; **checks: P12-NF-34–36**. Each mode declares whether it supports stable receipt lookup,
decisive non-occurrence, exclusion of delayed execution, and any final charge. Telegram and other
send-only modes do not gain those capabilities by belonging to the conversation family. A timeout,
eventual search miss, missing chat display, expired history, local process death, or new credential
does not prove the old send failed. The original operation remains owned, its maximum application
and charge exposure remains visible. No replacement effect runs in the landed slice. A future
successor requires the requested Part Eight/Six send-retry seam and current Part Nine evidence.

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
send-retry case exists in the executable slice. A future new attempt after proved non-occurrence,
old-executor quiescence, and final charge closure depends on the additive owner contract requested
in `design-conversation-adapters-seam-request-send-retry.md`; an adapter or Six cannot create that
permission itself.

**Rule — failure notices do not create a recursive message storm.** Rules 14, 52, 53, 54, 87
and 95; **checks: P12-NF-40/41**. The original operation is repaired when safe. A required notice
uses part eight, the existing alert destination, stable coalescing identity, and finite episode
budget. It never creates one topic or notice per retry. If the conversation route itself is down,
the notice remains a visible obligation on an independent operator surface. Failure to send the
failure notice cannot mark the original delivered or launch an unbounded notice-about-notice loop.

---

## 9. The real worker-to-conversation path

**Rule — Claude Code, Codex, and every harness use one path.** Rules 29, 30, 63, 84, 105 and
115; **checks: P12-NF-42/43**. A harness receives part five's grounded intake and may propose an
`OutboundMessage` through the public effect doorway. It does not receive platform credentials,
raw account sessions, arbitrary provider clients, or a general send script. The executable
assembly binds a confined conversation adapter custodian that accepts only a current validated
operation and consumed dispatch-claim. Framework hooks may steer attempted direct writes to the
public doorway, but a hook's presence is not confinement proof. Every enabled harness must pass
the same isolation and lifecycle checks.

**Rule — the end-to-end transition order is fixed.** Rules 14, 15, 26, 28, 33, 41, 42, 46,
58, 62, 63, 68, 75 and 89; **checks: P12-NF-43/44**.

1. Capture the authenticated platform event before protocol acknowledgment.
2. Let part four deduplicate, resolve principal and current binding/standing, and append the intake.
3. Let part five create or resume the durable run and record actual-start grounding.
4. Let the worker produce a bounded answer or request part seven judgment through its doorway.
5. Prepare exact rendered platform bytes and part eight's attributable outbound operation.
6. Revalidate authority and durability, then let part six commit the claim and resource reservation.
7. Invoke the concrete adapter once for that claim and record the exact observation.
8. Let part nine independently assess the demanded delivery stage and let part eight settle only what evidence proves.
9. Return the result to part five and rebuild every disposable view from the causally linked facts.

**Rule — Telegram proves the first real slice under crash cuts.** Rules 34, 37, 43, 62, 68
and 105; **checks: P12-NF-44/46–48**. The production initialization path uses a real Telegram test
bot, authenticated sender, pre-existing verified binding, real Claude Code or Codex harness, real
registered model doorway, real persistence, and an independent recipient-side witness. The fixture
kills the worker or adapter after every adjacent durable boundary in the sequence above, including
after provider application before local observation. Passing requires one admitted intake, one
durable run, stable identities within the execution, no more than one externally observed semantic
reply, evidence no stronger than its source, every obligation owned, and equal rebuilt projections
at one vector. If the platform cannot resolve a cut, the correct result is retained uncertainty and
zero replay, not forced green.

**Rule — Telegram precedes the family; later activation is evidence-independent, not list-gated.**
Rules 44, 62, 72, 73, 76, 84 and 105; **checks: P12-NF-45/46/48/49**. Telegram must first pass the
reference slice. After that, Slack, WhatsApp, iMessage, and web may each activate when that exact
mode passes the shared suite, production wiring, account-level live canaries, independent
delivery-stage assessment, migration compatibility, and platform-limit tests. The written list is
work priority, not an activation prerequisite between later adapters. No later adapter borrows
Telegram or a sibling's evidence. A platform API change invalidates only the affected conformance
subject and inhibits unsupported operations. It does not silently downgrade authentication,
discard inputs, or close other healthy adapters. Strict serialization of every later adapter is a
separate operator policy, not this proposed baseline.

---

## 10. What Instar 1.x does today and what carries forward

**Rule — layer-below claims stay tied to the modules and incidents that earned them.** Rules
89 and 111; **checks: P12-NF-02/49/51/52**. The required read-only audit found the following behavior.
The carry-forward column states the required property, not a requirement to reuse the 1.x code.

| Instar 1.x module and earned incident | Behavior or guarantee that carries forward | 2.0 disposition |
|---|---|---|
| `TelegramAdapter` | Long polling waits for handling before offset advance; forum topics keep distinct routes. A placeholder token once left a moved session reporting success while no message could reach Telegram, so admitted life requires verified bot identity and a real route. | Preserve custody-before-cursor and topic identity; replace local routing, authorization and success inference with parts four, eight, nine and ten. |
| `TelegramAdapter` media handlers | Voice, photo, and document updates are downloaded to local paths and routed to handlers. Voice invokes a configured Groq or OpenAI transcription provider directly, then injects `[voice]` text; photo and document handlers inject local-path markers. Download or transcription failure sends a direct fallback reply. | Preserve current custody by capturing the original update and recording unsupported media with zero private fetch/provider/send calls. Retire direct download, provider, path-injection, cleanup, and fallback-send authority. Successful fetch/transcription remains gated on the requested Part Eight media operations; seven owns applicable provider attempts and five consumes the derived result. P12-NF-51 separates these cases. |
| `pending-relay-store`, `DeliveryFailureSentinel`, and `telegram-reply.sh` | Stable delivery identity, per-agent durable custody, fenced claims, ambiguous timeout handling, and loud recovery prevent silent loss and blind duplicate sends. A restoration purge once ate a quiet-hours-held notice. Minting an id only at enqueue left the first send outside dedup. Both incidents require identity before first dispatch and no purge of unresolved work. | Re-express the queue as fact-derived outbox/recovery under six and eight. Keep adapter storage only as disposable acceleration. |
| `telegram-reply.sh` | Wrong-port agent identity checks prevent cross-tenant sends. A tone flag placed after the topic id was delivered as user text while its effect vanished, causing a correct check to be graded wrong. Inputs that change send semantics must be typed, ordered, and refused when malformed. | Replace shell argument authority with the public effect port and typed operation input. A compatibility wrapper may only translate and return the core result. |
| `MessageRouter`, `MessageStore`, `DeliveryRetryManager`, and `SpawnRequestManager` | Save-before-send, both sides of conversation history, stable envelopes, queued spawn work, bounded attempts, and explicit delivery phases preserve continuity. Earlier one-sided history caused context loss. Refusing a system-channel registry write caused repeated session spawning. | Part two stores facts, part five owns runs, and part six owns loops and transport recovery. HTTP receipt and session injection no longer count as conversation delivery. |
| `ConversationRegistry` and `conversationIdentity` | A structured Slack channel/thread tuple joins a durable negative numeric id, canonical key, one-hop aliases, bind pins, origin, and crash-replayed journal/snapshot state. Its journal may retain only a send key, lane, sequence or timestamp. Positive Telegram ids pass through. These are the real cross-channel identity and alias authorities in 1.x, but a bind pin is only a retained tuple and send-guard rows do not retain the payload or provider receipt. | Preserve readable old ids, tuples, aliases, bind targets, and send-guard bytes through the compatibility decoder. Import no operator binding, effect, claim, assessment or settlement from insufficient evidence. Keep it inert and migration-blocking through the requested legacy-import seam until every numeric-id consumer has an exact disposition under P12-NF-52. |
| `deliverToConversation`, `PromiseBeacon`, and the server composition | The shared funnel resolves Telegram ids and minted Slack ids, follows binding tuples, classifies non-delivery, records logical/content send guards, and routes pending beacon follow-through. The server wires `PromiseBeacon` through it. It also has 1.x-specific dark/dry and reachability behavior. | Move the beacon, server wiring, conversation lookup surfaces, and stored topic-id consumers to Part Eight. Preserve pending and ambiguous sends without replay, and retire the old funnel only after every stored conversation reference resolves through the new route. |
| `TelegramMarkdownFormatter` and `slack/SlackMrkdwnFormatter` | One outbound formatting funnel, safe URL schemes, escaped code/text, bounded parsing, and explicit pass-through modes prevent literal markup, unsafe links, double escaping, and parser resource abuse. | Keep deterministic transformations and captured real-byte fixtures, but validate the rendered digest through part eight before sending. |
| `slack/SocketModeClient` and `slack/SlackAdapter` | Fresh connected state, verified team identity, thread routing, reconnect recovery, and guarded socket writes are necessary. The adapter also has a fail-closed user check, an organization permission observer/enforcement gate, DM/mention-directed handling, mention-only ambient handling, and bounded `speak`/`react`/`silent` ambient decisions. It downloads attachments with the workspace credential and may inject retrieved or downloaded source text and process-local paths into the prompt. An unguarded acknowledgment during sleep/wake once crashed the server, stale socket callbacks once orphaned a healthy replacement, and a malformed live probe once marked a healthy API failed. | Preserve the state-machine, probe, direction, and permission requirements. Move capture/ack to Four, semantic ambient judgment to Seven, and reactions/replies to Eight. Retire private file retrieval and prompt injection; current media is preserved as unsupported, while successful retrieval depends on the requested media seam and Part Ten confinement. |
| `WhatsAppAdapter` and its backends | Backend capabilities, fail-closed configured contacts, group/participant separation, chunking, and connection state are useful platform mechanics. The linked-device Baileys backend also downloads audio to a local file, calls a configured transcription provider, injects `[voice]` text, and falls back to an `[Audio]` placeholder when unavailable or failed. | Split Business and linked-device evidence modes. Move consent, authorization, acknowledgments, queues, limits and retries to their core owners. Retire local audio custody, direct transcription, source-text injection, and placeholder fallback as adapter authority; preserve the original event now and gate successful media derivation on the requested Part Eight seam. |
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

**Value — preserve lessons, not accidental topology.** SQLite, JSONL, tmux, shell wrappers, Socket
Mode, long polling, and specific SDKs may still be sound implementation choices. None is elevated
to the constitutional contract by having carried an important 1.x fix.

---

## 11. Non-functional checks and activation

**Rule — bounds name their subject, workload, and failure action.** Rules 13, 34, 39, 43, 55,
60, 61 and 64; **checks: P12-NF-30/39/40/46–48**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Capture-to-ack | Real platform events at idle, declared peak, boundary, and boundary-plus-one sizes; kill at write, flush, fact append, ack and cursor cuts | No protocol ack before durable custody; failed capture remains redeliverable or an owned outage |
| Intake isolation | Flood one sender, conversation and adapter while healthy peers send ordinary and stop messages | Finite byte/concurrency/queue caps hold; healthy eligible work receives service within a declared fair round |
| Outbound uniqueness | Kill at preparation, claim, provider acceptance, observation, witness and settlement; lose and duplicate callbacks | At most one external semantic reply; unresolved cuts retain identity, exposure and zero replay |
| Formatting | Real captured bytes, malformed markup, unsafe links, Unicode, NUL/control data, adversarial nesting and declared size edges | Exact deterministic digest or explicit refusal; no meaning/audience/standing change and no unbounded parse |
| Conversation identity | Restart, reconnect, rename, archive, topic/thread roots, account churn, aliases and cross-platform forwards | Same authenticated tuple resolves the same history; churn holds binding; no content-based merge |
| Evidence honesty | Positive receipt, delayed receipt, forged callback, missing query, read/display signal, stale probe and unsupported stage | No stage promotion; nine records exact assessment or retained unknown |
| Recovery cost | Cold/warm rebuild of unresolved intake/outbox over release corpus on every deployment class | Recorded scanned facts/bytes, duration, peak memory and failures fit approved finite budgets; overrun blocks activation |
| Platform health | Cadenced authenticated identity, inbound and outbound canaries through production assembly with independent witness | Fresh exact-mode proof required; stale, failed or unavailable inhibits only unsupported scope and starts owned repair |
| Framework parity | Claude Code, Codex, and every enabled harness attempt the same reply and direct-credential escape cases | Public doorway succeeds; raw credential/provider access fails; missing harness evidence keeps that tuple dark |
| Notification bound | Many simultaneous permanent/transient failures, unavailable alert route and recovery flap | Existing alert destination, stable episode coalescing, finite attempts, no topic/notice storm or recursive send |

**Rule — activation needs three tiers and fresh independent proof.** Rules 34, 37, 38, 43, 62,
72, 73, 81 and 105; **checks: P12-NF-44–50**. Unit checks cover pure identity, parser, formatter,
limit, dedup, and state-transition logic. Integration checks use actual persistence and every public
port, with a kill at each durable boundary. Live lifecycle checks use production initialization,
real platform credentials, real provider bytes, an authenticated test principal and conversation,
an enabled real harness, and part nine's independent witness. Critical inbound/outbound outcomes
also carry fresh probes and step supervision. Source inspection, a running process, a configured
token, a mock transport, or a self-reported green row cannot make an instance live.

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
| P12-NF-02 | audit/docs | Unsupported 1.x claim or unnamed module/incident; named read-only evidence and scoped claim pass |
| P12-NF-03 | architecture | New core message/binding/queue/retry type or private import; earlier-owned types and public ports pass |
| P12-NF-04 | build/activation | Instance omits contract field, parser, operation or unsupported capability; complete exact-mode declaration passes |
| P12-NF-05 | architecture | Adapter selects standing, binding, classification, retry or success; translation plus owner decision passes |
| P12-NF-06 | fault | Content interpretation/filter/dedup/ack/cursor is reachable before Part Four's route-bearing receipt, or route extraction reads message prose; physical capture then bounded envelope extraction then `receive(raw, route)` passes. A crash after extraction produces no acknowledgment and provider redelivery; a crash after receipt drains through `recover(receiptId)` |
| P12-NF-07 | captured contract | Token/session/locality/display name inflated to stronger provenance; re-checkable exact evidence passes |
| P12-NF-08 | security | Adapter assertion or message content selects principal/standing; part-four decode against signed history passes |
| P12-NF-09 | dedup | Same id and changed bytes collapse; matching redelivery joins while mismatch conflicts |
| P12-NF-10 | security | Sender-controlled id suppresses another sender/tenant or expired cache revives work; fully scoped durable key passes |
| P12-NF-11 | contract | Protocol ack reported as principal/run/worker/answer receipt or ackPolicy bypassed; exact custody meaning passes |
| P12-NF-12 | load/security | Oversize event partly interpreted or secret enters ordinary capture; bounded refusal/two-artifact custody passes |
| P12-NF-13 | lifecycle | Unresolved/refused input drops or has no owner/drain; preserved authority-inert result passes |
| P12-NF-14 | binding | First sender, adapter map or session registry establishes operator; verified binding facts pass |
| P12-NF-15 | race | Stale/contested binding selects newest claimant; conflict holds new authority while stop remains live |
| P12-NF-16 | Telegram identity | Bot/chat/topic collision or general-topic drift creates two histories; canonical scoped tuple passes |
| P12-NF-17 | Telegram security | Forwarded/channel-post identity becomes human principal or update kind disappears; explicit source/disposition passes |
| P12-NF-18 | Telegram fault | Offset/webhook success crosses uncaptured update; consecutive durable capture boundary passes |
| P12-NF-19 | Slack identity/admission | Root message changes from channel to thread identity, team is omitted, or DM/mention/undirected state is conflated; predeclared stable tuple plus explicit directed or ambient disposition passes |
| P12-NF-20 | Slack fault | Envelope ack precedes receipt, post-ack failure loses an event, private permission drops it, or unavailable advisory silences a directed ask; receipt then ack plus Four-owned permission and declared directed/ambient fallback passes |
| P12-NF-21 | WhatsApp security | Backend, group participant, LID, phone label or normalized address confused as verified person; exact mode evidence passes |
| P12-NF-22 | WhatsApp lifecycle | Private consent/allowlist/queue/receipt bypasses core owner, or linked-device audio downloads/transcribes/injects/falls back privately; public intake/effect composition and current preserved unsupported media pass |
| P12-NF-23 | iMessage identity | Phone reuse, chat-db access or fabricated connected time keeps binding/live claim; observed device/chat/churn evidence passes |
| P12-NF-24 | iMessage isolation | Helper sends without claim, standing, observation or audit; confined effect-port invocation passes |
| P12-NF-25 | web security | Client id/cookie/tab/click grants authority or dedups another user; server-minted session-bound event passes |
| P12-NF-26 | identity/migration | Rename, alias, bridge or forward merges histories/bindings; append-only explicit mapping with conflict passes |
| P12-NF-27 | effect contract | Reply adds provenance, audience, attachment, notification, continuity or other undeclared message fields, or omits a landed field; record identity plus the closed ordinary-reply fields semanticMessage, run, speaker, account, conversation, text, purpose and sourceResult pass |
| P12-NF-28 | effect admission | Stale binding/grant/fence/generation or missing durability dispatches; current atomic validation and claim pass |
| P12-NF-29 | formatter | Rendering changes refusal, audience, link safety or meaning, or advisory disappears; exact rendered `text` plus a source-result/closure-referenced preparation fact preserves all |
| P12-NF-30 | limits/load | Oversize text is truncated or chunked through the landed single-message path; one fitting ordinary reply or explicit `Refused` passes, while aggregate cases remain gated on the requested seam |
| P12-NF-31 | format fallback | Parse rejection or timeout changes bytes and resends under the old identity; captured failure, unchanged digest, `retryEligible: false`, and return to the owning run with no second invocation pass |
| P12-NF-32 | UX effect | Reaction/read receipt/typing fires through the ordinary-text port or failure clears intake; explicit unsupported `Refused` passes now, and a governed optional effect passes only after the requested seam lands |
| P12-NF-33 | crash | Effect identity minted after provider call or private queue is custody authority; pre-dispatch fact and rebuild pass |
| P12-NF-34 | evidence | HTTP/socket/local log/provider acceptance labeled delivered/read or encoded as an invented observation stage; an unchanged `response`/`lookup` observation with provider bytes in its capture and only the source-supported assessment passes |
| P12-NF-35 | verification | Adapter self-grades or stale/same-path probe certifies delivery; Part Nine decodes the captured provider evidence and accepts only the exact occurrence predicate its current bar supports |
| P12-NF-36 | uncertainty | Timeout/search miss/new route/local death proves non-occurrence and retries; owned unknown with zero replay passes |
| P12-NF-37 | retry | SDK/adapter invents backoff, invokes again, or mints a replacement identity; a Part Six bounded read-only observation wake for the unchanged operation/digest with zero additional invocations passes now. A successful new send attempt remains gated on the requested retry seam |
| P12-NF-38 | restart | Restart loses queued intake/send, resets attempts or changes identity; fact-derived outbox/drain resumes exactly |
| P12-NF-39 | retention | Dead-letter, configured time-to-live (TTL), or purge deletes unresolved bytes, evidence or owner; retained terminal/pending obligation passes |
| P12-NF-40 | fairness/load | One failing route starves stop/healthy work or spawns per-attempt notices; finite fair/coalesced scheduling passes |
| P12-NF-41 | failure path | Advisory, refusal or notice is swallowed, recursive or reported sent; explicit bounded result and owner pass |
| P12-NF-42 | isolation | Worker reads credential/raw account session or fabricates origin; scoped custodian and enrolled evidence pass |
| P12-NF-43 | wiring/e2e | Harness/direct script bypasses intake/effect/grounding or required port is null; the complete public chain with landed `start`/`recovery`/`resume` grounding passes, while a compaction case refuses as unsupported until the requested Five/Eight seam lands |
| P12-NF-44 | Telegram lifecycle | Crash cut duplicates reply, loses work, overstates evidence or diverges rebuild; one owned exact execution passes |
| P12-NF-45 | parity/activation | Any later adapter activates before Telegram proves the reference slice or borrows Telegram/sibling evidence; after Telegram, each exact mode may activate on its own dark-to-live evidence regardless of another later adapter's state |
| P12-NF-46 | live probe | File/token/process/config or malformed canary counts as life; real identity/inbound/outbound fresh proof passes |
| P12-NF-47 | measurement | Target/estimate/success-only percentile labeled measured or failed sample omitted; named hardware workload record passes |
| P12-NF-48 | three-tier | Mock-only or parser-only test makes significant adapter live; unit, integration and real lifecycle evidence pass |
| P12-NF-49 | upgrade | Platform/API/package change alters identity, provenance, ack or pending effect silently; scoped inhibition and compatible replay pass |
| P12-NF-50 | governance | Declared fixture has no check-run/assessment or implementation implies approval; honest declared/held state passes |
| P12-NF-51 | family media | Telegram, Slack, or linked-device WhatsApp media is acknowledged before original receipt, a file path substitutes for custody, source text is injected privately, transcription calls a provider privately, a fallback sends privately, or derived text becomes a fresh verified sender event. The current positive preserves the original event, records an owned unsupported result, and makes zero fetch/transcription/private-send calls. Successful fetch/derivation passes only after the requested effect seam lands and the exact mode proves the owner-governed path |
| P12-NF-52 | 1.x migration | Old negative id, alias, bind pin, pending logical send, ambiguous send or `deliverToConversation` caller becomes unreadable, becomes authority, or blindly replays. A payload- and receipt-less ambiguous send must remain an inert capture linked to owned blocked work with zero effect/provider calls under the requested legacy-import seam; until that seam lands, a read-only dry run reports it as unsupported and migration cannot activate |

---

## 13. Inherited duties and disposition

**Rule — no inherited duty remains parked.** Rules 8, 49, 69 and 71; **checks:
P12-NF-01/44–50**.

| Duty | Disposition |
|---|---|
| Big picture section 10 — replaceable conversation edge and channel parity | **Held as a contract:** one family suite, no core platform branch, exact per-instance capabilities and individual activation through P12-NF-03–05/45/48. Runtime status remains declared until evidence runs. |
| Part four — concrete authenticated evidence, event-id authority and acknowledgment policy | **Held as a contract for current intake:** bounded structural route extraction, `receive(raw, route)`, the landed `(adapter, channel, sender, identityEpoch, eventId)` key, per-platform identity matrices, real-byte cases, current binding resolution, and capture of media as explicitly unsupported through P12-NF-06–26/51. Four retains intake and standing ownership. Legacy compatibility activation remains gated on `design-conversation-adapters-seam-request-legacy-import.md`. |
| Part five/six — durable work, one voice, bounded observation recovery and stable operation identity | **Held as a contract for landed start/recovery/resume:** worker bridge, fact-derived outbox, read-only observation wakes, fairness and crash recovery through P12-NF-33/36–44. Five/Six retain run, lease and loop ownership. Compaction accounting and a successful new send attempt are not held coverage; they depend on `design-conversation-adapters-seam-request-rungraph-continuity.md` and `design-conversation-adapters-seam-request-send-retry.md`. |
| Part seven/eight — advisory judgment and attributable reply effect | **Held as a contract for the landed slice:** one exact ordinary-text reply, current validation, preserved advisory/refusal, zero-invocation media refusal, and no hidden fallback through P12-NF-27–33/37/41–43/51. Successful media, non-text operations, and aggregates are seam-dependent coverage under `design-conversation-adapters-seam-request-effect-doorway.md`; successful send retry is seam-dependent under `design-conversation-adapters-seam-request-send-retry.md`. Seven/Eight retain decision and settlement. |
| Part nine — independent evidence and live holder proof | **Held as a contract:** stage-specific observations, unsupported negatives, independent assessment and real canaries through P12-NF-34–36/44/46/48. Nine retains grades and witness posture. |
| Part ten — remaining adapter evidence contracts and executable bindings | **Held for current family realization:** Telegram, Slack, WhatsApp, iMessage and web modes map to Ten's existing contract/conformance and assembly types through P12-NF-03/04/19–26/45/49 and P12-NF-51's zero-call unsupported-media case. Successful media and legacy import are excluded until their named owner seams land. No new core type is introduced here. |
| Part eleven — first vertical slice and minimal conversation route | **Held for the adapter half:** the Telegram production slice, real worker bridge, crash cuts and delivery witness are P12-NF-42–48. Eleven retains the whole-slice and operator-surface verdict. |

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
**Recommendation:** bound-only. It preserves reachability for known relationships without turning
the adapter into an account-enumeration oracle; deployments may approve a different declared
policy per exact mode.

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
