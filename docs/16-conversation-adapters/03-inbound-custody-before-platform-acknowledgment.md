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
