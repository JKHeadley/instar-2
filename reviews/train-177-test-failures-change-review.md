# Change review — train-177 activation notice and crash-matrix repair

Subject base: 1cdebb160e9bdc97690fee8043a25e227e4973a7
Review state: open
Reviewed content: none
Outcome: Restore the two launcher assertions for the shipped activation reminder and remove aggregate blocking from the round-seven filesystem crash matrix without weakening its uncertainty, refusal or successor checks.
Affected rules: 26, 34, 37, 49, 60, 70, 74, 95, 100, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — custody and outbound checks unchanged; spend cap — accounting unchanged; stop — cancellation unchanged; no duplicate sends — all effect ownership unchanged; durable intake — journal and admission unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test infrastructure and test expectations only; no product code, prompt or authority change.
Side effects: Nine crash cuts and their positive control become ten separately reported tests; each cut retains a 60-second case ceiling and each child retains its 30-second bound. The other round-seven cases now await the same existing asynchronous helper, including two concurrent readers with finite bounds. Both launcher helpers accept the exact shipped activation notice while still rejecting unrelated appended text or a changed action. Existing model-route and credential alternatives are preserved.
Undo and recovery: Revert this test-only repair commit; no live state, migration or rollback protocol is involved. Keep the original failed gate and its findings recorded.
Multi-machine posture: Test execution and temporary journals are deliberately machine-local. The same source travels through Git; no runtime cross-machine state changes.
Layer below: tests/preview/credential-reminders.ts remainingText/credentialNotices; credential-display.ts; journal-agent.mjs activation registration; tests/e2e/async-child.ts spawn, close and finite timeout behavior; slice-p13-state-storage.mjs; both existing round-seven worker programs and their real process cuts. The existing RPC defect history distinguishes host starvation from synchronous child starvation.
Bug class: unit
Bug evidence: reproducer=The supplied train-177 gate at 1cdebb160 reports eight activation-notice assertion failures, the 66,411 ms nine-cut case exceeding 60,000 ms, and one unattributed onTaskUpdate timeout. This is test-harness repair; product behavior is unchanged.
Hook bypass: none
Convergence: none
Prompt review: No model prompt, response parser or accept/escalate/refuse path is changed. Recorded model-output replay is not required for this test-only change; real launcher assertions still exercise the original review paths.

1.x comparison: Searched actual JKHeadley/instar origin/main bc4355b8075dad89e8667ab082c526c0460b0455 src/ and docs/specs/ for credential/activation expiry, spawnSync, onTaskUpdate and test semaphores, with git history. src/core/overloadSelfHelp.ts (history c667d0cb5537b5548ce7e5a2833ba2f4261fc8f5) uses bounded asynchronous children so an overloaded event loop remains responsive; docs/specs/test-runner-concurrency-bound.md and history 1f90fa1a997713327ed61a6b36b586afdaf52a8f distinguish host suite admission from targeted tests. Reuse that asynchronous-child design via the already-landed tests/e2e/async-child.ts. No new semaphore or runtime code is needed. Exact `your activation expires` searches in main src/, docs/specs/ and their -S history have no match; this rendering and its stale test matcher are 2.0-specific. Read ONEX-LESSONS.md section 6: physical concurrency, actual assembly evidence and preservation of protection. Original reaper/browser carryover comparisons and accepted completion limits remain in the existing train records.

Decision: test-shapes | Add only the fixed activation reminder alternative and positive/negative matcher controls; preserve the exact underlying answer checks. | reported=reviews/train-177-test-failures-change-review.md
Decision: async-cuts | Split independent cuts into per-cut tests and reuse the existing bounded asynchronous child helper throughout the file; avoid adding a runner protocol or increasing a deadline. The unattributed RPC error remains subject to full-gate verification. | reported=reviews/train-177-test-failures-change-review.md

Verification: Parent matcher replay rejects the exact supplied notice in both files; repaired matcher replay accepts it. An injected 150 ms sleeping child permits event-loop heartbeats, while status 7 and SIGTERM timeout remain failures. Typecheck passed. Targeted command: nice -n 10 npm run typecheck; nice -n 10 npx vitest run --maxWorkers 1 on the three changed test files; final committed-head npm run lint, npm run register:check, node scripts/check-change-review.mjs check, and git diff --check. Actual results are appended to /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-PROGRESS.md. Full-suite qualification belongs to the Studio pipeline; no old report is relabelled.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the exact test matcher and reuse asynchronous child execution with separately bounded independent cases. Start guards are the assigned head and preserved fixture identity; completion guards are unchanged crash/refusal/success assertions, targeted tests, cheap gates and pushed clean state. All five floors remain intact. No autonomous product completion is claimed.
80/20: Correct the two observed test causes without new runtime machinery or quarantine. The independent desk decides acceptance and the pipeline supplies full-gate qualification.
VERDICT: author submission; this record asserts no independent verdict.
