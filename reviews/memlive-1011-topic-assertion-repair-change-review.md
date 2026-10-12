# Change review — align topic packet regression with compact memory guidance

Subject base: dfd853e30a22f920725781106d824c05431851b9
Review state: open
Reviewed content: none
Outcome: Repair the stale private-chat scope assertion while retaining the historical packet digest and the current memory protocol checks.
Affected rules: Rules 36, 37, 49, 70, 74, 101, 111, 112, 113 and 116; purpose ability principle.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test assertion and explanatory comment only; no runtime behavior changes.
Side effects: The test now accepts the compact scope guidance introduced by c010fd84. It still fails when scope guidance is absent, and still verifies remember mode, memory shape, absence of forum fields in private packets, and the exact historical digest for all other packet bytes.
Undo and recovery: Revert this assertion-only commit; no state or schema migration.
Multi-machine posture: Machine-local fixture execution only; runtime ownership, journal replication and audience boundaries are unchanged.
Layer below: Inspected c010fd84 and the current journal memoryDecision construction. The duplicate sentence was deliberately consolidated to preserve recall packet capacity; reverting the runtime prompt would reintroduce the earlier budget regression. Historical packet normalization remains unchanged and its digest passes.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Decision: align-scope-assertion | Check the current cross-topic/restart sentence instead of restoring redundant runtime prose. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/memlive-1011-repair-PROGRESS.md
Verification: Reproduced 10 passing tests and one failure before the edit. Foreground nice -n 10 vitest run tests/preview/topic-awareness.test.ts --maxWorkers 1 passes all 11 afterward, including captured topic updates 969390330 and 969390331 and both recorded subscription replies. Typecheck and build pass. No model-facing change or new model-proof claim. The requested saved gate report is absent; the desk progress record records final cheap checks and each attempted contract checker without fabricating a full-run report.

Subject (1 paths): tests/preview/topic-awareness.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: align one stale assertion with the deliberately compact guidance and retain all other checks. No machinery, runtime decision, capability limit or floor change. The required outcome is a passing regression test that still detects loss of cross-topic/restart guidance and unrelated private-packet changes.
80/20: The reported failure reproduces, the source assertion is repaired, all 11 neighboring tests pass, and the unchanged digest proves packet compatibility. Independent landing review and the full suite remain with the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
