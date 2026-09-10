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
