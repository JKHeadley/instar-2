# Change review — train-151 summary stall integration

Subject base: 019172c5a26008c2cbd2036bcb35975a086f22e7
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed rolling-summary repair onto the accepted train-150 live base, retaining completed faithful summaries and validated overflow facts within existing bounds.
Affected rules: 1, 7, 11, 26, 34, 36, 37, 42, 47, 49, 55, 60, 70, 74, 75, 90, 96, 101, 102, 111, 113, 116
Affected floors: Secrets retain existing redaction and exact source validation; spend retains reservations, cooldown, attempts and output bounds; stop gates remain; no send path changes or duplicate-send permission; durable original intake and journal ownership remain.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration touches the shared default-on journal worker and preserves the reviewed member's acceptance boundaries.
Side effects: Completed prefixes can become available during a later reply without changing that reply's prepared packet. Memory changes, including same-count undo, reject stale summaries. Valid overflow quotes consume existing bounded prose; oversized candidates remain refused. Format 5 uses the existing bounded retry version. No new model call, queue or store.
Undo and recovery: Retain current live build until the desk accepts this candidate. Revert through the existing release process and regenerate publication if required; no state conversion or runner change. Old journals remain readable and unknown effects are never replayed.
Multi-machine posture: Existing conversation owner executes the worker; accepted summaries use existing journal replication and replay. Memory-basis comparison is local to an in-flight attempt and introduces no shared coordination or lease.
Layer below: Read both constitutional documents, exact member diff and complete supplied member report; inspected summary admission, item source checks, memory freshness and post-retention byte ceiling. The member's reviewed 1.x comparison identifies TopicSummarizer at 6472aee0c8918f9dd3791b25bc95a5e753f0c488; existing 2.0 journal persistence avoids a second store. Consumer tests and existing desk generation verify the combined bytes.
Bug class: integration
Bug evidence: reproducer=tests/preview/proactive-compaction.test.ts; reproducer=tests/preview/summary-item-overflow.test.ts
Hook bypass: none
Convergence: none
Prompt review: No additional model-facing change beyond the reviewed member. Its report records October 6236101 passing/undecided overlap and uncertain reservation, plus 6236102 overflow with refusal preserved. Committed September cascade and production-session-work fixtures replay uncertain writers, undecided Jev, reply reviews and empty reply shapes on this tree. Raw October journals remain Studio evidence; no fresh live acceptance is claimed.
Decision: train-151-merge | Ordinary merge of exact reviewed 7e4af129491315f07cdca430b2917a6cc500d1cc, fast-forward with no conflicts. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-stall-1024-s-PROGRESS.md read in full from its SHA-verified supplied snapshot. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Decision: train-151-A | Preserve all member behavior and accepted base behavior; fast-forward requires no manual product or changelog resolution. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Decision: train-151-B | Create the branch directly at live 019172c5a26008c2cbd2036bcb35975a086f22e7, already containing origin/main; no branch movement or main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Decision: train-151-C | No product conflict and no omitted head; exact member ancestry will be checked before handoff. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Decision: train-151-D | Run targeted checks on WSL and report unchanged host-dependent checks and Studio-only evidence paths honestly for the Studio gate, without weakening assertions or declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Decision: train-151-desk | Use downloaded repin/build/rehash/replay tools with only Linux sed syntax adaptation; no inventory or owner pins changed, and generated publication is replayed at the reviewed member head. Preserve the fixed-prompt guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-151-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated quotation of governing rules, not a deferred commitment
simplestRobustRoute: This is the simplest robust route: one ordinary exact-head merge, the existing desk regeneration chain, and consumer tests. No new machinery. Existing idle admission is the start guard; faithful, fresh, bounded summary append is the end guard; stop, source validation, reservations, cooldown and size bounds are the limit guards. This integration claims no unattended live deployment or fresh live acceptance.
80/20: Verify the changed paths and their direct consumers, preserve the reviewed implementation, and submit the combined candidate to the Studio gate without a full-suite run here.
VERDICT: author submission; independent convergence and live acceptance belong to the desk
