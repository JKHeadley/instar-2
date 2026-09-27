# Justin's live long-message trial

Use the existing approved private-chat preview bot, grant, root, activation, model,
expiry and TypeSafe key binding. The desk runs this only after landing and resuming
the one journal runner. This script does not authorize a new bot, recipient or cap.

1. Desk: pause the runner by signal and wait for its writer lease to exit. Run
   `journal-agent.mjs status --root ROOT`. Record `cursor`, `turns`, `calls`,
   `replies`, `tooLong`, `unknownSends`, and `limits`. Ensure room for 12 turns,
   12 replies and up to 24 model/summary/review attempts. If needed, use the
   already recorded Justin cap authority with `raise-caps` while paused, then
   resume the same root. Do not change `max-context-bytes` for this trial.
2. Justin: in the bot's private chat, send ten messages labelled `Part 1/10` to
   `Part 10/10`. Make each part roughly 3,500 plain letters and include one
   harmless distinct marker near its end, such as `CEDAR-01` through `CEDAR-10`.
   Wait for the bot's response before sending the next part. If Telegram splits
   one paste into multiple bubbles, record the actual bubble count and labels.
3. Justin: for each bubble, check that the bot either answers that part with a
   `PREVIEW —` reply or says it saved the message but could not fit it with the
   needed context. A generic silence is a failure. Do not assume an answer to
   one part covers the others.
4. Justin: send `Which labelled parts did I send, and what can you actually
   recall? If a part was too long for your context, say so rather than guessing.`
   Check that the answer distinguishes known parts from anything it could not
   read. This is a coherence check, not proof of perfect recall.
5. Desk: run `status` and compare it with the baseline. Every Telegram bubble
   must have one durable update, and every reply intent must count once. Inspect
   `tooLong` for update IDs and `delivery`; `Telegram API accepted` proves only
   Bot API acceptance. `UNKNOWN` must remain fenced on restart. Restart the
   paused runner once and confirm `turns`, `replies` and `unknownSends` do not
   grow from redelivery of the same updates, and no duplicate reply appears.
6. Optional output boundary: Justin asks for a reply longer than 4,096
   characters. If the model produces one, the only sent text must be the short
   too-long-reply notice, and `status.tooLong` must label that update `reply`.
   If the model chooses a shorter answer, this branch remains covered by the
   offline boundary tests rather than claimed as live proof.

The single-update `maxBytes` branch is verified offline: Telegram's own message
limit prevents Justin from submitting one 32 KiB text update through the ordinary
client. This live procedure tests split updates through the real operator chat.
Keep the journal and live runner under desk custody; this builder must not run or
alter them.
