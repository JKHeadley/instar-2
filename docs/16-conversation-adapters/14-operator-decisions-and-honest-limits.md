## 14. Operator decisions and honest limits

This section is written for the human reviewer. Each decision states the question in plain words, the choices, what
each choice changes for you, and a recommendation. The rule and check numbers this section rests on sit in the closing block, so the decisions themselves stay readable.

**Value — decision 1: which platforms go live, and in what order.**
Question: after Telegram is proven, should the other platforms follow a fixed order or should each go live when its own proof is ready?
Choices: fixed order; or each on its own evidence once Telegram is proven.
What it changes: a fixed order means one slow platform delays every platform behind it; independent activation means each platform waits only for its own proof.
Recommendation: prove Telegram first, then let each platform go live on its own evidence, because one platform's limits should not hold back another that is ready.

**Value — decision 2: who gets a private receipt in a public or group chat.**
Question: when someone writes in a public or group chat, who should receive a brief private message confirming that the agent received it?
Background: one verified person is chosen to direct the agent for that chat and its agreed scope. Other participants are not included automatically, even when the agent recognizes them, and a reply visible to the whole chat can reveal that recognition to every observer.
Choices: acknowledge everyone privately; acknowledge only the one verified person; acknowledge nobody; or let the agent decide message by message within recorded limits.
What it changes: acknowledging everyone gives each sender a private receipt; verified-person-only gives a receipt to that one person and gives no automatic receipt to other familiar participants; acknowledging nobody can leave a legitimate contact with silence; message-by-message judgment adds flexibility but is less predictable and is not available yet. Any choice that promises privacy stays unavailable when the platform cannot prove delivery to just one person.
Recommendation: acknowledge only the one verified person by default, because that preserves a receipt for the person whose authority was verified without treating familiarity as authority.

**Value — decision 3: what counts as "one conversation" in Slack.**
Question: when someone asks the agent to do something in a Slack thread, should that work belong to the thread or to the whole channel?
Choices: the thread; or the whole channel.
What it changes: channel-wide work makes separate requests share one history and approval trail; thread work keeps each request separate while a standard handoff still gives every new thread the channel's relevant history as background.
Recommendation: use the thread, because separate requests should not interfere with each other while shared channel context remains available.

**Value — decision 4: what personal WhatsApp and iMessage accounts may send.**
Question: after the required checks pass, may these personal-device channels only read, reply to received messages, or also start new conversations?
Background: this choice covers WhatsApp linked to a personal phone and iMessage on a Mac, where a personal account runs on a personal device. The WhatsApp Business backend is a separate mode with its own policy and is not covered by this choice.
Choices: read-only; reply-only; or new conversations when permission has already been recorded.
What it changes: read-only cannot answer anyone; reply-only can answer conversations another person started; permission-based new conversations are more useful but can speak from a personal account without a fresh incoming message.
Recommendation: enable reply-only after its checks pass, because it is useful without granting broad proactive use of a personal account.

**Value — decision 5: the word shown to people when a platform has only accepted a message.**
Question: when a platform has taken the message but not confirmed delivery, what should the user see?
Choices: “sent”; “accepted by platform” or an emoji with that exact meaning; or no status.
What it changes: “sent” can imply delivery that has not been proved; the accurate words or their emoji equivalent show exactly what is known; no status avoids a claim but gives the user no feedback.
Recommendation: show “accepted by platform” or its clear emoji equivalent, because familiar wording is not worth a false delivery claim.

**Value — decision 6: whether Telegram may receive messages through a public web address.**
Question: may an installation let Telegram push messages to its public web address?
Background: with a webhook, Telegram pushes messages to a public address; with long polling, the agent asks Telegram for messages on a timer. A webhook therefore requires an internet-facing receiving address, while long polling uses an outgoing connection.
Choices: allow a webhook wherever the receiving address passes its checks; forbid webhooks everywhere; or require each installation to record its own choice.
What it changes: allowing webhooks makes a checked public receiving address available everywhere; forbidding them keeps every installation on outgoing long polling; choosing per installation matches local exposure needs but keeps reminding the main user until that installation records a choice.
Recommendation: choose per installation, because internet exposure and operating constraints differ from one installation to another.

**Value — decision 7: how loudly to tell you about a message whose delivery is uncertain.**
Question: when that bounded watch ends without an answer, how should your attention be requested?
Background: sometimes the agent cannot tell whether a message was delivered after its bounded checks finish. The unresolved item remains visible in the attention hub and the dashboard in every choice.
Choices: one immediate grouped notice followed by a daily digest; a daily digest only; or no pushed message.
What it changes: the first choice gives immediate awareness and asks you to review the uncertainty now; the second can delay awareness by up to a day and asks you to review it with the digest; the third interrupts you never and leaves the item unseen unless you open the attention hub or dashboard.
Recommendation: send one immediate grouped notice and then a daily digest, because the first notice limits how long a possibly missed message goes unseen while the digest avoids repeated interruptions.

**Rule — the decisions remain inside the governed contracts.** Rules 13, 14, 26, 28, 42, 43,
52, 54, 57, 62, 63, 77, 79, 83, 87, 89, 96, 98, 104 and 105; **checks:
P12-NF-11/18–20/29/34/41/45–48**. The per-message acknowledgment choice is granted but
non-executable until the “judged acknowledgment policy arm” addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 58) lands and its Four, Seven, and Ten
implementations integrate. A binding is Four's verified grant that selects one operator for one
conversation and scope. Under `bound-only`, only that verified person receives a conversational
acknowledgment; every other participant remains a requester even when familiar. The acknowledgment
decision uses Four's public consumer granted in the “acknowledgment policy consumer” addendum to
`seam-response-intake-followup.md` (SEAM-LEDGER row 60), and the private reply uses Part Eight's
single-member audience contract granted in the audience addendum to
`seam-response-effects-followup.md` (SEAM-LEDGER row 53). If the exact mode cannot prove private
delivery to that one person, it reports unsupported and sends no public fallback. P12-NF-11's
policy arm and P12-NF-32's private-delivery positive are non-executable until those grant files land
and their Four and Eight implementations integrate. The platform custody acknowledgment remains a
separate signal and does not apply or replace this binding decision. The Slack
channel-background handoff depends on the current-context delivery grants in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45).
Per-installation public-endpoint choices use the durable workflow granted in the “recurring
open-decision reminder” addendum to `seam-response-operator-followup.md` (SEAM-LEDGER row 59), which
is non-executable until that grant file lands and its Part Eleven and Ten implementations integrate.
Delivery
status words and registered emoji equivalents remain bound to the same Part Nine assessment.
Unchanged delivery uncertainty stays on the attention hub and dashboard; a pushed message must
still qualify under the notification policy.

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
