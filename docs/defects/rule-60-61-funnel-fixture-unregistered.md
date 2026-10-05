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

## Two causes of the Linux failures, measured (2026-10-04, cint-L51 repair 201100)

"the host kernel answers differently" above was the right shape and the wrong level of detail. Two
distinct causes stack on a host whose `/bin/sh` is dash (Debian, Ubuntu, WSL). The first is repaired;
the second is recorded here because repairing it changes what the funnel's process limit is a limit
*of*, and that cannot be verified on darwin from the Mama PC.

**Cause 1 — the shim's shell had no `-u` (REPAIRED, commit c91a22d5).** `scripts/limit-exec.sh` lowers
`RLIMIT_NPROC` with `ulimit -u`, and dash's `ulimit` builtin does not carry that option, so the shim's
own `exit 125` preceded every `exec`. Measured:

```
$ /bin/sh scripts/limit-exec.sh REQUEST 64 5 1 "PWD SHLVL OLDPWD" "" /bin/echo launched
scripts/limit-exec.sh: 4: ulimit: Illegal option -u      # exit 125
$ /bin/bash scripts/limit-exec.sh REQUEST 64 5 1 "PWD SHLVL OLDPWD" "" /bin/echo launched
launched                                                  # exit 0
```

Not a kernel difference at all: Linux carries `RLIMIT_NPROC`, the shell lacked the option. So no launch
of this host ever started, which is why the failures reached far past this file — the preview launcher's
authenticated `getMe` settled as `launch-refused` and `preview: bot identity refused` aborted it, failing
34 cases across 10 preview files on a line of launcher stderr that names an unrelated P-08 warning. The
funnel now resolves a shell whose `ulimit` carries `-u` (`limitShell()`, `/bin/sh` first, so darwin is
unchanged); with no capable shell it keeps `/bin/sh` and the shim refuses as before. The limit is never
skipped to let a launch through. This file went from 22 failed of 32 to 21 failed of 33.

**Cause 2 — `RLIMIT_NPROC` counts threads on Linux, and the limit is computed from processes (OPEN).**
With the shim now reaching its `exec`, the transport child starts and is killed immediately:

```
DIAGIO status=null signal=SIGABRT out=""      # scripts/production-boot-io.mjs invoke(), getMe
```

`transportProcessLimit()` (scripts/production-boot-io.mjs) counts the user's **processes**
(`/bin/ps -U <uid> -o pid=`) and adds `TRANSPORT_LIMITS.processCount` (4). On darwin `RLIMIT_NPROC` is a
process count, so that is the right subject. On Linux it bounds the user's **tasks** — every thread of
every process of that uid — so the computed ceiling is far below the current task count, and `node`
aborts before its first instruction. The repair is to count the limit's real subject per platform (on
Linux, the uid's task count, for example by summing `/proc/<pid>/status:Threads` or reading
`nproc`-equivalent task accounting) rather than to raise the headroom by a guess or to pass `null` — a
`null` limit drops rule 60's per-user arm entirely, which the constitution's purpose clause refuses when
the checkpoint can still enforce it. Until that lands, this host cannot run a launch of the preview
launcher, so the P-08 cluster above stays red here and the funnel's proof stays on the Studio.

## Scope: this holder is ONE arm of each rule, not the whole of them

Recorded because the register cannot say it. Rules 60 and 61 are cross-cutting: the design assigns
them to several places, each with its own named checks, and `resource-owner.admit` is the register's
first holder for exactly one of those places — the physical host's launch funnel.

| Arm | Where the design assigns it | Its checks |
|---|---|---|
| the physical host's launch funnel (ceiling, answer reserve, per-process kernel limits, kills) | part ten's host; `scripts/resource-owner.mjs` | the fixture this record owes |
| resource limits compose through the whole delegation tree (`RunBudget`: concurrent worker/process/memory ceilings, depth and fan-out limits, spend and token ceilings) | `docs/09-the-run-graph.md` §"resource limits compose through the entire delegation tree" | P5-NF-14/15 |
| all operational repetition has the same brakes (the loop primitive; `LoopPolicy` has no unbounded arm) | `docs/10-the-transport-and-leases.md` §5 | P6-NF-16/17/18/19 |
| delegation transfers credits without duplicating them | `docs/10-the-transport-and-leases.md` §"delegation transfers credits" | P6-NF-19/35 |
| collection work is durable and loop-governed; public reads are bounded and scoped | `docs/20-measurement-ledgers/10-holders-runs-loops-and-surfaces.md` | P16-NF-43–45, P16-NF-47–49 |

A `partial` hold states its portion and its remainder; a `deferred` hold carries a part, a ceiling,
an owner and an overdue action, and has no field for either. So while these two edges are deferred,
`generated/coverage.md` shows `60 → [resource-owner.admit]` and `61 → [resource-owner.admit]` with
nothing beside them saying the funnel is one arm. When the deferrals become `partial` (see below),
each `remainder` must name the arms above; until then this table is the statement.

Two consequences worth being exact about:

1. **`enforcedBy` being non-empty for 60 and 61 is not a claim that either rule is covered.** It is
   the claim that a holder is named and its proof is owed by a date. The arms above have their own
   checks and are not this record's debt.
2. **The other arms' check ids are not in the owner catalog either.** There is no `part-six` owner
   manifest, so `P6-NF-16/17/18/19` cannot be cited as can-fail evidence by any declaration today,
   even though `tests/transport/coverage.test.ts` and `tests/transport/authority.test.ts` carry
   those ids and pass. Adding that manifest plus its contract entry in
   `scripts/register-owner-references.mjs` is the separate, larger piece of work that would let the
   loop-primitive arm be held in the register at all; it is named here so it is not rediscovered.

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
