# Ten-message intake burst: live test as Justin

Use a **new, isolated** private-chat journal preview trial with its own approved activation,
empty root, and at least 20 turn slots, 40 call slots and 20 reply slots. Keep the frozen
live runner and its journal untouched. The desk starts this trial with the
`journal-agent.mjs run` command in [README.md](README.md#structural-journal-runner-rounds-1013)
and records its PID, root, starting `status`, Telegram chat and starting cursor.

1. As Justin, send ten Telegram updates within five seconds. Use nine short messages and
   one edit: send message 1, `The burst marker is cedar`; send message 2, `What marker did
   I give you?`; edit message 1 to `The burst marker is silver`; then send seven numbered
   questions. Make one numbered question a Telegram reply-to to message 2. Record the ten
   update IDs and the reply-to target from the Telegram client or an approved read-only
   capture. Do not include a secret or personal fact.
2. In a separate isolated-trial repetition, the desk sends `SIGKILL` to **only that trial
   process** after intake begins and before the burst ends. Justin keeps sending the rest
   of the ten updates. The desk waits for the writer lease to clear, then restarts the
   same isolated trial root and activation. Record the cursor and counts before and after
   restart. Do not edit or replay the journal by hand.
3. Let the trial drain. Read `status` and `inspect --root ROOT --update UPDATE_ID` for each
   of the ten IDs. Confirm one durable intake row per ID, ascending update order, and a
   cursor past the tenth ID. The edit must link to message 1 and have no send intent.
   If message 1 had no send intent when the edit arrived, it must have the explicit
   `superseded by edit` hold. If a model or send outcome is UNKNOWN, record that exact
   status and confirm it is not dispatched again.
4. Compare Telegram's actual PREVIEW replies with the journal's send intents and positive
   Bot API message IDs. Replies to ordinary eligible turns must follow update order;
   each update may have at most one answer send. A held turn must show its reason before
   later ordinary work proceeds. Send one later question about the burst marker and check
   that the answer uses `silver`, or that an undecided edit is stated as uncertain.
5. Restart the isolated trial once more without new messages. Recheck intake count,
   cursor, intents and Telegram replies. None may increase from redelivery alone.

**Pass:** all ten updates survive the kill and restart, the cursor never skips an
unrecorded update, edit and reply-to identities survive, and no update is answered twice.
Record any cap, stop, prompt or model hold as a hold with its durable reason, not as a
successful answer. This procedure is gate evidence for the isolated trial; this builder
has not run it on Justin's Telegram account.
