# Change review — merge live repairs into train-188 without losing either behavior

Subject base: 8931c39ddab2a2f54aed09973453e90e4fcc6f80
Review state: open
Reviewed content: none
Outcome: Resolve the refused merge of live add5d7587 into train-188, preserving asynchronous crash recovery, narrow activation-notice assertions, live resource-owner recovery, mobile dashboard work and both defect histories.
Affected rules: 26, 36, 37, 44, 60, 61, 66, 74, 95, 101, 102, 112, 113, 116.
Affected floors: secrets — existing custody and output boundaries retained; spend cap — existing limits retained; stop — independent three-second signal assertion retained; no duplicate sends — exact recovery assertions retained; durable intake — all crash cuts and uncertainty checks retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration includes existing resource ownership and launcher changes. Conflict resolutions alter tests and evidence only; the desk retains full integration acceptance.
Side effects: Retains the shipped TypeScript loader instead of reintroducing Vite servers per crash boundary. The signal lifecycle case retains the incoming cumulative 210s budget for six 30s children plus boot, without changing the independent 3s signal ceiling. Preserves newer catalog evidence and original conformance certificate pending Studio qualification.
Undo and recovery: Revert this merge against its first parent and regenerate publication from the resulting source. Preserve journals, prior failure records and both parent histories; no live service is changed.
Multi-machine posture: Repository changes travel across hosts; foreground targeted verification is local to the Laptop. Native conformance and final full-run acceptance belong to the Studio. No peer state or authority is introduced.
Layer below: Read both governing documents from origin/main aa8cbc934, both parent diffs and repair histories, async-child runner, credentialNotices display-label producer, production catalog evidence, source publication tooling and the 1.x test-runner contract.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No new model prompt, response parser or accept/escalate/refuse decision. Preserve captured activation notice from the existing train-173 Studio gate at 9cf2e24c and its positive/negative controls. Imported live runtime work retains its original owner records; this repair claims no new live replay.

Subject (29 paths): docs/defects/vitest-worker-rpc-timeouts.md, docs/release-evidence/train-181-register-repair-report.md, docs/release-evidence/train-187-codex-catalog-2026-11-05.json, scripts/check-dashboard-floors.mjs, scripts/operator-dashboard-readonly.mjs, scripts/operator-dashboard.mjs, scripts/resource-owner.mjs, tests/assembly/production-provider-subscription.test.ts, tests/e2e/harness-adapters-round7-regression.test.ts, tests/e2e/model-provider-path.test.ts, tests/e2e/register.test.ts, tests/integration/model-provider-reply.test.ts, tests/integration/resource-owner-partial.test.ts, tests/integration/telegram-poll-concurrency.test.ts, tests/model-provider/crash-worker.mjs, tests/model-provider/fixture.ts, tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-cutover-harness.mjs, tests/preview/native-loop.test.ts, tests/preview/operator-dashboard-mobile.test.ts, tests/preview/operator-dashboard.test.ts, tests/preview/operator-dashboard.ts, tests/preview/review-layers-canary.test.ts, tests/preview/tool-turn-replay.test.ts, tests/preview/tool-turn.test.ts, tests/preview/two-machine-runner.test.ts, tests/preview/two-machine-world.ts

1.x comparison: Searched actual JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a src/ and docs/specs/ for worker timeout, RPC timeout and policy cache; inspected history 618560b3e, c91b8780e and 681f86543. Read src/core/hostTestRunnerSemaphore.ts and docs/specs/test-runner-concurrency-bound.md, plus Studio ONEX-LESSONS.md section 6. Reuse its bounded-concurrency and truthful-outcome principles, not a second limiter: there is no direct implementation fit for these Git conflicts. Existing 2.0 owners already supply the repaired behavior.

Decision: train-188-merge-tests | Keep the shipped async TypeScript-loader crash tests and add the live branch three-observation assertion; retain cold-start control, process-exit-aware wait and incoming async status/resume/stop children with their cumulative budget. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-070058-PROGRESS.md
Decision: train-188-merge-notices | Keep the exact activation-label matcher and rejection controls from e7f0d6; the current producer uses displayLabel, so the old raw credential exception is obsolete and needlessly broad. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-070058-PROGRESS.md
Decision: train-188-merge-evidence | Preserve both defect narratives and original cache review attribution/replay history; keep the later measured catalog timestamps without inventing fresh verification. Native byte-bound certification remains Studio-owned. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-070058-PROGRESS.md
Decision: train-188-merge-publication | Use delegated owner rehash, support repin and register replay for merged bytes; never hand-edit hashes or certify an unrun native composition. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-188-repair-070058-PROGRESS.md

Publication: Delegated owner rehash refreshed one preview test pin; support repin changed none. Replayed 299 entries, 122 rules and 34 terms from 3cf63d1cfcd2397ccd7ca359dd864ec435de502d, generation sha256:5328e71962624f3310ac3751443b479ccdb4c076de4070b771f1332b714c53fa. This record covers the merge, source-pin and generated-publication commits.

## Closing block

simplestRobustRoute: Merge the existing repairs, resolve only overlapping intentions, and regenerate derived artifacts with the delegated tools. This is the simplest robust route; no new machinery. Existing resource caps, stop, profile, effect and intake guards remain.
80/20: Typecheck/build, the three conflict-resolved test files and cheap publication/review checks; the Studio owns full-run acceptance. No full suite or load generator.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
