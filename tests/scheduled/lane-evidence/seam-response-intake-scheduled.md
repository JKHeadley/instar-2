# Seam response — Part Four scheduled-system intake (GRANTED, additive)

Decision: GRANTED. Request: `design-scheduled-work-seam-request-intake-run-binding.md`. Basis: Part Four's approved
design (docs/08-the-intake.md) promises a `kind: system` principal and a canonical scheduled-tick stimulus; the landed
`IntakePort.receive(raw, route)` is a bounded conversation/stop slice whose parser and `resolvePrincipal`
(`principalKind === 'person'`) cannot admit it. Landing the designed system arm is implementation of approved scope.
No new core type. Part Four stays the sole owner of admission and event identity; Part Five keeps run creation.

## What Part Four gains (all additive; `receive`, `recover`, `expireHolds`, `classifySlicePayload` and the new
## `admitVerifiedAct` keep their behavior byte-for-byte; every existing Part Four test stays green)

1. `receiveScheduledTick({ raw, route, discovery })` → `Result<IntakeDisposition>` running the existing
   preserve → dedup → authenticate → resolve → standing → admit sequence. Accepts ONLY the registered
   scheduled-ingress adapter and a verified package-minted `kind: system` principal. Route fields: adapter id,
   channel `scheduled:<installation id>`, system-principal sender, signed identity epoch, event id derived from
   (namespace version, job instance id, scheduled instant). `raw` is the canonical tick body; source machine and
   discovery clock live in the separate Part One `Evidence` reference (`discovery`), never in the tick bytes.
   Equal route + equal bytes → the ORIGINAL admission (idempotent). Equal route + different bytes → Part Four's
   existing mismatch/conflict behavior. The dedup MEANING of the landed tuple
   `(adapter, channel, sender, identityEpoch, eventId)` is unchanged.
2. The admitted fact keeps Part Four's existing accountable owner and `blockedOn: run-admission`.
3. `pendingScheduledAdmissions({ owner, frontier, limit, after })` → bounded, read-only owner projection over
   admitted-but-not-yet-run scheduled facts, with `next` cursor. It grants no standing and creates no Run.

## Failure direction

Unknown adapter, non-system or unverified principal, malformed tick bytes, missing discovery evidence → the
existing typed refusal, nothing appended past the preserved receipt. Fail closed.

## Acceptance evidence (the review desk verifies)

Two machines with identical route/tick bytes → ONE intake admission (and, via Part Five's existing conditional
`create` with a deterministic Run id supplied by the consumer, one Run root); different discovery clocks/machines
→ separate Evidence without changing tick bytes; same event id + changed package/calendar bytes → the existing
mismatch/conflict; crash after admission is found by `pendingScheduledAdmissions` and the same Run is created;
crash after Run append before acknowledgement → the existing Run is returned; a person principal or an
unregistered adapter is refused; every pre-existing Part Four fixture (including the verified-act ones) behaves
identically. Real three-tier tests through the real Part Two machinery with durable-restart cuts.
