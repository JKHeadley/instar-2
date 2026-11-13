# Change review — train-253

Subject base: 231b3370e6ec9d44ad82929290a0d7e12343891d
Review state: open
Reviewed content: none
Outcome: Integrate exact reviewed hotfix-session-close-1112-r4 while preserving the live close tolerance, adding its persistence/refusal regression and withdrawing the unsafe exit diagnostic.
Affected rules: 1, 24, 25, 34, 37, 42, 49, 70, 74, 90, 101, 102, 105, 111, 113, 115, 116, 123
Affected floors: Secrets — remove the diagnostic disclosure surface; spend cap, stop, no duplicate sends and durable intake — preserve existing enforcement and journal records. No model calls or effects added.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Retains durable conversation closure behavior and integrates its reviewed test and native certification metadata.
Side effects: The inherited substring catch still accepts both unknown and already-closed edges, and persists a local close without a second accepted journal close. This does not reconcile stores or establish why the edge was absent. Removing the diagnostic removes its raw error/stack disclosure; ordinary suppressed-error reporting remains.
Undo and recovery: Revert this integration and regenerate using the existing desk chain if required by the release desk; preserve all history. The live base already contains the close tolerance. A rollback must not silently restore the unsafe diagnostic. No runtime state format or migration changes.
Multi-machine posture: Conversation cleanup remains on the owning machine. Replication, ownership, transport, durable intake and cross-machine authority are unchanged. Native certification remains bound to Studio’s certified composition.
Team posture: No changes to owner/member/guest admission, private defaults, sharing or outbound audience. Fixture identities remain isolated; the removed diagnostic could expose private message content.
Layer below: Inspected close(), maintain(), retirement and persist order in production-conversation-session.ts and admission in tests/preview/journal.ts: unknown and already-closed edges share one rejection before accounting mutation. A persisted local close is not evidence of a second journal acceptance. Direct consumers are conversation-topics.ts, production-provider.ts, production-codex-provider.ts and journal-agent.mjs; test selection follows lifecycle consumers without sweeping shared-index importers.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset and isolated clone hooks directory contains sample files only.
Convergence: none
Prompt review: No model instructions, output parser, accept/escalate/refuse judgment or delivered reply changes. Recorded model-shape replay is inapplicable; existing real-shape lifecycle fixtures remain in selected consumer tests.
Prompt finding: 0725f0150c56 | quoted-evidence | The unchanged role/refusal instruction is quoted by an existing test; this merge changes no model phrase or decision trigger.
Prompt finding: 27d7720e7977 | quoted-evidence | The existing context introduction is unchanged; the added regression tests journal failure propagation and persisted state.
Decision: train-253-M1 | Ordinary no-ff merge of exact reviewed 8e40223085b2680b9bb22ce2c6a9f3b529cb0b14; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-r4-PROGRESS.md, supplied snapshot SHA256 0173418879db9dd071c8c3d6e176d72ad43816426ff3397eda8fcec49bc8e131 verified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-253-build-report.md
Decision: train-253-A | Preserve every reviewed member behavior and accepted live behavior. No source conflicts occurred; generated publication is regenerated, never hand-merged. No changelog version changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-253-build-report.md
Decision: train-253-B | Supplied branch was already at member head; preserve it. Use a separate shared-object clone and create train-253 via worktree add directly at exact live 231b3370e6ec9d44ad82929290a0d7e12343891d. No branch reset or origin/main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-253-build-report.md
Decision: train-253-D | Classify unchanged Studio-dependent evidence/native checks separately; use certified installed Node 24.14.1 after Node 26 runtime refusal. No guard or timeout changes; no declaration edited to hide R105. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-253-build-report.md
Decision: train-253-chain | Run authenticated cint-L37 repin/build/rehash/replay chain. Repin and rehash update zero pins. Replay merge source 0b11c27310dd0ab6b64a8ccb9053daa4460b6e81 into generated publication. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-253-build-report.md
Deferral: generated/register.json:1 | not-a-deferral=generated publication quotes existing governing material; no new deferred work.

1.x comparison: Actual JKHeadley/instar origin/main 700b2a9135623f5eae27ebcf5352d9a6d9135c1b searched in src/, docs/specs/ and history. Read src/core/SqliteRegistry.ts and docs/specs/REMOTE-SESSION-CLOSE-SPEC.md, with history 7f06b196cbf3f3c097637c293bddbf63e14d0985 and 37ac75341ed38ac5cca722fc0a52152d83483cf8. Reuse member’s idempotent-cleanup principle: closed handles avoid repeated teardown and already-gone remote sessions are treated calmly. Broad best-effort teardown does not fit 2.0 journal-edge accounting; keep the existing narrower mitigation and propagation of unrelated errors. No unrelated 1.x code copied. Read authenticated ONEX-LESSONS.md sections 2 and 6: current lifecycle evidence, durable work across session exit, bounded test concurrency, and production assembly verification.

Scope and evidence: Exact member and live base are ancestors of this merge. No member left out; desk decision C unused because there is no product conflict. Root-cause reconciliation and structured exit provenance remain owned by session-close-tolerant-1112, as the reviewed member states; this train makes no competing repair. Always-sent prompt delta is zero; PREVIEW_FIXED_PROMPT_BYTES remains 23,459. Test and measurement outputs are recorded in the handoff report. No live proof, independent verdict or release approval is claimed by this integration.

simplestRobustRoute: One exact ordinary merge and existing desk generation are the simplest robust route. No new runtime machinery. Start guards are exact base/member identity; end guards are source-bound publication, targeted lifecycle and pinned checks, clean committed custody and push. Existing stop, budget, durable intake and effect-uniqueness limits remain enforced.
80/20: Product delta versus live is removal of two unsafe diagnostic lines; 27 test lines establish both catch outcomes and persisted close. Other changes are reviewed certification metadata, generated output and review records. The normal combined gate owns full-suite and live release proof.
VERDICT: author submission; independent desk owns convergence and landing approval
