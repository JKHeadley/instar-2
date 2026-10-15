# Part Ten assembly

This package owns the executable composition boundary. Its twelve stored records
are immutable, schema-versioned Part Two facts. `HarnessAdapterPort`, Part Seven's
`ModelAdapterPort`, and `PersistenceAdapterPort` are interfaces, not stored facts.

`createAssemblyRuntime` admits a scope only after rebuilding current status from
the signed spine. `resolveAssemblyHistory` walks both fact-envelope requirements
and record-declared dependencies, propagating missing, tainted, and conflicting
ancestors. A record's own `passed` or `active` field is never sufficient.

Native workers receive an Eight-owned process driver; persistence uses exact
AES-256-GCM chunks and an independently administered key port; mediated reads
revalidate Part One standing on every chunk. Local packages are decoded and
hashed before any code can execute. Growth breaches coalesce into one owned
episode and close only on a complete measured exit workload.

`tool-answer-guidance.ts` supplies the shared read-before-answer instruction for
Claude, Codex and native tool turns: acquire missing information through existing
authorized reads, cite it, and report actual failed attempts. It changes no tool
authority or resource limit; text-only turns retain their no-tools instruction.

## Continuing conversation session

`production-conversation-session.ts` composes the existing Eight-owned session
driver with the session-work admission, resource lease and durable edge interfaces.
Unlike scheduled work, successive inputs use the same child. One reserved call
allowance, lifetime deadline and finite turn count span the conversation; none
resets on a new message. Each input receives the current memory/open-work packet
and a separate bounded result destination. A result requires two identical reads,
a closed harness turn and no unresolved delegated child. The host remains the
sender and must retain intake before calling the port, record the returned answer,
and enforce commitment, correction and completion evidence before sending.

Its tests include the real production session driver over simulated physical I/O,
not a live harness or Telegram proof. The journal launcher wiring below is step 1;
foundation intake/effect/judgment integration remains in the later plan steps.

The host must call `close()` at shutdown, expiry or idle stop. Closing waits for
pending admission to return before releasing its lease, preventing a late resource
allocation from escaping cleanup. A failed turn closes admission, stops the exact
owned driver session and retains uncertainty; it is never retried by this port.
The driver owns durable delivery records. The port's in-memory turn set is only a
same-instance guard, not restart deduplication. Restart recovery remains with the
host journal and the driver's existing uncertain-delivery rules. Multi-machine
posture is deliberately local to the admitted conversation owner and its launch;
this port does not acquire or transfer conversation ownership.

## Bounded grounding packet (R5, `production-context-sampler.ts`)

Evidence tier: offline ahead unit. It is not exported from the barrel or wired into
boot; R6 owns that join and the `production-context-sampling` hold stays in force.

- `createProductionContextSampler` implements `ProductionGroundingReaderInput.sample`.
  It reads the owner plan, the store and the clock at every invocation and resolves one
  exact selection: the plan's Five Run/opening/step, launch, execution context, an
  explicit ordered input frontier (every admitted input up to the current one, exactly
  once), and one approved `rungraph-briefing-material` body per installed briefing
  class. Missing, tainted, conflicted, stale-status, outside-audience (principal or
  model route), unapproved or wrong-scope input refuses by identity only, never by
  content. Document and input-excerpt items must be exactly the selected bytes of their
  preserved, hash-bound capture. A directive is either an exact byte selection of an
  admitted input in the frontier or Five's own Run directives; the status item must
  carry Five's current pending steps (UNKNOWN disposition). Accepted replies are never
  supplied by the caller: each Seven `ProviderAnswerAcceptance` is followed to its
  request, that request's Five step, the delivery for that step and the input it
  answers; a reply to the current input, a duplicate, or one naming no request refuses.
  A tainted or conflicted acceptance, request or delivery on that join refuses by
  reference; it is never dropped from a successful packet.
  Over the history threshold the turn is held; no last-N, ranking or summary stands
  in. Delivery, consumption and final grounding stay with Ten's reader and Five.
- `buildGroundingBriefingBody` / `decodeGroundingBriefingBody`: the bounded
  `{ class, content }` body. Items carry id, kind, source (document path, immutable
  revision, preserved source capture, byte selector; or owner fact references for
  derived status/directives), selected-byte hash, exact content, scope, audience,
  standing and observation time. At most 8 items and 64 KiB of serialized body per
  body AND across the whole frozen selection, 16 KiB per item, 16 entries per metadata
  array; the builder and decoder enforce the same serialized allowance. These are
  preprocessing ceilings, never submission size.
- `renderGroundedContext` renders Seven's data-only `context` string from the durable
  delivery record: bindings (run, step, delivery, consumption, manifest), the ordered
  conversation (actual captured input bytes, each accepted reply right after the input
  it answers, frozen at the delivery fact), and the actual source items. Source text is
  quoted data. It first resolves delivery ↔ consumption ↔ Five grounding ↔
  run/step/installation and re-checks current approval, audience, freshness and
  source captures against the plan and clock read now; a changed source holds for
  re-preparation. `purpose: 'reconstruct'` rebuilds a historical packet from durable
  records without that current-standing check and permits nothing.
