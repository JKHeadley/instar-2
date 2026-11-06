# Change review — train-189 register gate repair

Subject base: 75047b028d4ed246a59a4bd52d456e16d4523be9
Review state: open
Reviewed content: none
Outcome: Preserve every register CLI positive and negative control while giving independent owner-binding and bridge matrices separate fixture deadlines.
Affected rules: 13, 26, 34, 37, 49, 60, 70, 74, 101, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake — unchanged production checkpoints; isolated fixture execution only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Reuses the existing owned test-only repair without changing product behavior, enforcement or assertions.
Side effects: Three owner-binding matrices and two bridge matrices independently initialize isolated temporary repositories. Additional fixture setup trades some total runtime for separate bounded cases. Bridge subprocesses use the existing asynchronous child helper so the worker can report progress.
Undo and recovery: Revert this repair commit; no installed service, live store or migration is changed. Preserve the desk failure and previous green evidence.
Multi-machine posture: Deliberately machine-local temporary repositories; shared test source travels through git with no new authority or durable state.
Layer below: The owner-binding test combined documentation mutations, decoder call mutations and artifact-pin mutations under one 120-second ceiling. The desk observed 120005 ms. The existing runNode helper yields child execution; the bridge case had retained blocking spawnSync calls. The owning repair splits the independent workloads, keeps every control and uses that existing helper.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompts, output parsing, acceptance decisions or model-facing behavior changes.

Decision: TRAIN189-GATE-OWNED | Reuse only the complete tests/e2e/register.test.ts patch from 944b258c3c248496ac7f4bed40a807d507eab649 and cc47685ea57621eb8710272982df34ed29d04dab; preserve all controls and the owned committed-bridge fixture budget. Supporting report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md, Pipeline repair — pinned-test child lifecycle. Acceptance is all five separated matrices plus the required final pinned gates. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-189-PROGRESS.md

1.x comparison: Inherits the train's scanner comparison and the owned fixture repair research. Independently inspected actual JKHeadley/instar main 154a09ffd44749ceac6205e4a95a9df4c56f4659: src/core/hostTestRunnerSemaphore.ts, docs/specs/test-runner-concurrency-bound.md, docs/specs/conformance-gate-timeout.md, path history 1f90fa1a9 / 618560b3e / c91b8780e / 681f86543 / e1a1b7218, and ONEX-LESSONS.md section 6. Fit: yielding waits and workload-specific deadlines retain evidence under contention. Mismatch: the host-wide 1.x scheduler does not implement the independent 2.0 register fixture lifecycle. Reuse the existing 2.0 async-child helper and owned test patch; no 1.x scheduler transplant.

Verification: Compare the complete test file byte-for-byte with cc47685ea57621eb8710272982df34ed29d04dab. Run all changed matrices and the remaining register cases in foreground chunks, typecheck/build, architecture/lint, register check, change-review check and the remaining pinned gate files. Final command outputs and durations are recorded in the cited progress file. Earlier green results do not override the desk's later red result.

## Closing block

simplestRobustRoute: Reusing the single owned repair is the simplest route. Independent matrices retain their existing assertions and 120-second fixture ceilings; asynchronous child waits keep the runner responsive. No scheduler, retry, quarantine or production timeout change is introduced. Isolated roots, exact pinned revisions, real CLI outcomes and fixture cleanup remain the start, end-state and limit guards.
80/20: Verify the affected test file and required final gates; keep the full suite and release switching with the desk.
VERDICT: author submission; independent review remains with the desk.
