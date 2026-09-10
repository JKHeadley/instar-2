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

If the governing policy says each installation records its own public-endpoint choice and this
installation has no recorded choice, a public endpoint is not selected by default. Long polling
remains the conservative receiving mode when its checks pass, so an unanswered policy choice does
not make the user unreachable. The required choice workflow is granted in the “recurring
open-decision reminder” addendum to `seam-response-operator-followup.md` (SEAM-LEDGER row 59).
Part Eleven keeps exactly one durable open-decision item, shows it on the pending-request surface
and dashboard, and reminds the verified main user through an ordinary reply no more than once in
each 24-hour period. It closes the item only when a recorded, signed choice names it. P12-NF-18's
open-decision and reminder positive is non-executable until that grant file lands and its Part Eleven
and Ten implementations integrate. The check rejects a silent default, a one-time prompt that can
be forgotten, a reminder to an unverified user, or a reminder after the signed choice closes the
item.

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
