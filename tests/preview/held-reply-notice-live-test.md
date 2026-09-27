# Held-answer notice: supervised live script as Justin

Use the desk-approved journal preview bot, root, activation, private chat,
expiry and limits. This script changes no grant, credential, cap or live journal.
The builder's offline tests are not evidence that a real Telegram notice arrived.

1. As Justin, send one ordinary message in the bound private chat, and note its
   Telegram time and update ID. Have the desk identify a real `reply check unavailable`,
   `call cap`, or `memory correction pending` hold for that turn in `status.holds`.
   Do not create a hold by editing the encrypted journal. Record the hold reason
   and first observation time.
2. Before ten minutes have elapsed from the durable hold time, confirm there is
   no held-answer notice in the chat and no `status.heldNotices` entry for the
   update. After more than ten minutes, confirm exactly one message arrives:
   `PREVIEW — I'm holding my answer to your message from HH:MM; it will follow or I'll tell you why`.
   Confirm `HH:MM` matches Justin's original message time in the runner's
   configured time zone. The original answer must not be sent by this notice path.
3. Run `status` twice and restart the same authorized runner once. Confirm the
   update has one `heldNotices` entry with `api-accepted`, one Telegram notice,
   and no second notice after another drain. If the send outcome is UNKNOWN,
   confirm the journal reports UNKNOWN and restart does not send it again.
4. If the desk can resolve the hold under the existing grant and finite caps,
   do so through the normal recovery path. Confirm the answer then arrives once,
   the notice remains in history, and neither send is repeated after restart.
   If the hold cannot be resolved within this trial, record it as still held;
   do not edit or replay the original turn.
5. Record the original update ID and time, hold reason and durable hold time,
   notice intent and receipt state, Telegram message IDs, restart result,
   answer result, and whether the notice was seen before and after the ten-minute
   boundary. Keep secrets and raw message bodies out of the report.
