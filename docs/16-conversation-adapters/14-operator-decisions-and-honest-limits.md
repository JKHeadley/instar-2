## 14. Operator decisions and honest limits

This section is written for the human reviewer. Each decision states the question in plain words, the choices, what
each choice changes for you, and a recommendation. The rule and check numbers this section rests on sit in the closing block, so the decisions themselves stay readable.

**Value — decision 1: activation order is an engineering default.**
Prove Telegram first, then activate each platform on its own exact conformance and live evidence.
The agent owns sequencing; no platform waits for an unrelated platform's proof. Adding an account
or widening role/exposure still consumes the existing recorded policy and standing.

**Value — decision 2: who gets a private receipt in a public or group chat.**
Question: when someone writes in a public or group chat, who should receive a brief private message confirming that the agent received it?
Background: one verified person is chosen to direct the agent for that chat and its agreed scope. Other participants are not included automatically, even when the agent recognizes them, and a reply visible to the whole chat can reveal that recognition to every observer.
Choices: acknowledge everyone privately; acknowledge only the one verified person; acknowledge nobody; or let the agent decide message by message within recorded limits.
What it changes: acknowledging everyone gives each sender a private receipt; verified-person-only gives a receipt to that one person and gives no automatic receipt to other familiar participants; acknowledging nobody can leave a legitimate contact with silence; message-by-message judgment adds flexibility but is less predictable and is not available yet. Any choice that promises privacy stays unavailable when the platform cannot prove delivery to just one person.
Recommendation: acknowledge only the one verified person by default, because that preserves a receipt for the person whose authority was verified without treating familiarity as authority.

**Value — decision 3: Slack conversation scope follows P-12.**
The thread is the default work and authority unit, with attributable channel-background handoff.
The agent implements this settled default; deliberately channel-wide work is recorded under the
actual scope and standing rather than made a fresh setup question.

**Value — decision 4: personal-account actions follow the onboarded role.**
P-05 records the accounts, recipients, channels and actions agreed at onboarding. A proved
WhatsApp or iMessage mode may perform those actions without repeated permission, including
starting conversations when granted, subject to the purpose's sign-off and durability rules.
Missing grants or unproved platform capabilities remain explicit; reply-only is not a universal
engineering restriction. This does not enlarge the constitutional single-machine irreversible set.

**Value — decision 5: delivery wording is an engineering default constrained by truth.**
Show “accepted by platform” or an equally clear representation when that is the strongest evidence.
Do not imply delivery from acceptance. The agent owns wording and usability measurement; the
operator is not asked to choose whether evidence is reported honestly.

**Value — decision 6: public ingress follows the role and P-06.**
Onboarding covers the named public surface, custody, capture-before-acknowledgment and recovery.
Within that standing the agent chooses webhook or polling from deployment evidence. An endpoint
outside every grant names the missing grant; implementation choice inside the role is not a
recurring permission request.

**Value — decision 7: incident attention follows P-14.**
After bounded self-repair fails, send one grouped action-needed notice per incident, with at most
two pushed notices per rolling hour per operator. Unchanged uncertainty stays on the pull surface.
The operator may change the attention policy; the agent implements its existing default without
inventing a daily-digest approval or status-notification loop.

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
An unresolved request to widen public-endpoint standing remains owned through the existing
“recurring open-decision reminder” seam in `seam-response-operator-followup.md` (SEAM-LEDGER row 59).
That seam does not create a recurring question about an endpoint already covered by P-06.
Delivery
status words and registered emoji equivalents remain bound to the same Part Nine assessment.
Unchanged delivery uncertainty stays on the attention hub and dashboard; a pushed message must
still qualify under the notification policy.

**Rule — technical completion is not approval or certification.** Rules 34, 65, 82, 90 and 109;
**checks: P12-NF-01/44/48/50–52** and the governed review process.
This is a design, not a finished product. It contains no code, no deployment, no runtime measurements, no review verdict,
and no operator approval. The independent desk reviews the design. The operator retains the purpose's build-start,
direction, value, policy and authority decisions; settled engineering choices need no extra yes. No platform is live until its real evidence exists: the three tiers of tests, the platform proof, the confinement
proof, the crash-cut proof, the migration proof, and an independent witness, all at the active generation.

*For the record: the seven decisions above are Value blocks under this document's opening reading-convention Rule block; the closing Rule block carries its own citations.*

---

*Depends on: the governed purpose, rules, register, glossary, big-picture design, and parts one
through eleven at the exact versions reviewed with this document. Next after approval: implement
the Telegram reference slice through the existing public ports, then graduate the remaining
conversation adapters only on their own evidence.*
