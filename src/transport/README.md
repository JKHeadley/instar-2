# Single-conversation transport slice

Public entry: `@instar/constitutional-types/transport`. Read the full design in
`docs/10-the-transport-and-leases.md`; this package implements the bounded lane-six
brief, not the whole distributed design. The slice manifest is **dark**; no runtime
feature is activated. P3 lists protected source/host artifacts only. A gated feature
declaration requires its actual production fixture catalog, deadline and live proof.

Composition order:

1. The trusted host provides a verified principal, scope, current authority context,
   P3 generation, fresh worker/authority incarnations, monotonic clock and finite caps.
2. Register `transportSchemas(host)` and `registerTransportBodies(host, boundary)`
   in P2, then create its real fact store. `createTransportSpine` uses P2's signed
   author/append path; `createTransportAuthority` reads P2 status-bearing snapshots.
3. Acquire the exact predecessor, schedule the run's durable loop, then let eight
   reserve its request/attempt/digest/maximum charge under that fence.
4. Eight gets a one-use claim and calls `consume(claim, fence)` immediately before
   its executor. Only Success permits that invocation. The handle is never a JSON
   token, and is burned before its durable consumption acknowledgement.
5. Recovery locates the same unresolved reservation and invokes ONLY eight's
   read-only `ObservationPort`, returning eight's `OperationObservation` reference.
   An observation reference is not a settlement or
   run completion. Weak absence, a fresh key, or restart cannot enable another send.

The exact P1 imports are in `contracts.ts` and `records.ts`; P2 owns envelope,
schema registration, signature verification, status snapshots and durable receipts.
Five's Run is consumed via its P1-owned reference placeholder until the run package
lands. The generic Telegram adapter carries five's original envelope unchanged;
eight's effect doorway owns the actual send and must consume the claim. There is
no Telegram client, token, target URL, provider retry or effect classification here.

`scripts/transport-slice.mjs` is a reference composition with a pinned boot seed.
Its filesystem adapter writes ONLY signed P2 envelopes, using compare-head under
an exclusive writer lock, atomic rename and file/directory fsync before ACK.
An abandoned append lock refuses further writes until quiescence is established.
This is not replicated storage. Eight can demand replicated durability; a local
receipt then refuses dispatch, preserving the uncertain reservation.

Bounds and honesty:

- One voter, one domain, one worker, one run. A lease has no availability through
  voter loss. No quorum, membership changes, independent repair domain, fairness
  across domains, or full Threadline adapter. Breaker is an explicit closed stub.
- Rebuild is bounded to 4096 domain records; P2 verifies the signed prefix. This
  slice does not claim incremental fleet-scale loop scanning or bounded P2 replay.
- Clock regression and stale ownership fail at admission without a loss notice.
  Signed principal/machine policy is checked on origin, replication and historical
  replay, including transport predecessors. Legitimate old incarnations remain readable.
- An exhausted ordinary duration starts no observation and spends no credit. Zero
  duration means zero starts. Authority restart invalidates old lease timers; only
  a nonactive episode with positive duration/remaining credit may enter the explicit
  `restoring` one-shot observation state, whose completion stops the episode.
- Ordinary observation first commits `running`; its matching `RecoveryRecord`
  releases the active reservation and folds the loop to waiting. Neither a due
  timestamp nor another API instance permits overlap. A returned refusal/throw is
  recorded as a completed attempt before being propagated, preserving its next wake.
  A killed observer or missing durable completion stays active even after takeover;
  the host must establish completion/quiescence before any new observation. This
  slice supplies no automatic quiescence override. The obligation and count remain.
- Charges are integer host-declared capacity units (not an invented money type).
  Uncertain charges are retained permanently in this slice. No P8 settlement
  consumption/release implementation exists yet, and no retry is enabled by that gap.
- Recovery observers are synchronous, read-only host ports. The policy timeout is
  declared but host process supervision must bound a wedged observer. There is no
  asynchronous timeout supervisor in this package; process-kill tests prove recovery
  only at their named cuts, not all possible instruction boundaries.
- The reference boot seed is NOT a production P3 loader or live revocation feed.
  The production composition must inject the current verified register/authority
  context, clocks and process identities. Neither dark declaration nor test fixtures
  claim live Telegram delivery, live-channel probes, or LLM supervision.
- P6 schemas recheck current standing at origin; causal grant-record binding from
  a production admission provider is not yet implemented by this reference host.
  These records are not P2 conferring authority and cannot themselves grant standing.

Tests under `tests/transport`, `tests/integration/transport.test.ts` and
`tests/e2e/transport.test.ts` execute real P2 admission and fsync-backed storage.
The E2E child imports emitted public transport code and is SIGKILLed after claim,
after consumption, after the fixture effect, or inside the active observer. The
last cut proves fail-closed active retention with zero replacement calls. Its eight doorway is explicitly a
test stand-in, not the sibling's eventual implementation or an actual Telegram send.
