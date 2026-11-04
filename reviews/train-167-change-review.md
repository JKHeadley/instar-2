# Change review — train-167 reviewed integration

Subject base: 45ce50d0244ea2a29cb2bd31cd72f5eb44ea3003
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed report-delivery head and preserve its single-result rendering while retaining every selected subject through answer assembly and revision.
Affected rules: 1, 4, 8, 10, 26, 34, 36, 37, 49, 57, 58, 69, 70, 74, 83, 90, 92, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing scrub/review; spend cap — existing bounded calls; stop — unchanged; no duplicate sends — exact selected text rendered once and unknown receipts remain unresolved; durable intake — unchanged journal and intent protocol.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates a model-facing delivered-result repair; exact reviewed bytes, no new integration runtime code.
Side effects: The integration repair renders one shared result under all its independently selected subjects. Existing single-subject behavior remains; grouping never infers selection or fulfillment authority. Shared headings can consume more bounded answer bytes, so a group that does not fit remains pending. Existing final-text, claim-scoped review and complete-receipt checks remain authoritative.
Undo and recovery: Keep current live build until desk acceptance; revert the integration if rejected. Journal schema remains compatible; preserve uncertain delivery records and never resend an unknown effect.
Multi-machine posture: Existing journal ownership, durable intent and receipt protocol unchanged across restart and owner transfer. No new store or peer requirement.
Layer below: Read constitution, member reports and reviewed source; inspect pendingReports, current-model selection, reply revision, sentObligations and receipt settlement. The direct-consumer sweep exposed erased subject labels in journal-deliver-all; reconcile subject identity with exact-result deduplication and test the same association through revision.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-deliver-all.test.ts
Hook bypass: none
Convergence: none
Prompt review: Preserve reviewed report guidance and existing bounded format retry. Replay captured request 46040805 and answer 46040806 plus original rejected fulfillment outputs and the recorded corrected model response; summary/uncertain/Jev/reply-review/empty-context neighbors are covered by retained fixtures. No fresh live call or deployed proof claimed.
Prompt finding: 4106b49fff07 | protocol-literal | Existing runner protocol wording retained from the reviewed member; not a new fixture-specific instruction.
Prompt finding: 849db3a6296a | protocol-literal | Existing runner protocol wording retained from the reviewed member; not a new fixture-specific instruction.
Prompt finding: 85544c20941f | protocol-literal | Existing runner protocol wording retained from the reviewed member; not a new fixture-specific instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Existing runner protocol wording retained from the reviewed member; not a new fixture-specific instruction.

Deferral: generated/register.json:1 | not-a-deferral=Existing generated evidence classification; no integration deferral.
Deferral: tests/preview/fixtures/report-settlement-46040806-2026-11-04.json:53 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/fixtures/report-settlement-46040806-2026-11-04.json:54 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/journal-deliver-all.test.ts:112 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/journal-deliver-all.test.ts:133 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/journal.ts:10818 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/report-settlement-live.test.ts:72 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.
Deferral: tests/preview/report-settlement-live.test.ts:165 | not-a-deferral=Exact result/subject rendering or recorded fixture assertion, not a new promise by this train.

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/fixtures/report-settlement-46040806-2026-11-04.json, tests/preview/journal-deliver-all.test.ts, tests/preview/journal.ts, tests/preview/report-settlement-live.test.ts

Decision: train-167-merge | Ordinary merge of exact reviewed 4abd1a9a957766de3b05afeeb1ab16f16033b1cd; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/resource-recovery-d1c-1104-PROGRESS.md exists on Studio. Fast-forward preserves reviewed bytes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md
Decision: train-167-A | Preserve member and live-base behaviors; the subject-label integration regression is resolved by train-167-subjects. No merge conflicts or changelog edits. No hand-edited generated files. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md
Decision: train-167-B | Use supplied separate train-167 checkout already created at exact 45ce50d0244ea2a29cb2bd31cd72f5eb44ea3003; reflog and ancestry verified. No main merge or branch reset. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md
Decision: train-167-C | No product conflict and no member left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md
Decision: train-167-D | Targeted checks on Studio; no host exemption invoked. Full-suite and live proof belong to desk; no serving login or live-root action. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md
Decision: train-167-desk | Run existing cint-L37 repin/build/rehash/register replay from the reviewed source head; no added pipeline machinery. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md

Decision: train-167-subjects | Preserve distinct selected subject labels alongside one exact result, including revision; initial importer failures and reviewed-head four-case red replay are retained. No member omitted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-167-PROGRESS.md

Repair verification: journal-deliver-all, journal-deliver-all-floor, report-settlement-live and claim-scoped-floor pass 38/38. Four new subject assertions fail on the exact reviewed head and pass with the repair. Captured 46040805/46040806 outputs remain replayed; the two additional revision neighbors use their distinct original subjects. The initial new fixture revised its setup acknowledgement before creating the second loop; corrected the fixture reviewer to pass setup and exercise revision only on the intended delivery turn. Full targeted sweep and final-head checks are recorded in the absolute PROGRESS report.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary reviewed merge plus existing regeneration and exact report grouping/carry. One heading for all selected subjects prevents the concrete failure where identical Yes. results close Monday and Friday obligations without saying which questions were answered. Reuse that carry during revision; no new state, model call, retry or settlement authority. Exact reviewed ancestry guards start, targeted checks and desk review guard landing, all five floors remain. No unattended live completion claimed.
80/20: Verify changed tests, direct importers, journal family and required pinned checks; full suite and live request/report/receipt-bound proof remain with the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
