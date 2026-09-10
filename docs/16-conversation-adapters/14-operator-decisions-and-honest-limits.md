## 14. Operator decisions and honest limits

This section is written for the human reviewer. Each decision states the question in plain words, the choices, what
each choice changes for you, and a recommendation. The rule and check numbers this section rests on sit in the closing block, so the decisions themselves stay readable.

**Value — decision 1: which platforms go live, and in what order.**
Question: after Telegram is proven, must Slack, WhatsApp, iMessage, and web go live one at a time in a fixed order, or can
each go live as soon as its own evidence is ready?
Choices: fixed order; or each on its own evidence once Telegram is proven.
What it changes: a fixed order means one slow platform delays every platform behind it. Independent activation means a
platform never waits on another, only on its own proof.
Recommendation: prove Telegram first, then let each platform go live on its own evidence. Treat the list order as work
priority only.

**Value — decision 2: replying to people the agent does not know, in public or group chats.**
Question: when a message arrives from a sender the agent cannot match to any known relationship, what should it do?
Choices: always acknowledge; acknowledge only when a relationship (a binding) already exists; never acknowledge; or let
the agent decide per message, within a policy the operator declares for that chat mode.
What it changes: always acknowledging lets strangers discover which accounts the agent already has a relationship with.
Never acknowledging can leave a legitimate new contact with silence. Binding-only protects that information while keeping
known contacts reachable. Agent judgement gives flexibility at the cost of predictability, so it must run inside a declared
policy and every choice the agent makes is recorded.
Recommendation: binding-only as the default. A deployment may declare a different policy per chat mode, including the
agent-judgement option, and that declaration is recorded.

**Value — decision 3: what counts as "one conversation" in Slack.**
Question: when someone asks the agent to do something in a Slack thread, should that piece of work belong to that thread,
or to the whole channel?
Choices: the thread; or the whole channel.
What it changes: two people can ask for two different things in two threads of the same channel at the same time. If work
belongs to the channel, those two requests share one approval history and can interfere with each other. If work belongs
to the thread, each request has its own history and approvals, while general channel context is still visible to both.
Recommendation: the thread. Directed work belongs to the thread where it was asked; the channel provides background
context only.

**Value — decision 4: how much WhatsApp and iMessage may do once they are admitted.**
Background: these two run through a personal device (a linked phone or a Mac), so a mistake sends messages from a real
personal account. Nothing here starts until the live proof in section 11 passes; no choice can skip that proof.
Question: once a device channel is admitted, may the agent only read, reply to messages it received, or also start new
conversations on its own?
Choices: read-only; reply-only (respond to admitted incoming messages); or proactive sending under an explicit standing
permission that the operator records.
What it changes: read-only can never send anything wrong but cannot answer anyone. Reply-only limits the damage of any
mistake to conversations someone else started. Proactive sending is the most useful and the most dangerous, so it needs
its own explicit permission and its own proof.
Recommendation: reply-only after admission. Proactive sending only under a recorded standing permission with its own
evidence.

**Value — decision 5: the word shown to people when a platform has only accepted a message.**
Question: when a platform has taken the message but not confirmed delivery, what should the user see?
Choices: "sent"; "accepted by platform"; or hide the state.
What it changes: "sent" can claim more than is known. "Accepted by platform" says exactly what happened. Hiding the state
gives the user nothing.
Recommendation: "accepted by platform", upgraded to delivered or read only when independent evidence exists for that
stage. Familiar wording is not worth a false claim.

**Value — decision 6: whether Telegram may receive messages through a public web address.**
Background: Telegram can deliver messages two ways. Long polling: the agent asks Telegram for new messages, and nothing is
exposed to the internet. Webhook: Telegram pushes messages to a public address the installation exposes, which is faster
but means running a public, authenticated endpoint.
Question: may an installation use the webhook method?
Choices: allow it for installations that accept the exposure and pass the endpoint checks; forbid it and require long
polling everywhere; or decide per installation.
What it changes: allowing it trades some internet exposure for lower latency. Forbidding it keeps every installation
private but slower. Per installation lets each deployment weigh its own exposure.
Recommendation: decide per installation, record the choice, and let the engineering rule in section 5 pick the method
from that record plus measured evidence.

**Value — decision 7: how loudly to tell you about a message whose delivery is uncertain.**
Background: sometimes the agent cannot tell whether a message was delivered. The agent watches for a bounded time; if it
still cannot tell, the uncertainty is recorded and kept, in every option below. This decision only changes how you hear
about it.
Question: when that bounded watch ends without an answer, how should your attention be requested?
Choices: one immediate notice (grouped with any others) and then a daily digest while it stays unresolved; a daily digest
only; or nothing pushed, visible only when you look.
What it changes: how often you are interrupted. It never changes what is kept or what is true.
Recommendation: one immediate grouped notice, then a daily digest.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P12-NF-01/44/48/50–52** and the governed review process.
This is a design, not a finished product. It contains no code, no deployment, no runtime measurements, no review verdict,
and no operator approval. Building starts only after the independent review desk agrees on this exact text and you approve
it. No platform is live until its real evidence exists: the three tiers of tests, the platform proof, the confinement
proof, the crash-cut proof, the migration proof, and an independent witness, all at the active generation.

*For the record: the seven decisions above are Value blocks under this document's opening reading-convention Rule block; the closing Rule block carries its own citations.*

---

*Depends on: the governed purpose, rules, register, glossary, big-picture design, and parts one
through eleven at the exact versions reviewed with this document. Next after approval: implement
the Telegram reference slice through the existing public ports, then graduate the remaining
conversation adapters only on their own evidence.*
