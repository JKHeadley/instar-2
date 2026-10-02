# Change review — cint-L32 repair round 3: the reply reviewer decides whether an answer reports a shared-access approval

Subject base: 9f9248c5bdcb7afa3e11db23dbb226f550ed42d5
Review state: open
Reviewed content: none
Outcome: Repairs Astra's round-3 MUST-FIX 1 (the disclosure still depended on how the answer was worded) structurally, per the desk note of 16:14. reportsApproval and its one-hour window are removed. Whether a delivered answer reports an approval taken under a shared-access acceptance is now a judgment of meaning by the reply reviewer that already checks every model-written reply (Jev, the batched reply check): only when the conversation has an applied shared-access approval (disclosedApproval, now the latest such approval whatever later requests followed) does the same Jev call carry one extra question, approval_report, naming the request, what it set (operatorRequestTarget) and that it came through the operator's GitHub account, an account the agent can also use. The structured answer (yes / no / undecided / unreadable, with the probability) is recorded on the reply-check row. The send path appends the existing fixed disclosure unless the reviewer answered a confident no on this exact text (at or below 0.15, Jev's established line in interpretStepJev and interpretSummaryJev); yes, undecided, a timeout, an unreadable answer, a revised or shortened text, or no review at all carries it. The immediate completion line's note is unchanged. Replies in conversations with no such approval, and the no-access route, are never asked the question and never get the note.
Affected rules: the amended safeguard Rule of docs/00-the-purpose.md (disclosure wherever an approval is recorded, displayed or exported), 10 (meaning is decided by a model, not a keyword list: the wording test is removed), 74 (this record), 79, 82, 90 (register regenerated with --replay), 101 (plain commits, no bypass), 102 (decisions below), 106 (observer: recorded real outputs replayed, real reviewer captured), 116 (no new call, service or gate: one conditional question in an existing call, the existing fixed line)
Affected floors: secrets — the Jev request carries the reply text (as before) plus the request id and the target limits, no credential; the capture read the TypeSafe key from the vault into an environment variable and never printed it; spend cap — no new model call: the question rides the existing reserved Jev call, whose reservation now measures the real request body; stop — unchanged; no duplicate sends — the disclosure rides the one reply per turn; durable intake — one optional field (approvalReport) on the existing reply-check row, absent on every other row
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the repair touches the approval disclosure on the operator-reply path of the carried critical build.
Side effects: with an applied shared-access approval, each operator reply's Jev request is 380 bytes larger (measured: 2,329 to 2,709 bytes for a short reply); every other request is byte-for-byte unchanged. An unrelated answer the reviewer confidently judges as not reporting the approval no longer carries the note; everything else does.
Undo and recovery: revert the repair commit and its register replay to return to 9f9248c5; old reply-check rows read unchanged (the new field is optional).
Multi-machine posture: machine-local preview runner, unchanged; no replicated state added.
Layer below: reviews/cint-L32-repair2-change-review.md (round 2, whose wording test this replaces); reviews/cint-L32-repair1-change-review.md; reviews/cint-L32-change-review.md
Bug class: integration
Bug evidence: reproducer=tests/preview/review-yes-wiring.test.ts; live=tests/preview/fixtures/approval-report-jev-2026-10-02.json
Hook bypass: none
Convergence: none
Decision: cint-L32-r3-meaning-by-reviewer | the report question is asked of the Jev reply check, the one reviewer call every model-written reply already gets, not the full-context review that runs only on escalation; no new call or service | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L32-PROGRESS.md
Decision: cint-L32-r3-confident-no | only a confident no (noul at or below 0.15, the existing Jev line) omits the note; the real reviewer scored the captured report 0.19 and the paraphrase 0.27-0.28 (undecided, so the note rides) and the unrelated answer 0.02 (no) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L32-PROGRESS.md
Prompt review: the Jev request gains one conditional question (approval_report) only when an applied shared-access approval exists; the answer model's packet is unchanged. Recorded shapes replayed: the captured status-applied and unrelated real answers (fixture review-yes-live-2026-10-02.json), and six real Jev responses on the exact candidate text and questions the worker sent (fixture approval-report-jev-2026-10-02.json).
Prompt finding: 0c0c2c5478e2 | protocol-literal | a refusal detail of the admission, matched by its own test; not prompt text (as in the carried record)
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change (as in the carried record)
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as in the carried record)
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change (as in the carried record)
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Skip: tests/preview/review-yes-live.test.ts:224 | scope=gated real-reviewer capture (INSTAR_APPROVAL_JEV_LIVE=1 and the TypeSafe key); its stored outputs are replayed by the always-running test below it

Subject (13 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/fixtures/approval-report-jev-2026-10-02.json, tests/preview/journal.ts, tests/preview/operator-yes.ts, tests/preview/reply-check.ts, tests/preview/review-yes-live.test.ts, tests/preview/review-yes-wiring.test.ts

## Closing block

simplestRobustRoute: one conditional question in the existing Jev reply-check call, its recorded answer, and the existing fixed disclosure line appended unless that answer is a confident no; the wording and age tests are removed.
80/20: 1 source must-fix repaired structurally, both sides shown with stubs and with real recorded reviewer outputs; 1 note (the real reviewer's reports sit between its confident lines, so the note rides on its undecided answer rather than a yes)
VERDICT: author submission; the independent verdict is recorded as a pass
