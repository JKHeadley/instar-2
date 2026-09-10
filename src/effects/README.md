# Effect doorway

Public entry: `@instar/constitutional-types/effects`. This remains a **dark
reference slice**, not live provider activation or independent convergence. The
approved design is `docs/12-the-effect-doorway.md`.

The stored owner records are OperationDefinition, the byte-preserved legacy
OutboundMessage, the closed conversation EffectPayload union, EffectRequest,
EffectValidation, OperationObservation and EffectSettlement.
OperationAdapterPort is an owned interface, not a stored fact. P1 owns
Result, Outcome, principals, scope, approval and evidence; P2 owns signatures,
fact admission, version chains, status/taint and durability receipts; P6 owns
reservation, one-use claim, exposure and bounded observation wakes.

## Composition

1. Register `effectSchemas` and `registerEffectBodies` alongside P6's actual P2
   schemas. Construct the store, then `createEffectSpine` and `createEffectDoorway`.
   A trusted host supplies the current standing/generation, exact approved version
   chain, independently verified principal, clock and custody. Pending P5 work and
   the P6 observation loop must already be durable.
2. `installOperationDefinition` checks the exact approved content, current version
   and scope. The executing principal cannot approve this policy. The fixture's
   ordinary reply demands **replicated(1)**. Local durability is only eligible if
   separately present in the exact approved definition with its declared loss model;
   missing peers never change policy.
3. `decodeOutboundMessage` fixes the attributed speaker, account, conversation,
   exact text, semantic work identity and source-result fact. `prepare` records it,
   the immutable request and reservation validation before calling P6 reserve.
   Immutable semantic identity cannot change through a new transport attempt/key.
   That legacy schema, request key and digest are unchanged. `decodeEffectPayload`
   adds eight conversation operations as an exact,
   versioned discriminated union. Each binds an immutable target digest and a
   versioned definition contract with independent occurrence, non-occurrence,
   quiescence and charge capabilities. Existing adapters omit the typed capability
   methods and therefore refuse before reservation/claim/provider invocation.
4. `dispatch` records fresh validation before P6's claim. `handoff` requires the
   claim's causal validation and exact request/digest/incarnation. It checks the
   entire prerequisite cone's exact P2 receipts, rechecks stop/expiry after waiting,
   consumes P6's genuine claim once, and records executor acceptance before invoke.
   Another doorway, copied handle, reentrant send or restarted executor cannot
   create another call. A claim is not an atomic transaction with the destination.
5. Response bytes are custody-captured observations, **not business success**.
   Timeout/throw/lost record leaves the durable local-acceptance or unknown
   disposition. Restart never reconstructs an invocation handle. P6 `recover`
   gives the read-only `observe` consumer one durable wake. Eight records that
   wake's acceptance before querying; a second direct consumer cannot overlap or
   reuse it. Bounded queries never decide an external negative by absence.
6. `settle` requires an independently supplied nine-owned assessment port, exact
   operation/digest evidence with current freshness, and demanded durability for
   evidence and settlement. Missing assessor refuses. Duplicate identical
   settlement returns the existing fact. Uncertain knowledge can be refined;
   contradictory final knowledge/charge refuses rather than overwriting history.
   Unknown occurrence/charge retains maximum exposure. This slice enables no retry.
7. `consumeEffectSettlement` accepts only a genuine owner-issued result, reruns
   evidence/durability checks, and rejects copied JSON/history. Assessment inputs
   and P1 evidence freshness are rechecked after each durability wait, including
   the final wait immediately before issuance or consequential consumption.
   After the last potentially waiting assessment/custody/storage work, nine's
   required `consumeCurrent` guard supplies and holds the complete current assessment
   (including charge, quiescence and availability) for a **synchronous** callback.
   Eight compares it to the original proof and checks P1 Evidence inside that guard;
   the public consequential consumer also runs inside it, not after it returns.
   A missing/unavailable guard refuses: another potentially waiting `read` is NOT
   a fallback. Host `current()` is a non-waiting local snapshot. Consumers must not
   wait, defer authority use or schedule asynchronous work from this capability.
   Changed assessment, evidence, reservation or observations refuse that attempt;
   an already durable historical settlement is not erased. It does **not**
   change credits. Six's conditional settlement/accounting extension is a routed
   dependency; until it lands no credits are released and no run completion is
   claimed from this record alone.

