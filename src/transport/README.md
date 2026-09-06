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
6. Bind eight's public `consumeEffectSettlement` as the optional fourth argument
   to `createTransportAuthority(host, spine, boundary, consumeEffectSettlement)`.
   Supply that SAME consumer to `registerTransportBodies(host, boundary,
   consumeEffectSettlement)` when configuring P2. The owner boundary captures this
   binding; an authority with a substituted callback refuses, including duplicates.
   Pass the actual `EffectDoorway.settle(operation)` issuance to
   `authority.settle(fence, settlement)`. The generic parameter preserves eight's
   branded input type; `SettlementAccountingInput` states consumption requirements,
   not a competing settlement type or decoder. This is a trusted assembly dependency,
   like the store/clock, never a callback selected by an untrusted request. Omitting
   it refuses all settlement applications and keeps reservations held.

Settlement consumption rechecks eight's independent assessment and exact durability
before reading six's fresh status-bearing prefix. A `SettlementApplication` binds
the exact operation/request/reservation-fact/claim-fact/digest and settlement fact
hash, with that fact in its causal closure. The private on-stack admission ticket
is required inside P2's origin boundary; raw authoring cannot mint a credit release.
Replay checks the signed evidence binding and arithmetic, never reconstructs a live
eight issuance. Eight's wire charge is decimal text or `unknown`; six only matches
that referenced field and imports P1's Outcome consumer, not an eight decoder.

Applications deduplicate by settlement identity, with exact changed-byte refusal;
successor settlements for an operation conditionally replace its accounting view.
`released` is cumulative unused credit, not an additive payment. Budget admission
uses the latest exposure once per operation. A lost ACK or duplicate cannot release
twice. Unknown occurrence, unknown charge, or possible delayed execution holds at
least the original maximum. A known charge above that maximum records a cap
violation and blocks spending beyond the domain cap. Only decisive known-charge,
quiescent settlement releases unused credit. Eight's reply producer has
`retryEligible: false`: no new attempt of the same request/semantic message is
enabled, even after proven non-occurrence. Distinct work in the same run may use
the remaining budget only after the original is fully reconciled.

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
  Uncertain charges remain held until sufficient eight-owned settlement arrives;
  there is no automatic retry, prepared-operation cancellation or new spend ledger.
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

The settlement integration and SIGKILL lifecycle tests import eight's ACTUAL public
exports and fixture from pushed commit `4048b2d2799112df4ab8809b7462e8b801f527c5`,
using git objects and this branch's emitted P1/P2/P6 packages. They require a full
history checkout, fail when the pinned input is absent, and never copy eight's
source into this package. Nine's independent assessor remains an explicit fixture
stand-in and the replica is a second local directory, not an independent failure
domain. This seam does not activate production effects or establish nine's bar.
