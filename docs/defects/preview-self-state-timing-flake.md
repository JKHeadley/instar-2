# Preview self-state timing flake (Rule 37 quarantine)

**Status:** OPEN. The 2000-turn p95 timing case in `tests/preview/self-state.test.ts` is visibly skipped. Its body and 25 ms threshold remain for repair.

**Evidence:** On this branch, a concurrent run measured p95 29.9 ms and failed; an unchanged isolated rerun measured 6.14 ms and passed. Astra's isolated review run measured 18.48 ms. A passing rerun does not clear the red result. The assertion uses wall-clock time and can include host scheduling contention unrelated to self-state work.

**Coverage while open:** The other active self-state tests still verify journal and run-log derivation, replay, raised caps, UNKNOWN outcomes, and packet inclusion after rolling summaries. The 2000-turn performance bound is unproved by the gate. Report green results as green with this Rule 37 quarantine.

**Repair and closure:** Diagnose the variable wall-clock cost under the normal parallel gate. Repair the measurement or the underlying cost, remove `it.skip`, and show the retained workload and threshold pass with headroom under the diagnosed condition. An unchanged isolated pass is insufficient. The owner carries this defect in the repository until then.

**Multi-machine posture:** The benchmark fixture is machine-local; this defect record and visible quarantine travel with the repository.
