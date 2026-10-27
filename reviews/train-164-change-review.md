# Change review — train-164 reviewed integration

Subject base: 10826ed522b6a11ebc77cb6bb0a047e8dd25def7
Review state: open
Reviewed content: none
Outcome: Integrate the two exact reviewed heads preserving the accepted live base, authenticated setup IPC and bounded summary recovery.
Affected rules: 1, 4, 7, 11, 26, 28, 34, 35, 36, 37, 41, 42, 49, 55, 60, 61, 69, 70, 74, 75, 90, 95, 96, 98, 100, 101, 102, 105, 111, 112, 113, 116, 118
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. IPC does not confer a human grant; output acceptance and usage metering remain bounded.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates authenticated installation transport and model-facing summary behavior, without expanding either reviewed scope.
Side effects: Generation receives the pinned thinking allowance while accepted answers keep the existing cap; oversized summary prefixes shrink within existing attempt ceilings. IPC adds bounded mutually authenticated transport, not custody or enrollment completion.
Undo and recovery: Keep the serving build until desk acceptance. Revert the integration if rejected; no journal migration, new authority or resend.
Multi-machine posture: Source/register shared by git; summary state uses existing journal ownership and replication. Unix IPC and test fixtures are deliberately machine-local; no peer identity is inferred.
Layer below: Full constitution, three hash-verified evidence snapshots, exact head ancestry, member reviews, owner receiver and TLS boundary, summary cap accounting and durable failure frontier, existing register generator.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No new prompt or classifier; preserve reviewed protocol wording and replay captured summary writers, uncertain/undecided judgments, reply reviews and empty reply context through existing fixture tests.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged protocol wording; no keyword intent gate — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged protocol wording; no keyword intent gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged protocol wording; no keyword intent gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged protocol wording; no keyword intent gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: 85544c20941f | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged journal protocol text; no new keyword decision.
Prompt finding: 0d4664ea9de7 | quoted-evidence | Existing trust guidance appears in self-description fixtures; this change does not edit the guidance or its authority.
Prompt finding: 14d7eeccc218 | quoted-evidence | Existing workspace/public-read guidance appears in self-description fixtures; unchanged by this unit.
Prompt finding: 38a2c5d186f1 | protocol-literal | Existing brief-reasoning protocol shared with act-first evidence; no prompt text or semantic decision changes.
Prompt finding: 9781075d458e | quoted-evidence | Existing doorway-refusal guidance is unchanged; no refusal or reporting criterion changes.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing workspace/public-read guidance appears in self-description fixtures; unchanged by this unit.
Prompt finding: b1bb3946362d | protocol-literal | Existing agent-identity framing appears in act-first evidence; unchanged by this unit.

Deferral: generated/register.json:1 | not-a-deferral=Generated governed text preserved by replay; no new builder deferral.
Skip: tests/platform/setup-owner-ipc.test.ts:16 | scope=Unprivileged protocol needs a non-root test identity; separate privileged installed-identity proof remains.
Skip: tests/platform/setup-owner-ipc.test.ts:124 | scope=Real launchd proof requires darwin and explicit disposable identity fixture; never claims WSL coverage.

Subject (29 paths): docs/defects/install-custody-recovery-composition.md, docs/setup-owner-ipc.md, docs/setup-supervisor.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/custody-platform/README.md, scripts/custody-platform/linux.mjs, scripts/custody-platform/setup-ipc.mjs, scripts/setup-owner-receiver.mjs, src/assembly/harness.declarations.json, src/assembly/production-provider.ts, tests/assembly/production-provider-subscription.test.ts, tests/assembly/production-provider-tools.test.ts, tests/platform/custody-platform.test.ts, tests/platform/custody/setup-ipc-material.mjs, tests/platform/custody/setup-ipc-studio.mjs, tests/platform/setup-owner-ipc.test.ts, tests/platform/setup-owner-receiver.test.ts, tests/platform/setup-owner-transport.test.ts, tests/preview/fixtures/summary-cap-2026-10-26.json, tests/preview/journal-provider.test.ts, tests/preview/journal.ts, tests/preview/summary-cap-replay.ts, tests/preview/summary-cap.test.ts

Decision: train-164-install | Merge exact reviewed fc270bbc946edca5d298a980c7ce081e656edf87; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md, snapshot sha256 c8577726cb6a6e731577424c7e9b2989d8040a074a7a1a6157a231f57c7414e8. Authenticated IPC only; retain tracked incomplete custody/enrollment scope. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-summary | Merge exact reviewed 088587ddf417aeb4b2e6810f8ac9aff05c5a3797; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-cap-1026-PROGRESS.md, snapshot sha256 666cb8b35fc133e55faa0ab21479b90d30242ad10bf79c6acd8eef99d9859283. Preserve answer admission and bounded summary shrink behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-A | Preserve both intended behaviors. Ordinary merges were conflict-free; no product bytes manually resolved. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-B | Create separate branch directly at exact live base; retain its complete ancestry and do not move the branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-C | No product conflict arose, neither merge was aborted and no head was left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-D | Run targeted foreground WSL checks, disclose host-dependent checks for the Studio; do not alter assertions for this host. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md
Decision: train-164-desk | Run existing repin/build/rehash/replay procedure from cint-L37-PROGRESS.md. Repin and rehash changed zero pins; regenerate seven publication files at combined source commit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-164-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: exact reviewed merges and the existing desk regeneration tools, with no integration-specific runtime machinery. Start guard is exact base/head ancestry; end guard is targeted checks and desk acceptance; existing authority, stop, spend, durable intake and uniqueness floors remain. Offline replay is not an unattended installation-completion claim.
80/20: Verify changed tests and direct consumers, preserve evidence and hand host-specific and full-suite acceptance to the Studio gate.
VERDICT: author submission; no independent convergence claimed
