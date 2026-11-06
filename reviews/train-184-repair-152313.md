# Change review — train-184 merge and receipt repair

Subject base: 2d9f359cb9144b66564661955a1db02f0b648db0
Review state: open
Reviewed content: none
Outcome: Preserve train-184 repairs while merging desk-designated live 79be7e88 and restoring Codex observation stamps to the committed train-187 receipt.
Affected rules: 26, 34, 37, 42, 49, 56, 70, 74, 90, 91, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — merged refusal finalizes the claimed turn; no duplicate sends — unchanged; durable intake — unchanged and prior timeout retained as unqualified evidence.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge carries live journal refusal and session-volume behavior; this author adds only receipt-bound conflict resolution and derived publications.
Side effects: Existing live behavior remains, including bounded volume growth and finalized post-claim refusals. No live sessions, credentials, accounts, or installed services are changed here.
Undo and recovery: Revert this merge and subsequent derived publication commits; no runtime state migration is performed.
Multi-machine posture: WSL portable targeted checks only. Studio owns native, installed, full-suite and live requalification for this new SHA. No old saved report is claimed as fresh evidence.
Layer below: Read merge diffs through journal-agent claim/finally and tool-turn volume mount/resize/detach. Verified declaration against the actual committed receipt with the unchanged desk resolver; altered model and subsidy timestamps both refuse.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-codex-provider.test.ts
Hook bypass: none
Convergence: none
Prompt review: Merged journal-cutover-model and tool-turn fixtures retain their existing bounded model/tool instructions; this repair adds no prompt instructions or authority. The barrier is a test fixture, not a product permission path.

## Evidence and Rule 101 comparison

Read the full purpose and rules at origin/main aa8cbc934351f78e52d4ecebc3714648981ece0f (already an ancestor). Read ONEX-LESSONS.md, especially account lifecycle and resource/testing/maintenance. Searched actual JKHeadley/instar origin/main b718807caa98480faa173850787b3a6f57c0affb in local cross-topic-onex-reference: src/core/DoorwayRegistryReader.ts separates canonical reviewed manifest from machine-local observations; docs/specs/DOORWAY-MODEL-KNOWLEDGE-REGISTRY-SPEC.md forbids observation promotion to canonical authority. Git history includes 2aaac4288. Reuse this boundary: restore only the receipt-backed catalog observation, never infer inference availability, quota, liveness or a fresh subsidy review. That reader is not a governed merge resolver and is not transplanted. The prior lifecycle comparison at 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 remains documented in the inherited train-184 review.

Both stamps are exactly 1793936455257, copied from 0dd520cacc22b174c0fefd441e62ddd38a863c2a and bound to docs/release-evidence/train-187-codex-catalog-2026-11-05.json. No new clock-derived observation or alternate receipt is introduced.

Decision: train184-live-receipt-merge | Merge only desk-designated live while preserving both histories; resolve the sole source conflict with the specified committed train-187 receipt bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-152313-PROGRESS.md
Decision: train184-derived-publication | Regenerate register and governed hashes with delegated desk tools, including only the permitted GNU sed portability adjustment; never hand-edit pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-152313-PROGRESS.md
Decision: train184-host-check-scope | Keep the unchanged Studio intake child timeout visible for Studio requalification; do not widen its bounds or claim it fixed from WSL. Run only targeted portable checks and cheap gates here. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-184-repair-152313-PROGRESS.md

simplestRobustRoute: Step back after repeated repair cycles: merge the requested live history, use the existing evidence resolver and delegated regeneration, and preserve accepted aggregate deadlines and assertions. No new product machinery.
80/20: One declaration conflict plus derived publications and this review. All other authored changes arrive from the requested live merge. Preserve the previous full-run failure honestly: intake.test.ts child ETIMEDOUT, one failed file/test; 1025 files and 9377 tests passed, 19 files and 248 tests skipped. Those numbers qualify only the old SHA.
VERDICT: author submission; no independent verdict or fresh full/native/live qualification is asserted.
