# Justin's private preview check: long conversation headroom

Run this only after the desk lands and authorizes this build for the existing
private preview. This builder branch does not touch the live runner or journal.
Use the desk's reviewed activation, bot, private chat, expiry and caps; arrange
enough unused turn, reply and shared model-call allowance for 40 answers, Jev
checks and rolling summaries before starting. Keep the desk report present.

1. Save `journal-agent.mjs status --root ROOT` and note the current turn count,
   `summaryThrough`, calls, replies, holds and UNKNOWN outcomes. Confirm the
   remaining allowance can cover the exercise without raising a cap mid-run.
2. Justin sends 40 ordinary, synthetic questions of about 285 characters in
   the same private conversation, one at a time. Include a distinct harmless
   marker in question 1, such as `PAPER-KITE-721`, and ask about it again near
   question 35. Wait for the reply and settled summary work after each send.
   Keep the questions free of secrets and requests to change memory.
3. After each turn, record whether it got one substantive PREVIEW answer, a
   too-long notice, or a hold. Check `status` at turns 10, 20, 30 and 40 for
   `summaryThrough`, holds, pending summaries, calls and replies. Inspect the
   answer packet near turn 35 and confirm its summary or recalled source still
   carries the first marker. Record an uncertain or UNKNOWN result as such;
   never resend a turn to make the count look green.
4. The pass target is 40 answers, zero too-long notices, zero summary holds,
   advancing summary frontiers before packet overflow, correct marker recall,
   and no duplicate sends. Save the content-free status snapshots and exact
   Telegram API receipt IDs in the desk trial record. A provider refusal,
   summary failure, call-cap hold or UNKNOWN result is an incomplete live result
   to report, not evidence that the answer was delivered.
