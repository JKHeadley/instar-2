# Change review — source conversation for scheduled tool work

Subject base: 81c4897e436e3bcd1df73444f96cb7af6f3724a6
Review state: open
Reviewed content: none
Outcome: Scheduled commitment and blocker tool work selects the originating turn's conversation, preserving its workspace and kept harness session across journal restart. Other topics remain distinct; General and private identities keep their existing canonical forms.
Affected rules: 33 (journal, workspace and session consume the same source identity), 45 (repair the launcher consumer), 96 (continued work retains its source session), 34 and 70 (consumer regression with real journal scheduling, disk workspace and restart), 74 (side effects and recovery), 101 (plain commits, no hook bypass), 102 (reported decision), 113 (multi-machine posture), 116 (reuse the durable source reference)
Affected floors: secrets — existing custody and disclosure checkpoints remain intact; spend cap — existing shared liability reservation is unchanged; stop — existing stop predicate is unchanged; no duplicate sends — no changes to intent, receipt or report delivery; durable intake — existing append and projection remain authoritative
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The launcher selects the persistent context of tool work; a wrong identity loses continuity and mixes topics at that consumer.
Side effects: Obligation work previously routed to General now uses its source topic. Already misplaced General files are not moved or copied across topic boundaries. Unknown IDs retain the existing General fallback; this helper adds no authority or admission gate.
Undo and recovery: Revert this repair to restore the previous selector; retain journals and workspace directories. Reverting reintroduces the known topic-continuity defect and should only accompany stopping affected work or a replacement fix.
Multi-machine posture: Identity is deterministically derived from replicated journal records; physical workspace and kept-session storage remain machine-local under the existing ownership/admission path. No new store or independent writer.
Layer below: Real journal commitment/blocker source records and workObligations scheduling, launcher conversation argument, and conversationWorkspace hashing and on-disk retention.
Bug class: integration
Bug evidence: reproducer=tests/preview/forum-routing.test.ts
Hook bypass: none
Convergence: none
Decision: forumtopics-obligation-source | Resolve commitment and blocker obligation IDs through the existing durable source turn before selecting the conversation; preserve direct-turn and private keys without adding state or restricting tools | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-forumtopics-repair-181657-PROGRESS.md
Prompt review: No prompt, output parser, or accept/escalate/refuse logic changes. The repaired consumer changes the workspace and kept session supplied to tool execution. The targeted regression evaluates the launcher's exact argument expression with real journal scheduling and physical workspace files, covering both obligation kinds, topics 7 and 9, absent/1 General, private mode and restart. Restoring the old expression makes only the forum regression fail (topic-7 becomes general); the fixed expression passes. Existing captured-shape replay tests are also rerun: summary-cascade-stall, held-cascade-replay, guidance and selfdesc-abilities. Their recorded model outputs remain unmodified. This is offline consumer evidence, not fresh live model, mounted harness or Telegram activation evidence.

## Closing block

simplestRobustRoute: Follow the commitment/blocker record's existing source field to its turn, then use the existing canonical conversation helper. This is the simplest robust route: it repairs the consumer without new state, a registry, a gate or a capability restriction. Existing stop, authority, spend and workspace bounds still apply. No autonomous live-completion claim is made.
80/20: Focused tests pass and detect the original bug; typecheck and build pass. Only targeted tests run on WSL; the desk owns full-suite and macOS proof. The saved gate results path returned HTTP 404, so historical post-test coverage cannot be reconstructed here.
VERDICT: author submission; independent review remains required
