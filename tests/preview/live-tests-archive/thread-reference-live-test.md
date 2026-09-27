# Live test: Telegram reply references in the journal preview

Justin runs this in the existing approved private preview chat after the desk
lands the build and resumes its existing journal runner. Keep the recorded bot,
chat, grant, expiry, model and limits. Check `status` first for enough room for
three turns, three model calls and three replies. Use the existing `raise-caps`
procedure if the approved trial needs more room.

1. Send a distinctive harmless fact in the main chat, for example: “For this
   check, the paper kite is violet.” Wait for the single PREVIEW reply. Note the
   Telegram message IDs of both the operator message and the agent reply.
2. Use Telegram **Reply** on that earlier operator message and ask: “What color
   was the paper kite in the message I replied to?” Wait for one reply. Run
   `inspect` with the existing root. Its `last.replyTo.messageId` should be the
   earlier operator message ID; `user` should contain the fact; `answer` should
   contain the agent's actual earlier reply. Check the answer addresses violet.
3. Use Telegram **Reply** on the agent's reply from step 1 and ask: “Which
   earlier message did that answer address?” Wait for one reply. `inspect`
   should show the agent reply's Telegram message ID and the same earlier
   operator text and actual agent reply. Check that the answer addresses the
   referenced exchange.
4. Send an ordinary message without Telegram Reply. `inspect` should show no
   `last.replyTo`. Run `status` and confirm one reply per accepted turn, no
   duplicate Telegram sends, no unexpected holds, and the recorded call and
   reply counts remain within the trial caps. Save redacted inspect/status
   output and the observed Telegram results as evidence.

Run the read-only checks using the existing storage-key host binding:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs inspect --root "$PREVIEW_ROOT"
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs status --root "$PREVIEW_ROOT"
```

This is a supervised operator-channel check. A held turn or unavailable target
is an incomplete result to record, not proof that the model saw the exchange.
