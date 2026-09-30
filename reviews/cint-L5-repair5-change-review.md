# Change review — cint-L5 repair 5: the audit reads scheduler history under its verified writer; credential reminders are scoped to the credential lifetime

Subject base: 8ace75144e8cd240ebc62426dd813f185bdbed55
Review state: open
Reviewed content: none
Outcome: Astra's round-1 NO named two reproduced defects. MF1: the journal audit expected packet history through turn.update - 1, while the packet writer grounds through before(turn.update); a scheduler due turn sits at a fractional update (1 + 1/1024), so its legitimate packet (which includes the request) and the next ordinary answer were reported as history-coverage failures. The audit also judged the due turn as operator speech, reporting memory-operator-source-absent, source-sender-unverified and history-attribution for correctly recorded scheduler work. The audit now imports the writer's own before() boundary, and a due turn is traced through its verified system writer (kind system, its own requested-action id in the raw envelope) to the earlier accepted operator turns that said each quoted request; its speaker is the runner label the packet writer uses. Operator-only checks on operator memory mutations are unchanged. MF2: credential reminder keys named only credential and stage, so a renewal under the same name inherited the old lifetime's delivery and its reminder was silently suppressed while status showed it delivered. The key now carries the lifetime's expiry; old journal rows stay readable and valid, and no delivery history is cleared. Evidence: the reviewer's two reproductions now show clean audits and a carried renewed reminder; the retained 16:28 canary copy strictly replays with zero audit findings (was three); new tests cover request → due turn → next answer (clean, plus unsigned and misquoted scheduler traces refused and an ordinary omission still failing) and renewal → restart → one reminder, then none; each new test fails on the old code.
Affected rules: 8 (a renewed credential's reminder loop is re-surfaced), 26 (the audit checks the recorded writer and source turns, not a label), 28/29 (the scheduler is traced as a verified system principal, never treated as the operator), 33 (writer and audit share one history boundary), 74, 96 (the due turn's grounding history is audited as written), 100 (each credential lifetime gets its escalating reminders), 116 (two small source fixes in existing modules; no new store, service or format)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (one reminder line per lifetime stage; a pre-upgrade row keyed without expiry can let the current stage ride one more answer once, never repeat after that); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the audit is a read-only evidence consumer and the reminder key change affects only which line an answer carries; no send path, intake or authority changes
Side effects: a journal written before this change keyed a delivered reminder without its expiry; its current stage is offered once more on the next answer. Audits of journals holding due turns now report clean where they previously reported false provenance failures.
Undo and recovery: revert the fix commit, the register regeneration and this record
Multi-machine posture: machine-local, deliberately; preview journal and custody files on the one preview machine, no replicated state
Layer below: tests/preview/journal.ts before() and groundingHistory (the packet writer's selection), the action-due projection that verifies the scheduler writer signature, and secret-custody DueReminder
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-audit.test.ts; reproducer=tests/preview/credential-reminders.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed; journal.ts only exports its existing before() boundary
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (13 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/credential-reminders.test.ts, tests/preview/credential-reminders.ts, tests/preview/journal-audit.d.mts, tests/preview/journal-audit.mjs, tests/preview/journal-audit.test.ts, tests/preview/journal.ts

## Closing block

simplestRobustRoute: use the writer's own history boundary and trace the due turn through the writer and request records the journal already keeps; add the expiry the reminder already carries to its existing key. No new audit service, journal format, scheduler or delivery store.
80/20: 0 must-fix, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
