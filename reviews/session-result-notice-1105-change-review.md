# Change review — unconfirmed task result notice

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: frozen
Reviewed content: sha256:4186740edb39fe7c07e9281106e95b2ca8e8258a2a873fe04d8e631dfd4bc36a
Outcome: When an answer outcome is UNKNOWN, plainly report that task completion is unconfirmed, effects may have happened, the request and attempt are retained, and this attempt is not automatically repeated. Name the prerequisite for resuming without promising an unassigned retry. Preserve recorded tool-result counts and historical notice classification.
Affected rules: 4, 26, 34, 36, 42, 49, 52, 55, 60, 70, 74, 89, 102, 111, 113, 116
Affected floors: secrets — no raw tool text added; spend cap — no model calls added; stop — safety halt unchanged; no duplicate sends — existing intent and send receipts unchanged; durable intake — existing journal records unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small user-facing fixed notice repair in the journal pipeline; no dispatch, permissions, schema, retry, stores or resource policy changes. Recorded replay and restart tests cover the changed surface; independent review and combined host gates remain required.
Side effects: New UNKNOWN notices are longer and explicitly distinguish answer failure from task effects. Historical sent notices retain their exact bytes and loss classification. Success answers, safety halts, existing tool counts and send uniqueness stay on their existing paths.
Undo and recovery: Revert this change; retained journal frames and intents require no migration. Never replay an uncertain effect or resend an already recorded intent as part of rollback.
Multi-machine posture: Pure rendering from the same durable turn projection on every host; no new local state, store or ownership path.
Layer below: Inspected model-uncertain projection, conversationSessionAnswer, existing session-work records, notice assembly, reply review exemption and delivered-history classification. The supplied target projection contains no verified PR outcome, tool count or queued retry; missing evidence cannot become a PR claim. Session closure is not evidence of task completion. Existing toolChecks counts returned results, not success.
1.x reference: Actual JKHeadley/instar main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d. src/monitoring/watchdog-notifications.ts and src/monitoring/SessionWatchdog.ts separate recorded intervention from running/completed work; history 6e2872663 names interrupted waits. src/monitoring/CommitmentTracker.ts and docs/specs/auto-expiry-review-ledger.md explicitly say outcome unknown (not confirmed completed); docs/specs/REMOTE-SESSION-CLOSE-SPEC.md rejects closed-nothing claims on timeout. Reuse that outcome discipline and clear wording, not unconditional watchdog picking-back-up promises or expiry mechanics. ONEX-LESSONS sessions/recovery area reinforces indeterminate timeout and attempts versus actual outcomes.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/session-result-notice.test.ts; live=tests/preview/fixtures/session-result-notice-969390679.json
Hook bypass: none
Convergence: none
Prompt review: No model prompt or call added. Historical captured Jev/review verdicts remain historical evidence, not a claim that the new wording was model-reviewed. Independent review judges the notice wording.

Decision: RESULT-NOTICE-1105-1 | Render only facts supported by the current durable turn; do not promote the desk's PR2750 or disk observations into universal task outcomes. State a prerequisite for resumption, never a new promise or retry assignment. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-result-notice-1105-PROGRESS.md
Decision: RESULT-NOTICE-1105-2 | Keep old notice bytes recognized during history replay while new unsent UNKNOWN attempts use the clearer text; replay the supplied projection and success neighbors without inventing raw journal frames. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-result-notice-1105-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: change the existing fixed notice and preserve old history recognition, with no extra model, store, schema, service, permission or retry machinery. Existing intake, secret, send uniqueness, stop and cap guards stay in force. No autonomous completion claim is made.
80/20: The targeted defect is unclear UNKNOWN task reporting. Task-specific PR result extraction and ownership/retry infrastructure are not invented from absent evidence; remaining carryover16 coverage belongs to the existing desk row and combined review.
VERDICT: Author submission for independent review; no independent acceptance or live deployment claimed.
