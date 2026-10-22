# Change review — train-135 reviewed wakeup repair integration

Subject base: 4a2635bc2064d5eaec5e451360634eeabecaad9d
Review state: open
Reviewed content: none
Outcome: Integrate exactly the reviewed sched-tool-1022 head e436401c47e405c0c3e1210daa90e80e6cfaba05 into the live base, preserving checkpointed scheduling, stop-only cancellation and truthful provider observation.
Affected rules: 1, 4, 34, 36, 37, 41, 42, 49, 56, 60, 70, 74, 90, 101, 102, 103, 111, 113, 116
Affected floors: secrets — existing admission and egress checkpoints retained; spend cap — existing host reservation and per-call caps retained; stop — closed-claim enforcement and exact cancellation retained; no duplicate sends — existing durable effect identity and journal fences retained; durable intake — existing journal preparation unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Release integration of reviewed model-facing admission and observation changes; no additional product behavior.
Side effects: Exact boolean stop:true is normalized to cancellation; other wakes reach an installed checkpoint or retain the ungated refusal. Local time limits preserve prior exchange evidence, which still expires normally. Provider identity mismatch remains visible. The repair record supersedes the original unit's categorical new-wake refusal description.
Undo and recovery: Retain the current live base until the desk accepts this candidate. Roll back to that accepted build using the existing release process; no schema migration or live root change occurs in this unit.
Multi-machine posture: Cancellation remains harness-session-local; each root observes its selected doorway. Existing host ownership, effect preparation, reservations and send uniqueness remain authoritative. No new replicated state or placement mechanism.
Layer below: Inspected admitToolCall, subscriptionExchange and the journal-agent doorway observer diff; retain the member's actual checkpoint HTTP tests, executable hook and captured journal replay. Read the member report including its checkpoint-authority repair and the desk replay chain.
Bug class: integration
Bug evidence: reproducer=tests/preview/sched-tool-replay.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only
Convergence: none
Decision: train-135-merge-sched-tool | Fast-forward the exact reviewed e436401c47e405c0c3e1210daa90e80e6cfaba05 from the exact live base; member evidence is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/sched-tool-1022-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-135-PROGRESS.md
Decision: train-135-A-preserve | Preserve all reviewed member bytes including its later checkpoint-authority repair; no conflict or hand merge occurred. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-135-PROGRESS.md
Decision: train-135-B-live-base | Keep 4a2635bc2064d5eaec5e451360634eeabecaad9d in ancestry and leave train-134 untouched; no main merge or branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-135-PROGRESS.md
Decision: train-135-D-host-checks | Apply the explicit WSL exception to macOS and Studio-dependent checks; report actual failures and missing Studio evidence without altering tests or declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-135-PROGRESS.md
Decision: train-135-desk-replay | Run the supplied repin, build, owner-rehash and register replay chain; generated output is regenerated rather than hand-edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-135-PROGRESS.md
Prompt review: No additional prompt edits. Replay the member's captured train-133 input/output and historical uncertain, undecided, review and empty-reply shapes. No fresh live provider use or autonomous wake completion is claimed by this integration.

Verification: Targeted changed tests, direct importers, journal tests, production provider subscription, unchanged context floor and pinned gate are recorded with exact outcomes in the train report. Studio-only lifecycle and evidence checks are disclosed there. The member report was downloaded read-only before checking; its canonical Studio references are retained.

## Closing block

simplestRobustRoute: An ordinary merge of the exact reviewed head followed by the existing desk generation chain and targeted consumer checks is the simplest robust route. No product machinery is added. Existing start authority, durable end-state evidence, stop, spend and send fences remain intact. This candidate claims integration evidence, not a new unattended live wake.
80/20: Preserve the reviewed repair and verify the affected consumers; leave the full combined-candidate gate to the desk as instructed.
VERDICT: author submission; no independent verdict claimed
