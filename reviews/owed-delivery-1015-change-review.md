# Change review — owed-delivery-1015

Subject base: a1b59d03faad205e33fc33dc6915825abfecb635
Review state: open
Reviewed content: none
Outcome: completed obligations with an explicit operator request for follow-up delivery use the existing requested-action reply path without another user message; closure follows the complete transport receipt.
Affected rules: 4, 8, 10, 26, 28, 29, 34, 36, 46, 52, 55, 57, 60, 63, 64, 68, 70, 74, 83, 84, 86, 87, 93, 101, 107, 111, 113, 116
Affected floors: secrets — existing outbound and review disclosure checks; spend cap — existing call/reply admission; stop — existing worker and dispatch gates; no duplicate sends — result slot identity, signed due frame, durable intent and complete receipts; durable intake — existing journal, no new store.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: requested outbound delivery and durable closure change; explicit request authority narrows the existing reply grant, not a new unsolicited-send grant.
Side effects: an explicitly requested, dependency-free follow-up starts at the next bounded work tick instead of the daily revisit. Its finished report is sent through the existing post-poll pass and reply review, without a second answer-generation call. A cancellation uses the existing commitment closure with an exact verified operator clause. Other promises retain the next-message behavior. UNKNOWN results remain owned and visible. Withdrawn results remain retained and visible, but do not revive cancelled work.
Undo and recovery: revert only before new deliveryRequest declarations or owed action-due frames are written; older readers reject those shapes instead of dropping their authority or no-repeat evidence. Retain this reader for roots containing them. Restart before intent resumes the same prepared reply; restart after an unknown send never retries it. No live root was changed.
Multi-machine posture: uses the existing journal writer and conversation owner. The scheduler signature binds result keys/slots, current grant, chat and topic; no independent peer sender or machine-local queue is introduced. Source and result evidence follow existing journal replication and snapshots.
Layer below: inspected verified intake, requested-action system signatures, capacityRefused, current audience admission, outbound secret checks, durable intent report binding and settleDeliveredReply. The latter waits for the last split message. Scheduler dispatch still occurs only after a successful empty poll, after queued withdrawals are read.
Bug class: unit
Bug evidence: reproducer=tests/preview/owed-delivery.test.ts
Hook bypass: none
Convergence: none
Decision: owed-existing-reply | reuse signed action-due with an exact durable result slot and prepared report; no new sender, timer or answer regeneration | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owed-delivery-1015-PROGRESS.md
Decision: owed-source-withdrawal | cancellation is a model-selected exact clause of a later verified operator turn; use existing closure before attaching reports | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owed-delivery-1015-PROGRESS.md
Prompt review: model-facing. The private-chat historical digest is preserved by restoring only the changed obligation guide and sends-constraint fields from the immutable capture; current values are asserted separately. The full and floor guides ask for deliveryRequest only for an explicit request to send the finished result; promises alone grant nothing. The work question distinguishes requested delivery from next-message reports. Recorded work output obligation:commitment:3:1791099958095 from the update 6232091 deferred-answer case reaches the new delivery path. Recorded summary writer 715672480, uncertain summary 715672483, Jev undecided 715672482 and unsure 969389570, reply review 969389923, delivered reply 715672479 and empty recorded context 715672550 are consumed as work output and produce no invented report or authority. Fixtures retain their provenance. The empty context is not evidence that Telegram delivered an empty bubble. No real desk-run acceptance is claimed; the brief reserves that conversation and its update/message IDs for the desk.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response in journal.ts, unchanged by this change.
Prompt finding: 4106b49fff07 | quoted-evidence | the historical packet test restores the earlier recorded no-tools instruction solely to preserve its immutable digest; this is not a model decision keyed to a test phrase.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label guidance in journal.ts, unchanged by this change.
Deferral: tests/preview/README.md:32 | not-a-deferral=documents retained reports and their exact delivery conditions, not postponed implementation.
Deferral: tests/preview/journal.ts:2464 | not-a-deferral=the work prompt states the implemented boundary between requested and next-message delivery.
Deferral: tests/preview/owed-delivery.test.ts:134 | not-a-deferral=identifies the captured deferred-answer fixture being replayed, not unfinished builder work.

Register publication: generated register and capability artifacts bind source commit cbd671a23a613524e16e2e742b0ac998fc1277c4; the regenerated capability, historical packet and fixed context-floor checks pass 26/26 tests.

## Closing block

simplestRobustRoute: this is the simplest robust route through the existing bounded obligation and requested-action machinery. An optional exact source clause prevents a promise from authorizing an unsolicited message. A signed result-set identity prevents a restart or a withdrawn batch from duplicating or stranding its results. Existing source, spend, stop and audience guards admit the start; durable intent prevents repetition; complete transport receipts alone establish delivery. No extra service, outbox or universal reviewer was added. Live unattended acceptance is reserved for the desk and not claimed here.
80/20: the final targeted group passed 145 tests with one existing skip; the generated capability line is kept inside 130 characters and the original private-packet digest remains unchanged. Targeted tests cover positive and negative authority, restart before intent and after uncertainty, receipt closure, cancellation, audience, secret and spend/stop boundaries, and recorded model shapes. The fixed prompt floor remains unchanged; repeated wording was shortened to keep all required context.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
