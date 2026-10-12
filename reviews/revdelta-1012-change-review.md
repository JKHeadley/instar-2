# Change review — Restore review and summary margin without moving limits

Subject base: 8f3ef4e9f01c11f893ad06b1c839f938262d118b
Review state: open
Reviewed content: none
Outcome: Keep the full review within its 6636-byte reserve and the summary within its 22959-byte allowance, each with at least 40 bytes spare.
Affected rules: 1, 4, 12, 13, 34, 36, 37, 41, 47, 49, 58, 70, 74, 78, 84, 101, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing checks; context floor, reserve and fixed allowance remain unchanged.
Operator questions: none about behavior or authority.
Suggested tier: critical
Declared tier: critical
Tier rationale: Model-facing guidance needs actual serialized-envelope measurements and recorded-output replays.
Side effects: Shorter review instructions preserve every judgment and format requirement. Summary correction instructions occur once, with their fuller existing wording retained. The review introduction and verdict-consistency sentence retain the wording consumed by existing fixtures. No parsing, admission or dispatch decisions change.
Undo and recovery: Revert the source repair and regenerate publications; no stored journal or live installation changes.
Multi-machine posture: Deterministic prompt text on every machine; no new state, ownership or replication behavior.
Layer below: Measured prepareJournalEnvelope, exact answer packet reuse by replyReviewContext, answer-only instruction omission, generated capability provenance, and complete summary envelope.
Bug class: integration
Bug evidence: reproducer=tests/preview/default-context-floor.test.ts; train-11 baseline review delta 6746 exceeds 6636 and summary 23073 exceeds 22959. After: delta 6590 (46 spare), summary 22916 (43 spare), answer unchanged at 22657. All four requested files pass, 39 tests with the existing manual capture skipped.
Hook bypass: none
Convergence: none

Cause: Comparing exact holdack2-1011 and train-11 envelopes finds no added review-only packet text or review question. Commit 89fca853 shortened answer-only instructions by 376 serialized bytes, raising the delta from 6370 to 6746. Summary growth is the af287b72 capability sentence and digest (+306), less 89fca853 recall compaction (-98): 22865 + 208 = 23073.

Repair: Shorten review question prose by 156 bytes without changing rule text, exceptions, mandatory verdicts, uncertainty handling or output bounds. Remove a duplicate summary correction sentence (153 raw / 157 serialized bytes); the adjacent fuller instruction retains correct/reply mode, answer candidate id, exact old reply clause and original question.

Recorded replay: guidance-live-2026-10-03.json supplies reviewer outputs for 969389923, 969389925, 969389883, 969390016 and 969389926. Current review envelopes carry those candidates. retrospective-duty-followup-train-1-2026-10-08.json supplies delivered 715672479 and empty-context 715672550 bytes. proofroom-summary-cascade-stall-2026-09-30.json supplies writer 715672484, uncertain results 715672492/496/497, Jev 0.38 undecided and stronger-review output. defaultroot-proofroom2-rule40-2026-10-02.json supplies unsure Jev scores and full reviews through the live-shaped conversation. These establish path execution with recorded outputs, not a fresh live model quality judgment.

simplestRobustRoute: Shorten existing unpinned prose and remove one exact semantic duplicate; retain all facts, existing machinery and limits. The existing floor test enforces maintenance margin, and existing recorded replays prove delivery of the changed questions. No new mechanism or autonomous capability is introduced.
80/20: Measured red-to-green boundary evidence and recorded replays support desk review; no independent convergence claim.
VERDICT: author submission; the review desk records its independent verdict.
