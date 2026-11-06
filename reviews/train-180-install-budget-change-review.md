# Change review — Align the install fixture deadline with its child bound

Subject base: 50a2c78714bdb98d3a39d7da811c477765100f24
Review state: open
Reviewed content: none
Outcome: The real npm-install test allows its already-bounded child to settle and migrations to finish before the runner starts fixture cleanup.
Affected rules: 37, 55, 60, 70, 74, 113, 116
Affected floors: secrets — no changes; spend cap — no calls or changes; stop — no changes; no duplicate sends — no send path; durable intake — no changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A finite per-case test timeout corrects the mismatch with its existing production child deadline; no product or suite-wide timeout changes.
Side effects: A slow real-install fixture can run up to 360000ms instead of 120000ms. Cleanup remains separately bounded at 120000ms. All assertions, actual npm installation, loader and migration coverage remain enabled. The extra minute above the child's five-minute cap covers migration and activation work.
Undo and recovery: Revert this test deadline and comment change. No production state is modified by the repair. Reverting restores the shorter parent deadline that can race install completion and fixture cleanup under load.
Multi-machine posture: Machine-local test runtime and scratch only; no cross-host writes or shared state. The pipeline still owns fresh full-gate qualification on its specified hosts.
Layer below: scripts/update.mjs install uses spawnSync npm with timeout 300000, then updateRoot imports and awaits installed migration workers before activation. A test timeout at 120000 can expire while this real child/continuation is still active. Vitest deadlines do not cancel arbitrary test promises. Test setup and cleanup must leave the bounded installer time to settle.
Bug class: unit
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none; core.hooksPath unset and only sample git hooks installed; mandatory checks run explicitly.
Convergence: none
Decision: train180-install-budget | Set only the real npm fixture to 360000ms, matching the existing 300000ms installer child cap plus migration/activation allowance; preserve 120000ms awaited cleanup and semantic assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-120119-PROGRESS.md

Subject (1 path): tests/preview/mcp-setup.test.ts

1.x comparison: Inherit this repair's searched actual JKHeadley/instar main 30b3046ca47869ef1867b357c56b84b1e3f0d2fe comparison in reviews/train-180-repair-120119-change-review.md: src/core/UpdateChecker.ts applyUpdate/execAsync, tests/unit/update-checker-apply.test.ts and history 41bda81c0, docs/specs/test-runner-concurrency-bound.md and history 618560b3e7c25cc0868577c1a0f1a9b1cbac83a2, docs/specs/TESTING-INTEGRITY-SPEC.md and ONEX-LESSONS section 6. Bounded child execution fits; mocked npm unit fixtures do not replace this real installed-loader/migration proof.

Evidence: The first local run passed the real install/cleanup in 64613ms but cold CLI setup reached its separate 30000ms bound. After warming only onboarding through the shipped loader, the second local run passed CLI setup (28886ms), but the installer case exceeded 120000ms and cleanup reported ENOTEMPTY while the timed-out continuation was still active (case total 202519ms). CPU idle was measured at 0.8% on this saturated host. Both red runs remain recorded; no claim that repeating alone repairs them. This explicit parent/child deadline correction follows that second failure. The supplied M5Pro full gate stays red pending pipeline qualification.

## Closing block

simplestRobustRoute: Match the fixture's finite deadline to the already-bounded operation it exercises, retaining the real install and awaited cleanup. This is the simplest route; no mocks, retries, skip, global timer change or additional cleanup framework. Start is a fresh temporary install, end is installed migrations and activation checked by the existing assertions, and the limit is 360000ms followed by 120000ms cleanup. No autonomous-product completion claim.
80/20: Correct the demonstrated parent/child deadline mismatch in the same named failing test file. Preserve inherited product review obligations and leave fresh full-gate qualification to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
