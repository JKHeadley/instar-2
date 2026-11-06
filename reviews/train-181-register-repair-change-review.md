# Change review — register CLI worker progress and bounded assertion groups

Subject base: a8771b2cae58f88db9ab1b49226881ce266b402d
Review state: open
Reviewed content: none
Outcome: remove the remaining synchronous CLI/wiring calls from the register lifecycle test and give independent assertion groups fresh fixtures and their existing case deadlines; prove parent-worker progress with an actual CLI barrier.
Affected rules: 37, 55, 60, 61, 70, 74, 101, 102, 107, 116
Affected floors: secrets — only offline fixtures; spend cap — no model calls or accounting changes; stop — no runtime change and existing child ownership retained; no duplicate sends — no effect or retry implementation changes; durable intake — committed-source and retained-output assertions remain exact.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test orchestration and repair evidence only; no runtime, owner, register source, constitution, prompt or acceptance behavior changes.
Side effects: the defaults case becomes three independently initialized groups with at most four CLI calls, keeping 120s each; the bridge case becomes four groups with at most two CLI calls, keeping 60s each. The nineteen-build malformed matrix becomes three fresh groups with at most nine builds and the same 300s bound after its retained local timeout. Two extra positive builds prepare the isolated clean and ambient wiring groups. No assertion is removed and no case is quarantined.
Undo and recovery: revert this test/evidence change; no installed artifact or journal is changed. Retain the desk red and open RPC record if replacing the repair.
Multi-machine posture: host-local test workers and temporary Git repositories; actual clone comparisons remain, without claiming two-host operation.
Layer below: Node spawnSync blocks the worker event loop while a CLI child works; the existing runChild spawn/close promise services worker RPC. Independent complete CLI builds were aggregated beneath one test timer.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Decision: t181g-async | use the existing async child helper at all six remaining CLI/wiring sites, including the malformed-source matrix, so completed child work cannot freeze the worker reporting channel | reported=docs/release-evidence/train-181-register-repair-report.md
Decision: t181g-groups | split the defaults, bridge and malformed-source assertions into isolated fresh groups while retaining each deadline and every original assertion, avoiding a growing batch beneath one timer | reported=docs/release-evidence/train-181-register-repair-report.md
Decision: t181g-handshake | use an actual CLI preload awaiting a parent-written permit, with a refusing unreleased neighbor, to demonstrate event-loop progress without host load | reported=docs/release-evidence/train-181-register-repair-report.md

Decision: t181g-bound | pass the enclosing case timeout to asynchronous children, preserving a finite child lifetime previously supplied by the synchronous test wrapper | reported=docs/release-evidence/train-181-register-repair-report.md

1.x comparison: actual JKHeadley/instar origin/main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6: src/core/WorktreeManager.ts uses promisified execFile for asynchronous subprocess work; src/core/InstarWorktreeManager.ts prepare and platform-copy paths still use synchronous operations. docs/specs/test-runner-concurrency-bound.md and ONEX-LESSONS section 6 require host-scope concurrency bounds, separate from worker responsiveness. Inspected worktree history b227aed93/5143e436f/6fb1db837 and limiter history 618560b3e/c91b8780e/681f86543. Fit is asynchronous child orchestration and bounded physical work; the worktree/semaphore subsystem does not implement register lifecycle fixtures. Reuse tests/e2e/async-child.ts whole, with no new runner or copied unrelated worktree behavior.

Import provenance: complete owner repair 99db9a0967837d7d10527c457263b50383464952, originally based on 995b147a436d9ad67b443e85c8bed64c902046bf. Subject base rebound to the train-175 integration parent; historical train-181 evidence below remains historical.

Evidence: the retained READY run reports 118 passed, two failed, one RPC error over eight files in 797.73s. An isolated unchanged run passed in 114.41s (82.391s defaults, 30.560s bridge); that is timing evidence, not Rule 37 exoneration. The defect record distinguishes the concrete remaining synchronous path from attribution of the untraced RPC error. Final validation is in the committed report and absolute lanes progress record.

Integration note: train-186 imports owning repair 99db9a0967837d7d10527c457263b50383464952 via 5eefd6fd921cb93fb3f241a152bd71b76302b9a2. At that import the test file was byte-identical and the base was daa95de2266ae83b359ef7758bbc2c040b52419d; subsequent cumulative-batch repairs remain in the merged test. The release-evidence report describes the owner's historical run, not train-186 validation. That historical defect merge appended only the owner's READY-gate section. Current metadata renewal and verification are described in reviews/train-186-register-gate-repair.md.

Skip: tests/preview/hub-recorded.test.ts:45 | scope=Inherited private actual-provider capture replay requires INSTAR_HUB_CAPTURE_ROOT and hash-verified bytes. Absence visibly skips and cannot certify the model-facing path; this merge adds no skip and claims no fresh capture replay.
Prompt review: The merge carries existing source changes through their owning review records; this record originally covered test orchestration only. No fixture-trigger or expected-answer rule is added by the conflict resolution, and no dispatch is rewritten to suggest a verdict. Existing tool inventory and doorway guidance remain general capability/authority statements, not user-intent classifiers.

## Closing block

simplestRobustRoute: complete the existing asynchronous child conversion and separate independent assertion groups without changing the production checker or weakening its comparisons.
80/20: one test file, existing helper, fresh bounded fixtures, all prior positive and negative assertions retained, and two actual-child progress controls.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
