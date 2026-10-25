# Change review — keep rolling summaries through overlapping replies and full fact lists

Subject base: 019172c5a26008c2cbd2036bcb35975a086f22e7
Review state: open
Reviewed content: none
Outcome: An already reviewed summary prefix commits while a later ordinary reply is running, unless the memory basis changed. Valid exact facts beyond the 20-item list remain in the existing reviewed, bounded prose instead of being discarded before review.
Affected rules: 2, 7, 11, 26, 34, 36, 42, 47, 55, 60, 74, 75, 96, 101, 102, 111, 113, 116
Affected floors: secrets — same source validation, redaction and correction projection; spend cap — unchanged admission, per-span attempts, pass cap, cooldown and UNKNOWN reservations; stop — unchanged gates and retraction refusal; no duplicate sends — no send path changed and overlap test holds the ordinary reply independently; durable intake — original journal records retained, no new storage or deletion
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Changes summary acceptance within the existing preview worker; review, resource limits, durable intake and authority remain in place. No new capability or engine.
Side effects: A completed summary becomes visible sooner to subsequent packets; an already prepared answer keeps its own packet. A memory change during writer/review work refuses the stale candidate even if the ordinary reply has finished. Content comparison catches same-length undo. Overflow quotes consume the existing prose allowance and can therefore reach its existing over-bound refusal; this avoids silently throwing away a fact the writer supplied. Format 5 grants the existing bounded attempts for the changed acceptance input; old UNKNOWN reservations remain charged and unreplayed.
Undo and recovery: Revert the source/test/documentation edits and regenerate the register. No journal schema change: old builds replay these summary and failure rows, but can again discard active-turn completions and overflow facts. No replay of unknown effects or provider calls is introduced.
Multi-machine posture: The existing conversation owner runs the same worker and records accepted summaries in the same durable journal. Memory comparison is local to one in-flight attempt; it introduces no replicated state, coordination, lease or ownership path. Existing sharing and replay carry the resulting summary as before.
Layer below: Inspected runSummary admission, summary reservations and recovery pause, per-format brakes, exact source validation, memory/correction/undo projection, faithfulness and full-context review, packet capture and journal append. Read the authorized proof-room journal through 6236166 without modifying it, and checked runner log summary telemetry (none emitted). The ordinary answer owns its prepared packet, so appending a reviewed older prefix does not rewrite it.
Bug class: integration
Bug evidence: reproducer=tests/preview/proactive-compaction.test.ts; reproducer=tests/preview/summary-item-overflow.test.ts
Hook bypass: none
Convergence: none
Prompt review: Prompt text and the generated capability sentence are unchanged; technical documentation stays in the README details. Acceptance now retains exact overflow facts in the prose the existing reviewers inspect. October replay used the actual 6236101 writer, Jev undecided 0.46 and passing full-context review during an overlapping ordinary reply; its uncertain second attempt remains UNKNOWN. The 6236102 candidate now includes both stripped facts, while its recorded violation still refuses. September cascade replay covers uncertain over-cap writers and undecided Jev; guidance replay preserves real reply-review and delivered/empty-context bytes. Raw October evidence stays in the authorized ignored worktree state directory; no new capture is committed or served. Live group S acceptance belongs to the desk.
Prompt finding: 4106b49fff07 | protocol-literal | Existing evidence-boundary instruction is unchanged; this repair adds no fixture-driven meaning branch.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response is unchanged; its test pins the displayed response.
Prompt finding: 85544c20941f | protocol-literal | Existing waiting-message literal is unchanged; this repair does not change sending.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-citation instruction is unchanged; no fixture phrase was added to the prompt.
Decision: summary-stall-D1 | Replace the active-turn completion veto with exact memory-basis comparison. Idle admission still paces new work; a reviewed older prefix need not wait for an unrelated answer. Undo can change memory without changing its count. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-stall-1024-s-repair-003350-PROGRESS.md
Decision: summary-stall-D2 | Keep valid overflow quotes in existing prose, checked by the same reviewers and byte ceiling, rather than raising the item bound or adding a store. Format 5 marks changed acceptance using the existing mechanism. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-stall-1024-s-repair-003350-PROGRESS.md

Register publication: The generated register and capability metadata bind to source commit e74a5ff4e392284198973eafc034b8ff80a8f2b3. Capability sentences are unchanged; the source pin and generation were refreshed with the shipped generator.

## 1.x-first comparison and pipeline repair

Reference inspected: `JKHeadley/instar`, commit `6472aee0c8918f9dd3791b25bc95a5e753f0c488`, `src/memory/TopicSummarizer.ts`, specifically `buildSummaryPrompt()` and `TopicSummarizer.summarize()`. The 1.x implementation reads the existing prose summary and messages since that summary, asks the model to update the prose with those messages, validates the returned text and saves the completed body through `TopicMemory.saveTopicSummary()` with its message frontier. This is the rolling-summary behavior inherited here: extend retained context and persist the completed result for future sessions.

The repair belongs in 2.0's existing `tests/preview/journal.ts` reviewed journal worker. It already owns summary admission, original-message retention, correction projection, review, resource reservations and durable summary append. Keeping an already-reviewed prefix when its memory basis is unchanged restores the inherited completion behavior within those checks; retaining validated exact overflow quotes in the existing bounded prose preserves that same continuity. Importing the 1.x `TopicMemory` persistence path would introduce a second summary store and a new coherence obligation without fixing either the completion veto or the fact-list truncation at their source. No 1.x file is transplanted, and no new summarizer is needed. This is behavioral reuse through the existing 2.0 machinery, not a claim of identical persistence or concurrency semantics.

Scope accounting: the original unit base is `019172c5a26008c2cbd2036bcb35975a086f22e7`; its reviewed head is `73f94fa1c39af4bcc22c02dcfa48019593ced063` (14 changed files). The desk's broader review header starts at `d0944dbaee4acee514c53c25c3f1ba13026953d6` (2,214 changed files); the unit verdict does not freshly approve that inherited range. This documentation repair starts at the reviewed head and changes only this review record. The desk's unfilled why/plan-step fields remain desk context, not a runtime defect.

Decision: summary-stall-repair-D1 | Add the verified 1.x rolling-summary comparison and explicit unit range to this existing review; retain the reviewed implementation because another persistence path solves neither observed cause and adds machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-summary-stall-1024-s-repair-003350-PROGRESS.md

Repair side effects and undo: documentation and Decision report destinations only; revert this repair commit to undo. No runtime, model-facing, storage, authority or multi-machine behavior changes. The five safety floors are unchanged. Historical replay statements above describe the original unit; this repair makes no new live acceptance claim.

## Closing block

simplestRobustRoute: This is the simplest route through the existing rolling-summary worker: retain the result already paid for when its basis is unchanged, and put an exact fact that cannot fit the structured list in the prose that already exists to retain facts. The live discarded passing review and code-stripped 21st/22nd facts justify each change. No new job, queue, retry, engine, store, raised limit or model call. Idle start, memory/retraction freshness, reviewers, exact source/redaction checks and the existing resource brakes remain. Offline replay reaches the observed discarded frontier unattended; the desk reruns group S live after shipping.
80/20: Failing-first tests cover overlap and fact loss; both sides cover memory change including undo, pending versus absent dated decisions, invalid quotes, and the prose ceiling. Existing summary, retraction and real-shape tests pass. Author submission only; independent review and live acceptance are owned by the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
