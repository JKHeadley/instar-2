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
