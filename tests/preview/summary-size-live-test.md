# Justin's private preview check: bounded rolling summaries

Run this only after the desk lands the change in a separately authorized preview
trial. Use Justin's verified private chat and the desk's reviewed journal runner,
activation, expiry, and existing caps. Keep the live runner and its journal untouched
while reviewing this builder branch.

1. The desk saves `journal-agent.mjs status --root ROOT` before the test. Confirm
   there is room for several replies, their Jev checks, and at least two summary
   calls under the recorded call, reply, and turn caps. Record `summaryThrough`,
   `summaryPending`, `calls`, `unknownCalls`, and holds. If call diagnostics is
   integrated, also record `callOutcomeCounts` and `lastCallOutcomes`.
2. Justin sends a harmless, distinct fact in the private chat, for example
   “For this preview test, remember that the paper kite is named ORCHID.” Wait
   for the one reply and its durable receipt. Then send several ordinary,
   synthetic messages of roughly 2,500 characters each, one at a time, waiting
   for each reply and `summaryPending: 0`. Keep each message below the ordinary
   reply prompt limit. Stop when `summaryThrough` advances twice or the recorded
   cap leaves insufficient room for another reply and summary. Do not alter a
   cap or repeat an UNKNOWN call to force the result.
3. Ask “What was the paper kite named?” Confirm a single answer grounded in
   ORCHID, or record the actual hold or uncertainty. Check that each accepted
   summary frontier advances in order, earlier original turns remain in the
   encrypted journal, and no reply is duplicated. Repeat `status` after a normal
   runner restart to confirm the frontier and call counts replay unchanged.
4. If call diagnostics is integrated, copy only its content-free `role:summary`
   rows from `lastCallOutcomes` as they appear (the view holds the last ten).
   For each call record `promptBytes`, `outputTokens`, elapsed time, and any
   `localLimit`. The pass target is `promptBytes <= 24576`, output usage around
   or below the requested 1024 tokens, and no 2048-token cap or timeout. If the
   provider uses more than 1024 tokens but completes below its 2048-token cap,
   record the measured value; the target is an instruction, not an enforced
   provider limit. Without the diagnostics branch, mark live byte/token measurement
   unproven rather than inferring it from summary text or elapsed time.
5. Preserve the before/after status, the content-free measurements, and the
   Telegram reply receipts in the desk's trial record. A missing covering
   summary, UNKNOWN call, cap hold, or over-budget single turn is an incomplete
   live result; keep the original and do not resend an uncertain effect.
