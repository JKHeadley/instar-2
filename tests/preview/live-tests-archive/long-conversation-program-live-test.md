# Justin's private preview check: one 200-turn conversation

Run only after the desk lands this build and authorizes a trial with enough existing
capacity for 200 turns, 200 replies, summary calls and possible full-context reply
reviews. Use Justin's bound account in one private Telegram conversation on the
reviewed runner. This builder test does not start, modify or read the live runner.

1. Save the runner's `status --root ROOT` output. Confirm the grant, expiry and
   recorded caps cover the planned run; keep the installed provider policy and
   context byte cap. Record starting cursor, calls, replies, summary frontier,
   unknowns and holds. Do not reset the journal or repeat an uncertain call/send.
2. In turns 1–3, Justin states three harmless, distinct facts with exact values,
   such as the color of a studio door, a named meeting room and a shelf count.
   Record those exact clauses outside the journal for scoring. Send turns 4–199
   in the same chat over one day, one at a time after each reply. Mix short
   ordinary messages with 1–2 KB planning notes about unrelated topics. Make
   roughly every fifth turn long. Keep the content harmless and avoid commands
   that would request a tool or a separate conversation.
3. At turns 25, 50, 100, 150 and 199, save `status`. Record accepted turns,
   replies, calls, `summaryThrough`, holds, UNKNOWN outcomes and packet bytes.
   Inspect one prepared answer packet after each checkpoint: it must stay under
   the installed context limit, and summaries must cover earlier turns as the
   unsummarized tail grows. When Jev escalates, inspect the recorded review
   result and prepared prompt size; a review overflow or `reply check unavailable`
   hold is a failure. A Jev clear pass simply counts as a checked reply.
4. For turn 200, Justin asks for all three original values without repeating
   them. Score exact facts present in the prepared answer packet and correct
   values in the reply separately, each out of three. The target is 3/3 for both,
   one reply per accepted turn, no `too long` or overflow hold, and every
   prepared answer and review within the installed byte limit. A summary quote
   is evidence of packet visibility; the actual reply establishes answer recall.
5. Save final `status` and the three turn IDs, summary frontier, packet sizes,
   review outcomes, reply receipts and any holds in the desk's trial record.
   Restart the runner normally and check that those counters and the 200th
   answer replay unchanged. If a cap, expiry, stop or UNKNOWN outcome intervenes,
   record the exact first turn and reason as an incomplete result. Preserve the
   journal and one-shot send fence; use only the desk's existing authorized
   recovery procedure.
