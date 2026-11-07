# Change review — train-187 preserve both sides of the live merge

Subject base: fc372a328d712c7b09272caf4c4d96a4b449c6d2
Review state: open
Reviewed content: none
Outcome: Merge live 825897466 into candidate fc372a328, preserving helper failure settlement, single/batch recovery, crash evidence and both provenance histories. Regenerate derived publication from the merged source.
Affected rules: 26, 34, 37, 49, 69, 70, 74, 90, 101, 102, 109, 111, 112, 113, 116
Affected floors: secrets — no credential or custody changes; spend cap — no paid calls; stop — existing deadlines retained; no duplicate sends — duplicate-close and restart assertions retained; durable intake — single/batch recovery and uncertain evidence preserved.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Integration of existing reviewed behavior; semantic conflict resolutions affect tests and provenance, not new runtime policy.
Side effects: Both recovery sizes now cover failed-child and duplicate-close evidence. Both raw baseline descriptions and review histories remain. Existing candidate crash tests keep independent roots and distinguish deadline kills from intended crash evidence; the live helper classifier and stale-grace checks remain.
Undo and recovery: Revert this merge with its first parent and regenerate source-bound publication. No live store is modified.
Multi-machine posture: Git shares the merged source. Portable tests run on WSL; native macOS conformance and full qualification remain Studio-owned. No machine authority or ownership changes.
Layer below: Inspected nestedSessionWorkClose and fresh admission recovery, the sentinel stale-grace import, async-child versus the candidate timeout-rejecting execFile helper, and generated-source replay. Live and candidate histories are preserved as merge parents.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train187-merge-union | Preserve both evidence dimensions and provenance histories; retain independent crash roots and explicit timeout rejection, avoiding duplicate orchestration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-174141-PROGRESS.md
Decision: train187-merge-publication | Reuse existing repin and replay generators; keep the inherited native certificate honest for Studio recertification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-174141-PROGRESS.md
Prompt review: No prompt is edited by conflict resolution. Inherited helper changes retain their existing recorded-shape review; the findings below concern unchanged protocol and reply literals.
Prompt finding: 0725f0150c56 | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "use them to answer and act within that role; a tool refusal remains a refusal."
Prompt finding: 27d7720e7977 | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase src/assembly/production-conversation-session.ts <- tests/assembly/production-conversation-session.test.ts: "this memory and work record"
Prompt finding: 4106b49fff07 | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol/reply text unchanged by this merge resolution — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (30 paths): docs/implementation/carryover-16-helper-failure-1104.md, legacy-1x/README.md, legacy-1x/src/commands/server.ts.helper-watchdog-excerpt.md, legacy-1x/src/monitoring/HelperWatchdog.ts, legacy-1x/src/monitoring/SubagentTracker.ts, legacy-1x/tests/unit/HelperWatchdog.test.ts, legacy-1x/tests/unit/HelperWatchdog.wireup.test.ts, legacy-1x/tests/unit/subagent-tracker.test.ts, register-source/owner-references/preview.json, src/assembly/README.md, src/assembly/production-conversation-session.ts, src/assembly/production-session-work.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/helper-loss-trace.test.ts, tests/assembly/production-session-work.test.ts, tests/e2e/model-provider-path.test.ts, tests/integration/model-provider-refusals.test.ts, tests/integration/model-provider-reply.test.ts, tests/model-provider/crash-worker.mjs, tests/model-provider/fixture.ts, tests/model-provider/http-provider.ts, tests/preview/admission-gate.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal.ts, tests/preview/live-sentinels.test.ts, tests/preview/live-sentinels.ts, tests/preview/review-layers-canary.test.ts, tests/preview/session-admission.test.ts, tests/preview/tool-admission-hook.mjs, tests/preview/tool-turn.test.ts

1.x comparison: actual JKHeadley/instar origin/main 1723950ceca23f0ae516e4cb9d3e675ae1c1eea3 searched src/ and docs/specs/ for merge conflicts. Inspected src/core/GitSync.ts (normal merge after stuck rebase), src/core/LLMConflictResolver.ts (semantic reconciliation after exact strategies), src/core/SafeGitExecutor.ts, docs/specs/INTER-AGENT-MESSAGING-SPEC.md (regenerated derived index), docs/specs/worktree-reaper-squash-merge-blindness.md (landing evidence is workflow-specific), WorktreeManager history 5143e436, 269da957, def73b19 and ONEX-LESSONS.md section 6. Fit: preserve actual source/history and regenerate derived records. Mismatch: runtime sync/reaper code does not resolve this development branch's semantic conflicts; no subsystem transplant is warranted.

## Closing block

simplestRobustRoute: A normal merge with semantic union at the eight named conflicts and existing publication generators is the simplest robust route. No new orchestration or runtime guard. The start guard is the exact two parents; end guards are targeted tests and source-bound checks; Studio owns native qualification.
80/20: Preserve both behaviors, run the changed portable files and cheap checks, and return the exact pushed commit for Studio qualification; no full suite on WSL.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
