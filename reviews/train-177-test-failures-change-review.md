# Change review — train-177 activation notice and crash-matrix repair

Subject base: 1cdebb160e9bdc97690fee8043a25e227e4973a7
Review state: open
Reviewed content: none
Outcome: Restore the two launcher assertions for the shipped activation reminder and remove aggregate blocking from the round-seven filesystem crash matrix without weakening its uncertainty, refusal or successor checks.
Affected rules: 26, 34, 37, 49, 56, 60, 70, 74, 95, 100, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — custody and outbound checks unchanged; spend cap — accounting unchanged; stop — cancellation unchanged; no duplicate sends — all effect ownership unchanged; durable intake — journal and admission unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Test infrastructure, generated pins and reuse of the existing model-map evidence renewal; no model selection, prompt or runtime authority change.
Side effects: Nine crash cuts and their positive control become ten separately reported tests; each cut retains a 60-second case ceiling and each child retains its 30-second bound. The other round-seven cases now await the same existing asynchronous helper, including two concurrent readers with finite bounds. Torn-state reconstructions and the twelve poison history/loss combinations are separately reported; beforeAll seeds each original cut once, preserving its shared durable history and every assertion. Each child remains bounded to 30 seconds. Both launcher helpers accept the exact shipped activation notice while still rejecting unrelated appended text or a changed action. Existing model-route and credential alternatives are preserved.
Undo and recovery: Revert this repair and regenerate the register (reverting the model-map renewal restores the expired-entry refusal); no live state, migration or rollback protocol is involved. Keep the original failed gate and its findings recorded.
Multi-machine posture: Test execution and temporary journals are deliberately machine-local. The same source travels through Git; no runtime cross-machine state changes.
Layer below: tests/preview/credential-reminders.ts remainingText/credentialNotices; credential-display.ts; journal-agent.mjs activation registration; tests/e2e/async-child.ts spawn, close and finite timeout behavior; slice-p13-state-storage.mjs; both existing round-seven worker programs and their real process cuts. The existing RPC defect history distinguishes host starvation from synchronous child starvation.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent.test.ts; other=tests/preview/review-layers-canary.test.ts; other=tests/e2e/harness-adapters-round7-regression.test.ts
Hook bypass: none
Convergence: none
Prompt review: No model prompt, response parser or accept/escalate/refuse path is changed. Recorded model-output replay is not required for this test-only change; real launcher assertions still exercise the original review paths.

1.x comparison: Searched actual JKHeadley/instar origin/main bc4355b8075dad89e8667ab082c526c0460b0455 src/ and docs/specs/ for credential/activation expiry, spawnSync, onTaskUpdate and test semaphores, with git history. src/core/overloadSelfHelp.ts (history c667d0cb5537b5548ce7e5a2833ba2f4261fc8f5) uses bounded asynchronous children so an overloaded event loop remains responsive; docs/specs/test-runner-concurrency-bound.md and history 1f90fa1a997713327ed61a6b36b586afdaf52a8f distinguish host suite admission from targeted tests. Reuse that asynchronous-child design via the already-landed tests/e2e/async-child.ts. No new semaphore or runtime code is needed. Exact `your activation expires` searches in main src/, docs/specs/ and their -S history have no match; this rendering and its stale test matcher are 2.0-specific. Read ONEX-LESSONS.md section 6: physical concurrency, actual assembly evidence and preservation of protection. Original reaper/browser carryover comparisons and accepted completion limits remain in the existing train records.

Decision: test-shapes | Add only the fixed activation reminder alternative and positive/negative matcher controls; preserve the exact underlying answer checks. | reported=reviews/train-177-test-failures-change-review.md
Decision: async-cuts | Split independent cuts and reconstruction combinations into per-case tests and reuse the existing bounded asynchronous child helper throughout the file; retain the existing child deadlines; individual reconstruction cases use the same 60-second ceiling as append cuts, replacing aggregate 30/60-second ceilings. The unattributed RPC error remains subject to full-gate verification. | reported=reviews/train-177-test-failures-change-review.md

Decision: retained-red | The first targeted run passed 38 and failed 7: all nine original cuts and the control passed, but the asynchronous conversion exposed aggregate torn/poison deadlines; launcher polling/status children also exceeded bounds. Preserve that log, split the remaining independent reconstruction steps, and rerun the changed files. | reported=reviews/train-177-test-failures-change-review.md
Decision: owner-evidence | Current register replay refused the Codex model-map evidence expired at 2026-11-06T03:35:59.351Z. Reuse the exact declaration and sanitized catalog observation from existing owning commit 5eefd6fd921cb93fb3f241a152bd71b76302b9a2, as already reused by train-190, without its unrelated register-test changes. No new verification timestamp is invented; model, estimated subsidy and freshness durations stay unchanged. | reported=reviews/train-177-test-failures-change-review.md
Decision: repin | Run the delegated owner-manifest rehash and chain scripts, commit source, replay the register, and commit generated outputs. No pin is hand-edited. | reported=reviews/train-177-test-failures-change-review.md

Inherited renewal comparison: the owning reviews/train-187-register-gate-repair.md at 5eefd6fd921cb93fb3f241a152bd71b76302b9a2 records actual JKHeadley/instar main 79d83ec93a399c0cd5896871e3e8e29d83d3fc5c, src/core/DoorwayRegistryReader.ts, src/scaffold/templates/jobs/instar/doorway-scan.md, docs/specs/doorway-scan-real-run.md, histories 35b02553b/269da957b and ONEX-LESSONS section 6. Reuse its distinction between catalog knowledge and observed reachability. The exact imported docs/release-evidence/train-187-codex-catalog-2026-11-05.json proves only catalog presence at 2026-11-06T03:40:55.257112Z, not model inference, liveness, account identity or measured pricing. Rule 56 current stale/future checks remain unchanged.

Register replay: Source e673e8d8c4d349374ee63684dd33ab3745c95901 generated sha256:8a386492dcc5aabf045c5d39238ad2e63d9a548b1bc97d3927afa0db97f3fb0f, 298 entries and 121 Rules, shape-only replay authority. Source test reference hashes were regenerated by the delegated desk script.

Verification: Parent matcher replay rejects the exact supplied notice in both files; repaired matcher replay accepts it. An injected 150 ms sleeping child permits event-loop heartbeats, while status 7 and SIGTERM timeout remain failures. Typecheck passed. Targeted command: nice -n 10 npm run typecheck; nice -n 10 npx vitest run --maxWorkers 1 on the three changed test files; final committed-head npm run lint, npm run register:check, node scripts/check-change-review.mjs check, and git diff --check. Actual results are appended to /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-PROGRESS.md. Full-suite qualification belongs to the Studio pipeline; no old report is relabelled.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the exact test matcher and reuse asynchronous child execution with separately bounded independent cases. Start guards are the assigned head and preserved fixture identity; completion guards are unchanged crash/refusal/success assertions, targeted tests, cheap gates and pushed clean state. All five floors remain intact. No autonomous product completion is claimed.
80/20: Correct the two observed test causes without new runtime machinery or quarantine. The independent desk decides acceptance and the pipeline supplies full-gate qualification.
VERDICT: author submission; this record asserts no independent verdict.
