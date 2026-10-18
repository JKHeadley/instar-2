# Change review — unsolicited-report-1017

Subject base: 5f31a9f2724a50093e5e45128b30030d20d333a7
Review state: open
Reviewed content: none
Outcome: preserve the real room-4 requested-result send as a replay and prove that a completed report without a delivery request waits for the next inbound message. Investigation found no unauthorized send.
Affected rules: 4, 18, 26, 28, 29, 34, 36, 46, 49, 54, 57, 64, 70, 74, 83, 87, 98, 101, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends, durable intake — runtime unchanged; replay uses isolated temporary journals and a local transport recorder.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: captured regression evidence and tests only; no runtime, prompt, parser, policy or authority change.
Side effects: no product behavior changes. Captured model outputs contain the original reasoning, declarations and report; the replay uses test identities and an injected clock. The negative neighbour deliberately removes only deliveryRequest from the recorded declaration. An unrelated summary response is a labelled stand-in.
Undo and recovery: revert this test, fixture and review; no production state or persisted format changes. Live roots were opened read-only, never run.
Multi-machine posture: no new state or sender. The test reopens the existing journal and checks one delivery across restart; the existing owner and replication paths remain unchanged.
Layer below: inspected owedResultAuthority, deliveryRequestSupported, scheduleRequests, action-due projection, signed intent and complete receipt settlement. Source request, verified operator, result slot, destination and installation grant are bound before dispatch. The predecessor train-60 already contains f1d3906065155d37fbeda3b51474f921652e0285, which introduced this route; its recorded commitments lacked deliveryRequest.
Bug class: unit
Bug evidence: reproducer=tests/preview/requested-report-live.test.ts
Hook bypass: none
Convergence: none
Decision: preserve-requested-result | verified update 46040219 explicitly requested a later answer; ordinary reply authority covers that result, while a promise alone creates no send authority | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/unsolicited-report-1017-PROGRESS.md
Prompt review: not model-facing; no question, parsing or acceptance behavior changes. Recorded answer/update 46040219 and work call obligation:commitment:0:1792241039987 pass through the existing conversationSessionAnswer and journal worker. The positive replay matches message 1612 byte-for-byte. The negative neighbour reaches the existing no-grant inhibition, then drains on hi without duplicate delivery after restart.

Deferral: tests/preview/fixtures/requested-report-proofroom4-2026-10-17.json:13 | not-a-deferral=immutable captured operator request for a later answer, replayed by this completed test.
Deferral: tests/preview/requested-report-live.test.ts:17 | not-a-deferral=test name identifies the recorded deferred report; no builder work is postponed.

## Closing block

simplestRobustRoute: retain the existing requested-result authority and add a real replay plus its no-authority neighbour. The suspected regression was a different model declaration, not a widened sender. Removing this path would strand explicitly requested results. No new mechanism or gate is needed. Existing source authority, stop and caps guard the start; durable intent and complete receipts guard delivery. The recorded unattended send is Telegram message 1612 from room proofroom4-dshort15-20261017-052402, before hi update 46040221.
80/20: the investigation resolves the exact outbound text, intent kind, authority, receipt and predecessor difference. The test checks requested delivery, no-request retention, next-message delivery and no repeat after restart. No runtime repair is justified by this evidence; the desk owns final independent review.
VERDICT: author submission; no independent convergence claimed
