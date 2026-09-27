# Desk live test: a dated week recap as Justin

Use the existing approved private journal runner and bound operator chat. Keep
its grant, bot, journal root, expiry, model, zone and installed limits. Do not
edit or replay the live journal. If the runner is stopped or its caps or expiry
prevent a reply, record that state and end the probe without raising limits.

1. As Justin, send “What did we talk about this week?” in the bound private
   chat. Use a week that already contains at least one known operator turn;
   record its date and a known open question or commitment if one exists.
2. Observe one normal `PREVIEW —` reply. Check that it names the week or dates,
   attributes subjects only to that period, and marks any supported open
   question or commitment as open. If the packet omitted turns, the reply must
   disclose that it is partial. Do not treat silence about an item as proof it
   was absent.
3. Run `status` and `inspect` with the current approved root as described in
   this README. Confirm the inspected model packet has `period.from`,
   `period.through`, `period.zone`, a bounded `period.turns` list with dates,
   and `period.omitted`; compare one item to the known Telegram message. Confirm
   `lastReplyCheck` is a completed Jev or subscription pass, the exact send
   intent has one Telegram API receipt, and no duplicate reply arrived.
4. As Justin, ask “What did we talk about last week?” only if there is a known
   turn then. Confirm the previous Monday–Sunday window, that this week's turn
   is excluded from `period.turns`, and that the answer does not attribute it
   to last week. Record honest uncertainty if the recap is partial.

Save redacted status and inspect evidence for the gate. Telegram API acceptance
does not prove the operator read the message. Offline tests use model and Jev
stubs; this procedure supplies the real operator-channel observation.
