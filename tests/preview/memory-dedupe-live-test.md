# Memory dedupe live script for Justin

Use the existing authorized private preview chat after the desk lands this build and
resumes its one runner. This file is a script, not a claim that a live test ran.
Keep the same root, bot, audience, grant, expiry, and model. Record the actual
Telegram replies and `status`/`inspect` JSON as the trace.

1. Run `journal-agent.mjs status --root ROOT` with the existing storage-key host
   binding. Record `commitments.total`, `commitments.open`, `calls`, `replies`,
   `summaryThrough`, and `holds`. Ensure the existing caps leave room for at least
   five calls, four replies, and four turns; the desk may use its already recorded
   `raise-caps` authority if needed. Do not reset the root.
2. As Justin, send `Please remember that my gym locker code is 3310.` Wait for its
   reply. Then send `Remember: my gym locker code is 3310!` and wait for its reply.
   These are two source messages for one complete quoted request.
3. Wait for a covering summary and `summaryPending: 0`. If necessary, send
   unrelated ordinary turns until `inspect --root ROOT --text "What code did I ask
   you to remember?" --model MODEL` reports `next.historyMode` as
   `summary-plus-recent`. `status.commitments.total` should have risen by **one**
   from the baseline, and the one open item in `inspect` should show both original
   messages, one as its primary source and one in `sources`. Ask the same question
   in chat; the reply should state 3310 once, without presenting two independent
   remembered items.
4. Send `Please remember that my gym locker code is 4412.` Wait for its reply and
   covering summary. `status.commitments.total` should now be **two** above the
   baseline. `inspect` should show a separate 4412 item; it must not attach 4412
   as another source of the 3310 item.
5. Send `Actually my gym locker code is 4412, not 3310.` Wait for the reply and
   covering summary. Check `status.withheld` cites the 3310 source and the
   verified correction. Ask `What is my gym locker code?` The reply should give
   **4412 only**. In `inspect`, both old 3310 source messages should be withheld,
   while the authenticated correction message may still quote 3310 as the old
   value. The 4412 item should remain open and distinct. Record any cap hold,
   unavailable summary decision, or mismatch as an incomplete or failed trace.
