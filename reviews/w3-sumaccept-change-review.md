# Change review — w3-sumaccept: an undecided summary-faithfulness verdict escalates to the full-context subscription review instead of refusing; the summary window, envelope and warnings no longer strand a long chat

Subject base: 661ab944b613338a6b604feffd02d7ba0518321f
Review state: open
Reviewed content: none
Outcome: The proof room never accepted a summary (summaryThrough null; Jev faithfulness 0.22, 0.16 and 0.30, all inside the 0.15-0.85 unsure band), so its long chat ended. Four stacked defects: (1) an undecided faithfulness verdict was written as a refusal and a hold, and the subscription review ("then a subscription review when appropriate") only existed after a faithfulness pass; (2) a summary answer wrapped as {"reply":"<summary JSON>"} (the shared system prompt asks for that envelope) was not unwrapped, so Jev judged an escaped envelope and an inner memoryDisposition "unresolved" was ignored; (3) an UNKNOWN summary charge inside the first four-turn candidate window left no dispatchable frontier; (4) undecidedEdits carried every unresolved cue in full (53 live, 9.9 KB of a 24 KiB packet). Fixes, per observer #102's confidence cascade: Jev decides when confident (pass <= 0.15, lost >= 0.85); its unsure band, an error, over-bound evidence or no Jev port escalates once to the existing summaryReview port (full packet + proposed notes, invokeSubscription, inside maxCalls); review pass accepts (faithfulness path 'subscription', and the redundant integrity pair is skipped), review violation refuses, retryable unavailable refuses as undecided, thrown/uncertain stays UNKNOWN. The review question now names faithfulness. The {"reply"} envelope is unwrapped. The candidate window skips frontiers at or before an UNKNOWN charge. undecidedEdits keeps the latest 5, each clipped to 600 chars, with a disclosed moreUndecidedEdits count. Evidence: tests/preview/summary-accept-cascade.test.ts (10 tests, proof-room fixtures on both sides: faithful accepted via review, lossy refused by review, confident lost refused with no review, confident pass unchanged, review retryable/thrown, envelope, byte-held long chat resumes, UNKNOWN window, bound); 6 of the first 8 fail on the base code; a scratch replay of the proof-room journal accepts 47 summaries with the review passing and 0 with it always violating, answering its turns either way; all 160 tests/preview files pass.
Affected rules: 2/7 (refused summaries keep originals; omitted warnings are counted and stay in journal, history and recall), 11/47/110 (a long chat compacts again; disclosure path unchanged), 15/77 (the room answers its long chat), 42 and purpose rule 3 (undecided never passes on its own; the review verdict is the recorded authority; violation and confident lost still refuse), 55/60/75 (one review per attempt inside maxCalls, reserved and settled through existing rows), 57/67/86/95 (the low-context filter decides only when confident, the full-context gate decides otherwise; fail direction closed for approval, open for reachability), 74, 116 (reuses the existing review port and rows; the window and bound follow the exhausted-frontier and dated/moreDated patterns)
Affected floors: secrets — unchanged; spend cap — unchanged (one extra subscription review per undecided attempt, inside the existing maxCalls; refused at the cap; the escalated pass skips the integrity pair so the net cost is one call); stop — unchanged (the stop gate runs before and after the escalation); no duplicate sends — unchanged; durable intake — unchanged (nothing is deleted; refused summaries keep originals)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: preview journal worker only; an undecided verdict now reaches an existing stronger judge instead of refusing, a confident or reviewed refusal still refuses, and send, intake and authority paths are untouched
Side effects: summaries the review passes are now committed where they were refused; summary-review-reserve rows may follow an undecided faithfulness answer (old journals replay unchanged); answer and summary packets carry at most 5 unresolved-edit warnings plus a count
Undo and recovery: revert the fix commit and this record (and the desk's register regeneration)
Multi-machine posture: machine-local, deliberately; the preview journal worker on the one preview machine
Layer below: tests/preview/journal.ts runSummary (faithfulness cascade, candidate window, summary answer parsing), the journal projection of summary-check and summary-review-reserve rows, packetFor's undecidedEdits, and journal-agent.mjs summaryReview
Bug class: integration
Bug evidence: reproducer=tests/preview/summary-accept-cascade.test.ts
Hook bypass: none
Convergence: none
Prompt review: two prompt texts changed: the summaryReview question (journal-agent.mjs) now also names faithfulness loss as a violation and keeps "uncertainty is a violation"; the undecidedEdits packet instruction discloses the omitted count. Both are questions to the model, not asserted answers. The 0.15/0.85 Jev calibration is unchanged.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change

Subject (3 paths): tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/summary-accept-cascade.test.ts

## Closing block

simplestRobustRoute: route the faithfulness unsure band to the summaryReview port and rows that already escalate the integrity check, unwrap the envelope the shared prompt already asks for, filter the candidate window the way exhausted frontiers are filtered, and bound one packet list the way dated items are bounded. No new route, model, store, format or judge.
80/20: 0 must-fix, 2 notes (a summary over the 2048-token output cap still ends that attempt UNKNOWN, a separate production-provider policy unit; per-question recalibration of the band against the stronger model needs graded live pairs, which the recorded Jev-score-beside-review-verdict rows now supply)
VERDICT: author submission; the independent verdict is recorded as a pass
