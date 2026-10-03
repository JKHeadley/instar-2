# Change review — w3-renewform repair: an invalid date keeps the unread-request refusal on a string reply

Subject base: aaa823dd56c2231c9fdf4952aa96c1754bfc0eea
Review state: open
Reviewed content: none
Outcome: The unit review (Astra, round 1) returned NO on one demonstrated regression. When an unreadable operator proposal and an unverifiable date came in the same turn with a plain string reply, the fixed OPERATOR_ACTION_UNREAD line replaced the model's reply but was not copied into separatedAnswer (undefined for a string reply). The invalid-date branch then rebuilt the reply from separatedAnswer alone, so the renewal refusal disappeared and only the date refusal was sent. Fix at source: whenever the unread line replaces the reply, separatedAnswer is set to it too, so the invalid-date branch keeps the fixed refusal and still drops the model's unsupported "passing the renewal request below" claim. Proven both ways with the reviewer's composition (renew-expiry with requestedEnd plus an unverifiable dated reminder): with the old line the string case fails, and with the new line both string and separated cases pass. renew-ask-live 7/7 pass; tsc, lint and register:check pass.
Affected rules: 42 (a refusal stays recognizable through every layer), 3 (no reply announces a request that was not formed), 37 (fixed at source; nothing quarantined), 74 (this record), 90 (register replayed by the desk tools, not hand-edited), 101 (plain commits), 116 (one assignment changed; no new gate or parser leniency)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (still one send per turn); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: one assignment in reply composition and two tests; no prompt text, parser, admission, authority or effect path changes
Side effects: a turn with both an unreadable operator proposal and an unverifiable date now sends the fixed unread line followed by the date refusal, on string and separated replies alike
Undo and recovery: revert the repair commit, the replay commit and this record; no journal format or state change
Multi-machine posture: machine-local preview runner, unchanged
Layer below: parseOperatorAction and proposeOperatorRequest (unchanged) still decide that the proposal is unreadable; only the reply text that reports it changes
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; no bypass flag used)
Convergence: none
Decision: renewform-unread-survives-invalid-date | set separatedAnswer to the fixed unread line unconditionally, instead of adding a special case in the invalid-date branch, because separatedAnswer is read only by that branch and the fixed line is exactly the answer that is safe to keep | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-renewform-PROGRESS.md
Prompt review: no model-facing change; no prompt text, parser or decision path is touched, only the composition of fixed reply lines
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/renew-ask-live.test.ts

## Closing block

simplestRobustRoute: one assignment so the fixed refusal is also the answer an invalid date keeps; the reviewer's composition pair added to the existing test file
80/20: 1 must-fix repaired, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
