# Change review — U11: due credential reminders and a failing doorway check ride the next answer as one line

Subject base: 91cefaa085713d50518f1bdcf64263331510fadf
Review state: open
Reviewed content: none
Outcome: Closes the delivery gap for Rule 100 left by build 6 (the `dueCredentialReminders` seam had no consumer; status showed due stages that nothing ever told the operator). New tests/preview/credential-reminders.ts turns each due reminder stage (secret-custody's escalating 7 d / 3 d / 1 d / 6 h / 1 h / expiry schedule) into one fixed line naming the credential, its identity, the time remaining bound to that credential (Rule 13) and the smallest human action, keyed `credential:<name>:<stage>`; and a failing standing doorway check (Rule 56) into one line per verdict episode, keyed by when the verdict began, offered only while the live verdict still fails so a route the answer just re-verified is never called stale. The reply-only grant allows no unsolicited send, so the journal worker attaches at most one such line to the next verified-operator answer, at the same place and under the same conditions finished obligation work already rides it (Rules 8, 92). The answer row records the carried line (`notices`), validated on replay to be said verbatim in the answer. Delivery is derived from durable state: a key is spent once a reply saying its line has a send intent (sent, or its receipt unknown, so never repeated: the no-duplicate-sends floor) or another unsent answer holds it; a revised reply that dropped the line frees it. `status.credentials.due` now carries `delivered: {stage, at, current}` from sent replies. On the real launcher path (journal-agent-resources fixture, activation expiring 2026-10-05, inside 7 days today) the first reply carried "Reminder: the credential "preview-activation" (offline-successive-activation) expires in 6 days 3 h. Smallest step for you: approve a renewed activation record." and status showed stage 0 delivered.
Affected rules: 8, 13, 56, 87, 100, 116
Affected floors: secrets — unchanged, the line names a credential and its identity, never a value, and still passes checkOutbound; spend cap — unchanged, no model call is added; stop — unchanged, the line rides only an answer the worker already sends; no duplicate sends — held, a spent key (sent or receipt unknown) is never offered again and replay rebuilds that from the journal; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: adds one fixed line to operator-visible replies; it creates no new send, no new effect and no model call, and the send path, review and receipts are unchanged
Side effects: the next answer after a reminder stage becomes due, or after the standing doorway check starts failing, ends with one extra line; with both pending, the credential line goes first and the doorway line on the following answer
Undo and recovery: revert these commits and regenerate the register; journals written with `notices` fail replay on the reverted code only if it rejects unknown answer fields, which it does not (the field is ignored), so no data change is needed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; tests/preview/secret-custody.ts dueCredentialReminders and reminderSchedule; tests/preview/doorway-map.ts doorwayFreshness and standingDoorwayCheck; tests/preview/journal.ts pendingReports attach point
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed; the line is appended after the model's answer, never sent to the model
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/credential-reminders.test.ts, tests/preview/credential-reminders.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts

## Closing block

simplestRobustRoute: the required outcome is that a due reminder reaches the operator; the only permitted send is the reply, so the simplest route is to ride the existing attach point finished obligation work uses, with one optional port and one recorded answer field for delivery. No scheduler, no new send, no notice queue and no model call are added; the model-mediated packet route (as the update note uses) was not taken because it cannot guarantee the line is said.
80/20: new tests prove the due boundary (exactly 7 days, not 1 ms earlier), one line per answer, no repeat after delivery or after an unknown receipt, escalation to the next stage, replay, doorway episode keying and the live-verdict exclusion, and verbatim validation; neighbouring suites (secret-custody, journal-obligations, journal-agent-resources, doorway-map) pass; tsc, lint and register:check pass.
VERDICT: author submission; the independent verdict is recorded as a pass
