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
decides whether a sender receives a separate conversational acknowledgment. That decision depends
on Four's public consumer granted in the “acknowledgment policy consumer” addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 60), and any resulting message travels through
Part Eight as an ordinary reply. This policy arm of P12-NF-11 is non-executable until the grant file
lands and its Four implementation integrates with the landed Part Eight reply path. The protocol
acknowledgment itself remains the custody signal defined above; it never means that a principal
resolved, a run began, a worker consumed input, or an answer was sent. If durable
capture fails, the adapter leaves the platform event unacknowledged where redelivery exists and
records the scoped outage through an independently durable path where it does not.

**Rule — deduplication follows capture and separates a stable event from its delivery attempts.**
Rules 31, 33, 36 and 42; **checks: P12-NF-09/10/19/20**. Part four's landed logical identity is the canonical tuple
`(adapter, channel, sender, identityEpoch, eventId)`. The adapter instance is `adapter`. The
`channel` value encodes the authenticated account or tenant and authenticated conversation
namespace in one unambiguous, versioned string. `sender` is always present, even where the provider
claims a globally unique event id. `identityEpoch` identifies the authenticated identity era so
provider reassignment cannot collide with earlier history. `eventId` is the provider-minted id
under the declared authority. Part twelve creates no adapter-local deduplication key. In the landed
slice, the full arrival hash is both custody evidence and the compared commitment: the same tuple
and same arrival hash joins the original state only after the owner has written `intake-admitted`,
while the same tuple and different bytes records `Conflict` and an attack signal. That landed
comparison remains the executable behavior until the granted owner seam below is integrated. An
expired acceleration cache cannot make an old event new because consumers re-resolve against
durable history.

The family contract declares an authenticated stable-event projection for each mode. That
projection includes the provider's stable identity fields and the event payload, and excludes only
the delivery-attempt fields named by the declaration. The full envelope is always preserved. The
closed declarations are:

| Platform mode | Stable event fields committed by Four | Delivery-attempt evidence kept beside the event |
|---|---|---|
| Telegram bot | Verified bot/account scope, `update_id`, authenticated chat and sender scope, identity epoch, update kind and payload | The webhook request or long-poll response envelope, arrival clock and cursor/offset observation. Telegram supplies no event-level retry counter to this contract. |
| Slack | Verified app/team scope, Events API payload `event_id`, inner `event.event_ts`, channel, sender, event kind and event payload | `retry_attempt`, `retry_reason`, and the outer HTTP or Socket Mode delivery envelope. These fields may change while `event_id`, `event.event_ts`, and the event payload remain unchanged. |
| WhatsApp Business | Verified business/phone scope, the provider message or status-event id, chat, sender/participant, event kind and payload | The authenticated webhook request envelope, arrival clock and any provider retry metadata declared for that API version. No retry counter is assumed when the provider supplies none. |
| WhatsApp linked device | Enrolled device/account scope, message `key.id`, chat and sender/participant identifiers, device epoch, event kind and payload | The WebSocket/upsert envelope, batch and reconnect observation, and arrival clock. No library reconnect counter becomes stable event identity. |
| iMessage on a Mac | Enrolled account/service and database epoch, stable message GUID or provider message id, chat GUID, sender, event kind and payload | The poll batch, durable cursor and observation clock. A database row number or poll count is not stable event identity. |
| Web | Installation/account/session epoch, server-minted event id, conversation, request digest, event kind and payload | The authenticated HTTP or WebSocket arrival and replay evidence, plus client retry metadata only when the registered protocol declares it. A client-selected id never becomes stable identity. |

This distinction depends on the “stable event identity vs delivery attempt” addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 57). It grants Four the stable-event commitment
beside full-byte capture and lets Ten bind each adapter's declaration. With that owner seam, a Slack
redelivery whose `event_id`, `event.event_ts`, and payload are unchanged joins the original work
even when `retry_attempt` and `retry_reason` change; both envelopes remain captured. Reusing the
same provider id with a changed stable field or changed event payload remains a conflict and attack
signal. P12-NF-09/19/20's real-redelivery positive and negative fixture pair is non-executable until
`seam-response-intake-followup.md` lands and its Four/Ten implementations are integrated.

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
and its implementation is integrated. Any conversational acknowledgment first needs the Four-owned
decision granted in the row-60 addendum to `seam-response-intake-followup.md`; a permitted
acknowledgment then follows Part Eight's validation, audience, ownership, notification bound, and
settlement. This path is separate from the platform custody acknowledgment above. Fire-and-forget is
never valid. Failure of a decorative acknowledgment cannot hide or terminalize the accepted intake.

---
