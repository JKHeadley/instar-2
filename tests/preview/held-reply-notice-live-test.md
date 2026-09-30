# Held-answer notice: supervised live script as Justin

Use the desk-approved journal preview bot, root, activation, private chat,
expiry and limits. This script changes no grant, credential, cap or live journal.
The builder's offline tests are not evidence that a real Telegram notice arrived.

1. As Justin, send several ordinary messages in a row in the bound private chat,
   and note their Telegram times and update IDs. Have the desk identify real
   `reply check unavailable`, `call cap`, or `memory correction pending` holds
   for those turns in `status.holds`.
   Do not create a hold by editing the encrypted journal. Record the hold reason
   and first observation time.
2. Before ten minutes have elapsed from the first durable hold time, confirm there is
   no held-answer notice in the chat and no `status.heldNotices` entry for the
   updates. After more than ten minutes, confirm exactly one message arrives:
   `PREVIEW — I'm holding N answers, including your message from HH:MM; it will follow or I'll tell you why`.
   Confirm `N` equals the accepted answers still held at notice time and `HH:MM`
   matches the selected message time in the runner's configured time zone.
   The original answers must not be sent by this notice path.
3. Run `status` twice and restart the same authorized runner once. Confirm there
   is one `heldNotices` entry with `api-accepted`, one Telegram notice, and no
   second notice in the following hour even if more held turns arrive. If the
   send outcome is UNKNOWN, confirm the journal reports UNKNOWN and restart
   does not send it again. If another held turn is eligible after the rolling
   hour, confirm only one further counted notice is sent.
4. If the desk can resolve the hold under the existing grant and finite caps,
   do so through the normal recovery path. Confirm the answer then arrives once,
   the notice remains in history, and neither send is repeated after restart.
   If the hold cannot be resolved within this trial, record it as still held;
   do not edit or replay the original turn.
5. Record the original update IDs and times, hold reasons and durable hold times,
   notice intents and receipt states, Telegram message IDs, restart result,
   answer result, and whether the notice was seen before and after the ten-minute
   boundary. Keep secrets and raw message bodies out of the report.
