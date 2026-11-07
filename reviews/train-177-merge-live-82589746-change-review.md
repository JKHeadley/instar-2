# Change review — train-177 merge live 82589746

Subject base: c9847434eea5b067c3d7bcd4e3235c21b8edf793
Review state: open
Reviewed content: none
Outcome: Resolve the candidate/live merge while preserving both canary notice controls, bounded asynchronous launches, browser review dispositions and both commit histories.
Affected rules: 34, 37, 55, 60, 69, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116
Affected floors: secrets — offline fixture isolation retained; spend cap — no additional provider calls; stop — child deadlines retained; no duplicate sends — existing exact send-count assertions retained; durable intake — inherited journal behavior retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept the combined merge tier; authored conflict repair changes tests and review metadata only. Incoming production behavior remains byte-identical to its reviewed live parent.
Side effects: Canary runs one additional pure notice control from live alongside all five candidate controls. Existing asynchronous child helper and 30-second per-launch bounds remain. Register references are regenerated from merged bytes.
Undo and recovery: Revert the merge using its first parent and regenerate derived register outputs. Preserve both histories and uncertain effects; no installation migration is introduced.
Multi-machine posture: Shared repository merge; disposable offline fixtures and checks remain machine-local. No authority, credential custody or synchronization change.
Layer below: Read both parent diffs and tests/e2e/async-child.ts. The helper awaits exact spawned children and terminates those children at their existing deadlines. Browser review incoming dispositions extend the existing unchanged prompt accounting. Main is an ancestor of the pinned live target.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train177-173539-merge | Merge pinned live 825897466, which includes main, preserving all candidate asynchronous budgets and both parents' notice controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-173539-PROGRESS.md
Decision: train177-173539-review | Keep incoming browser review dispositions in full; they account for inherited prompt literals without changing runtime behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-173539-PROGRESS.md
Decision: train177-173539-register | Use canonical desk rehash and replay tools from committed merged bytes; never hand-edit hashes or qualification declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-173539-PROGRESS.md

1.x comparison: JKHeadley/instar origin/main 1723950ceca23f0ae516e4cb9d3e675ae1c1eea3; src/core/WorktreeManager.ts and src/core/SessionLivenessOracle.ts use bounded asynchronous child execution and preserve uncertainty. Searched those paths and docs/specs/test-runner-concurrency-bound.md with history 5143e436, 618560b3, 269da957; read ONEX-LESSONS sections 2 and 6. The lifecycle/semaphore implementation does not fit this fixture merge; existing 2.0 async-child is the fitting implementation, preserved intact.
Prompt review: This conflict repair changes neither prompts nor model output parsing or accept/refuse decisions. Imported helper behavior and model-facing literals are byte-preserved from 825897466 and retain their owning reviews; no new live-model qualification is claimed.
Prompt finding: 0725f0150c56 | protocol-literal | The regression normalizes the existing role/refusal prologue for historical packet and digest comparison; no semantic gate keys on this phrase; unchanged by this change.
Prompt finding: 27d7720e7977 | protocol-literal | The existing memory-record boundary delimits the intentionally changed prologue in historical byte comparison; it is not a model decision trigger; unchanged by this change.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: 85544c20941f | protocol-literal | Existing fixed queued-message notice, unchanged by this change; its test checks the actual notice, not a semantic trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Deferral: generated/register.json:1 | not-a-deferral=derived register metadata is replayed from committed source, not a new promise

Subject (37 paths): docs/implementation/carryover-16-helper-failure-1104.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, legacy-1x/README.md, legacy-1x/src/commands/server.ts.helper-watchdog-excerpt.md, legacy-1x/src/monitoring/HelperWatchdog.ts, legacy-1x/src/monitoring/SubagentTracker.ts, legacy-1x/tests/unit/HelperWatchdog.test.ts, legacy-1x/tests/unit/HelperWatchdog.wireup.test.ts, legacy-1x/tests/unit/subagent-tracker.test.ts, src/assembly/README.md, src/assembly/harness.declarations.json, src/assembly/production-conversation-session.ts, src/assembly/production-session-work.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/helper-loss-trace.test.ts, tests/assembly/production-session-work.test.ts, tests/e2e/model-provider-path.test.ts, tests/integration/model-provider-refusals.test.ts, tests/integration/model-provider-reply.test.ts, tests/model-provider/crash-worker.mjs, tests/model-provider/fixture.ts, tests/model-provider/http-provider.ts, tests/preview/admission-gate.mjs, tests/preview/journal.ts, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts, tests/preview/mcp-setup.test.ts, tests/preview/review-layers-canary.test.ts, tests/preview/session-admission.test.ts, tests/preview/tool-admission-hook.mjs, tests/preview/tool-turn.test.ts

## Closing block

simplestRobustRoute: Ordinary merge, union of complementary test controls, incoming complete browser review dispositions and canonical register replay. This is the simplest robust route; no new runtime machinery or ability restriction.
80/20: Run the conflict-bearing canary, typecheck, build and cheap gate checks; full-suite qualification remains on the Studio per the assigned host scope.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
