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
  content. Over the history threshold the turn is held; no last-N, ranking or summary
  stands in. Delivery, consumption and final grounding stay with Ten's reader and Five.
- `buildGroundingBriefingBody` / `decodeGroundingBriefingBody`: the bounded
  `{ class, content }` body. Items carry id, kind, source (document path, immutable
  revision, preserved source capture, byte selector; or owner fact references for
  derived status/directives), selected-byte hash, exact content, scope, audience,
  standing and observation time. At most 8 items, 16 KiB per item, 64 KiB per
  candidate corpus; these are preprocessing ceilings, never submission size.
- `renderGroundedContext` renders Seven's data-only `context` string from the durable
  delivery record: bindings (run, step, delivery, consumption, manifest), the ordered
  conversation (actual captured input bytes; accepted replies by Seven
  `ProviderAnswerAcceptance`), and the actual source items. Source text is quoted data.
- `groundedSubmission` mirrors Seven's canonical request so Five's step digest can be
  fixed first; `verifyGroundedSubmission` then reads Seven's captured submission,
  resolves the delivery/consumption/manifest/owner facts independently of the
  renderer, and compares every input, reply and source body, plus the bytes the model
  adapter received. Run it at the adapter seam before any provider IO.
- `checkGroundingEnvelope` measures subject-bound UTF-8 bytes (request, combined prompt,
  Seven's capture allowance, delivery payload, complete outbound reply) and refuses
  before dispatch with bytes, bound, turn and retained references. Nothing is trimmed.

This is not recall. `src/recall` keeps its exchange-memory role; this packet reuses
Two's facts and captures without a parallel store. Handoffs: R4 binds the real body
schema, source selection and class mapping; R6 wires the sampler and verifier into
boot/composition with the real route framing and bounds; R7 joins per-turn hosting and
live usefulness. The current preview/Eight envelopes cannot hold one grounded turn; the
measured bound proposal is in the R5 progress handoff.
