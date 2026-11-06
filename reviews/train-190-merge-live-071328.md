# Change review — preserve register repairs while merging live

Subject base: d4744921f035cf6910757d1ce17e33ea86956880
Review state: open
Reviewed content: none
Outcome: Merge live add5d75879174874e15bf1552ae37c82e00c6358 into train-190, retaining both register test repairs and both defect histories.
Affected rules: 18, 37, 55, 60, 63, 70, 74, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing credentials only, no disclosure; spend cap — no new calls or accounting change; stop — asynchronous children retain finite timeouts; no duplicate sends — no new runtime dispatch change; durable intake — all owner/prerequisite refusal assertions remain.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge imports live runtime changes with their existing review records; authored resolution is test and defect-history integration only.
Side effects: Live includes smaller intake fixture groups and the existing 120s cumulative bridge budget with explicit 60s children. The merged register file equals live byte-for-byte and retains candidate asynchronous helpers, malformed-source groups and parent-release controls. Both historical defect sections remain. Auto-merged runtime and review changes are preserved. Generated output is replayed from the merged committed source.
Undo and recovery: Revert this merge with its first parent selected, then regenerate publication; preserve both parents and recorded red evidence. No deployed state is mutated by this repair.
Multi-machine posture: Local temporary fixture repositories and bounded child processes; shared branch history preserves both machines' repairs. Studio owns full-suite and native macOS qualification.
Layer below: Read tests/e2e/async-child.ts spawn/close promise, finite SIGTERM child timeout and result propagation; compared both complete register test revisions and bridge/intake deltas. Live's pre-existing native composition certificate is retained unchanged, not recalculated or asserted from a Linux test. Architecture verifies byte binding independently.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Prompt review: No authored prompt, dispatch, model parser or acceptance-rule change. Imported live changes retain their existing reviews; no model-facing repair requires a journal replay.

1.x comparison: Searched actual JKHeadley/instar main 2dd76c62c572245eb9381cdfc80b5a346583ba43 src/, docs/specs/ and history for Vitest/RPC/register replay and asynchronous children. Read src/monitoring/SessionWatchdog.ts, docs/specs/CODEX-TEST-WORKER-INTERRUPTION-AND-CONTROL-PLANE-RESILIENCE-SPEC.md, history 8fc69c721 and focused-preflight history 6deb97877; read ONEX-LESSONS section 6. Bounded asynchronous subprocess work fits; watchdog/preflight infrastructure is not a register fixture. Reuse existing 2.0 async-child and complete owner repairs instead of unrelated machinery. Inherits reviews/train-190-register-gate-repair.md's detailed earlier comparison.

Decision: train190m-preserve | Preserve live's complete register test file, which already incorporates the candidate async owner repair plus smaller intake groups and independently bounded bridge children; retain both defect histories without rewriting earlier observations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-071328-PROGRESS.md
Decision: train190m-publication | Retain live's existing native conformance certificate and regenerate owner/publication evidence through delegated scripts; no manual pin editing or new certificate declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-190-repair-071328-PROGRESS.md

Verification: Final commands, exact results and file inventory are recorded in the report cited above. Full-suite results remain the Studio gate's responsibility; this record claims no full-run pass or independent convergence.

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the existing owner repairs and preserve their histories, using the existing async helper and generated publication tools. No new mechanism or ability restriction is introduced. Existing child bounds and checkpoint assertions remain.
80/20: Target the conflicted register file, typecheck/build and final cheap checks; do not run the full suite on WSL. Retain failed historical runs as red evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
