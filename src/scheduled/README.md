# Scheduled work

Declarative scheduled-work packages: manifests, cron expressions, next-run calculation, capacity and load shedding, and the intake adapter that turns a due package into ordinary intake. Design: `docs/19-scheduled-work.md`.

`shedding.ts` also supplies the pure crash-window reducer used by the journal host supervisor.
Failure, spawn refusal, hang and rapid queued exit share one count; success does not erase recent
failures. No-work, capacity-applied inhibition, cancellation and uncertain effects are excluded.
The owner persists the returned state before another launch. An open pause requires an explicit
owner resume, and elapsed time alone never closes it. This is the local host retry population,
not a distributed Part Six breaker or permission to retry an uncertain effect.