## Evidence and tests

`telegram-fixture-contract.json` lists every required P10 evidence capability as
supported for the **synthetic fixture** or unsupported with a reason. In particular,
there is no authoritative negative lookup, delayed-execution exclusion or real
billing proof. A fixture response proves no human delivery/consumption.

`scripts/effect-replica-storage.mjs` uses the real P2 replication append into a
second fsync-backed local **directory standing in for an authenticated peer**.
It is not independent media: simultaneous disk loss is uncovered. Captures are
fsynced into two fixture custody directories. No raw production credential exists.
The assembly must supply `EffectCustodyPort` separately from fact durability.
Before issuing or consuming settlement it reopens and hashes every referenced
operation capture at the locations demanded by the approved policy. P2 receives
fresh plain-data capture statuses on every read, including loss and restoration;
a cached receipt or replicated referring fact is not current custody. This fixture
supports only its explicitly declared two-directory loss model.

Tests exercise unit boundaries, full-port integration and emitted-code fresh
processes. The E2E fixture is SIGKILLed before send, after send/before observation,
and after recording. Reopened origin/peer histories preserve exactly 0/1/1 fixture
applications, one read-only query, unchanged liability, and refusal of new claims
and fresh semantic keys. These are actual process/storage tests, not live service
or full five/seven/nine/ten assembly evidence.

`scripts/check-effect-contracts.mjs` maps all 49 design IDs to actual partial
executions, explicit exclusions or **not-built** work. No unexecuted test is held.
The P2-NF-63 full boundary matrix and P2-NF-73 reconciliation alias are not silently
claimed complete: their inherited skips remain visible in the full suite.

## Bounds and unresolved seams

- Explicit brief exclusions: target-conditional mutation (later PR 23 investment),
  multi-adapter registry, and business settlement beyond this one reply.
- One conversation/run, 4096-record read ceiling, 4096 text characters/declared
  serialized byte bound, 64 closure references, finite charge and clock deadlines.
  No fleet incremental projection, cross-tenant fairness or async host supervisor.
  A synchronous adapter must be bounded by its P10 host; declared timeout is not
  a claim that this library can interrupt a wedged process.
- The reference seed is trusted fixture configuration, **not a verified P3 entering-
  force loader**. Only protected source artifacts are declared. Runtime governed
  gate activation remains dark pending the owner wiring and production evidence.
- The P5 pending/result and P9 evidence-acceptance fixtures are named stand-ins.
  No P9 type, constructor or production assessor is reimplemented here. The P9
  consumer interface states requirements; production composition must provide its
  owned fact decoder/current acceptance contract, including a non-waiting guard
  that refuses if it cannot hold current conclusions stable through consumption.
  The shipped nine stand-in implements a real local critical section over its
  mutable assessment and refuses reentrant updates; it performs no I/O or calls
  to the potentially waiting read port while guarded. This is not a production
  distributed assessment lease or an implementation of nine's stored records.
  Merely supplying a no-op does
  not constitute conformance. Current approval/evidence are rechecked through P1.
- The full causal standing-record provider, provisional-clearing matrix,
  evidence-withdrawal/accounting correction, separately scoped late observer,
  live disclosure/custody, advisory review, attention coalescing and independent
  protected-runtime isolation remain explicitly unbuilt full-design integrations.
  P4 stop is not merged on this base; final local stop is tested through the host.
- No owned database besides P2 facts. In-memory sets/weak maps only narrow
  invocation/settlement use; their loss never licenses replay. Historical index
  values are informational and cannot bypass `consumeEffectSettlement`.
