# Change review — train-165 reviewed integration

Subject base: 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed counted-request head and its T1/T4 repair ancestry into the exact live base; regenerate the register without changing reviewed runtime bytes.
Affected rules: 1, 4, 8, 10, 13, 26, 32, 34, 35, 36, 37, 41, 42, 46, 49, 55, 60, 63, 69, 70, 74, 75, 77, 83, 84, 89, 90, 95, 101, 102, 111, 112, 113, 116; Purpose Rules 2, 3 and 6 and least revelation
Affected floors: secrets — fixed diagnostic fields and existing redaction; spend cap — reservations and call limits retained; stop — wrapper and native stop retained; no duplicate sends — existing unique intents and receipts; durable intake — existing encrypted journal, with no live root touched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The reviewed ancestry includes report selection and failed-tool reply settlement; the integration keeps those behaviors and their acceptance evidence together.
Side effects: Test copies alone gain at most 64 content-free model-request observations per claim. The inherited changes require current evidence selection for owed reports, return explicit rejected reports to rework, reserve time for remainder review and settle fully checked failed tool turns through the existing unique uncertainty notice. No integration-specific runtime change.
Undo and recovery: Keep the serving build until independent desk acceptance. Reject this candidate before switching if gate evidence fails. Retain the new reader for any instrumented copy and rejected-report rows; do not downgrade evidence readers, replay uncertain tool effects or overwrite durable intake.
Multi-machine posture: Source and register travel by git. Existing conversation ownership, encrypted journal retention and replication remain; diagnostics belong to a claim on its owning process, not a global ordinal. No new peer requirement.
Layer below: Read constitution in full, exact base and reviewed-head ancestry, member review and hash-verified report snapshots, counted POST reservation and streaming boundary, test-copy binding, report intent/receipt settlement, scoped review deadline, paired tool traces and native stop, existing register generator.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No new integration prompt. Inherited report guidance asks the existing mind to select or reject offered evidence by meaning; exact shape checks do not infer intent. Replay the committed T1/T4 recorded fixtures and captured summary, uncertain/undecided judgment, reply-review and empty-candidate neighbors. Local replays are not new live provider or user acceptance.
Prompt finding: 4106b49fff07 | protocol-literal | Existing protocol guidance shared with regression fixtures; no new keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 849db3a6296a | protocol-literal | Existing protocol guidance shared with regression fixtures; no new keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Existing protocol guidance shared with regression fixtures; no new keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: e8708c7fea24 | protocol-literal | Existing protocol guidance shared with regression fixtures; no new keyword meaning gate — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Deferral: generated/register.json:1 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/astra-fit-middle-independent.test.ts:76 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/astra-repair-envelope-independent.test.ts:76 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/astra-report-backlog-review.test.ts:65 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/astra-t1-recovery-review.test.ts:92 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/astra-two-short-independent.test.ts:89 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/journal.ts:2673 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work
Deferral: tests/preview/t1-verified-answer.test.ts:72 | not-a-deferral=Product pending-work guidance, regression assertion or generated metadata; no deferred builder work

Subject (44 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/README.md, tests/preview/admission-gate.mjs, tests/preview/admission-gate.test.ts, tests/preview/astra-fit-middle-independent.test.ts, tests/preview/astra-repair-envelope-independent.test.ts, tests/preview/astra-repair-send-independent.test.ts, tests/preview/astra-report-backlog-review.test.ts, tests/preview/astra-t1-recovery-review.test.ts, tests/preview/astra-two-short-independent.test.ts, tests/preview/deferral-delivery.test.ts, tests/preview/deferral-finish.test.ts, tests/preview/fixtures/t1-verified-answer-20261027.json, tests/preview/fixtures/t4-tool-failure-answer-2026-10-27.json, tests/preview/forum-routing.test.ts, tests/preview/gap-progress-final.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-deliver-all-floor.test.ts, tests/preview/journal-deliver-all.test.ts, tests/preview/journal-due-loop.test.ts, tests/preview/journal-incoherent-results.test.ts, tests/preview/journal-loop-declared-wait.test.ts, tests/preview/journal-loop-fire.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/journal-revision-keeps-results.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal.ts, tests/preview/native-stop-outcome.test.ts, tests/preview/obligation-task-answer-live.test.ts, tests/preview/phase-timing.ts, tests/preview/requested-report-live.test.ts, tests/preview/select-report-fixture.ts, tests/preview/t1-review-budget-replay.test.ts, tests/preview/t1-verified-answer.test.ts, tests/preview/tool-failure-answer.test.ts, tests/preview/tool-turn.mjs, tests/preview/work-output-repair.test.ts

Decision: train-165-merge | Merge exact reviewed head 6bd8d649e49466cc9fc4aef634d88c620cad7923; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/t4-counted-requests-1029-PROGRESS.md, snapshot sha256 cdaea397dc33adc4f445eacc80793ea5835379df7269dc1c171d56ac26e2e3ee. Its ancestry also carries reviewed T1/T4 repairs, so verify the full base-to-head delta. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md
Decision: train-165-A | Preserve all reviewed behavior; ordinary merge fast-forwarded with no conflicts or manual product resolutions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md
Decision: train-165-B | Create a separate branch directly at 9e04f28e9ef5d7c623e43e3197fde4620d8bd5c8 and retain its ancestry; no branch relocation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md
Decision: train-165-C | No product conflict arose and no head was omitted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md
Decision: train-165-D | Run foreground WSL targeted checks; classify recorded physical-bridge/macOS and allocated-provider limitations for the desk without weakening assertions. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md
Decision: train-165-desk | Run the existing cint-L37 repin/build/rehash/replay chain; repin and rehash changed zero pins, register regenerated from exact merged head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-165-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the exact reviewed head, existing repin/build/rehash/register replay and targeted consumer verification. No integration machinery. Start guard is exact live-base ancestry; end guard is a pushed clean candidate with evidence for desk acceptance; secrets, spend, stop, durable intake and uniqueness remain enforced. No unattended live completion is claimed.
80/20: Preserve reviewed behavior and history, check direct consumers and recorded decision boundaries, and submit host-dependent and full-gate evidence honestly to the Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
