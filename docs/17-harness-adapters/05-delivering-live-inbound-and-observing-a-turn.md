## 5. Delivering live inbound and observing a turn

**Rule — one durable queue owns busy input.** Rules 14/29/46/55/60/63/68/95;
checks P13-NF-19–24/42. Four accepts each verified input durably with stable source identity and
conversation order. The common conversation coordinator takes the next pending input when the
worker is available and its current-context preparation is admitted. It serializes active turns;
there is no adapter-private inbox with a second definition of accepted. The durable queue has
finite admission/resource bounds and an age probe. At capacity, retain already accepted work
and apply source backpressure without acknowledging unretained input. No queue truncation drops
the oldest message. Reachability's reserved path and stop remain available.

`busy-not-dispatched` means no byte was submitted for this attempt and no asynchronous submission
is scheduled. It returns custody to the same pending queue item; the coordinator retries only
through Six's bounded policy and Eight's safe attempt rules. A transport timeout is `uncertain`,
not busy. A semantic refusal retains its input and reason; it is not a dropped or completed
message. The default is to queue while a turn runs, not interrupt it. An explicit interrupt is a
separate control request. Repeated source delivery resolves to the existing intake/digest; a
conflicting digest is preserved as a conflict. The adapter never merges messages or presses
Enter on a visually retained composer hoping to submit later.

**Rule — delivery and observation identify the current turn.** Rules 26/29/42/63/68;
checks P13-NF-19/20/21/23/24. Every attempt names the current intake, context delivery, candidate
work, operation, original launch and incarnation. The second message has a different intake and
delivery even when it reuses the same process. A request for another conversation or stale
incarnation refuses before dispatch. Repeating the exact accepted request returns its recorded
receipt; it does not submit twice. Uncertain submission stays owned until observation establishes
what happened and that no delayed submission remains possible.

A conversation turn is the span from one admitted input to its correlated terminal outcome;
it may contain many model exchanges and tool calls. It is not a new authority record. Five
owns its work references, and Ten's delivery plus observations provide its correlation. Runtime
acceptance, model-context consumption, tool completion, reply candidate, turn end and outward
send are distinct events. A reply can be ready while child work remains pending; the work owner
records that status rather than declaring the run complete.

**Rule — the conversation host receives usable reply content.** Rules 26/42/68/87/89;
checks P13-NF-21/31/32/34. `observe` returns a reply observation with the exact captured UTF-8
text (or a resolvable capture reference), media references if supported, role/channel,
input/delivery, output identity/digest and completeness. Diagnostic text, tool output and
intermediate reasoning do not become the person's reply. An adapter may use a structured event
or an authenticated per-turn result artifact; that extraction belongs inside the adapter.
Two identical reads of a worker-writable file alone prove neither turn end nor authenticity.

Turn end reports `completed`, `interrupted`, `failed` or `uncertain`, with reply references,
pending child/effect references and usage evidence. A completed turn with no reply is explicitly
`no-reply`, never an empty sent bubble or proof the person's request was answered. Missing,
malformed or truncated content is marked incomplete. The host records a recoverable outcome;
it cannot rerun an uncertain tool-bearing turn merely to obtain prettier text.

Eight alone dispatches outward replies using their stable semantic identity and current audience
standing. The session produces the answer; it does not separately send the same answer through
a bot or connector. Receipt uncertainty is observed, not resent. Channel splitting, acknowledgements
and progress messages belong to the conversation/outbound owners, under their own identities and
budgets. The adapter does not truncate an answer to Telegram's transport size or claim delivery
when it only emitted text.
