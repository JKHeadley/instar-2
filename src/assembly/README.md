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

`tool-answer-guidance.ts` supplies requested-step/full-set completion guidance on plain and tool answers, and read-before-answer instructions for
Claude, Codex and native tool turns: acquire missing information through existing
authorized reads, cite it, and report actual failed attempts. It changes no tool
authority or resource limit; text-only turns retain their no-tools instruction.

`memory-answer-guidance.ts` gives all conversation framings and the journal's answer,
repair and summary paths one supersession rule: the operator's later direct statement
of the same fact wins, with old values retained as history. The model distinguishes
updates from genuine ambiguity; existing source validation admits the memory change.

`production-codex-provider.ts` admits the reviewed native Codex CLI 0.156.1
through an exact executable digest, version, subscription profile and activation
policy. Historical 0.149.1 captures remain labeled with their original version;
the 0.156.1 answer capture exercises the same route and application answer reader.
Retired or unreviewed versions require a new review and activation. Tool admission,
model-call limits, stop, durable intake and send uniqueness remain enforced by
their existing owners.

## Scheduled work recovery

`production-session-work.ts` binds a successful child close to its result digest. The
existing obligation tick can collect that checkpoint after host loss without another
model call. Collection requires the same owner, parent, scope, operation, bounded
result and one completed close after child cleanup. A proven pre-launch refusal may
return to the existing bounded schedule. A missing close, changed result or unknown
session outcome retains the obligation as visibly halted; it never replays an effect.
Old closes without a digest remain unknown. Results use the existing delivery grant
and receipt path. Tool-worker checkpoints use the recorded model output, verified
process-allocation return and settled tool/child trace from that same journal, including
after compaction. This adds no watcher, store, send authority or cross-machine lease.

## Continuing conversation session

The conversation prompt keeps each prepared grounding packet once, with host clock and unresolved references separate. Ordinary questions retain their separate context; a batch preserves each complete envelope and arrival order.

The prompt explains the application response contract: the host owns memory, scheduling and delivery. Missing account access belongs in the result as an honest limitation with useful available work, such as an unsent draft; it is never evidence of an inbox read or a completed send.

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

An admitted session at an unclosed idle quota wall retains its accepted input and original
turn deadline while the driver waits 30 seconds, then submits at most one neutral
continuation of the same turn. The existing journal records intent before terminal
input; an uncertain submission is never retried, including after host restart.
The original admission, call allowance and effect identities remain in force.
Compaction-owned sessions and uncertain intake are excluded. An open recovery keeps
the turn open for idle cleanup; emergency stop and the independent deadline still
win. An idle repeated throttle after a five-second observation window returns the existing
typed pause, so the login pool can select capacity for subsequent work. Completion
still requires the driver's existing evidence, never transcript growth or elapsed
backoff. Unconfined sessions retain observation only because they lack the admitted
effect and model-call floors required for autonomous continuation (Rules 1, 55, 60).
A fresh Stop plus a bounded nonempty result takes precedence over stale quota text
in scrollback. A throttle Stop without that result retains recovery and its original
deadline, or exposes the existing pause after the single attempt. Both result-consuming
callers pass their current result presence to the driver; pane text cannot invent an answer. A new
accepted input starts its own compaction episode, so a past completed compaction does
not exclude later turns from throttle recovery. Busy resumed work remains active under
the original deadline even when old quota text remains visible.

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

The activation policy declares an eight-worker safety ceiling and four-hour worker
and idle lifetimes. `--topic-worker-ceiling 1..8` can lower the installation ceiling;
raising it requires a new policy disposition. The runner, coordinator and physical
driver consume the same limit. A prior activation with the old policy digest refuses
until the matching activation is installed. New workers require sampled CPU idle of
at least 12 percent and free memory of at least 2 GiB and 10 percent of physical RAM,
through `scripts/topic-worker-capacity.mjs`; unknown measurements retain queued work.
The serialized resource admission samples after the topic slot wait and physical lease
acquisition or retry, once the host knows its worker needs replacement. Refusal releases
the unlaunched lease and keeps the input queued without dispatch, including an idle
worker's observed exit; healthy resident turns retain context.
Account capacity continues through the reviewed login pool and its between-turn
handoff. The host resource owner retains its answer reserve, with nine total slots
and the same per-worker bounds. These ceilings do not replace physical headroom.

