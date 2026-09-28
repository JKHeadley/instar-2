# Instar

The second-generation agent operating system. A separate project from `instar` 1.x,
which continues to run and improve on its own. Nothing here changes 1.x.

**The name is settled (operator decision, 2026-09-05): this project is Instar.** The
repository slug is an artifact of setup, not a second name. Why the name carries forward,
what this project is for, and who decides what are all in
[docs/00-the-purpose.md](docs/00-the-purpose.md) — read that first.

## What this project is for

Instar 1.x has around ninety written rules for how it should be built. Almost none of
them are checked by anything, so the code drifts away from the rules and nobody notices
until something breaks. Measured on 2026-08-23: of 92 guards in the running system, 20
were confirmed to actually be on.

This project's single idea: **every rule is something a computer checks automatically,
starting on day one.**

## The rule for this repo, until further notice

**No code.** Documents only, in this order:

1. **The rules.** Every rule ported over, and for each one, how a computer will check it.
2. **The big-picture design.** What the small core does and how the pieces fit.
3. **The design for each part.**
4. Only then, code.

Nothing moves to the next step until the previous one is approved.

## What "approved" means here

Justin approves a specific version of a document. If anyone edits it afterwards, the
approval expires and comes back to him. Otherwise "approved" quietly stops being true
and nobody notices.

## What "verified" means here

Three tests, all of which a person or a script can apply:

1. Every claim about how the new system should work is either **a rule** (with the name
   of the automatic check that will enforce it) or **a value** (explicitly labelled as
   something no check will enforce). There is no third category. If a document cannot
   say how a claim gets checked, it is not finished.
2. Every claim about how 1.x works *today* carries the number and the command that
   produced it. Not recollection.
3. Every document has a plain-language twin. Something said in one and missing from the
   other is a defect.

## How work gets approved here

**`main` holds approved documents only.** Every draft arrives as a pull request, gets
reviewed line by line, and only reaches `main` when Justin merges it. Merging *is* the
approval, and it is bound to the exact content reviewed — edit the draft after a review
and the review reopens on the new version. That is the approval rule from the readme,
using a mechanism that already exists rather than one we have to build.

## Status

The rules foundation, big-picture design, and the first four part designs (constitutional
types and the decoding boundary; the fact envelope, version chain, and projection contract;
declarations, the register generator, the terms resolver, and the rule graph; intake and
identity/standing resolution) are approved on `main`, together with the first six
constitutional amendments landed atomically with part three and the five amendments routed
through part four. Seven part designs remain. Code waits until the part designs it depends
on are approved.

Review model (operator decision, 2026-09-03): the independent review desk runs every pull
request to convergence first; the operator then reviews a concise plain-language overview and
decides only the direction-, value-, and policy-level questions, which each PR lists explicitly.
The agent carries responsibility for technical correctness; merging still records the approval.

## Where test temp files go

Test runs put their temporary files on RAM-backed storage so the durable-storage tests never
swamp the real disk: `INSTAR_TEST_TMP` if set, else the `/Volumes/instar-test-ram` volume on
macOS (create it with `scripts/ensure-test-ramdisk.sh`) or `/dev/shm` on Linux, else the real
disk with a loud warning. Set `INSTAR_TEST_REAL_DISK=1` to opt out; `npm run test:durability`
does exactly that to prove production storage on the real disk once per landing gate.
