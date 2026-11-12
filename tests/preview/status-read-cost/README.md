# Status read cost diagnostic

This is an offline measurement, not a status optimization. Product code is unchanged.
Run on a builder machine, never as a Studio load test. The fixture contains synthetic
model-call history written and compacted through `openPreviewJournal`; it does not
call a model. All journal writes go to a new temporary directory. The pointer file
names that directory for subsequent reads. The storage key is synthetic.

From the repository root:

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/status-read-cost/generate.mjs /tmp/status-cost-root 1600
python3 tests/preview/status-read-cost/measure.py /tmp/status-cost-root
python3 tests/preview/status-read-cost/measure.py /tmp/status-cost-root --plain
npx vitest run --maxWorkers 1 tests/preview/status-read-cost.test.ts
```

1600 records produce approximately 63 MB after compaction; 3200 produce 126 MB.
Random payloads make exact encrypted sizes vary. The generator also preserves the
uncompacted journal beside the compacted one. The measurement runner checks that
status leaves journal bytes unchanged. Remove the generated temporary directory
and pointer after collecting evidence.

`cpu` is child user plus system CPU seconds from `getrusage`, including the loader
thread; `wall` is monotonic elapsed seconds. Phase values in stderr are microseconds
from `process.cpuUsage`, and include CPU used by other threads in the same process.
`startupCPU` covers loader startup, TypeScript cache/transform and module initialization
through entry to the status branch. `decode` includes `decrypt`, `decompress` and
`frameJSON`: do not add these nested counters to the total. `snapshotParse` is the
streaming snapshot JSON parser, `restore` is projection restoration, and `replay`
is projection of ordinary frames (absent for a snapshot without an appended suffix).
The residual includes snapshot base64 conversion/digest checks, garbage collection,
status rendering and process teardown. Instrumentation refuses a missing source match.

`--plain` omits instrumentation and supplies a control for its overhead. `--runs N`
changes the number of reads. To measure uncached compilation, set
`INSTAR_SLICE_TS_CACHE=off` on a single run; do not compare that with warm-cache reads.
The equality test freezes both clock inputs for comparison; timing runs use real clocks.

The 2026-11-12 M5 Pro profile at base d1823a36 is in
`reviews/status-read-cost-1112-change-review.md`. No claim of a live Studio
performance fix or non-linear history scaling is made.
