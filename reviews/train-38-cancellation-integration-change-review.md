# Change review — train-38 interrupted answer recovery

Subject base: 2c1a275e2db3568020cbdff0fac01ea040efeee7
Review state: open
Reviewed content: none
Outcome: Integrate the existing cancellation repair so a transient authority read does not immediately kill an admitted answer; an interrupted empty answer keeps bounded replacement or durable recovery ownership.
Affected rules: 1, 4, 8, 26, 34, 36, 37, 41, 46, 49, 55, 58, 60, 68, 70, 74, 75, 83, 95, 101, 102, 105, 111, 112, 113, 115, 116; purpose constraints 2 and 3.
Affected floors: secrets — existing scrubbed capture and tool checkpoints retained; spend cap — original UNKNOWN charges retained, replacement separately reserved; stop — strict admission and immediate worker/file/journal stop and readable withdrawal; no duplicate sends — current send-intent fence, one replacement only with complete read-only evidence and verified cleanup; durable intake — existing journal retains owned recovery before replacement dispatch.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Imports an existing physical cancellation and answer-recovery change; no independent redesign.
Side effects: Already admitted calls tolerate at most eight additional unreadable observations over 200ms. Present withdrawal remains immediate. Recovery may spend one separately capped reservation; incomplete tool evidence permits owned reconciliation only. Follow-up uses the existing next-reply delivery policy. Merge keeps current session connectors and resource-owner stderr diagnostics. Native supported composition is recertified through its real contract on the Studio before the desk derivation tool updates its declaration.
Undo and recovery: Revert the integration as a unit and regenerate register with the existing scripts; retain the journal and UNKNOWN charges. Do not repeat any prior uncertain reservation or send. The new journal fields are additive; recovery rows and historical legacy replacements retain their recorded meaning.
Multi-machine posture: Process liveness is local to the owning machine; recovery uses the existing durable journal, writer ownership, replication demand and send fences. No new store, peer dependency, authority or tool restriction.
Layer below: Read preserved forum-answer-copy-20261015-010503 via status/read-only journal: update 715676215, SIGKILL/stopped after 2499ms, no output, verified cleanup, no operator stop, infrastructure notice 532. The old generic cause cannot identify the exact predicate; transient read is a hypothesis, not a proven cause. Inspected active/toolsActive, owner-record snapshot invalidation, resource-owner poll/admission and whole-trace producer/reconciliation. Existing answer-cancel-transient-1013 source and completeness repair address the same failure class; merge reuses their implementations and history.
Bug class: integration
Bug evidence: reproducer=tests/preview/answer-cancel-recovery.test.ts; restart=tests/preview/answer-cancel-recovery.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, sample files only.
Convergence: none
Decision: train38-cancel-reuse | Merge existing repair 2caeef9e including strict admission and complete-evidence/durable-owner corrections; keep current train additions and regenerate pins instead of inventing a duplicate repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-38-repair-PROGRESS.md
Prompt review: The imported obligation instruction describes recorded interruption and UNKNOWN effects; no new literal semantic gate or prompt tuning. Real train-38 outcome/request/notice replay exercises owned recovery for its historical incomplete trace, and complete empty production-reader records exercise bounded replacement. Success text is explicitly a test double, not claimed as fresh model or Telegram evidence. Captured summary/uncertain/Jev/review/delivered/empty shapes remain negative cancellation controls and pass through existing worker notice tests; source updates recorded in PROGRESS.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory-list reply literal is unchanged by the merge.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label guidance is unchanged by the merge.
Deferral: tests/preview/journal.ts:741 | not-a-deferral=describes implemented separately reserved replacement and owned recovery
Deferral: tests/preview/journal.ts:753 | not-a-deferral=describes implemented owned reconciliation for uncertain writes
Deferral: tests/preview/journal.ts:4687 | not-a-deferral=validates the implemented durable follow-up record
Deferral: tests/preview/journal.ts:11186 | not-a-deferral=delivers recovery instructions to the implemented obligation worker

Register publication: Existing desk rehash/repin reported zero owner/inventory changes. Replayed generated/ from fdde5efddc4ac37bf76a75532751053b13e3e4f2, generation sha256:49fa43ace12e905e98f99482c524bbde5f5fe600c02a04b37c93c7fa486b1209. Targeted replay/diagnostic/cache/egress/notice suite passes 84/84; native contract passes 10/10. New regression fails both cases on the pre-repair journal and passes both after integration.
Deferral: generated/register.json:1 | not-a-deferral=generated projection of implemented declarations

## Closing block

simplestRobustRoute: This is the simplest robust route: merge the existing source repair, preserve current train additions, add this incident to recorded replay, and regenerate evidence. Existing cancellation polling, answer replacement and obligation machinery do the work. The bounded read allowance prevents transient read failures masquerading as withdrawal; complete trace evidence prevents duplicate uncertain effects; pre-dispatch ownership prevents a second interrupted process losing the task. Start guards are strict authority/admission and stop; end guards are delivered answer or owned recovery, verified cleanup and send fence; limits remain 200ms/nine observations, one replacement and existing caps. Offline replay and the Studio native contract are evidence here; the pipeline supplies fresh live answer and full-suite acceptance.
80/20: Focused touched-file tests, typecheck/build and cheap gates only; no full suite or load test on Studio. No independent convergence or fresh live answer claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
