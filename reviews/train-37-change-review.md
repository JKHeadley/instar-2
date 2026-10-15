# Change review — train-37 waiting batches and quiet acknowledgements

Subject base: 48ae575d1c663a5d47cee6e237dd6c9b0e3c5059
Review state: open
Reviewed content: none
Outcome: Combine the three exact reviewed heads with the live topic-account handoff, preserving ordered durable waiting batches, bounded progress, truthful speaker accounting and reaction acknowledgements.
Affected rules: Purpose 2/3; Rules 1, 13, 26, 29, 34, 36, 37, 42, 46, 49, 52, 55, 60, 63, 68, 70, 74, 75, 87, 89, 90, 95, 96, 101, 102, 105, 111, 112, 113, 116.
Affected floors: secrets — existing outbound and credential checkpoints; spend cap — shared bounded topic allowance; stop — unchanged host and send guards; no duplicate sends — durable intent and UNKNOWN without replay; durable intake — waiting identities and atomic per-intake result custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Combines durable conversation dispatch and outbound acknowledgement behavior.
Side effects: Batches wait for the existing per-topic account handoff and then capture its current authority. The launcher retains per-topic binding and adds durable recovery edges. Waiting-progress and reaction fields coexist in journal records. The existing native macOS certificate remains unchanged and must be renewed on the combined composition by its Studio owner. Generated publications are regenerated, not hand-merged.
Undo and recovery: Reject the candidate before deployment or restore the preceding live build using the desk's normal copy-root procedure. Preserve journal, topic custody, progress intents and unknown receipts. Do not rerun uncertain effects or delete state. Deployment is desk-owned.
Multi-machine posture: Existing owning-host fences and replicated journal policy remain. Physical workers and account handoff are machine-local; no new remote writer, credential transfer or peer dependency.
Layer below: Inspected prepareTurn before request authority capture, topicConfig merging, exact serialized batch sizing, atomic results and correlated recovery, plus acknowledgement intent/provenance and reaction-versus-text receipt accounting.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample files only.
Convergence: none
Prompt review: No new model wording beyond the reviewed waiting-batch member. Replay its committed historical summary/uncertain/Jev/reply-review/delivered/empty shapes through the combined batch and acknowledgement paths; no live-model acceptance claim.
Decision: train-37-batch | Ordinary merge of exact 75633196fe99391ea1f20cf9516c9ea5d75ec6f3; scope and provenance in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1m-batch-waiting-1014-PROGRESS.md and the committed member review records. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-speakers | Ordinary merge of exact c51af15d5faa5283b58555ea0a60050e187f01b3; preserve exact receipt-based accounting from /Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule89-speakers-1014-PROGRESS.md. Studio-only oracle edits remain for the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-reaction | Ordinary merge of exact f381f70d52eaca1f316c244ae49ee96ac310a958; preserve definite-refusal fallback, UNKNOWN and typing bounds from /Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1o-reaction-ack-1014-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-desk-A | Resolve product overlap by retaining prepareTurn/topicConfig and batchWaiting, capturing authority after handoff, passing recoveryEdges through configurationFor, and retaining both waitingProgress and reaction journal fields. Test both blocked and ready handoff with a waiting batch; its fixture uses a typed topicConfig assignment and checks queued outcomes before collecting completed results. Preserve base certificate pending real Studio verification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-desk-B | New worktree and branch directly at exact live base 48ae575d1c663a5d47cee6e237dd6c9b0e3c5059; no main merge or unreviewed tip. Preserve existing graduation repair and live behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-desk-D | Run targeted portable tests, direct consumers, journal tests and prescribed checks on WSL; report macOS/host-only checks and missing absolute Studio evidence honestly for the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md
Decision: train-37-publication | Use downloaded repin/build/rehash tools and register replay at the committed combined source. Retain prior generated publication only during merge, then regenerate all seven artifacts. No certificate spoofing or new machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md

Decision: train-37-consumer-fixture | The direct group-carry consumer extracts the shipped send body but omitted its new typing dependency. Supply that dependency and assert one stop before normal answer/terminal-notice dispatch; retain recorded disclosure/restart and no-duplicate assertions. This is test-only, with no product fallback. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-37-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merges, existing regeneration tools, and focused consumer verification. No added runtime mechanism. Handoff readiness and authority guard start, exact batch identities and durable receipts guard outcomes, and existing cap/stop/deadline bounds remain. No unattended production-completion or release-acceptance claim.
80/20: Run changed tests, direct imports and prescribed journal/pinned checks; no full suite, transitive import closure, second base worktree or load burner. Native certification belongs to the Studio.
VERDICT: author submission for desk gate; no independent convergence claim
