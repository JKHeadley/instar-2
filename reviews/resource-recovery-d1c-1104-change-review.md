# Deferred report selection and single delivery

Subject base: 45ce50d0244ea2a29cb2bd31cd72f5eb44ea3003
Review state: open
Reviewed content: none
Suggested tier: critical
Tier rationale: bounded model-facing report selection repair with exact delivery floors unchanged.
Prompt review: the report-selection guidance and existing fulfillment-format retry now explain exact duplicate rendering; one real recorded-packet replay selected both reports. No literal test answer is prescribed.
Outcome: a current answering model can select two identical prepared reports for one deferred request and deliver the result once, binding both selected identities to the same durable intent and receipt.
Affected rules: 8, 22, 92 (owned work reaches its report/receipt); 4, 10, 26 (explicit model selection, exact source/text checks); 36, 58, 70 (captured case and falsifiable replay); 74 (side effects and rollback); 101 (plain commits); 113 (machine posture); 116 (existing selection, one bounded retry, existing settlement).
Affected floors: secrets, spend cap, stop, durable intake and no duplicate sends remain unchanged. No extra model call beyond the existing single format retry. No new effect, approval, store, journal field or settlement authority.
Operator questions: none
Declared tier: significant
Side effects: explicitly selected reports whose complete exact text already occurs in the reply bind without appending that text again. Independent identities retain independent selection checks. The existing size ceiling still stops further attachment when a result does not fit. Revision carry lines are unique. Omitted, rejected, stale, wrong-topic or already-bound results retain their existing guards.
Undo and recovery: revert this source change. Journal shape is unchanged, so older code can replay the new answer/intent/receipt rows. No state migration or forced settlement.
Multi-machine posture: the existing owner, journal intent binding and receipt protocol remain authoritative across restart and ownership transfer; no new machine-local or shared state.
Layer below: summary/request recording, recordReplyLoop, fulfillmentSupported, answer report admission, applyIntentObligations, sentObligations and receipt closure. Neither captured commitment had agentPromise; widening that validator would be the wrong repair.
Bug class: live-path
Bug evidence: reproducer=tests/preview/report-settlement-live.test.ts; live=tests/preview/fixtures/report-settlement-46040806-2026-11-04.json
Hook bypass: none. core.hooksPath was unset; the resolved common hooks directory contained only sample hooks.
Convergence: none

## Cause and limits

On installed 45ce50d0, summary row 153 through update 46040805 recorded the request as commitment 1. Answer/intent rows 161/174 recorded its reply judgment loop as commitment 2, with promises empty. Rows 250/259 produced identical reports. The answer model at 46040806 omitted selectedReports to avoid duplicate rendering and proposed fulfilled ids 1 and 2 (row 317). Neither id was an agentPromise. The generic format retry (row 319) led it to retry id 2 alone (row 325), still unsupported. Row 327 counted one rejected fulfillment; intent 341 carried no reports; receipt 343 delivered the substantive paraphrase without settling either result. Later delivery of commitment 1 at 46040808 does not change this trace.

The repair makes the existing route usable: explain prepared-report selection in the answer guidance and existing fulfillment retry, include each selected exact result only once, and bind every explicitly selected key. It does not infer that two differently worded commitments mean the same work, broaden fulfillment eligibility, or close reports on paraphrase alone. The old raw answers remain refused, and the test demonstrates that honestly.

The real claude-opus-5-5 replay of row 319's prepared packet with the changed guidance selected both keys and kept its own greeting brief. Its raw output is in the fixture. It ran tool-free through the installed harness handoff with the non-reserved test profile; no live runner or message was changed. This is one measured prompt response, not a deployed D1c pass or a model reliability estimate.

The earlier c4ac82ee journal corrects the claim that no promised answer was delivered: rows 190/192 delivered commitment 5 through the owed-result route at 19:46 PST (receipt 2830), before hi update 46040797. The prior model had declared deliveryRequest; the current run did not. Nevertheless its proof PASS is weaker than complete settlement: D.sh permits a reply-count increase during the quiet window to substitute for the follow-up marker, then checks aggregate awaitingDelivery zero. Its hi reply (46040797) did not contain the planning answer and workInFlight remained 1. The hi intent (row 382) rejected commitments 2/3/4 into rework, including a duplicate planning report; zero awaitingDelivery therefore did not establish complete settlement. The earlier receipt does establish one delivery of the planning answer, not just an unrelated count increment. The current FAIL exposed a product selection/rendering gap; the resource-owner delta is not shown causal. The desk proof should bind the deferred request's actual report identities and receipts, including the delivered content, rather than a global count or marker. No proof assertion was changed here.

Relevant carryover: absolute desk file carryover-1028.md, row 01, “PromiseBeacon / CommitmentTracker: finish and deliver.” It remains OPEN for the complete grouped unattended outcome; this repair is narrower. Rules 8, 22 and 92 are not promoted by offline tests or the one model replay.

## Verification

The seven generated register artifacts are refreshed from source commit dcf3b8c3b1d289296cd13ca042929f2c821bb447. This record also covers that refresh; it changes source pins, not runtime authority or coverage claims.

The regression reconstructs two waiting reports from the captured request, reply loop and exact result bytes. An unrelated id 0 is a stated synthetic placeholder. It feeds both old outputs through readAnswer and the worker, then the new real replay output through the same route. Positive cases assert one result occurrence, one send, both intent bindings and receipt settlements, with disk reopen. Negative neighbors cover no result, only one selected key, UNKNOWN receipt and claim-scoped report removal.

Can-fail check: with journal.ts restored temporarily to base 45ce50d0, the two positive cases fail with 2 and 3 result occurrences instead of 1. Restoring the repair passes. Additional recorded-shape compatibility checks use summary-cascade-stall (715672479–715672500, uncertain 492/496/497, undecided Jev 0.38), claim-scoped-floor (969389898/969389899) and run-completion's retained real otherShapes. Empty context/output fixtures are not evidence that Telegram delivered an empty message.

simplestRobustRoute: this is the simplest robust route: reuse current model report selection and the existing bounded format retry, deduplicate only exact already-present result bytes, and retain the existing final-text and receipt checks. Semantic merging or a new settlement protocol would add authority and recovery machinery without being necessary for the captured case.

80/20: author checks complete; independent review and exact-head live delivery remain desk-owned.
VERDICT: author submission; this record asserts no independent verdict.

Prompt finding: 4106b49fff07 | protocol-literal | Existing runner protocol or fixed status text; unchanged by this repair and not a semantic answer prescription.
Prompt finding: 849db3a6296a | protocol-literal | Existing runner protocol or fixed status text; unchanged by this repair and not a semantic answer prescription.
Prompt finding: 85544c20941f | protocol-literal | Existing runner protocol or fixed status text; unchanged by this repair and not a semantic answer prescription.
Prompt finding: e8708c7fea24 | protocol-literal | Existing runner protocol or fixed status text; unchanged by this repair and not a semantic answer prescription.
Deferral: tests/preview/fixtures/report-settlement-46040806-2026-11-04.json:53 | not-a-deferral=Captured model text or replay setup/description, not deferred implementation work.
Deferral: tests/preview/fixtures/report-settlement-46040806-2026-11-04.json:54 | not-a-deferral=Captured model text or replay setup/description, not deferred implementation work.
Deferral: tests/preview/report-settlement-live.test.ts:71 | not-a-deferral=Captured model text or replay setup/description, not deferred implementation work.
Deferral: tests/preview/report-settlement-live.test.ts:149 | not-a-deferral=Captured model text or replay setup/description, not deferred implementation work.
