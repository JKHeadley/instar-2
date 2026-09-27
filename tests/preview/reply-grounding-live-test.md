# Reply grounding audit: Justin's live check

Use the already approved private preview chat, existing root, grant, activation,
model and caps. The desk runs these commands on the single runner host with its
existing storage-key binding. Do not start a second runner or alter the journal.

1. Run `status --root ROOT` and record `replyGrounding`, remaining calls,
   replies and turns. Pause if any cap leaves no room for two ordinary replies;
   use only the existing recorded `raise-caps` authority if available.
2. As Justin, send `Remember this test fact: the blue lantern is in drawer 7.`
   Wait for one PREVIEW reply. Run read-only `inspect --root ROOT` and note
   `reply.update`.
3. As Justin, send `Which drawer has the blue lantern?` Wait for one PREVIEW
   reply. Run `inspect --root ROOT` again to record its `reply.update` and
   visible text. The answer should say drawer 7;
   if it does not, preserve that result rather than editing the journal.
4. Run `node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root ROOT --update UPDATE_ID` for the second turn. Confirm `reply.text` matches the actual PREVIEW send intent, `telegramMessageId` is positive when Bot API accepted it, and `grounding.history` or `grounding.recalled` names the first turn. If a summary covered it, confirm `summaryThrough` and the corresponding recalled/person/commitment source as actually selected; absence from a bounded packet is recorded honestly.
5. Stop and resume the runner through its ordinary supervised procedure. Repeat
   `inspect --update UPDATE_ID` and compare the full `reply.grounding` object,
   including `packetSha256`, byte for byte. Check `status.replyGrounding.recorded`
   advanced by two and that each update has one send intent and at most one API
   receipt. Preserve the commands, replies and outputs for the desk gate.

This checks one live packet and replay on the existing trial. It does not prove
that a cited item caused the model's wording or that Telegram delivered or read
the API-accepted reply.
