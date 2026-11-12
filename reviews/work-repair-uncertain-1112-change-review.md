# Change review — bounded retry of an uncertain formatting repair

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: Completed obligation work whose formatting call returns no result gets one additional formatting-only attempt; a successful repair reaches ordinary result delivery without rerunning the work.
Affected rules: 4, 8, 36, 41, 55, 57, 58, 68, 70, 74, 75, 83, 101, 102, 113, 116, 123
Affected floors: secrets — existing redaction and outbound checks; spend cap — each attempt durably reserves a call and unknown token liability remains charged; stop — checked before preparation and reservation; no duplicate sends — work is not repeated, both repair ids exclude tools and sessions, delivery retains its intent fence; durable intake — existing journal writer and accepted input remain unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes a scheduled model-call recovery decision and its journal reservation, without changing authority or prompts.
Side effects: At most one additional tool-free formatting call per work slot after an uncertain repair. Definite malformed/rejected/empty repair results are not retried. The extra call can consume allowance; stop, capacity and preparation can refuse it. A second uncertain repair or a crash stays conservative and held. Known original usage settles before first repair; first repair usage settles before retry; no missing usage is converted to zero.
Undo and recovery: Old journals replay with the same history. Already held commitments 57/58/59 remain held; no migration or automatic release is provided. Revert execution only on roots with no new repairRetry frames, or retain the new reader: the old reader rejects a second same-slot repair reservation. Never remove the new frames or their charges to permit a downgrade. Existing exact work-recovery evidence can be reconciled separately by the desk; this change does not reinterpret an invalid work account as a valid report.
Multi-machine posture: Existing journal owner and model-route authority remain the only owners. Optional reservation/projected fields travel through the existing replay and snapshot mechanisms. No new shared store, ownership transfer or peer requirement.
Team posture: Existing obligation principal, context redaction and delivery audience remain unchanged. Repair uses the same scoped packet; it adds no sharing or access path and does not widen any recipient's visibility.
Layer below: Inspected obligationDecision, answer reader, journal reservation/token settlement, schedule/recoveryHeld, toolTurnEligible, launcher modelRoute/callSubscription/invokeSubscription, observedSubscriptionIO and subscription adapter preflights. call-outcome is emitted only for a command with prompt stdin; preflight failures can return adapter uncertainty without a call-outcome. The brief lacks the original outputs and preflight phase rows, so exact format defect, login failure and restart causality remain undetermined. Neither timeout policy nor login admission was changed.
Bug class: integration
Bug evidence: reproducer=tests/preview/work-output-repair.test.ts
Hook bypass: none
Convergence: none
Decision: bounded-format-retry | Keep the completed work output/context while making one separately reserved formatting-only retry on no result; do not rerun work or accept invalid text. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/work-repair-uncertain-1112-build-report.md
Prompt review: No model prompt or output parser changes. Recorded proof-room work frames 131/138/181 (updates 46039927/46039928, work-output-live-2026-10-12.json) trigger the new retry path after injected no-result repair and reach normal delivery exactly once. November 12 commitments 57/58/59 provide the complete-work/uncertain-repair sequence but no raw output; their exact output shape is not claimed reproduced. Additional foreign-protocol controls replay the existing retrospective-duty-followup-train-1-2026-10-08.json corpus: summary-writer 715672480, summary-uncertain 715672483, Jev undecided 715672482 and unsure 969389570, reply-review 969389923, delivered reply 715672479 and empty reply in recorded context 715672550. They cannot become work reports; nonempty invalid accounts take bounded repair, the empty result remains failed with no repair.
Prompt finding: 105c1569b6bb | protocol-literal | Existing stop wording is unchanged; this retry neither edits nor evaluates it by phrase.
Prompt finding: 4106b49fff07 | protocol-literal | Existing tool-evidence instruction is unchanged; the repair retains the original scoped packet.
Prompt finding: 7ef11b68103f | protocol-literal | Existing activation wording is unchanged; no activation policy is changed.
Prompt finding: 849db3a6296a | protocol-literal | Existing saved-memory response is unchanged, not a new model gate.
Prompt finding: 85544c20941f | protocol-literal | Existing retained-message wording is unchanged; intake is unchanged.
Prompt finding: 9f0106c66027 | protocol-literal | Existing interrupted-work notice is unchanged, not used to decide retry eligibility.
Prompt finding: bac6ce7485d9 | protocol-literal | Existing stopped-work notice is unchanged, not used to decide retry eligibility.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label guidance is unchanged; no prompt mutation is introduced.

1.x comparison: Searched actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987 src/, docs/specs/ and git history. Read src/monitoring/ResumeQueueDrainer.ts:24-28,217-224,491-505, docs/specs/autonomous-run-outlives-session.md, src/core/SelfHealGate.ts and the Grok oneShotCompletion.ts envelope repair. Relevant history includes 7ef757d89, c56b38f6c, 7779f8a9a, 5129779c3 and a34adbc8e. Durable work and bounded retry fit; session revival and Grok JSON rewriting do not implement this obligation-format protocol. Reuse the 2.0 work-output-repair-1012 reservation/validation design and its captured fixtures instead of importing irrelevant machinery. ONEX-LESSONS is absent from the tracked repositories and unavailable at the named Studio path on this host; no absence beyond inspected paths is claimed.
Diagnosis: Base journal.ts:12689-12701 replaces the completed work account with the repair account, then journal.ts:12662-12664 marks uncertainty held based on the original tool route. The missing repair result is thus treated as missing work. The three failing-first recorded-output tests on train-240 stop at two calls; all pass with the additional counted retry. Genuine uncertain work still holds without repair.
Measurement: Product diff is tests/preview/journal.ts only: 22 additions + 11 deletions = 33 changed product lines, below 150. Test and review lines are reported separately in the handoff.
Validation: Failing-first train-240 run: 3 failed, 15 passed; failures are the absent second formatting call. Focused repair tests and surrounding obligation/parser/diagnostic tests pass. Final head checks and exact counts are in the Studio handoff report; no live-provider or deployed Telegram proof is claimed from this host.

Register publication: Eight generated projections were replayed mechanically from source commit a09cef94e9d1a3fdd9aa8bc373d614c1c0c599f2; generation sha256:be87936ee0d0835274b64b07bf4b83ad5f93890b478886a51a44d0e218f8097a. No constitutional wording, changelog numbering, owner pin or conformance declaration was edited. Architecture passes with the already-certified Node 24.14.1.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the existing formatting packet, validation, model port, counted obligation-start and result/send path. A single optional retry marker enforces one additional no-result attempt across replay; a distinct id keeps tools/sessions excluded. No new queue, scheduler, heuristic parser, prompt or login recovery is added. Start guards are a completed malformed work account, retained output, stop and capacity; end guard is the existing field validator; limit guard is two total formatting calls, with sustained failure held and no automatic work repeat. No unattended real-provider completion claim is made.
80/20: The reproduced propagation failure is fixed within 33 changed product lines. Exact live preflight cause remains unproven, so no speculative adapter fix is included. Independent compliance and convergence are for the desk's Astra review.
VERDICT: author submission; independent review remains with the desk
