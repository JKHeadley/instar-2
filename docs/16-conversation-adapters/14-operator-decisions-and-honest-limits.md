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
