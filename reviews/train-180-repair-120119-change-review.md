# Change review — Await bounded cleanup of the real MCP install fixture

Subject base: 632ae713c43d29419e575a8807222bee510a9935
Review state: open
Reviewed content: none
Outcome: The real npm-install MCP proof awaits removal of its installed release and isolated cache within an explicit two-minute cleanup budget, without blocking the worker event loop during recursive removal.
Affected rules: 37, 60, 70, 74, 113, 116
Affected floors: secrets — unchanged, test-only opaque fixtures remain isolated; spend cap — no model calls; stop — no changes; no duplicate sends — no send path changes; durable intake — no changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Local test-fixture cleanup only; installer, migrations, semantic assertions and production behavior are unchanged.
Side effects: Only this file's cleanup hook uses the larger finite budget. A stuck removal fails at 120000ms instead of 10000ms. Removal errors still reject the hook. Roots are processed sequentially and awaited, so cleanup is not detached and no pool of concurrent root removals is introduced.
Undo and recovery: Revert the test cleanup edit; the original synchronous hook and its default timeout return. No production state, migration or installed configuration changes.
Multi-machine posture: Deliberately machine-local scratch disposal on whichever host runs this test; source travels through git. WSL targeted verification is not a replacement for the pipeline's M5Pro full gate.
Layer below: scripts/update.mjs install/updateRoot stage a real npm package and run installed migrations; the fixture owns both installation and isolated npm cache. Vitest 3.2.7 chunk-hooks.js withTimeout checks synchronous elapsed time and defaults hooks to 10000ms; tests/setup/yield-worker.mjs yields between tests but cannot make rmSync yield during a large removal. Node asynchronous rm preserves recursive/force semantics while allowing worker I/O.
Bug class: unit
Bug evidence: reproducer=tests/preview/mcp-setup.test.ts
Hook bypass: none; core.hooksPath is unset and the common git hooks directory contains sample hooks only, not installed commit/push guards. Required checks run explicitly.
Convergence: none
Decision: train180-mcp-cleanup | Await sequential asynchronous disposal of owned temporary roots with the real install case's finite 120000ms budget; preserve the real consumer proof and every assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-120119-PROGRESS.md

Decision: train180-cli-prewarm | Preserve the first targeted run as red evidence; warm the actual onboarding import through the shipped loader before retesting, matching the gate cache precondition without broad tests or a CLI deadline change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-180-repair-120119-PROGRESS.md

Subject (1 path): tests/preview/mcp-setup.test.ts

1.x comparison: Searched actual JKHeadley/instar main 30b3046ca47869ef1867b357c56b84b1e3f0d2fe src/, docs/specs/ and git history for npm install, cleanup and hook timeouts. Inspected src/core/UpdateChecker.ts applyUpdate/execAsync, tests/unit/update-checker-apply.test.ts (history 41bda81c0), docs/specs/test-runner-concurrency-bound.md (history 618560b3e7c25cc0868577c1a0f1a9b1cbac83a2), docs/specs/TESTING-INTEGRITY-SPEC.md and authenticated ONEX-LESSONS.md section 6. Reuse bounded resource use and real-consumer verification discipline. The 1.x unit test mocks npm and removes a small fixture synchronously; transplanting that fixture would remove the 2.0 installed-package/loader/migration proof. Keep this existing fixture and correct its cleanup boundary.

Failure evidence: The supplied authenticated M5Pro gate at the subject base reports one failure, the production npm-install case in this file, at afterEach line 19: Hook timed out in 10000ms. The case body already has 120000ms. No assertion failure is reported for that case. The original full-gate result remains red until the pipeline requalifies the repaired head; targeted success does not replace that record. The inherited round-2 product review and its open CB6-MF-A, CB7-R90 and CB1-MF5 obligations are unchanged by this repair.

Local validation observation: After npm ci, the first isolated run had 19/20 passes, including the repaired install case (64613ms), and an unchanged CLI setup child reached its 30000ms deadline. The host load assessment reported 2.8% CPU idle/SATURATED. Unlike the full gate, that run omitted loader-cache warming. The shipped loader documents roughly 20 CPU-seconds for a cold graph; importing scripts/onboarding.mjs through that loader prepares only the failing child graph without invoking setup. This timing observation is retained, not erased by a subsequent pass.

## Closing block

simplestRobustRoute: Keep the real install test and use the existing asynchronous filesystem removal API with a finite hook budget matching that fixture. This is the simplest robust route: no global timeout change, quarantine, detached cleanup, mocked installer, new runner or production change. Start is owned temporary roots, completion is awaited removal, and the limit is 120000ms with errors propagated. This is a test repair, not an autonomous-product completion claim.
80/20: One observed cleanup-boundary failure receives one local repair. All semantic assertions remain; broader suite qualification belongs to the existing pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
