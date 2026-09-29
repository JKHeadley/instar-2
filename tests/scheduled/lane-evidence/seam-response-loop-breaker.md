# Seam response — Part Six recurring loops, breaker and missed coverage (GRANTED, additive, consolidated)

Decision: GRANTED. This consolidates two requests against the SAME owner seam into ONE additive change to
Part Six (src/transport): `design-sentinel-holders-seam-request-loop-breaker.md` (shared recovery breaker) and
`design-scheduled-work-seam-request-recurring-loop.md` (recurring loop, parent budgets, missed coverage).
Basis: the approved Part Six design (docs/10-the-transport-and-leases.md) already specifies a persistent parent
duty, shared rolling budgets, multiple bounded episodes, open/half-open breaker behavior and a missed-count fact;
the landed `LoopPolicy` (`breaker: 'stub-closed'`, concurrency literal 1, one episode per Run) is a dark slice of
that approved design. Landing it is implementation of approved scope. No new core type: everything below is a
Part Six owned record with a Part Six owned closed decoder. Part Six stays the sole owner of retry admission,
breaker state, loop and resource closure; Part Eight keeps effect settlement; Part Nine keeps "did the result
restore protection"; Part Five keeps run progression.

## What Part Six gains (all additive; every existing LoopPolicy/LoopRecord/ScanCursor value still decodes to
## the same meaning and every existing Part Six test stays green)

1. `LoopPolicy` gains finite, closed policy values for: initial/max delay, multiplier and jitter bounds; failure
   threshold and the counted failure classes; a finite accepted-outcome window; open-breaker duration/cooldown
   and maximum open duration; half-open trial count/concurrency and the evidence required to close or reopen;
   concurrent-work caps as finite values (the landed literal 1 remains a valid value); persistent parent-duty
   reference and a shared rolling attempt/resource budget. `breaker: 'stub-closed'` remains valid and means
   exactly what it means today.
2. `LoopRecord` gains explicit closed / open-breaker / half-open states and transitions alongside the landed
   scheduled/running/restoring/waiting/stopped; multiple bounded episode identities under one parent WITHOUT
   counter reset; a stable pressure identity derived from operation family + governed target/conversation/
   machine/pool scopes that survives worker, key and local-episode changes; parent action/resource budgets
   whose exhaustion cannot be reset by moving machines or minting a new holder episode. Every transition
   records the pinned policy/generation, contributing attempts + outcomes, pressure key, counters,
   timestamps/clock basis, current owner run, next eligible time and source vector.
3. A Part Six owned `MissedRangeRecord` exactly as the scheduled-work request specifies (fields, `catchUpPolicy`
   none|latest, per-member dispositions missed-no-execution | existing-run | catch-up-run, optional catch-up Run
   reference) with `recordMissedRange` / `readMissedRange`. The writer validates: membership is the exact
   ordered calendar expansion between the exclusive prior expansion cursor and the current/missed boundary at
   the supplied asOf; exactly one disposition per member; an already-admitted member keeps its Run; `none` has
   no catch-up Run; `latest` links exactly the latest otherwise-unexecuted member to ONE deterministic Run;
   replays return the same record; partial completion appends causally linked successors without changing
   identity or membership. It requires the exact `ScanCursor` fact but does NOT change that cursor's
   selection-only meaning, and `BoundedDueScanPort` keeps paging owner-supplied keys only. Distinct
   owner-supplied due keys (e.g. machine-scoped job instance ids) stay distinct — Part Six never globally
   collapses distinct target ids; ordinary lease/fence/resource checks apply per instance.

## Failure direction

Missing/conflicting policy, incomplete attempt population, incomparable time, exhausted parent budget or
unavailable shared pressure state REFUSES the next automatic attempt and leaves the recovery/gap owned (a
named owner, visible). It must NOT silently degrade to `stub-closed` for a policy that requires a real breaker.
Fail direction stays closed.

## Acceptance evidence (the review desk verifies)

- Shared pressure/recovery fixture: two holder families, multiple workers, at least two machine identities on
  the same operation family: failures open ONE breaker; every contender refuses during cooldown; exactly the
  governed half-open trials run; failed trials reopen; passing trials plus independent restoration evidence
  close; restarts / new local episodes cannot erase counters; equal causal frontiers produce the same breaker
  outcome window.
- Parent budgets and breaker counts survive restart, machine/route change and new episodes.
- Missed coverage: boundary and boundary-plus-one lateness produce stable group membership; a partially
  processed group resumes at its first undisposed member and cannot mint a second catch-up Run; a previously
  admitted member stays linked to its original Run; two machine-scoped scan keys both run while a global
  shared-effect key still deduplicates once.
- Byte-for-byte preservation: every pre-existing LoopPolicy/LoopRecord/ScanCursor fixture decodes identically.
- Real three-tier tests through the real Part Two machinery, with durable-restart cuts at transition boundaries.
Consumer checks that depend on this seam (P14-NF-43/47/49; P15 recurring/crash-loop checks) stay
non-executable until this evidence lands.
