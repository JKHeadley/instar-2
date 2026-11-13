# Change review — train-263

Subject base: 384bad285f51c5c132d9474fb3d5fc2cc9835e75
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed journal prompt retention head while preserving live-base behavior, source knowledge, pending work and honest replay evidence.
Affected rules: 7, 26, 33, 34, 37, 41, 58, 74, 90, 101, 102, 105, 111, 113, 116, 123
Affected floors: Secrets remain encrypted/redacted; spend accounting and caps unchanged; stop unchanged; send intents and uniqueness unchanged; original intake preserved.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates the reviewed durable snapshot retention transform and native conformance evidence without introducing another product change.
Side effects: Old settled exact prompt bodies are replaced by disclosed retention projections. Unique source bodies, original messages, replies, decisions and required reader fields remain. Unfinished work and recent prompts remain exact. Retained unique sources mean the fixture size result is not a universal storage ceiling.
Undo and recovery: Revert integration and replay the register. Reverting code cannot reconstruct retired exact prompt bodies; recovery requires an encrypted pre-retention backup. No new rollback mechanism or live-root mutation.
Multi-machine posture: Existing encrypted replicated journal snapshots carry retention and replay markers. Ownership and replication are unchanged; no new machine-local store.
Team posture: Existing private journal ownership and owner/member/guest audience checks remain. Retained sources do not widen sharing or grant access.
Layer below: Inspected retainedPromptView, retainedEvidence, model-call reference/hash matching, compaction verification and replacement, CLI inspection/status, proof packet digests, reply review context and retrospective population. The existing compactor verifies the transformed state before replacement and only then updates live references. Reviewed member records remain unchanged.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-prompt-retention.test.ts
Hook bypass: none; core.hooksPath=.husky/_, directory absent in this worktree; ordinary git merge and plain git commit/push.
Convergence: none
Prompt review: No new prompt wording or acceptance judgment added by the train. The member changes old-body disclosure and replay eligibility; its real recorded shape tests are rerun. Inherited prompt dispositions remain in member review records.
Decision: train-263-M1 | Ordinary merge of exact f4630c6adf78c3348bdb8d9dc5da9b63a05da847 fast-forwarded. Member evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/journal-prompt-retention-1112-PROGRESS.md, authenticated snapshot SHA256 155ccc61e61bc480133cbbd44b99e3832acc031b93d47e790e51898b804c9ca1. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-263-PROGRESS.md
Decision: train-263-A | Preserve all reviewed member behavior; no overlapping conflict or changelog edits; generated artifacts are replayed, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-263-PROGRESS.md
Decision: train-263-B | Create the new branch directly at exact live base 384bad285f51c5c132d9474fb3d5fc2cc9835e75 in a separate worktree; preserve ancestry, with no main merge or branch reset. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-263-PROGRESS.md
Decision: train-263-D | Run focused checks with unchanged guards/timeouts; disclose WSL/Studio-dependent checks separately and leave the full combined gate to Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-263-PROGRESS.md
Decision: train-263-chain | Run the authenticated cint-L37 repin/build/rehash/replay chain at exact reviewed member f4630c6adf78c3348bdb8d9dc5da9b63a05da847; no native certificate hand-edit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-263-PROGRESS.md

1.x comparison: Freshly fetched JKHeadley/instar main a385ba2f2e717c34c94943d2f2da428e9d746097; searched actual src/, docs/specs/ and history. Read src/messaging/MessageStore.ts cleanup, src/messaging/TelegramAdapter.ts maybeRotateLog, docs/specs/bounded-accumulation-standard.md, and history 7ac38f1b8/753857c0e. Resolution-first retention and audit preservation fit; their different-store plaintext rotation/deletion does not fit the encrypted snapshot. Inherit member comparison ee957c98be8e09cf83285ee6140b20e981d79787. Authenticated ONEX-LESSONS.md sections 5 and 6: bound indexes without deleting source history, declare real replication and verify the production consumer.

Scope: Nothing left out; desk decision C unused because no conflict occurred. Always-sent prompt delta is zero; PREVIEW_FIXED_PROMPT_BYTES remains 23,459. This submission claims no new live deployment, full-suite pass or independent release approval.

simplestRobustRoute: The exact ordinary merge and existing desk chain are the simplest robust route. Start: exact reviewed member and live-base ancestry. End: generated publication, targeted consumer evidence, clean committed work and push. Limits: existing five safety floors and bounded foreground verification; no new machinery.
80/20: No train-specific runtime code. Preserve the reviewed feature, run its changed tests and relevant consumers plus required pinned checks; the Studio combined gate owns the full suite and native/live release proof.
VERDICT: author submission; the independent desk owns convergence and landing approval
