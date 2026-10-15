# Change review — avoid premature summaries and settle reaction receipts

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Short conversations retain complete history without automatic summary calls until the existing full-history or packet headroom bound is reached. Required memory decisions, unanswered-question review, overflow recovery and established long-history catch-up remain. Slow successful reaction responses can settle as accepted; explicit failure retains text fallback and ambiguity retains non-replay.
Affected rules: 4, 7, 10, 13, 26, 36, 42, 55, 57, 60, 63, 74, 75, 87, 93, 96, 101, 102, 113, 116
Affected floors: secrets — existing bridge scan and memory redaction retained; spend cap — unchanged admission, hard output cap and accounting, fewer unnecessary calls; stop — existing checks before dispatch and fallback retained, physical wait bounded; no duplicate sends — ambiguous reaction still forbids text fallback; durable intake — original journal and dispatch claim unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One scheduling condition and one transport timeout, using existing paths and limits; no new authority, state or output acceptance.
Side effects: Automatic extraction of summary-derived people, commitments and meaning terms starts later for short histories; originals remain in complete grounding, and answer-side memory and commitments remain active. A synchronous reaction can occupy its caller for up to ten seconds instead of half a second; a definite slow failure can delay text fallback. A short tail of an already compressed long history retains the previous catch-up trigger.
Undo and recovery: Revert this branch's changes to restore the early summary trigger and half-second reaction bound; no persistent schema or state migration. Never replay previously unknown reactions. Existing bounded recovery handles previously exhausted summary spans; this scheduling change does not reset their attempt budget.
Multi-machine posture: Existing conversation-owner admission remains the single sender. Scheduling and the timeout are machine-local and introduce no shared state or new retry. Every machine uses the same durable conversation history and existing summary records.
Layer below: Inspected preparedFor's 64 KiB complete-history preference, automatic and forced summary consumers, memoryFrom exact trigger/source checks, 1024-token prompt target and 2048-token hard cap, summary faithfulness escalation, bridge AbortSignal timeout, noticeInvoke forwarding and journal dispatch/stop/ownership checks. Read the walk's actual prompts, outputs and classifications directly, read-only.
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-ack-walk.test.ts; reproducer=tests/preview/telegram-acknowledgement-bridge.test.ts
Hook bypass: none
Convergence: none
Prompt review: Scheduling is model-facing; prompt, parser and acceptance rules are unchanged. The walk fixture replays all 33 field-malformed outputs at their original frontiers, a valid summary, genuine uncertain outcome, Jev undecided scores and stronger-review pass/violation. The recorded 33-turn conversation avoids automatic summary calls. Existing recorded-shape regression tests also exercise reply reviews and delivered/empty-context reply bytes. No live provider, Telegram or proof-room call is authorized or claimed.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-citation instruction, unchanged by this scheduling repair; the fixture checks the delivered protocol, not a phrase used to classify meaning.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory response, unchanged by this repair; the memory-list test checks that literal response.
Decision: summary-ack-1015-D1 | Use a finite ten-second reaction receipt allowance, conservatively covering the recorded 7–8 second intake-to-reaction observations without calling them transport latencies; preserve explicit failure and ambiguity semantics. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-ack-1015-PROGRESS.md
Decision: summary-ack-1015-D3 | Cut premature automatic summarization while a conversation still fits complete grounding. The old whole-packet 24 KiB trigger paid for summaries the answer path did not need, while asking the writer to re-decide already-corrected memory against withheld clauses. Retain original history, forced decisions, exact refusal rules and long-history catch-up. This supersedes D2's temporary missing-records stop; the Studio exports are now readable. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/summary-ack-1015-PROGRESS.md

Subject (7 paths): tests/preview/journal.ts, tests/preview/summary-ack-walk.test.ts, tests/preview/fixtures/summary-ack-walk-2026-10-15.json, tests/preview/telegram-acknowledgement.mjs, tests/preview/telegram-acknowledgement.test.ts, tests/preview/telegram-acknowledgement-bridge.test.ts, tests/preview/journal-poll-endpoint.mjs

## Closing block

simplestRobustRoute: This is the simplest route: use the existing complete-history threshold to avoid an unnecessary call, and give the existing bounded reaction call time to receive its actual result. No new summarizer, parser tolerance, retries or reconciliation service. Original history, forced recovery, memory/source validation, output/spend bounds, ownership, stop and exact receipts remain the guards. The recorded walk completes offline without automatic summaries; live unattended acceptance belongs to the desk and is not claimed here.
80/20: Real recorded outputs and conversation state establish the cause and exercise the changed path; targeted regressions cover both sides of scheduling, faithfulness and transport outcomes. The desk owns independent review and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