- `groundedSubmission` mirrors Seven's canonical request so Five's step digest can be
  fixed first; `verifyGroundedSubmission` then reads Seven's captured submission,
  resolves the delivery/consumption/manifest/owner facts independently of the
  renderer, and compares every input, reply and source body, plus the bytes the model
  adapter received. Run it at the adapter seam before any provider IO. `purpose:
  'reconstruct'` proves a historical packet after restart and grants no permission to
  reach the adapter; the default `dispatch` requires current standing. The submitted
  route must be Seven's prepared route, and before dispatch it must be the current
  owner plan's verified model route, so audience is judged against the real destination.
- `checkGroundingEnvelope` measures subject-bound UTF-8 bytes (request, combined prompt,
  Seven's capture allowance, delivery payload, complete outbound reply) and refuses
  before dispatch with bytes, bound, turn and retained references. Nothing is trimmed.
  `groundingEnvelopeHold` returns the same cause, turn, exceeded measurements and
  references as a structured value; `reportGroundingEnvelopeHold` returns it beside the
  existing installation hold report, whose `production-context-sampling` row stays held.

This is not recall. `src/recall` keeps its exchange-memory role; this packet reuses
Two's facts and captures without a parallel store. Handoffs: R4 binds the real body
schema, source selection and class mapping; R6 wires the sampler and verifier into
boot/composition with the real route framing and bounds; R7 joins per-turn hosting and
live usefulness. The current preview/Eight envelopes cannot hold one grounded turn; the
measured bound proposal is in the R5 progress handoff.

## Capabilities

- `harness-doorway-parity`: binds each supported harness and model doorway to certified code; the rest are marked unproven.
  Details: binds each supported harness and model doorway to its certified code and runtime; the rest are marked unproven or unsupported.

## Continuing conversation (proof-room option)

`production-conversation-session.ts` is the common host over public
`HarnessAdapterPort<2>` in `contracts.ts`: `describe`, `launch`, `deliver`,
`observe`, `control`. Version 1 is the retained first-input compatibility arm;
it does not advertise continuing-session conformance. `conversation-harness-adapter.ts`
puts the existing admitted driver behind version 2. The host never selects a vendor.
`journal-agent.mjs` opts in with `--conversation-session on` and the existing
reviewed conversation activation; default behavior and scheduled work remain separate.

`conversation-topics.ts` composes one such host per admitted Telegram topic, including
one `main` host for the general topic. The runner supplies the topic from the durable
intake record, never from model output. Each topic keeps its own queue, observation
cursor, process identity and cumulative share of the installation allowance. The
journal's existing forum packet grounds in that topic's full projected history (or
its current summary and suffix), with shared agent memory and open work. Reply
routing remains the intake record's chat/thread at the existing send doorway.

The activation policy declares the two-worker cap and five-minute idle lifetime; the
runner, coordinator and physical driver consume those same limits. A prior activation
with the old one-worker policy digest refuses until a matching activation is installed.
The runner admits at most two live topic workers. A third waits durably for a slot;
an idle worker retires at five minutes or earlier when another topic needs its slot.
Retirement keeps all records, and the next input launches a fresh worker from them.
Independent topic drains also accept newly arriving topics while another awaits a
reply, with one FIFO drain per topic and two drains at once. The serial compatibility
path is unchanged when the conversation option is off. All drains settle before the
journal writer guard is released, including on error.

The encrypted snapshot holds all topic states and ONE installation reservation.
Topic and process edges draw on it; the checkpoint atomically sums durable charges
across topics before forwarding a call. Directory-wide transcript counts are not
used on this route because they mix other topics' calls. Snapshots admit at most
4096 topic records and retain all memory. The old group-wide snapshot upgrades in
place: first retire its exact worker, then split inputs by their recorded topics,
keep unresolved dispatched inputs uncertain, and retain the old charges and original
inputs as migration evidence. An interrupted reservation, malformed custody or
unconfirmed retirement refuses without resetting liability or replaying effects.

The host owns accepted inputs, FIFO disposition, exact-identity deduplication,
reply captures, observation cursors, process generations and cumulative call charges.
Its injected store is atomic and durable before return. The physical composition uses
`scripts/conversation-host-store.mjs`: an encrypted, fsynced, atomic snapshot under
the existing custody key and conversation ownership fence, outside worker-readable scope.
Corrupt or unreadable state refuses; it never becomes an empty queue. Admission applies
backpressure at 64 pending inputs, 4096 retained inputs and 1 MiB per input, preserving
all already accepted records. A queued input remains queued after a proved non-dispatch;
a dispatched but unresolved input becomes uncertain on restart and is never replayed.
A repeated exact input returns its recorded outcome; conflicting bytes refuse.
Waiting messages use the largest arrival-order prefix whose serialized delivery fits
1 MiB; the suffix stays queued and a lone message uses its ordinary prompt. On restart,
a completed batch may be recovered from its correlated adapter receipt and the existing
journal's process and completed child edges, even when the old admission gate is gone.
Missing or invalid evidence retires the old worker and records uncertainty without
replaying its tools or preventing later messages from draining.

Each OS process gets a fresh claim and incarnation, its own 64-input/one-hour ceiling,
and only the unused portion of the original 128-call reservation. Every process deadline
also stays below the already admitted parent lifetime; a process renewal cannot extend it. The model checkpoint
persists each call charge before forwarding, including calls that produce no transcript.
A new message, process, grant or host does not replenish that allowance.
Grant withdrawal fences the worker and pauses authorization while retaining conversation
custody; a validated renewal on the host tick or next input can continue it. Operator stop
remains terminal for this host. Changed signed grant bytes select a fresh admitted process. Unknown accounting
retains exposure. An interrupted parent-reservation write requires reconciliation rather
than charging twice or launching without its parent. Stop closes dispatch before exact
claim/incarnation control; cleanup waits for late resource admission.

The adapter returns distinct reply and turn-end observations from the bounded result
capture and correlated Stop receipt. Repeated file bytes and pane-idle text cannot end a
conversation turn. The installed lifecycle hook is copied beside the readable admitted
hook; its inbox is shared only with the worker identity. A hook is worker lifecycle evidence,
not proof of tool completion, reply delivery, or independent authenticity against a malicious
worker. The existing tool and outward effect owners still decide those facts.

At a process ceiling, exit or changed verified grant, the host retires the old process and
admits a replacement, delivering the current journal-prepared history/clock/work packet.
Vendor transcript resume is not required. Signed activation changes are revalidated at
the idle tick and turn boundaries; withdrawal during a turn stops it. In-place compaction and foundation
history migration remain owned by plan steps 5/6; no new grounding or account authority is
invented here. The host calls `maintain()` on its existing tick and `close()` on shutdown.

Codex and native workers implement `HarnessAdapterPort<2>` and return correlated bounded
reply/turn-end batches with monotone delivery cursors, honest non-dispatch/uncertainty, and
exact-target control. They use the same host queue, parent reservation, call checkpoint and
current context. They do not implement a second queue or budget. Their real parity evidence
belongs to `codex-worker-1013` and `native-harness-1013`; this option claims no live walk or
macOS certificate. The journal continues to own intake, answer decoding, review and sends.

### Continuing-session accounts and review

The admitted driver accepts host-prepared connector records through `connectors(claim)`.
The host uses the same root MCP configuration, SecretRef resolution, one-use socket
launcher and harness handoff as the per-call path. Each replacement launch rearms
fresh nonces; no credential value is written in a launch file. Root account changes
close admission. Reads declared in that root and reversible role-granted actions work
through the existing hook and current effect policy.

`--conversation-account-actions on` is the single irreversible-account rollout switch,
default **off**. Keep it off until purpose PR 164 merges and the desk accepts the copy.
When on, only configured connectors with current role/resource/sign-off coverage can
pass. The existing effect owner durably retains the exact input, configuration and
decision before release, linked to the parent authority/budget, and refuses duplicate
or unrecordable effects. This is the journal admission path; step 4 owns its foundation
effect-doorway replacement.

With `--conversation-session on`, the journal sends the completed reply through its
existing secret, stop, spend and duplicate-send walls first. The existing Jev and
contextual review then record advisory results for the next turn's grounding. A slow
review cannot hold that reply; unknown paid reviews are never retried on recovery.
Option off retains the existing pre-send review route. The non-additive journal
`reply-review-after-send` marker uses generation 5: an older reader must refuse a copy
that has used this mode. Do not reuse that copy for an older-build rollback; retain the
original root for the desk's copy walk and deployment decision.

Continuing topic workers can use a host-supplied `prepareTurn` boundary and
`topicConfig` binding for reviewed account-pool moves. The host serializes the
boundary with its queue, retires only that worker, and keeps the shared allowance
and durable intake. See [topic login pool](../../docs/topic-login-pool.md).

Topic hosts take a snapshot of waiting messages in arrival order and deliver them in one
continuing turn. The journal prepares and reserves each intake separately; the batch result
names each operation, and the host persists every result in one atomic snapshot. Each answer
then uses the existing journal validation and unique send intent. A lone waiting message
keeps the original envelope. A closed batch whose result was not yet checkpointed is read
through the correlated adapter before worker retirement; queued messages still drain after
restart. An interrupted tool-bearing turn without a correlated completion remains uncertain,
never automatically repeated as if its effects had not happened.

While a message waits behind a reserved turn, the journal can send one fixed progress line
after 45 seconds (Rule 87's bounded pace; the unit brief selects the interval). Durable
progress intents bound it to one per message and one per topic per 45 seconds, including
across restart. The ordinary send doorway still enforces audience, secrets, stop and reply
allowance. Uncertain sends are not repeated. These additive custody fields retain existing
records; rollback requires a reader that understands them, never deleting the journal.