Idle workers keep their context for up to four hours, within their admitted parent
lifetime. Memory pressure reclaims the least-recently-used idle worker per maintenance
tick; a needed slot assesses the oldest idle worker first. A queued worker awaiting
a slot or resource lease takes precedence over ordinary expiry, so confirmation is
not reset between the two paths. The existing conversation holder requires every
input settled and this worker admission's delivered inputs successful, readable
admission with no open children, and fresh affirmative adapter idleness. Historical
failed outcomes remain recorded without pinning a replacement worker. A stable fingerprint must span 30 seconds
under pressure, or two minutes on ordinary idle expiry, followed by a separate
30-second grace. Every assessment and the close itself recheck evidence; new input,
progress, missing evidence or a sample gap over three minutes resets candidacy.
Unknown adapters keep their workers. Busy workers are never retired for these reasons.
The encrypted custody snapshot holds candidacy and unexplained-failure inhibition;
no new watcher or store exists. One unexplained close or release failure inhibits
all automatic cleanup in the topic pool until repair; a typed pre-actuation refusal
keeps that target without inhibiting the pool. Unknown or post-actuation driver
failures remain uncertain through the adapter. Stop, authority withdrawal and admitted lifetime ceilings remain separate.
Retirement retains records and charges. Confirmed closure appends the existing
process-edge close, never closes the conversation allowance or unfinished work.
The status pull and dashboard aggregate only warm workers currently lost to cleanup,
explain the next-start cost and retained history, and expose uncertain release.
A revived worker no longer counts as unavailable; its historical closure stays in the journal. Capacity waits
keep durable intake and use the existing acknowledgement/progress and collection
path. Independent topic drains run up to the configured ceiling. The serial
compatibility path is unchanged when conversation sessions are off. All drains
settle before the journal writer guard is released, including on error.

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

A context-limit pause on an accepted single input carries its exact reason to the owner.
Once per input, with known send outcomes, no tool effect since dispatch, no open child work
and remaining call allowance, it tries idle compaction for at most 30 seconds. The compact
hook restores the full permitted pending envelope and its last inbound identity. A verified
compact receipt continues that answer in the same worker. A recorded compaction failure
retires the exact old worker and verifies resource cleanup before admitting a fresh worker
with the same input, original deadline and remaining cumulative allowance. Both paths retain
durable continuation intent before submission and restore the exact admitted packet, including
its pending input identity and history, without an additional model-facing recovery wrapper.
The host carries recovery evidence separately
from the model's answer schema and records it with a nonempty decoded answer. The journal adds
the transition disclosure to the final reply after memory acknowledgements and rewriting,
before the durable send intent; an unknown send is never replayed. Empty output remains an
answer failure. Missing history, uncertain submission, unknown/busy terminal state,
policy refusal, active stop and repeated context triggers retain uncertainty without replay.
This recovery uses the current conversation owner on its owning machine; it creates no service.

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

The read-only worktree census in `scripts/worktree-inventory.mjs` complements the
process inventory. `src/assembly/worktree-inventory.ts` classifies dirty checkouts
only with complete, fresh, same-machine process and worktree observations, resolved
ownership for each candidate checkout, and full quiet-window activity coverage.
The caller resolves `ownership(checkout)` to PID ownership for that checkout; an
owner elsewhere does not veto it, while missing or unknown candidate ownership
keeps it excluded even when the process working directory is elsewhere. Missing activity is unknown,
never inferred from an old timestamp. The adapter re-enumerates paths and heads
before returning; a changed enumeration stays partial. Findings carry the exact
path, head, machine and process sample, and grant no mutation or launch authority.

`createWorktreeRecovery` consumes these observations on the owner's existing
bounded cycle. Its installed observer route submits one ordinary request to
Part Four's existing durable intake and work owner. The machine/path/head/last
activity identifies the quiet episode; fresh census timestamps never create
another item. A new activity episode can create new work at the same head.
Intake retains the exact checkout location and assigns reconciliation before
returning. Restart uses intake's existing deduplication and custody. Refused
intake stays refused; a stopped caller or unknown evidence opens no work.

The caller supplies its authenticated observer intake, same-machine census and
positive ownership/activity history. Missing observations are never replaced
by file age, transcript content or a guessed dead owner. This is observation
and assignment, not permission to take over the checkout: a worker rechecks
current ownership and uses existing admitted effects for preservation and
result delivery. No new store, watcher, model call, commit, cleanup or send
path is introduced. The automated test uses real temporary git state and
recorded journal shapes; live deployment and user delivery are proved by the
desk's proof-room run, not asserted by the library test.

