# Change review — train-50 live merge repair 005100

Subject base: 28e3e90ec15cf874293ee4ac7d096953f7250596
Review state: open
Reviewed content: none
Outcome: Merge live 9da7fe39 into train-50 28e3e90e, retaining both working-progress reporting and queued-worker acknowledgements plus agent path enforcement.
Affected rules: 26, 34, 37, 49, 74, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing checkpoints. No new grants or dispatch paths.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration touches the journal lifecycle and host composition; use the suggested tier.
Side effects: Pending queued workers now retain acknowledgement handling alongside working-progress timers; both imports remain in the launcher. The merged native composition requires a Studio contract run. Derived publication must be replayed from merged sources.
Undo and recovery: Revert the integration through the desk release process; retain durable journals and uncertain send evidence, never retry an unknown send. Preserved incoming uncommitted local work at local branch train-50-preserved-005100.
Multi-machine posture: Shared repository composition on all hosts; existing conversation ownership and durable intake enforcement unchanged. Native Darwin certificate remains Studio-owned; no remote runtime writes.
Layer below: Read both constitutional documents in full and compared to origin/main; inspected both merge parents, pending-model handling, progress timer admission, signed outbound intent and receipt handling, existing deadline review histories and source publication tools.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: train50-005100-merge | Retain independent path and working-activity imports, and combine knownPending acknowledgement handling with working progress. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-50-repair-005100-PROGRESS.md
Decision: train50-005100-history | Keep candidate deadline integration review and both parent histories; preserve unrelated local work on its own branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-50-repair-005100-PROGRESS.md
Decision: train50-005100-conformance | Retain the existing Darwin conformance declaration until a real Studio contract run can replace it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-50-repair-005100-PROGRESS.md
Prompt review: No new prompt or parser protocol is authored. Both parents retain their reviewed instructions. Replay captured summary uncertain, Jev uncertain/undecided, review and reply shapes through the working-progress consumer and captured revision promises through the existing journal regression.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged parent protocol asserted by existing regression tests; no fixture answer is introduced as a runtime intent trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged parent protocol asserted by existing regression tests; no fixture answer is introduced as a runtime intent trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged parent protocol asserted by existing regression tests; no fixture answer is introduced as a runtime intent trigger — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Skip: tests/preview/agent-paths.test.ts:54 | scope=Imported Darwin-only sandbox-exec integration checks; Linux cannot execute the macOS sandbox. Portable path checks still run.
Skip: tests/preview/agent-paths.test.ts:71 | scope=Imported Darwin-only sandbox-exec integration checks; Linux cannot execute the macOS sandbox. Portable path checks still run.
Skip: tests/preview/agent-paths.test.ts:78 | scope=Imported Darwin-only sandbox-exec integration checks; Linux cannot execute the macOS sandbox. Portable path checks still run.
Skip: tests/preview/agent-paths.test.ts:85 | scope=Imported Darwin-only sandbox-exec integration checks; Linux cannot execute the macOS sandbox. Portable path checks still run.
Skip: tests/preview/agent-paths.test.ts:104 | scope=Imported Darwin-only sandbox-exec integration checks; Linux cannot execute the macOS sandbox. Portable path checks still run.

Subject (27 paths): scripts/README.md, scripts/agent-paths.mjs, scripts/conversation-host-store.declarations.json, scripts/onboarding.mjs, scripts/production-boot-io.mjs, scripts/production-boot.mjs, scripts/production-session-io.mjs, scripts/resource-owner.mjs, scripts/topic-worker-capacity.mjs, src/assembly/README.md, src/assembly/conversation-topics.ts, src/assembly/production-conversation-session.ts, src/assembly/production-session-driver.ts, tests/assembly/conversation-topics.test.ts, tests/assembly/production-conversation-session.test.ts, tests/assembly/production-provider-subscription.test.ts, tests/integration/resource-owner.test.ts, tests/platform/macos-only.txt, tests/preview/agent-paths.test.ts, tests/preview/agent.mjs, tests/preview/conversation-authority-server.mjs, tests/preview/journal-agent.mjs, tests/preview/journal-topic-sessions.test.ts, tests/preview/journal.ts, tests/preview/tool-turn.mjs, tests/preview/topic-worker-capacity.test.ts, tests/preview/trust-setup.mjs

Publication: Existing desk owner rehash and inventory repin tools found zero stale pins. Register replay at 854ef5972d1eb3670e12c175d22416599af5a21b produced generation 71129e6ccb88312041417a695e11e2177ca57cda7fc15fb0a431fdec03f5b917, 293 entries and 117 rules. No native conformance declaration was re-attested.

Verification: Typecheck and build passed; nine targeted files passed with 239 tests passing and seven Darwin-only cases skipped. Recorded shapes were replayed by working-progress and revision-promises tests; no live delivery claim.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary additive merge, retain both independent imports and combine the acknowledgement parameter with the existing progress lifecycle. Existing desk generators refresh publication; no new mechanism or capability restriction. Exact merge parents guard entry; positive and refusal targeted checks guard completion; existing resource bounds, stop and send uniqueness guard execution. No unattended live acceptance is claimed.
80/20: Targeted conflict and changed-file tests, TypeScript and cheap checks on WSL; full-suite and native Darwin conformance remain with Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
