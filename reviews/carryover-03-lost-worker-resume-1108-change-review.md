# Change review — session-work boundary reopened for exact close refusal

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: Reopen the session-work boundary review for the shared exact close-refusal constant and its host/journal consumers. The lost-worker collector behavior is unchanged.
Affected rules: 26, 33, 42, 49, 60, 68, 70, 74, 90, 101, 102, 109, 111, 113, 116, 123
Affected floors: Secrets are scrubbed in diagnostics; spend caps and stop checks are unchanged; no duplicate sends or replay is introduced; durable intake and recorded outcomes remain retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This renewed review concerns a shared lifecycle/durability boundary. It asserts no acceptance of changed bytes by the former reviewer.
Side effects: The shared named refusal allows the host to retain an uncertain local close while preserving strict journal duplicate refusal. No lost-worker recovery predicate or dispatch path changes.
Undo and recovery: Revert the unit with its matching publication. Preserve the original review and source history; do not revive the old frozen certificate for different bytes.
Multi-machine posture: Journal ownership and replication are unchanged; local host custody remains under the existing owner lease.
Team posture: Existing ownership and sharing apply. Diagnostics contain no newly exposed private input or credential, and no team permission changes.
Layer below: The strict journal admission, original lost-worker collect-before-run implementation and tests, local custody retirement/replacement, and the ordinary-lane failure latch.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none
Convergence: none
Prompt review: This repair changes lifecycle refusal handling and diagnostics, not a model prompt or model-output acceptance. Existing literal assertions are unchanged.
Decision: session-close-tolerant-1112-B | Scope the reopened round to the unit base so it cannot claim intervening unrelated changelog history. Original source and review commits remain covered by the existing train-220 review and immutable Git history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-PROGRESS.md

Prior round: the full original frozen record is preserved at e1b60f970f212bbfc6f7a6cbafdfaba9695e7192:reviews/carryover-03-lost-worker-resume-1108-change-review.md. Its original two-commit range (526543fec and e1b60f970, above 82a4c739) is also covered by reviews/train-220-change-review.md at 7b6bbe6eb736422bd5713db895c0ee14d49822ba; ancestry was checked. No earlier evidence is deleted or rewritten.

1.x comparison: This repair's research is JKHeadley/instar main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0, src/core/ReplicatedJournalCompactor.ts and src/commands/server.ts, docs/specs/unified-session-lifecycle-robustness.md, history ab26b7ca3 and ONEX-LESSONS.md section 2. Reuse projection verification and observable nonfatal cleanup design; the HLC/tmux code does not fit typed session-work liability. The unchanged original recovery implementation retains its prior comparison at 149377310f9b586641a05eddf196df4543dc031a, ResumeQueue.reconcileFromReapLog and ResumeQueueDrainer.validateReality.

simplestRobustRoute: Keep the existing collector and journal admission; share one exact refusal constant and contain cleanup errors at the existing host boundary. No new allowance, worker, timer, model or replay. Existing stop/ownership/reservation guards remain the start and limit guards; one durable settlement and visible uncertain custody remain the end guard.
80/20: The unit's real-journal reproducer, unchanged lost-worker tests, actual launcher diagnostics, native contract and mandatory checks cover this renewed scope. Full evidence is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-close-tolerant-1112-build-report.md.
VERDICT: author submission; the independent desk judges the renewed round
