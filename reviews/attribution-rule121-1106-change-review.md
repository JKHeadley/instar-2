# Change review — Rule 121: attributed statements are checked at send and at note write

Subject base: f35c547d652db018c19aa882525ea28fbe259a4b
Review state: open
Reviewed content: none
Outcome: A statement credited to a person is checked before it is sent and before a note file changes. Code proves the marker, the record, the sender and the quote; one recorded model judgment decides whether the text is a credit and whether the line claims more than the words. Off unless launched with --attribution record or enforce.
Affected rules: Rule 121 (the subject); Rules 4, 14, 29, 41, 42, 57, 58, 75, 77, 86, 89, 95, 102, 118, 122.
Affected floors: secrets — unchanged, the judge call passes the same doorway and disclosure check as a reply review; spend cap — each judge call is reserved first and counts against maxCalls, the same text is never judged twice; stop — gate() runs before the reservation; no duplicate sends — a crash after the reservation leaves `unchecked`, the paid call is not replayed, and the send intent path is unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Adds a step on the live send path and a wait in the note-writing tool hook, though both are off unless launched with the option.
Side effects: With the option on, a reply the prefilter flags waits for one model call, bounded at 45 s; measured median about 3 s on Claude and 7 s on Codex. Each flagged reply costs one model call, a revised reply a second. Under enforce a claim still refused after the revision round leaves by excision, and a reply with nothing left becomes the holding notice. With the option off, no behaviour changes.
Undo and recovery: Launch without --attribution. Reverting the commits leaves `attribution-reserve` and `attribution-check` rows the previous build does not know, so undo means relaunching without the option first and reverting only for a journal that never ran with it.
Multi-machine posture: Machine-local to the journal-owning host. Rows are journal rows, so they replicate as every row does; no peer lookup is needed because the journal is the log.
Layer below: Read docs/01-the-rules.md row 121, the 1.x spec and AttributionJudge in JKHeadley/instar, the 1.x live test report, the pre-send loop and its code-found link objections, the claim-scoped excision, the Rule 58 boundary, and the admission hook's held-secret ask.
Bug class: integration
Bug evidence: reproducer=tests/preview/attribution.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Decision: attr-one-call | One judge call instead of 1.x's two, with the code's facts stated in the prompt, because a marked claim cost two calls in 1.x. The replay decided it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-2226-PROGRESS.md
Decision: attr-own-judgment | A dedicated judgment, not a rule in the batched reply review: a confident Jev pass skips that review, and its prompt has pinned byte budgets. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-2226-PROGRESS.md
Decision: attr-under-reply-review | Declared under preview.reply-review rather than a new capability, so a dark option needs no register or owner-reference change in this unit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-2226-PROGRESS.md
Decision: attr-call-record | The judge's call is a review call in the call-outcome validator and the recorder; found on the real route, and the test now runs through the real recorder. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/attribution-rule121-1106-repair-2226-PROGRESS.md
Prompt review: One new question, ATTRIBUTION_QUESTION, version attribution-judge-2.0-v2, ported from the 1.x extract and support prompts into one call. It states what the sender proof means and keeps who wrote the words apart from whether the line overstates them. Replayed on real Claude and Codex calls; numbers below. No existing prompt, parser or question changed; the one objection text added is OBJECTION_TEXT[unsourced_attribution].
Prompt finding: 0abb3dc96311 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 4106b49fff07 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: 85544c20941f | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: aef7d91bef51 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: b288d6ef1604 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: e769ca9dd959 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: e8708c7fea24 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: f6d7f3274c85 | protocol-literal | Existing fixed wording, unchanged by this change.
Prompt finding: feadb66b8ad1 | protocol-literal | Existing fixed wording, unchanged by this change.

Subject (12 paths): tests/preview/admission-gate.mjs, tests/preview/attribution-live-test.md, tests/preview/attribution.test.ts, tests/preview/attribution.ts, tests/preview/capabilities.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/model-call-boundary.test.ts, tests/preview/model-call-boundary.ts, tests/preview/reply-check.ts, tests/preview/tool-admission-hook.mjs, tests/preview/tool-admission.mjs

Verification: Real replay on d486d499, .instar/lanes/attribution-2-0-replay/REPORT.md: caught 181 of 182 on Claude and 182 of 182 on Codex; false refusals as labelled 4 of 85 and 3 of 85; none unchecked. Focused suites pass: attribution, capabilities, model-call-boundary, admission-gate, tool-admission, pre-send-review-order, journal-conversation-session, fail-direction-agreement. journal-agent.test.ts has six failures, identical on the base f35c547d (real-clock activation reminder). The full suite was not run here.
Residue: attr-slack-send-owed | medium | real Slack sending is unproven because 2.0 sends on Telegram only; owed when 2.0 Slack replies go live, accepted by the hub 2026-11-06.
Residue: attr-write-gaps | medium | notes written by shell commands, and tool turns with no checkpoint, are not checked; the rolling summary is not checked.
Residue: attr-live-proof-owed | high | real Telegram proof, a refusal on the real route, the write check on the real route, the record period and the measured timeout rate are still owed. A stand-in run on the real model route found and fixed two bugs that made every check pass unchecked.

## Closing block

simplestRobustRoute: One small module and one recorded judgment, entering the existing revision round and excision; the journal replaces 1.x's ledger, pins and peer lookups.
80/20: Send and note-write are built and replayed. Summaries, shell-written notes, turns with no checkpoint, a daily audit and judge-linked lineage are named as owed, not built.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
