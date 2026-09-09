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
