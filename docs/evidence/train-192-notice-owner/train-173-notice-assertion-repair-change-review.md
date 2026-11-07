# Change review — train-173 pipeline notice assertion repair

Subject base: 9cf2e24c3aa9d0929915327ed28fbb5ddc3d159c
Review state: open
Reviewed content: none
Outcome: Both launcher test readers recognize the shipped activation-expiry notice while preserving exact answers and refusing unrelated appended text.
Affected rules: 26, 34, 36, 37, 49, 70, 74, 95, 100, 101, 107, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing runtime enforcement; this change edits only test assertions.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Corrects two stale test-only readers; no prompt, provider, runtime parser, policy, declaration or effect path changes.
Side effects: The helpers now accept the current activation label with the exact renewal action instead of the obsolete internal credential label. The existing model-route notice branch remains. Captured-line controls also reject unrelated suffixes and a substituted action. All existing answer, review outcome, call count and journal assertions remain.
Undo and recovery: Revert this commit to restore the previous test readers; no runtime state needs repair or migration.
Multi-machine posture: Test execution is machine-local; the assertion repair travels in git. No new state, coordination or ownership behavior.
Layer below: Read credentialNotices and remainingText in tests/preview/credential-reminders.ts, credentialDisplayLabel in tests/preview/credential-display.ts, and the existing activation-display and reminder tests. Reviewed vitest.config.ts, tests/setup/yield-worker.mjs, scripts/test-child.mjs and docs/defects/vitest-worker-rpc-timeouts.md for the separate unattributed runner errors.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing text or model-output parser changed. Literal reminder text is captured test evidence from the supplied Studio gate; the negative examples test the assertion helper only and are never submitted to a model.
Decision: notice-assertion | Replace the stale credential-label expectation with the actual activation notice and exact renewal action, preserving the separate model-route branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md
Decision: runner-evidence | Preserve the existing open runner defect and report the two unattributed RPC errors without inventing a starving file, increasing timeouts or changing global scheduling. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-173-repair-PROGRESS.md

1.x comparison: Searched actual JKHeadley/instar main 4e38b9fdaae43b62940a6a43e1e69094d1b91bd1 src/ and docs/specs/ for activation expiry, credential reminders and worker RPC symptoms. Inspected src/monitoring/MissingLoginSessionDetector.ts, src/core/hostTestRunnerSemaphore.ts, docs/specs/scrape-fixture-realness.md and docs/specs/test-runner-concurrency-bound.md, plus history ff8344b4b, ab26b7ca3, 618560b3e7c25cc0868577c1a0f1a9b1cbac83a2, c91b8780e1a6981fa7f21fb9dc1dcfc16d3cddaa and 1f90fa1a997713327ed61a6b36b586afdaf52a8f. ONEX-LESSONS.md sections 4 and 6 cover captured fixture realness and bounded test concurrency. These offer missing-login signals and host suite admission, not a matching 2.0 activation-notice assertion; no code transplant fits. Reused the captured-byte verification discipline and bounded targeted execution; retained 2.0's existing credential rendering unchanged.

Evidence: The supplied Studio gate at 9cf2e24c recorded six journal-agent failures and two canary failures. Both exact captured reminder lines (6 days 23 h and 6 days 22 h) fail the old matchers and pass the repaired matchers; an unrelated suffix fails both repaired matchers. Permanent controls exercise each answerOf helper. The original red gate and its two unattributed onTaskUpdate errors remain evidence; the existing runner defect stays open and the automatic pipeline owns full-run qualification. No fresh full report is asserted or fabricated.

Validation: `nice -n 10 npm run typecheck` exited 0. `nice -n 10 npx vitest run --maxWorkers 1 tests/preview/journal-agent.test.ts tests/preview/review-layers-canary.test.ts` exited 0: 2 files and 24 tests passed in 110.17 seconds, no runner errors. This does not close the original full-run RPC defect. Diff whitespace checks passed. Final post-commit cheap-check and push evidence is recorded in the absolute repair PROGRESS file.

simplestRobustRoute: This is the simplest robust route: correct the two stale test readers to match existing shipped rendering, with captured positive and invalid negative controls. No production mechanism, timeout, skip or gate is added. Test isolation guards entry, exact answer and notice checks guard results, and the existing pipeline decides full acceptance.
80/20: Repair all eight named assertion failures at their shared source; preserve the already-owned runner uncertainty without speculative changes or a full suite on this machine.
VERDICT: author submission; no independent convergence claimed
