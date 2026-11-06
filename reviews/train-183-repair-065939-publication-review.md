# Change review — publish the merged train-183 register

Subject base: 81e33f96e37a8a0ddbfc2aad8c0f1dcfb5e7840e
Review state: open
Reviewed content: none
Outcome: Bind the generated register to merged source 81e33f96e37a8a0ddbfc2aad8c0f1dcfb5e7840e using the existing replay publisher (300 entries, 122 rules, 34 terms).
Affected rules: 32, 37, 49, 74, 83, 90, 91, 101, 102, 112, 113, 116
Affected floors: secrets — unchanged custody and outbound checks; spend cap — unchanged model budgets; stop — retain live signal handling and existing stop checks; no duplicate sends — unchanged durable send journal; durable intake — preserve existing journal and replication implementation.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combine reviewed live and candidate compositions; no new runtime feature or policy decision.
Side effects: The two test helpers accept both existing activation and credential expiry notices, while keeping the candidate's activation refusal regressions and the live asynchronous child handling. The cache review retains owner history and earlier integration provenance. Codex metadata keeps the newer candidate timestamps. Generated source references are re-derived by the existing publisher.
Undo and recovery: Revert this merge and its generated publication together; retain both parent histories and existing journals. Do not replay uncertain sends.
Multi-machine posture: Existing shared relationship and journal replication remains intact; host provider inspection remains deliberately machine-local. This WSL merge repair does not claim a new Studio or multi-machine runtime proof.
Layer below: Read both complete governing documents at origin/main aa8cbc934; compared both conflict stages, inherited cache owner review and test consumers, declaration metadata and owner-reference publisher. The live commit includes current main.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No new prompt, model output parser or model acceptance decision. Conflict resolutions are test notice recognition, historical review text and metadata. Existing recorded activation notice regressions remain. Inherited model-facing changes retain their original review/evidence; no fresh live replay is claimed.

1.x comparison: Inherits reviews/train-183-change-review.md and reviews/train-183-cache-integration-review.md. Independently fetched actual JKHeadley/instar main d1de939e575e9489970af8e287274a07d0ff7207; searched src/, docs/specs/ and git history for policy-limits, policyLimits and remote-settings.json with no matching cache inspector in those paths. Read src/core/ReplicatedRecordEmitter.ts witness-before-tick, src/core/JournalSyncApplier.ts fsync-before-applied, docs/specs/WS2-SEND-SIDE-EMISSION-SPEC.md, history ff8344b4b/d4242edc4/6efb50acd and authenticated ONEX-LESSONS sections 4/5. Reuse the already adapted durable journal design and owner cache repair; no new 1.x transplant fits this merge conflict.

Deferral: generated/register.json:1 | not-a-deferral=Generated register retains existing rule wording; no new deferred implementation.

Decision: train-183-065939-publication | Publish the canonical register from the merged source through build-register replay; no hand-edited hash or authority change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-065939-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: merge existing behavior, preserve history and regenerate derived references. No new mechanism or reduced capability. Existing authority, cap, stop, durable intake and send uniqueness checkpoints remain; targeted tests and cheap checks guard this handoff, and Studio owns live/full-run acceptance.
80/20: Run typecheck, build, the two conflict test files and required cheap checks; do not run the full suite on WSL.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
