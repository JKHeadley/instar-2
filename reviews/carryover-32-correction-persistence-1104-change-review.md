# Change review — correction recall persistence and occurrence identity

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: frozen
Reviewed content: sha256:cb9d093509f2cda159dbe92910e25a9f6722cf0e05c8366d10ad844dd1c550e4
Outcome: Preserve a tested partial repair for carryover row 32 in lanes/carryover-1028.md. A source-unresolved operator correction teaches recall from its own durable message, and two signals from one operator message cannot manufacture a repeated failure. This change does not claim the complete CorrectionLedger, CorrectionCaptureLoop and CorrectionInstanceFixGate carryover or close row 32.
Affected rules: 7, 11, 24, 26, 28, 34, 36, 39, 49, 70, 74, 85, 101, 102, 113, 116
Affected floors: secrets — existing redaction and projection remain the only text path; spend cap — no new model call; stop — no new execution or retry; no duplicate sends — no effect dispatch added; durable intake — existing journal rows remain the sole source of truth.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Recall changes what later model calls see. The two measured repairs have focused regression and restart checks; the full feature, recorded-shape qualification, independent review and live task remain outstanding, so this is not a READY submission.
Side effects: Source-unresolved corrections now contribute bounded retrieval cues just as reminders do. Duplicate signals still remain in diagnostic failure history, but only distinct trigger messages contribute to pinning. The existing twelve-cue, two-occurrence and four-pin limits stay in force.
Undo and recovery: Revert this change to restore the previous projection. No journal schema, persisted row, policy or migration changes; either projection reads the same history.
Multi-machine posture: Pure projection from the existing journal. Equal journal prefixes yield equal lessons on each machine. This introduces no machine-local store and does not widen journal replication or conversation ownership.
Layer below: Inspected both constitutional documents in full, the three named 1.x files at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, server capture and class-review wiring, analyzer recurrence rules, driver verification, and the sentinel design. In 2.0 inspected memoryFailures/memoryLessons, recall consumption in journal.ts, and retrospective feedback ownership and closure. Journal replay retains correction rows, but the learning projection ignored source-unresolved corrections; it also counted detectors instead of distinct operator occurrences when pinning.
Bug class: durability
Bug evidence: reproducer=tests/preview/memory-learning.test.ts; restart=tests/preview/memory-learning.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, parser, model dispatch or acceptance rule changes. Recall evidence changes, so real recorded P2/P3 and ordinary-answer fixtures are replayed alongside explicitly scripted correction decisions. This is not a claim of a full model-facing carryover qualification.

Decision: C32-1104-1 | Apply the 1.x per-lesson occurrence aggregation design inside the existing journal projection. Use durable source and trigger ids instead of introducing a second store or a normalized-text identity that can lose distinctions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-correction-persistence-1104-PROGRESS.md
Decision: C32-1104-2 | A correction with no resolved original learns against the correction message, subject to the same withdrawal check as reminders; one trigger contributes at most one occurrence per source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-correction-persistence-1104-PROGRESS.md
Decision: C32-1104-3 | Preserve these measured repairs without presenting them as a full port. Capture/backlog, tuned recurrence and routing, class-review correspondence, and closure parity need their own complete evidence before row 32 can close. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-correction-persistence-1104-PROGRESS.md

## Closing block

simplestRobustRoute: Correct the existing recall projection over already durable, validated operator records. The per-source set of trigger ids prevents a named failure: two detectors on one message falsely satisfying the repeated-failure threshold. No extra model, store, scheduler, effect path or standing grant is introduced. Existing intake validation starts the path, withdrawal excludes retired sources, and existing recall bounds limit its output. No unattended shipped-path result is claimed.
80/20: Preserve the two can-fail repairs as a partial result; they do not establish parity for the full grouped correction-learning outcome.
VERDICT: author submission; this record asserts no independent verdict.
