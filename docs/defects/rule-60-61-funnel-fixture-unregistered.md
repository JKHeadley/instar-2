# Rules 60 and 61: the host funnel holds them in code, and no registered fixture proves it

**Status:** OPEN.
**Owner:** echo (agent), constitutional-build desk.
**Opened:** 2026-10-03 (unit w4-ugaps).

## What this records

`scripts/resource-owner.mjs` is the one funnel every provider launch of a host passes. It holds a
hard concurrent-launch ceiling (`eligible`, 3 launches), keeps the answer reserve out of reach of
non-critical work (`reserveLaunches: 1`), lowers each process's own `RLIMIT_NOFILE`, `RLIMIT_CPU`
and `RLIMIT_NPROC` — soft **and** hard — before anything is spawned (`limitedArgv`), kills a launch
observed past its memory or process ceiling, and sheds self-triggered work first under pressure
(`priorityGate`, `src/scheduled/shedding.ts`). That is rule 60's "one funnel that holds the
ceiling" and rule 61's "settles down under pressure, not fire forever".

Until unit w4-ugaps the funnel was not a declared boundary at all, and
`generated/coverage.md` reported `enforcedBy: []` for both rules. That unit declared it
(`resource-owner.admit`, a `blocking sites` entry) and added a `holds` edge for each rule — as
**deferred**, to part ten, with a calendar ceiling of 2026-12-15.

The deferral is the honest class because **the can-fail evidence is written but not registered**.
The tests that exercise the ceiling, the answer reserve and the kills live in
`tests/integration/resource-owner.test.ts` (for example: "kills a launch whose descendant tree
exceeds its memory ceiling, and not one within it"; "settles a burst: maintenance keeps the
reserve for answers and never exceeds the launch ceiling"; "a refused allocation returns the debit
it already prepared, so refused maintenance never takes the answer slot"). Two things keep them
out of the catalog today:

1. **No owner contract admits that path.** In `scripts/register-owner-references.mjs` the
   `preview` owner admits fixture artifacts only at `tests/preview/<kebab>.test.ts`, and
   `part-ten` admits only the paths hard-listed in `partTenFixturePaths`. Neither lists
   `tests/integration/resource-owner.test.ts`.
2. **It could not be shown passing where the unit ran.** On the Mama PC (WSL2, 2026-10-03) that
   file reports 22 failed of 32: it exercises process groups, `RLIMIT_NPROC` inheritance and
   detached-descendant census behaviour that the host kernel answers differently. The desk runs
   it on the Studio (darwin). Citing a fixture the unit could not observe passing would be a
   claim without evidence (Rule 3).

The preview launcher's own funnel test, `tests/preview/journal-agent-resources.test.ts`
("PREVIEW-HOST-RESOURCE-FUNNEL launches every model call through the resource owner and records
resources, doorways and credential custody"), is registered in the catalog and is the
declaration's `inspectedBy` reference, but it is **currently red on `cint-L45` itself**, before
unit w4-ugaps, with `preview: tools off: no recorded operator grant resolves the tools policy: the
activation changes a subject the recorded grant does not cover`. That is a tools-activation grant
defect in another unit's subject, reproduced identically on a clean `origin/cint-L45` worktree, so
it is not this record's repair either.

## Repair and closure

The owner either (a) adds `tests/integration/resource-owner.test.ts` to the part-ten fixture
paths (or admits it under the preview owner's existing exception form, as
`PREVIEW-PROVIDER-FAILURE-ON-CAPTURE` is admitted at `tests/assembly/provider-failure.test.ts`),
registers a fixture id with the file's committed hash, names that id in the deciding test titles,
and replaces both deferred holds on `resource-owner.admit` with `partial` holds citing it; or
(b) repairs the tools-activation grant so the already-registered
`PREVIEW-HOST-RESOURCE-FUNNEL` fixture passes, and cites that instead for the funnel-is-passed
portion — the ceiling and reserve portions still need (a).

Either way the deferred holds become `partial` with their portion and remainder stated, and this
record closes. If 2026-12-15 passes first, the register's own deadline walker fails the build
(P3-NF-24) and the overdue action on each hold raises an operator attention item naming the rule
as unproven.

## What is NOT claimed meanwhile

That rules 60 and 61 are proven. The register says `deferred`, which is the claim that the holder
is named and the proof is owed by a date — not that a check can fail for them today. The funnel's
enforcement is read in code and recorded in unit w4-ugaps's report; it is not evidence at the tier
the rule graph counts.

**Multi-machine posture:** machine-local. The funnel bounds one host's own processes; this record
and the deferral travel with the repository.
