# Change review — unconfirmed task result notice

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: frozen
Reviewed content: sha256:e1b214422be4b32a879c9c5d6f4d8e186600713a80e2578fdf8174423820541d
Outcome: When an answer outcome is UNKNOWN, plainly report that task completion is unconfirmed, effects may have happened, the request and attempt are retained, and this attempt is not automatically repeated. Name the prerequisite for resuming without promising an unassigned retry. Preserve recorded tool-result counts and historical notice classification.
Affected rules: 4, 26, 34, 36, 42, 49, 52, 55, 60, 70, 74, 89, 102, 111, 113, 116
Affected floors: secrets — no raw tool text added; spend cap — no model calls added; stop — safety halt unchanged; no duplicate sends — existing intent and send receipts unchanged; durable intake — existing journal records unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Small user-facing fixed notice repair in the journal pipeline; no dispatch, permissions, schema, retry, stores or resource policy changes. Recorded replay and restart tests cover the changed surface; independent review and combined host gates remain required.
Side effects: New UNKNOWN notices are longer and explicitly distinguish answer failure from task effects. Historical sent notices retain their exact bytes and loss classification. Success answers, safety halts, existing tool counts and send uniqueness stay on their existing paths. The session-repair consumer test now asserts unconfirmed completion and no automatic retry for uncertain/throw outcomes; malformed replies retain their distinct failure wording.
Undo and recovery: Revert this change; retained journal frames and intents require no migration. Never replay an uncertain effect or resend an already recorded intent as part of rollback.
Multi-machine posture: Pure rendering from the same durable turn projection on every host; no new local state, store or ownership path.
Layer below: Inspected model-uncertain projection, conversationSessionAnswer, existing session-work records, notice assembly, reply review exemption and delivered-history classification. The supplied target projection contains no verified PR outcome, tool count or queued retry; missing evidence cannot become a PR claim. Session closure is not evidence of task completion. Existing toolChecks counts returned results, not success.
1.x reference: Actual JKHeadley/instar main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d. src/monitoring/watchdog-notifications.ts and src/monitoring/SessionWatchdog.ts separate recorded intervention from running/completed work; history 6e2872663 names interrupted waits. src/monitoring/CommitmentTracker.ts and docs/specs/auto-expiry-review-ledger.md explicitly say outcome unknown (not confirmed completed); docs/specs/REMOTE-SESSION-CLOSE-SPEC.md rejects closed-nothing claims on timeout. Reuse that outcome discipline and clear wording, not unconditional watchdog picking-back-up promises or expiry mechanics. ONEX-LESSONS sessions/recovery area reinforces indeterminate timeout and attempts versus actual outcomes.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/session-result-notice.test.ts; live=tests/preview/fixtures/session-result-notice-969390679.json
Hook bypass: none
Convergence: none
Prompt review: No model prompt or call added. Historical captured Jev/review verdicts remain historical evidence, not a claim that the new wording was model-reviewed. Independent review judges the notice wording.

Prompt finding: 4106b49fff07 | protocol-literal | Existing text-only capability instructions describe the actual lack of tool execution on that route. The fixture checks that delivered capability boundary; this patch neither adds the instruction nor copies a trigger from the fixture.
Prompt finding: 85544c20941f | protocol-literal | Existing login-outage notice is an exact fixed protocol output tested by its session consumer. It is separate from the UNKNOWN notice changed here; no login-outage promise or decision rule is added.
Prompt finding: e8708c7fea24 | protocol-literal | Existing recall guidance asks for evidence citations and unknown-source disclosure; its fixture verifies prompt delivery. No literal-match decision or prompted verdict is introduced by this notice repair.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory-list response and its recognition prefix are exact output protocol text exercised by the memory-list test. They are unchanged, not new semantic triggers or expected model answers.

Decision: RESULT-NOTICE-1105-1 | Render only facts supported by the current durable turn; do not promote the desk's PR2750 or disk observations into universal task outcomes. State a prerequisite for resumption, never a new promise or retry assignment. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-result-notice-1105-PROGRESS.md
Decision: RESULT-NOTICE-1105-2 | Keep old notice bytes recognized during history replay while new unsent UNKNOWN attempts use the clearer text; replay the supplied projection and success neighbors without inventing raw journal frames. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-result-notice-1105-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: change the existing fixed notice and preserve old history recognition, with no extra model, store, schema, service, permission or retry machinery. Existing intake, secret, send uniqueness, stop and cap guards stay in force. No autonomous completion claim is made.
80/20: The targeted defect is unclear UNKNOWN task reporting. Task-specific PR result extraction and ownership/retry infrastructure are not invented from absent evidence; remaining carryover16 coverage belongs to the existing desk row and combined review.
VERDICT: Author submission for independent review; no independent acceptance or live deployment claimed.
