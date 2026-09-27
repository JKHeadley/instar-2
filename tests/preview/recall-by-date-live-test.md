# Recall by date: Justin's live private-chat test

Use the already approved journal runner, root, private Telegram chat, bot,
expiry, caps and Jev binding. Do not restart it with a new root or edit its
journal. The desk runs this with Justin; this branch supplies only the script.

1. In the existing journal, identify two ordinary, non-sensitive messages
   Justin personally sent on two known calendar days. Use their Telegram send
   dates in the runner's configured time zone. Record the exact days privately;
   do not copy message contents into a shared test log.
2. As Justin in the bound private chat, ask “What did I tell you on Tuesday?”
   using a weekday that has a known message in the most recent week. Check that
   the PREVIEW answer reports only in-day operator statements, dates each one,
   and gives no statement from the adjacent day. If the exact weekday is not
   suitable, ask with its ISO date instead.
3. Ask “What did I say from YYYY-MM-DD to YYYY-MM-DD?” with the two known days
   as the inclusive bounds. Check that the most relevant results come first,
   at most five original turns are quoted in the saved packet, each reported
   item has its date, and no out-of-range statement is attributed to the range.
   If there are more than five matches, the answer must not claim the list is
   exhaustive.
4. Use an already forgotten, non-sensitive test fact if one exists in this
   journal. Ask for that date again. The answer and `inspect` packet must not
   reveal its forgotten clause. If no such fact exists, Justin may send a
   harmless test sentence, ask to forget that exact sentence, wait for the
   normal acknowledgement, then ask for its send date. Do not use a real secret.
5. Run the runner's `status` and `inspect` on the same root. Confirm the last
   answer has `lastReplyCheck.verdict: pass` through Jev or a completed
   subscription review, one exact send intent and one receipt (or an UNKNOWN
   intent with no retry), and no duplicate Telegram reply. Record dates,
   selected count, verdict/path and whether the observed answer matched the
   source turns. A held reply-check result is a visible hold, not a passed test.

This proves the live private-channel behavior only when Justin and the desk
complete these observations. Offline tests alone do not establish it.
