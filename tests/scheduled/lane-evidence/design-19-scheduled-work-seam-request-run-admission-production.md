Status: GRANTED CONDITIONAL (SEAM-LEDGER row 83; seam-response-loop-followup.md + seam-response-assembly-followup.md addenda)

# Part Fifteen seam request — real RunAdmissionPort production implementation and wiring

Request id: `P15-P6-run-admission-production-v1`

Owner: Part Six for admission, ownership, reservation and execution authority; Part Ten for the
production assembly binding. Consumer: Part Five's existing public `RunGraphPort`, as used by Part
Fifteen scheduled work.

## Missing landed contract

The checkout exposes the existing injected `RunAdmissionPort` shape used by Part Five, but no real
Part Six implementation or Part Ten production binding. `src/rungraph/README.md` explicitly marks
the adapter composition pending. `seam-response-assembly-followup.md` does not name or grant this
behavior and its opening guard excludes unnamed behavior.

Please grant and land an additive Six-owned implementation of the existing `RunAdmissionPort`
create/commit/verify/execution and reservation obligations, backed by Six's signed current
authority, leases, fences and resource reservations, plus the exact Ten-owned non-null production
composition binding. A process-local set, permissive fixture, Run self-report, worker presence or
no-op implementation must not satisfy the port.

## Required acceptance evidence

- Unit: stale fence, wrong opening/head, duplicate callback, absent reservation, wrong worker and
  copied/self-reported state refuse; the exact signed-current neighbor passes.
- Full-port integration: Four admission → Five opening/grounding/transition through the real Six
  implementation, with every create/commit/verify/execution decision re-resolved from owner facts.
- Lifecycle: fsync/SIGKILL cuts around admission, append callback, commit, worker observation and
  terminal closure reconstruct one Run and one reservation; ambiguous or missing history stays
  refused and no process disappearance releases an uncertain slot.
- Wiring: Part Ten production assembly rejects null, mock, process-local and no-op implementations
  and proves delegation to the real Six implementation.

This request supplies no implementation and grants no behavior. P15-NF-06/22/38/45 remain wholly
non-executable for their production-admission arms until the owner grant lands with this evidence.
