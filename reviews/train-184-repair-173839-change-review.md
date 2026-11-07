# Change review — resolve train-184 against designated live

Subject base: a8af28a236c11772d90470f91abd621660da0399
Review state: open
Reviewed content: none
Outcome: Merge designated live 8258974660cadac50e9a4988c050cf14764e8dc3, keeping the drain fix and all refusal assertions while removing superseded aggregate test deadlines.
Affected rules: 34, 37, 42, 49, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — unchanged custody; spend cap — unknown charge retained; stop — unchanged checkpoints; no duplicate sends — no replay or new runner; durable intake — retained input unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Imported live changes include the already-reviewed session helper lifecycle; authored resolutions are test-only.
Side effects: Prefer live's split crash scenarios with bounded per-child deadlines over candidate aggregate deadline increases. Keep timeoutSignal injection and the 10000ms assessment-only timeout, preserving the 150ms delayed complete-receipt regression and separate timeout refusals. Keep both sets of reminder assertions. No production capability is reduced.
Undo and recovery: Revert the merge relative to its first parent and regenerate derived files. Preserve parent commits and retained effects; do not resend.
Multi-machine posture: Authored changes affect local test execution only. Imported live ownership and helper behavior stays byte-identical to the designated live parent. No shared state or authority is added.
Layer below: Both parent diffs, providerFixture lease/operation/judgment deadlines, timeoutSignal propagation, localProvider transport, split crash worker scenarios and answerOf strict notice suffix checks.
Bug class: integration
Bug evidence: reproducer=tests/integration/model-provider-refusals.test.ts
Hook bypass: none; worktree core.hooksPath unset and shared git hooks contain samples only.
Convergence: none
Prompt review: No authored model prompt, output parser or accept/escalate/refuse policy changes. Live source files merge byte-identically; their records and evidence remain in history. Reminder assertions replay the existing captured Studio gate notice, not a new production parser.
Prompt finding: 0725f0150c56 | protocol-literal | Unchanged imported live instruction preserves refusal identity; test quotes its contract.
Prompt finding: 27d7720e7977 | protocol-literal | Unchanged imported live context section names the memory/work record; no fixture-dependent judgment added.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged live instruction forbids unsupported claims of attempted work.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response literal is imported unchanged.
Prompt finding: 85544c20941f | protocol-literal | Existing retained-message notice is imported unchanged; no resend request.
Prompt finding: e8708c7fea24 | protocol-literal | Existing provenance instruction is imported unchanged.
Deferral: generated/register.json:1 | not-a-deferral=Derived register carries existing governing wording; no new postponed work.

1.x FIRST: Reverified inherited comparison at actual JKHeadley/instar origin/main 149377310f9b586641a05eddf196df4543dc031a: src/scheduler/ScriptCanaryRunner.ts:491 waits for stdout write completion before exit (history 35b02553b). Searched src/ and docs/specs/ for refusal/policy-cache behavior and git history for the drain primitive; inspected docs/specs/unified-session-lifecycle-robustness.md and token-audit-completeness.md. ONEX-LESSONS sections 2, 4 and 6 distinguish slow from dead, corroborate sign-in evidence, and bound test concurrency. Preserve the already-carried 2.0 drain and test fixtures; unrelated 1.x session-recovery machinery does not fit a Git integration repair.

Decision: train184-173839-split | Adopt designated live split crash cases and existing timeout injection rather than repeat superseded aggregate deadline increases. Keep every original refusal/evidence assertion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-173839-PROGRESS.md
Decision: train184-173839-history | Keep candidate policy-cache review byte-identical; the alternative train-176 version remains at live parent 82589746 with owner provenance 0c1d832a. Both histories survive this merge, without rebinding an old review to unrelated changes. Retain both reminder test sets. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-173839-PROGRESS.md
Decision: train184-173839-register | Use delegated owner/grounding repin and register replay from the committed merged source; never edit a pin by hand. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-173839-PROGRESS.md

Verification so far: typecheck, build and architecture passed. Delegated tools refreshed two preview owner-reference pins and zero grounding inventory entries. Register replay binds source 491e185153eb038a07025098b63a9b2c220e5c0c (299 entries, 122 rules). Final targeted test and gate outputs belong to the builder report.

Repair evidence: The first targeted run passed 75 of 76 tests. The remaining unsplit fsynced-pending case timed out at its 30000ms aggregate deadline. Split only its seed setup, concurrent-reader test and independent control test using the existing beforeAll/it pattern; preserve both simultaneous readers and every assertion, with each physical child still bounded at 30000ms. This removes the aggregate stage coupling rather than restoring the previous 95000ms monolith.
Decision: train184-173839-last-aggregate | Split the one remaining multi-stage crash case after its observed timeout; keep concurrent reads together and every state assertion intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-173839-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge, existing split test cases and timeout injection, and existing register regeneration. No new gate, runtime mechanism, quarantine or capability restriction. Start from the exact named parents; finish with targeted tests and cheap checks; Studio retains full-run and independent qualification.
80/20: Step back from aggregate timeout repairs and use the live branch's smaller individually bounded cases. Preserve both histories and all assertions, with no unrelated redesign.
VERDICT: author submission; no independent verdict or live acceptance claim
