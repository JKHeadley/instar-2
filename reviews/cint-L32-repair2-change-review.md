# Change review — cint-L32 repair round 2: approval disclosure whatever its age

Subject base: d59d2973fdcd871b0552ab1ec55803d6e69f3c04
Review state: open
Reviewed content: none
Outcome: Repairs Astra's round-2 MUST-FIX 1 (the unclosed part of round-1 MUST-FIX 1; Purpose, the approval-account exception) at its source. disclosedApproval (tests/preview/journal.ts) no longer conditions on the approval being younger than OPERATOR_REQUEST_MS: request expiry bounds when an approval can be consumed, never how long it must be truthfully described. The latest applied shared-access approval stays in the packet's operatorRequest with its note for as long as it is the latest request, and a new reportsApproval decides whether the delivered answer reports it: every answer within the hour (the round-1 behavior, kept), and afterwards any answer that names the request id or speaks of an approval. Such an answer carries the fixed line "Request <id> was approved through your GitHub account; note: <SHARED_ACCESS_NOTE>." unless it already carries the note; an unrelated later answer does not repeat it. The recorded real status-applied output (fixture review-yes-live-2026-10-02.json) is now also replayed 3,600,001 ms after the approval through the actual worker and delivers the disclosure; reverting journal.ts makes that delayed replay fail (Astra's reproduction), so both sides are shown. review-yes-wiring.test.ts replaces the unconditional no-note expectation after an hour with a delayed approval report (carries the note), a delayed unrelated answer (does not), and the no-access neighbor within and past the hour (never).
Affected rules: the amended safeguard Rule of docs/00-the-purpose.md (disclosure wherever an approval is recorded, displayed or exported), 74 (this record), 79, 82, 90 (register regenerated with --replay, never hand-edited), 101 (no hook bypass), 102 (decision below), 106 (observer: the recorded status-applied output replayed immediately and delayed), 116
Affected floors: secrets — unchanged (fake GitHub client in tests; no token read); spend cap — no model-call path added or changed; stop — unchanged; no duplicate sends — the disclosure rides the one reply per turn, no new send; durable intake — no journal row shape changed
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the repair touches the approval disclosure on the operator-reply path of the carried critical build.
Side effects: after the hour, an answer that names the request or mentions an approval ends with the disclosure line; within the hour behavior is unchanged. The packet keeps the applied shared-access approval while it is the latest request (a few bytes), instead of dropping it after an hour.
Undo and recovery: revert the repair commit and its register replay to return to d59d2973; no journal format changed.
Multi-machine posture: machine-local preview runner, unchanged; no replicated state added.
Layer below: reviews/cint-L32-repair1-change-review.md (round 1, whose disclosure window this repairs); reviews/cint-L32-change-review.md (the combined build)
Bug class: integration
Bug evidence: reproducer=tests/preview/review-yes-live.test.ts; live=tests/preview/fixtures/review-yes-live-2026-10-02.json
Hook bypass: none (plain commits; no bypass flag)
Convergence: none
Decision: cint-L32-r2-report-not-age | an approval report is recognised by the request id or the word approval in the delivered text (plus every answer within the hour), rather than by age, so a delayed report stays truthful and unrelated answers do not repeat the note; no classifier or new gate | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L32-PROGRESS.md
Prompt review: the packet's operatorRequest for an applied shared-access approval now stays past the hour while it is the latest request; its wording is unchanged. The always-sent bytes of a fresh root are unchanged. The recorded real status-applied output was replayed immediately and delayed.
Prompt finding: 0c0c2c5478e2 | protocol-literal | a refusal detail of the admission, matched by its own test; not prompt text (as in the carried record)
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as in the carried record)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as in the carried record)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as in the carried record)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal.ts, tests/preview/review-yes-live.test.ts, tests/preview/review-yes-wiring.test.ts

## Closing block

simplestRobustRoute: drop the age condition from disclosedApproval and add one text test for whether the answer reports the approval; reuse the existing fixed disclosure line and recorded replay.
80/20: 1 source must-fix repaired, shown on both sides with the recorded real output; 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass
