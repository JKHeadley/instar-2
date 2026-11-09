# Change review — reply noise repair: the model judges carried results

Subject base: 540ef47e58856535efd2bde5d707528da06e75d1
Review state: open
Reviewed content: none
Outcome: Answers Astra's round-1 review of reply-noise-1108. The shared-passage veto (separateCarried) is removed with its re-ask clause, so one passage that truthfully gives several owed results delivers all of them in one call again. Whether a reply gives an owed result stays the answering model's judgment: the report-selection guidance now says to carry an item only when the reply alone tells the operator its result, that one passage may give several, and that an item the reply does not answer is selected or rejected, never carried. The runner's exact checks (quote present in the reply, item offered, final text, send receipt) are unchanged. The login-notice half of reply-noise-1108 is untouched.
Affected rules: 2, 4, 8, 10, 12, 26, 36, 70, 86, 92, 116
Affected floors: secrets — no credential read, written or printed; spend cap — no new model call, and the shared-passage refusal that forced a re-ask is gone; stop — stop admission unchanged; no duplicate sends — no send path changes, and a verbatim result is still appended at most once; durable intake — no intake or journal row shape changes
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Accept the suggested tier. The change is one guidance clause and a removal, but it sits on the reply path and on owed-result delivery, which closes commitments.
Side effects: Owed results carried by one shared passage close again after delivery, as at base. The model is offered a longer, more specific carry instruction (about the same length as the reviewed head's clause; the 29642-byte envelope test still reaches both short middle reports). An unanswered offered item that the model nonetheless declares carried would still close: only the model's judgment prevents it, which is the review's chosen route; the real-model replay of the recorded 11:54 context is not done on this host.
Undo and recovery: Revert the commit to restore the reviewed head (veto plus its clause). No state is written and no row shape changes.
Multi-machine posture: Machine-local, deliberately. Each runner keeps its own journal; the change reads only that runner's packet.
Layer below: Read carriedProposals and replyProse/carriedEvidence/reportEvidenced, the undecidedReports re-ask, the answer's own-words parsing, the revision renewal and the reportCandidates packet (each offered item carries its subject, the promise wording, and its text, the stored result) in tests/preview/journal.ts. The 11:54 raw declarations and turn context live only in the Studio's live preview journal, which this host cannot reach (lanes evidence: reply-noise-1108-PROGRESS.md says so; review evidence holds only the synthetic reproducer).
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-noise-1108.test.ts
Hook bypass: none
Convergence: none
Decision: reply-noise-repair-remove-passage-veto | Remove separateCarried and the "one passage gives one result" restriction in the parse, the re-ask decision and revision renewal, because a passage can truthfully answer several promises and exact text overlap cannot decide meaning (Rules 4, 10, 86); supersedes reply-noise-passage-per-result and reply-noise-refusal-reuses-reask. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-noise-1108-repair-123722-PROGRESS.md
Decision: reply-noise-repair-carry-guidance | Repair the existing report-selection guidance instead of adding a validator or review call: carry only what the reply alone tells the operator, one passage may give several, an unanswered item is selected or rejected; kept short so the tight envelope still reaches its reports. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-noise-1108-repair-123722-PROGRESS.md
Prompt review: REPORT_SELECTION_GUIDANCE's carriedReports clause now reads "the runner appends only a short marker, so carry an item only when your reply alone tells the operator its result; one passage may give several. An item your reply does not answer is selected or rejected, never carried." It states the decision the model owns and copies no test phrase (Rule 12). The re-ask text is back to base. Stub tests prove the runner side only; the real-model replay of the recorded 11:54 context (Rules 36/70, observer #106) is not done here because the live journal is unreachable from the Mama PC.
Prompt finding: 4106b49fff07 | protocol-literal | carried unchanged from the merged inputs; this repair does not touch that clause
Prompt finding: 849db3a6296a | protocol-literal | carried unchanged from the merged inputs; this repair does not touch that clause
Prompt finding: 85544c20941f | protocol-literal | carried unchanged from the merged inputs; this repair does not touch that clause
Prompt finding: 9f0106c66027 | quoted-evidence | carried unchanged from the merged inputs; this repair does not touch that clause
Prompt finding: bac6ce7485d9 | quoted-evidence | carried unchanged from the merged inputs; this repair does not touch that clause
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction, unchanged by this repair; the regression checks delivered guidance, not a desired semantic answer.

1.x comparison: Inherited from reviews/reply-noise-1108-change-review.md, which Astra accepted: JKHeadley/instar main fa13c1c8345778af7847c8517c24bb2b7363d8e6, src/monitoring/AccountSwitcher.ts, QuotaManager.ts and CommitmentTracker.ts have no own-words carry marker or report-selection guidance, so this stays a 2.0-owned fix.

Subject (2 paths): tests/preview/journal.ts, tests/preview/reply-noise-1108.test.ts

## Closing block

simplestRobustRoute: Remove the text-overlap veto and improve the existing model's selection instruction, keeping the exact quote, offered-result, final-text and send-receipt checks. No state, field, call, classifier or gate is added. Start guard: only reports offered to this reply. End state: delivered results close after delivery; unanswered results stay owed when the model selects or rejects them. Limits: the existing single re-ask, call allowance, reply bounds and stop.
80/20: The combined-passage positive and the guidance-in-packet test fail at the reviewed head and pass here; the individual-quote control and verbatim-select delivery pass both ways. The remaining gap is the real-model replay of the recorded 11:54 context, which needs the Studio's live journal.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
