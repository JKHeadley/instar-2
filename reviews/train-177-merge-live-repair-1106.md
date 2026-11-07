# Change review — train-177 merge live preserving asynchronous regression proofs

Subject base: 234b7faf1a6109e2ddba25f9d2a064e2621f645a
Review state: open
Reviewed content: none
Outcome: Merge live 79be7e88e into train-177 while preserving both defect histories and all regression assertions. Resolve overlapping asynchronous test repairs without reintroducing blocking child calls.
Affected rules: 34, 37, 55, 60, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets — offline fixtures only; spend cap — no added model calls; stop — explicit finite child timeouts retained; no duplicate sends — inherited behavior unchanged; durable intake — all crash and uncertainty assertions retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept suggested merge tier; new authored changes are test conflict resolutions and history preservation, with live product changes carried unchanged from their own reviewed commits.
Side effects: Boundary cases retain 30s child bounds and use the incoming 65s cumulative budget plus its exact three-observation assertion. Torn and poison cases retain train-177 independent bounds. Register bridge groups inherit owning repair 7b78ea242 via live: 120s cumulative bounds with explicit 60s child bounds. Preview cases retain train-177 per-launch bounds and both reminder forms. Generated artifacts are replayed, never hand-pinned.
Undo and recovery: Revert this merge with its first parent and regenerate the register through the same scripts; keep both source histories and retained red defect evidence. No installation state is migrated.
Multi-machine posture: Repository change shared identically across hosts; test execution and temporary fixtures are machine-local. No synchronization or authority change.
Layer below: Read base/ours/theirs conflict diffs, tests/e2e/async-child.ts exact-child termination and asynchronous IPC, reviews/train-187-register-budget-repair.md owning cumulative budget evidence, the two parent histories and existing defect closure criteria. Architecture check, typecheck and build pass; targeted tests and final gate results recorded in the report.
Bug class: integration
Bug evidence: reproducer=tests/e2e/harness-adapters-round7-regression.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Decision: train177-merge-live | Preserve train-177 independent crash cases and async preview launches; retain incoming observation count, bounded bridge repair and both defect histories. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-162920-PROGRESS.md
Decision: train177-derived-evidence | Rehash owner references and replay the register from committed bytes; retain incoming exact catalog stamps and valid conformance evidence without manufacturing new qualification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-162920-PROGRESS.md

1.x comparison: JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a, src/commands/init.ts git-sync conflict handling; docs/specs/test-runner-concurrency-bound.md and docs/specs/local-verify-fast-focused-preflight.md; history 618560b3e, c91b8780e, 681f86543, e1a1b7218; ONEX-LESSONS.md section 6. Searched src/ and docs/specs/ for merge conflicts, Vitest timeouts and worker RPC. Reuse base/ours/theirs semantic comparison and bounded async execution; 1.x scheduler machinery does not fit this test merge. Existing 2.0 async-child helper and owning register-budget repair provide the fitting implementation. No absence claimed from unsearched paths.
Prompt review: No prompt, output parser or model accept/escalate/refuse decision is authored by this repair. Imported model-facing behavior is byte-preserved from live and retains its own review/evidence. Conflict resolution affects test execution and notice alternatives only.
Deferral: generated/register.json:1 | not-a-deferral=generated register metadata replayed from committed source, not a new promise

Subject (44 paths): docs/defects/codex-model-map-refresh-2026-11-05.md, docs/defects/vitest-worker-rpc-timeouts.md, docs/release-evidence/codex-model-map-refresh-1105.json, docs/release-evidence/session-volume-isolated-1105-report.md, docs/release-evidence/train-181-register-repair-report.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, scripts/check-dashboard-floors.mjs, scripts/operator-dashboard-readonly.mjs, scripts/operator-dashboard.mjs, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, src/assembly/production-codex-provider.declarations.json, tests/assembly/production-provider-subscription.test.ts, tests/e2e/harness-adapters-round7-regression.test.ts, tests/e2e/model-provider-path.test.ts, tests/e2e/register.test.ts, tests/integration/model-provider-refusals.test.ts, tests/integration/model-provider-reply.test.ts, tests/integration/resource-owner-partial.test.ts, tests/integration/telegram-poll-concurrency.test.ts, tests/model-provider/crash-worker.mjs, tests/model-provider/fixture.ts, tests/preview/README.md, tests/preview/journal-agent.mjs, tests/preview/journal-cutover-harness.mjs, tests/preview/journal-cutover-model.mjs, tests/preview/native-loop.test.ts, tests/preview/operator-dashboard-mobile.test.ts, tests/preview/operator-dashboard.test.ts, tests/preview/operator-dashboard.ts, tests/preview/session-volume.test.ts, tests/preview/tool-turn-replay.test.ts, tests/preview/tool-turn.declarations.json, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts, tests/preview/two-machine-runner.test.ts, tests/preview/two-machine-world.ts

## Closing block

simplestRobustRoute: Ordinary merge plus semantic resolution of overlapping test repairs and union of defect history, then existing pin/replay tools. This is the simplest robust route; no new mechanism or ability restriction.
80/20: Four conflict-bearing tests, typecheck, build, architecture, register and review checks; the Studio pipeline owns full-suite qualification and the existing RPC defect remains open.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
