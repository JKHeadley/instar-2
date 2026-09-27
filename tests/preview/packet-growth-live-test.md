# Packet growth — supervised live test as Justin

Use the existing approved private preview runner and Justin's bound Telegram account
after the desk installs this build. Keep its grant, system prompt, activation policy,
provider limits and journal root as they are. Record `status` before starting; confirm
there is enough time and at least six turn, call and reply slots. The desk may use
the existing authorized cap raise if the trial needs more slots.

1. In the private preview chat, send `What is the observatory access code I told you?`
   Record the exact reply and the persisted prompt's packet byte count, `historyMode`,
   `summary.through`, `history` IDs and `recalled` IDs. An unknown answer is honest
   when the fact was never in this journal.
2. Send `What is the ferry docket I told you?` and record the same fields. Check
   that a prior observatory source is offered only if this question relates to it;
   it must not remain merely because the preceding question recalled it.
3. If either fact exists in the journal, ask about it once more. The answer should
   use the same fact and cite its source. An accepted summary must replace covered
   raw turns in `history`; a relevant older turn may appear in `recalled`.
4. Inspect `status` and the stored prompts after each answer. Every prompt must fit
   the current byte cap. Compare a later prompt with the first at a similar point
   in the summary cycle; packet size should follow the short unsummarized tail,
   rather than all earlier turns. Confirm journal turn count, cursor and prior
   replies remain intact after a normal restart. Confirm exactly one new send
   per question and no changed UNKNOWN, stop or cap accounting.

The offline companion is `packet-growth-replay.mjs`, which plants two dated facts,
replays 500 encrypted journal turns and reports exact packet bytes at 36, 100 and
500 turns. It makes no Telegram send or model call. The live check is incomplete
if the runner cannot accept enough turns before its existing cap or expiry.
