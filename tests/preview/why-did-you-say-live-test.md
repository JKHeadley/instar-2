# Desk live test: explain a recorded reply

Use the existing approved journal runner, root, bot, grant, expiry, limits and
vault bindings. Run this only as Justin, the verified operator, in the bound
private Telegram chat. This branch does not launch or change that runner.

1. Check `status` for room for three turns, three replies and three answer calls,
   plus review allowance under the existing Jev policy. Use the already recorded
   cap-raise authority if needed. Send: “Remember that the project marker is
   Cedar.” Wait for one PREVIEW reply.
2. Send: “What is the project marker?” Wait for one PREVIEW reply. In Telegram,
   use **Reply** on that bot message and send: “Why did you say that? Which of my
   turns and memory items were in the packet you used?” Wait for one PREVIEW
   reply. The answer should identify the recorded turn or memory item if it was
   present, distinguish available inputs from proven internal reasoning, and
   say plainly if the record is missing. A claim that it knows exactly which
   input caused its answer fails this test.
3. Run `status` and `inspect` against the same root with the existing storage
   key binding:

   ```sh
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
   node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT"
   ```

   Confirm `inspect.last.replyProvenance.update` points to the message from
   step 2 and `recorded` is true. Compare `history`, `recalled` and
   `channelSourceIds` with the answer and the messages Justin sent. Confirm the
   explanation has a completed `lastReplyCheck` (Jev PASS or a completed
   subscription PASS), one
   exact send intent and one Telegram receipt, with no duplicate reply. Record
   the observed check path and latency from `status`.
4. For the missing-record side, use an existing older reply only if its journal
   reservation has no saved prompt. Ask why as a Telegram reply to that message.
   `inspect.last.replyProvenance.recorded` must be false and the answer must
   say it lacks the packet. If no such historical reply exists, record that this
   live branch was unavailable; the offline legacy-journal test covers it.

Keep all messages in Justin's private chat. Do not paste secrets into the trial.
