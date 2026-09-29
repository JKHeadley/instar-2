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

## Confined notice driver (`infrastructure-notice-driver.ts`)

`dispatchInfrastructureNotice` is the only path by which an infrastructure notice leaves.
It decodes the payload, re-resolves the destination against the configured alerts
destination and grant, refuses the conversation's own route, records the dispatch in the
host's durable ledger before the send, and returns the recorded outcome for any episode
already dispatched: an unknown outcome stays `uncertain` and is never sent again. It holds
no process, file or network API; `scripts/host-watch.mjs` (journal mode) supplies the ledger
and the fixed Telegram bridge after three failed runner restarts.
