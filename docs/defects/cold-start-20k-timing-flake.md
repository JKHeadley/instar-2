# Cold-start 20,000-message timing flake

Status: OPEN — Rule 37 timing-only quarantine, 2026-10-22.
Owner: Echo / cold-start performance repair desk.
Recheck: next cold-start performance repair, no later than 2026-10-29.

At head `1d4991572fa621eb6e25b3c67c5685d41c13cacc`, independent Astra
review measured verified read 8,260.391 ms, status preparation 7,923.254 ms,
and populated run reconstruction 373.188 ms: **16,556.833 ms total** against
`tests/recall/cold-start.test.ts`'s strict 15,000 ms assertion. Ready state,
20,002 entries and no conflicts all passed. The earlier builder measurement
was 14,755.417 ms (244.583 ms margin). Both observations are retained;
a passing retry does not clear the failure.

Provenance: unit-step5-cold-1022 round 1 review, base
`d0944dbaee4acee514c53c25c3f1ba13026953d6`, requested head above;
review evidence `astra-unit-step5-cold-1022-evidence/review-20k.log`, as
quoted in the supplied pipeline repair brief. Reviewer conditions: Node
24.14.1, one worker, RAM temporary storage, `--configLoader runner --no-cache`;
priority reduction was refused by that sandbox. These are supplied review
observations, not new runs by this repair.

The measured interval covers synchronous signed fact reading, projection
preparation and run folding, plus intervening logging. Source construction
is outside it. Memory storage is used; this is neither disk durability nor
whole-service startup. The test does not control CPU scheduling or host
contention. The review identifies no incorrect source computation, and a
source optimization cannot establish an unconditional wall-clock ceiling
under these unspecified conditions. No bounded source repair for that
measurement defect is established; speculative changes to verified admission
would not repair its benchmark contract. This is the review's explicitly
requested narrow quarantine, not a claim that further optimization is impossible.

Only the 20k timing assertion is visibly skipped. The 20k source, read, status,
run reconstruction and all semantic assertions remain active when selected.
All other corpus sizes retain the existing scaled timing check; default is
200 messages. Phase measurements are still printed. A green result means
semantic success with this open performance defect, never a dependable
15-second ceiling. The 180-second test watchdog remains active.

Reproduce the semantic workload and measurements:
`INSTAR_COLD_RECORDS=20000 nice -n 10 npx vitest run tests/recall/cold-start.test.ts --maxWorkers 1 --configLoader runner --no-cache`.
Run without `INSTAR_COLD_RECORDS` for the small-corpus regression check.

Closure: the owner declares benchmark host, Node version, storage, worker
count, priority and contention conditions; profiles and repairs the measured
path or measurement contract; then removes the timing skip and supplies
repeatable passing evidence under those conditions, retaining this red result.
An unchanged passing retry or larger arbitrary threshold cannot close it.

Multi-machine posture: measurements are machine-local; this defect and the
quarantine travel with the repository. No shared fact, authority, secret,
spend cap, stop, send uniqueness or intake durability behavior changes.

Repair verification on the Laptop (2026-10-22): the changed test's 20k
semantic case passed and its separate timing case was visibly skipped.
Verified read 8,887.066291 ms, status 7,563.505709 ms, run 303.025833 ms,
total **16,753.597833 ms**. The default 200-message case passed its scaled
budget at 270.268583 ms. These runs used one worker and the command above;
the sandbox refused nice priority and the runner reported no verified RAM
temp root (the benchmark source itself remains in-memory). This supports the
quarantine behavior, not closure of the speed defect.
