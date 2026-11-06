# Change review — register CLI worker progress and bounded assertion groups

Subject base: cfa082fed741515dc7534890045ff29725a00da0
Historical live integration base: a8771b2cae58f88db9ab1b49226881ce266b402d (preserved from add5d758; the subject base above retains candidate coverage).
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
Prompt review: The merged subject includes tests/preview/journal-agent.mjs and tests/preview/operator-dashboard.ts. Reviewed the fixture-trigger and neutral-dispatch boundary: the journal merge adds dashboard machine/activity projection while retaining the candidate commitment and delivery-recovery wiring; dashboard text is rendered operator status, not a new model judgment prompt. No fixture answer, expected verdict or trigger phrase is added to a model instruction, and no dispatch is given an expected conclusion. Existing prompt behavior and its parent evidence remain unchanged by this merge.
Decision: t181g-async | use the existing async child helper at all six remaining CLI/wiring sites, including the malformed-source matrix, so completed child work cannot freeze the worker reporting channel | reported=docs/release-evidence/train-181-register-repair-report.md
Decision: t181g-groups | split the defaults, bridge and malformed-source assertions into isolated fresh groups while retaining each deadline and every original assertion, avoiding a growing batch beneath one timer | reported=docs/release-evidence/train-181-register-repair-report.md
Decision: t181g-handshake | use an actual CLI preload awaiting a parent-written permit, with a refusing unreleased neighbor, to demonstrate event-loop progress without host load | reported=docs/release-evidence/train-181-register-repair-report.md

Decision: t181g-bound | pass the enclosing case timeout to asynchronous children, preserving a finite child lifetime previously supplied by the synchronous test wrapper | reported=docs/release-evidence/train-181-register-repair-report.md

1.x comparison: actual JKHeadley/instar origin/main 9b5790e8105f94c8ad6f13243d063e7c7efd23b6: src/core/WorktreeManager.ts uses promisified execFile for asynchronous subprocess work; src/core/InstarWorktreeManager.ts prepare and platform-copy paths still use synchronous operations. docs/specs/test-runner-concurrency-bound.md and ONEX-LESSONS section 6 require host-scope concurrency bounds, separate from worker responsiveness. Inspected worktree history b227aed93/5143e436f/6fb1db837 and limiter history 618560b3e/c91b8780e/681f86543. Fit is asynchronous child orchestration and bounded physical work; the worktree/semaphore subsystem does not implement register lifecycle fixtures. Reuse tests/e2e/async-child.ts whole, with no new runner or copied unrelated worktree behavior.

Evidence: the retained READY run reports 118 passed, two failed, one RPC error over eight files in 797.73s. An isolated unchanged run passed in 114.41s (82.391s defaults, 30.560s bridge); that is timing evidence, not Rule 37 exoneration. The defect record distinguishes the concrete remaining synchronous path from attribution of the untraced RPC error. Final validation is in the committed report and absolute lanes progress record.

Integration note: train-187 imports owning repair 99db9a0967837d7d10527c457263b50383464952. Its test file is byte-identical; only this review base is rebound. The release-evidence report describes the owner's historical run, not train-187 validation. The defect merge preserves train-171 history and adds only the owner commit's READY-gate section; its unrelated parent peer repair is not imported. Current metadata renewal and verification are described in reviews/train-187-register-gate-repair.md.

Import provenance: complete owner repair 99db9a0967837d7d10527c457263b50383464952, originally based on 995b147a436d9ad67b443e85c8bed64c902046bf. Subject base rebound to the train-175 integration parent; historical train-181 evidence below remains historical.

## Closing block

simplestRobustRoute: complete the existing asynchronous child conversion and separate independent assertion groups without changing the production checker or weakening its comparisons.
80/20: one test file, existing helper, fresh bounded fixtures, all prior positive and negative assertions retained, and two actual-child progress controls.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
