# Change review — report route state without offloading reply work

Subject base: fd0a80e2dab68e9fd5c5d5b33ce2b7dc13468177
Review state: open
Reviewed content: none
Outcome: The doorway notice states its known model-route status without telling the operator to fetch details. The real full-context reviewer accepts the repaired candidate from answer-check update 715675469. The role-aware self-description remains intact.
Affected rules: 1, 4, 8, 36, 37, 41, 42, 49, 56, 58, 70, 74, 77, 84, 86, 101, 103, 104, 111, 112, 113, 116
Affected floors: secrets — all outbound secret checks unchanged; spend cap — call reservations unchanged; stop — existing stop unchanged; no duplicate sends — journal intent and notice episode keys unchanged, restart replay sends once; durable intake — original messages and held candidates remain recorded
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: A short infrastructure notice is model-reviewed as part of the answer, so real model judgments and a recorded journal replay verify the user-facing fix.
Side effects: Removes the request to send status from doorway notices. The status command, route identities, freshness facts, three-route display bound, and once-per-episode delivery remain. Already-recorded notice text stays immutable. No reply-review rules, thresholds, parser, capability, permission or provider framing change.
Undo and recovery: Revert the notice wording and its regression expectations together, then regenerate pins. No journal migration; old notice keys and historical text remain readable.
Multi-machine posture: Each installation renders its recorded doorway map locally; repository-shared wording, no new state, ownership, transport or replication behavior.
Layer below: doorwayFreshness and observeExchange determine the reported state; openReplyNotices and deliveredNotices retain once-per-episode semantics; journal reply cascade preserves the original review hold and revision-review unavailability; prepareJournalEnvelope, readAnswer and parseReplyReviewVerdict replay the unchanged full-context reviewer.
Bug class: integration
Bug evidence: reproducer=tests/preview/doorway-notice-replay.test.ts
Hook bypass: none; core.hooksPath is unset and the inspected common hooks directory contains only samples
Convergence: none
Decision: train8-notice-source | Repair the infrastructure wording that caused the review finding, not the role-aware self-description or the reviewer. The recorded draft already answered the requested probe correctly. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-8-repair-PROGRESS.md
Prompt review: No reviewer instruction changes or expected answer are supplied to the judge. Real repaired and offload-control calls use the captured original prompt, current replyReviewQuestion and the same five selected rules. Repaired notice receives PASS on all five; offload control receives parks_on_user VIOLATION. The offline integration deliberately retains original Jev unsure scores to force the full-context review. Original defers_work violation plus recorded revision and unavailable re-review still produces the holding notice. parks_on_user alone remains advisory under the unchanged existing rule set.
Deferral: tests/preview/fixtures/doorway-notice-held-2026-10-11.json:95 | not-a-deferral=Immutable captured reviewer explanation of the original failure, not a new work promise.
Deferral: tests/preview/fixtures/doorway-notice-offload-review-2026-10-11.json:12 | not-a-deferral=Recorded model reasoning about a deliberately rejected control, not a new work promise.

Verification: Targeted notice/replay tests pass 13/13; existing topic-awareness and self-description tests pass 17/17; recorded summary-cascade and held-cascade replay tests pass 16/16; selected recorded-shapes check passes 1/1. Full suites are delegated to the pipeline. The saved full gate report has one old topic-awareness failure already repaired at a66c39f6; its repaired test passes here. Architecture, typecheck and build pass. Final pin regeneration and cheap checks are recorded in the desk progress file.

## Closing block

simplestRobustRoute: State the known route result directly in the existing notice; remove the unnecessary request for another user action. This is the simplest route: no new machinery, exemption or weaker check. Existing caps, stop, durable intake, secret floors and send fences guard the path. Real-model recorded-candidate replay passes; a new deployed answer-check is the pipeline's remaining live gate, not claimed here.
80/20: The recorded failure, accepted replacement and rejected offload control identify and verify the source change; existing review and notice machinery suffice.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