While a continuing conversation is answering an admitted operator message, its live adapter
observations feed the host's current tool-admission projection. The journal may send one short
`Status:` line per real tool step at about 2, 5 and 10 minutes from intake, then every 10
minutes. The tool's own description is preferred; otherwise the line names its tool and target.
Between tools, a self-written description may be quoted as the latest step, never as a still-running tool.
There is no extra model call. Missing activity, a stale observation, a paused or dead worker,
stop or expiry produces no progress line. The existing failure path handles failed workers.
Final dispatch cancels pending progress and waits for an in-flight status send before sending
the answer. Progress uses signed agent provenance, the ordinary reply cap (leaving one answer
slot), durable unique intents and the existing retrospective review population. UNKNOWN sends
are not retried. The journal and its replicated ownership path own the durable cadence; the
activity projection is deliberately ephemeral and must be freshly observed after a restart.
The session driver's optional activity observation carries only the owned claim, capture digest,
observation time, typed wait signature and active/idle/indeterminate classification. Empty captures
and older adapters without classification are unknown. The existing presence cycle records every
registered work subject even while its ordinary lane is busy. A quiet indeterminate frame raises a
hedged signal after one minute; an unchanged active indicator has the 1.x ninety-minute backstop.
Fresh helper waits and affirmative idle frames suppress the signal; idle never proves a result.
Changing frames, unknown observations and missed observation windows reset corroboration. These
observations survive journal replay and appear on the bounded status surface without a new push.
They never authorize a restart or termination. The existing step deadline, result receipt, stop,
resource owner and effect identities remain authoritative.

The admitted throttle continuation uses the 1.x SessionWatchdog settle rule: fresh quiet throttle
frames must stay identical throughout its existing thirty-second backoff. Activity or changed
frames reset corroboration, including across driver restart; older records without a fingerprint
start a fresh observation. The original deadline and one-continuation limit remain unchanged.
StallTriageNurse's outcome check is held by the existing result-and-Stop receipt boundary: a changed
screen or an empty reply is not a recovered answer. This ports the useful observation/recovery
behavior without importing legacy timers, direct messages or pane-wide interruptions.

## Native connection retry exhaustion

The terminal session driver leaves Claude Code's bounded same-turn 529 retry and
backoff in charge. Every native attempt passes the existing model admission gate;
the conversation owner's durable call reservation is charged before dispatch and
survives restart. Observed native retry pressure is kept with its exact turn in the
existing session journal. A fresh, quiet final 529 error after that retry is reported
to the existing owner as a pause, because the captured client emits no Stop receipt
on exhaustion. The owner retains the request and uncertain outcome, closes admission
and retires its worker. A real correlated Stop takes precedence. No recovery input,
tool, send or original request is replayed, and no deadline or allowance is renewed.
Unknown terminal shapes keep the original deadline. Driver reconstruction retains
retry evidence; host restart retains spent calls and unresolved input without replay.

The recorded fixture `socket-drop-worker-1016101-2026-10-16.json` contains isolated
loopback update identities, native countdown/error bytes, call timing and owner
state. Driver and owner replay tests cover both recovery and exhaustion. This
behavior remains local to the admitted conversation owner; it grants no other
machine permission to act.

The preview journal's typed unknown-answer notice takes precedence over a memory
acknowledgement. Its exact fixed wording passes the existing secret check and uses
the existing content-free notice path. Review may record signals about decorated
notices, but cannot rewrite an unknown outcome into an answer. An existing send
intent still owns delivery; an uncertain send is never repeated.

### Safety-ceiling halts

The continuing conversation owner records a `halt` with its exact deadline or call
allowance before resource closure. It fences new calls and inputs under that
allowance, retains unfinished inputs and uncertain effects, and preserves the halt
across host restart. The existing admission close, adapter close and resource lease
release own cleanup; an unconfirmed close retains the exact worker for reconciliation.
A completed last allowed call is still accepted; unknown accounting or an ordinary
worker exit is not relabelled as a measured limit.

The independent session deadline watchdog uses the driver's journal lock and writes
`deadlineHalt` before closing the verified session identity. The driver carries that
cause through its lifecycle observation even after the process has disappeared.
The journal runner consumes the typed safety cause through its normal uncertain-result
path and sends one signed infrastructure notice under the original reply identity,
with the existing stop, cap, ownership, audience and unknown-send protections. No
operator stop is fabricated, no run is declared complete, and no uncertain action is
retried. The minimal operator responder retains its independent admission.
