## 5. Delivering live inbound and observing a turn

**Rule — inbound is durable before delivery.** Rules 29, 31, 63, 68 and 69; **checks:
P13-NF-19/20/24**. A live inbound message first enters Part Four, receives its stable source and
conversation identity, and becomes durable candidate work for Part Five; it is not yet a pending
ordinary `RunStep`. For a surviving worker, the assembly calls `ground()` for that candidate. Its
injected reader performs the fresh read and derives the exact new input and context bytes, has Part
Eight admit that exact delivery and Part Six issue the current fence-bound one-use claim, then
appends and resolves Ten's granted immutable context-delivery specification binding the operation,
claim, bytes, step, input, launch, and unchanged incarnation. Admission does not invoke delivery.
The guarded driver only then invokes `deliver` once and observes consumption of that claim. `deliver`
receives only the owner-decoded current-context reference, intake reference, immutable digest,
target launch, and target incarnation. After witnessed consumption, Five appends grounding and a
separate `transition(start)` admits the step. The adapter cannot invent an anonymous keystroke
path, accept a message only into process memory, mutate the launch, or clear durable custody
because a write call returned. This same-incarnation positive is non-executable until
   the dated 08:48Z addenda in `seam-response-assembly-followup.md` and
   `seam-response-rungraph-followup.md`, recorded as GRANTED in `SEAM-LEDGER.md` row 45, land.

**Rule — delivery stages never collapse.** Rules 26, 42, 63 and 69; **checks:
P13-NF-20/21/23/24**. The adapter separately reports refusal, uncertain dispatch, input accepted by
the runtime, context consumed by the model boundary, output observed, and any later independently
witnessed delivery. An operating-system write, PTY success, terminal echo, prompt disappearance,
provider request start, or transport acknowledgment proves only its actual stage. `deliver`
returning without error is not `context-consumed`. A lost answer leaves the original operation
pending with its maximum possible exposure until observation closes it.

**Rule — busy-session input is serialized by durable identity.** Rules 55, 60, 63 and 68;
**checks: P13-NF-19/20/22/24**. If the harness cannot accept another input during an active model
exchange, the adapter refuses or leaves the admitted input queued under its existing operation and
step identity. It does not type into a composer, overwrite a pending draft, concatenate two
messages, or claim future automatic submission. A capable harness may accept more than one input
only when its conformance evidence preserves order and maps every acceptance and consumption event
to the exact immutable input. Backpressure uses Part Six resources and loops rather than an
unbounded process-local queue.

**Rule — turn evidence is bound to existing work identity.** Rules 26, 49, 68 and 69; **checks:
P13-NF-21/23/31/32**. A turn is not a new core record here. It is the adapter's correlated span of
observations for one admitted `RunStep`, launch incarnation, input digest, and any Seven/Eight
attempts and operations it causes. Runtime event ids, stream positions, and opaque conversation
handles are recorded as source evidence on `HarnessObservation`. They do not replace the owning
step, request, or operation identity.

---
