# Change review — Stop paced result continuation after cancellation

Subject base: 60ca052995fc1163e064d40e246f281d179bdf56
Review state: open
Reviewed content: none
Outcome: Unsent parts of a paced owed-result reply recheck the request's current source standing, closure and pending operator withdrawal before dispatch, including after restart. An authorized continuation still completes.
Affected rules: 1, 4, 28, 37, 49, 52, 57, 63, 70, 74, 83, 93, 101, 102, 111, 113, 116, 121, 123
Affected floors: secrets — existing outbound check; spend cap — existing admission; stop — existing gate and push checks; no duplicate sends — preserve durable starts and receipts; durable intake — preserve all journal rows and undelivered reports.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This repairs current authority at the outbound continuation checkpoint.
Side effects: owedResultAuthority defaults to requiring an unbound report as before. Continuations pass their exact reply id and require a still-pending report bound to it, retaining all source, open-commitment and slot checks. actionBlocked reuses pending operator withdrawal handling. The guard runs before spending pacing budget or recording another part start. The original review now explicitly includes Rule 93. Delegated owner-manifest and inventory repin tools found zero changed pins. The generated register was replayed against source commit 52b68cb83d518a6bfdcda166155b259e2d3cea5a, generation c5a7f7db6affff296b1f2e51195532b3d7042278f6a7c1efdee97f0c109a9c3a.
Undo and recovery: Revert the repair commit to restore the old boundary, which would restore the demonstrated cancellation defect. Keep all starts, receipts and unfinished reports; never replay an unknown send. No store migration or new scheduler.
Multi-machine posture: Existing owned conversation journal and signed occurrence remain authoritative. Reopening or transferring that journal retains cancellation, exact reply binding and part receipts. No machine-local authority is added.
Team posture: Verified source identity, original destination and current audience admission remain in the existing path. An unsettled verified operator message holds continuation for interpretation; unrelated principals gain no cancellation authority. Sharing is unchanged and private by default.
Layer below: Inherits and rechecks the accepted JKHeadley/instar main comparison at db3ed6d3052cfcc24888b6c8bc86086abcfc2987: src/monitoring/CommitmentTracker.ts, src/monitoring/PromiseBeacon.ts, src/scheduler/JobScheduler.ts; docs/specs/PROMISE-BEACON-SPEC.md, PROMISE-BEACON-ESCALATION-SPEC.md, agent-owned-followthrough.md, COMMITMENTS-COHERENCE-SPEC.md and COMMITMENTS-AGENT-CONTRACT-VOCABULARY-SPEC.md; history 7e8fde8e8/a29957130/323573c11/164d3f56d/570bd25fc. Reuses durable lifecycle, terminal cancellation, original-topic batching and stable retry identity through existing 2.0 owed-result machinery. Read ONEX-LESSONS.md section 5 (shared ownership, durable reminders, missing checkInAt writer). No second scheduler or store improves this dispatch check. Inspected pendingReport, attachableReport, actionWithdrawn, owedUnsettled, report binding and final receipt settlement beneath the repair.
Bug class: integration
Bug evidence: reproducer=tests/preview/owed-delivery.test.ts; restart=tests/preview/owed-delivery.test.ts; live=independent review's writer-through-delivery reproduction, not a fresh live deployment
Hook bypass: none; no bypass flags used.
Convergence: none
Decision: DPR-CANCEL-CONTINUATION | Reuse owedResultAuthority with exact reply binding and actionBlocked before each unsent owed-result part. This keeps legitimate split delivery and blocks queued or recorded cancellation without losing receipts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/deliver-promised-results-1112-p2-repair-PROGRESS.md
Prompt review: No prompt or parser changed. Targeted owed-delivery tests replay the inherited real recorded summary writer 715672480, uncertain summary 715672483, undecided Jev 715672482, unsure Jev 969389570, reply review 969389923, delivered reply 715672479 and empty reply 715672550 from retrospective-duty-followup-train-1-2026-10-08.json; obligation result 6232091 from obligation-step-outputs-live-2026-10-04.json; and credlabel-proofroom-T-2026-10-03.json review shapes. These are fixture replays, not fresh live extraction. Existing protocol-literal dispositions follow.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged fixed emergency-stop renewal disclosure; the fixture asserts the existing protocol, not a semantic trigger.
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged grounding instruction against inventing tool attempts; the fixture checks delivered guidance rather than prescribing a verdict.
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged activation-expiry disclosure, quoted by the closing-notice fixture; no new meaning classifier.
Prompt finding: 85544c20941f | protocol-literal | Unchanged infrastructure outage sentence preserving durable intake; not a fixture-specific model judgment.
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged stopped-work uncertainty disclosure; the fixture verifies saved-input reporting rather than prompting an expected verdict.
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged stopped-work notice, not an intent classifier or a new model instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged sourceLabel provenance instruction; the regression checks source attribution guidance.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory inventory response; no fixture phrase is used as a gate.

simplestRobustRoute: This is the simplest robust route: extend the existing authority helper to recognize this exact already-bound reply, then reuse cancellation checks at the existing part dispatch checkpoint. The start guard is live source/closure/withdrawal authority, the end guard is full receipts, and existing pacing and safety floors remain. No ability, tool or autonomous work is removed. No unattended live deployment is claimed.
80/20: Both reviewer cases first failed with actual send counts 5 to 9 and 10 to 12. With the repair both pass, retain exact parts/reports through replay and a fresh hourly budget, and the existing successful paced-continuation test still completes. The targeted delivery and reply-parts files pass; full-suite and live acceptance remain pipeline/desk work.
VERDICT: author submission; no independent approval claimed.
