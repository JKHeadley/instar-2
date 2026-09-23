# Changelog — `10-the-transport-and-leases.md`

_Generated from `10-the-transport-and-leases.changelog.json` by `scripts/render-changelog.mjs` — do not edit by hand._
The document itself reads as a first version; every change to it is recorded here, newest first,
each linked to the git change that made it (rule 91).

## Revision 5 · 2026-09-22 · draft — operator review on PR #106; Astra landing review astra-sixpair-review-4d9a7bd.md (CONVERGED — YES) of the SIX-PAIR unit: Six admits one accepted-answer reply Run beside its provider Run, and owns the final dispatch invocation.

- **Add the fixed provider/reply pair as a bounded exception to singleton admission: Six owns admission, shared accounting and recovery; Five owns the accepted-answer reply opening; Eight owns the outbound operation. The existing singleton profile and its historical records keep their meaning.** — The reply must own its own Run and Eight operation while the provider call's charge and quiescence remain unknown, which is the live-model case; the previous one-run rule refused it. _(git-history: src/transport/run-pair.ts, src/transport/records.ts §fixed pair admission; commits b0bcdea, e2c11c3)_
- **Record the repaired final-invocation sequence: consume the one-use claim, complete Eight's callback-capable durability and effect preparation, then invoke through Six's invokeConsumedDispatch, which rechecks the exact consumed reservation, live claim, current fence and parent inhibition before the adapter runs; a refusal there leaves consumed exposure and permits observation only.** — A provider cap violation that became durable inside that callback could otherwise still be followed by a physical send. _(git-history: src/transport/dispatch-invocation.ts, src/effects/doorway.ts final invocation handoff; commit b0bcdea)_
- **Replace §4a's blanket one-loop-per-domain statement: standing capacity implies no change to singleton loop admission, and the separately versioned provider/reply profile admits only its exact dependent reply Run, creating no additional ordinary or minimal-responder slot.** — The prior wording read as forbidding the reviewed pair; it must bound the exception without widening capacity. _(git-history: docs/10-the-transport-and-leases.md §4a singleton-capacity replacement; commit 56b47c1)_

## Revision 4 · 2026-09-20 · draft — operator-directed M3-I owner resolution for SIX–TEN–ELEVEN responder-capacity admission

- **Define Six-owned CapacityReservation v1 and P6-NF-41–44 for guarded production, origin/historical decoding, finite parent/child conservation, restart retention and scheduling isolation; keep operation AdmissionReservation unchanged.** — The operation-bound reservation cannot represent standing installation capacity without inventing a run and effect; Six must own the new allocation semantics and its decoder. _(git-history: docs/10-the-transport-and-leases.md §4a; commit subject: Design: responder-capacity admission (M3-I owner resolution))_

## Revision 3 · 2026-09-19 · draft — operator-directed M2 closure of the fixed single-machine installation contract

- **Specify direct consumption of Six's assignment-derived fence and exact AdmissionReservation instead of standalone or fixture-shaped installation facts.** — The production resolver expected a stored FenceToken name and an unspecified resource reservation even though Six already owns both authority relationships. _(`1b960e7`)_

## Revision 2 · 2026-09-08 · approved — operator review on PR #45; part six follow-up: the durable bounded due scan cursor, landed after the Astra desk's CONVERGED — YES at the reviewed head

- **Part six gains the durable bounded due scan cursor: a selection-only scan port whose cursor survives restarts, with finite item and monotonic-duration bounds, and which never derives, schedules, reserves or settles due work.** — The scheduled-work design needs to walk a large backlog of candidates in bounded steps; the first approved version only offered a complete read. _(PR #45; docs/09-the-run-graph.md and docs/10 §bounded due scan)_

Approved in: PR #45, merge `adbc272dc`.

## Revision 1 · 2026-09-05 · approved — operator review on PR #20; first approved version of part six after the two-desk convergence review

- **First approved version of part six: the transport reference adapter, leases and fence tokens, the loop primitive, and recovery.** — Next part in the dependency order after part five's approval. _(PR #20; docs/04-the-big-picture.md)_

Approved in: PR #20, merge `210d1574f`.
