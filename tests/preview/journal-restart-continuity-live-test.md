# Restart continuity live script for Justin

Use a new, isolated journal preview trial with its own reviewed activation, private
Telegram chat, finite caps and empty root. Keep the existing live runner and its
journal untouched. The desk starts this trial using the `journal-agent.mjs run`
command in [README.md](README.md#structural-journal-runner-rounds-1013), then
records the root, process ID, activation, model, caps and starting `status`.

1. Justin sends: `For this restart test, remember that the cedar lantern code is 731.`
   Wait for the reply. The desk records `status` and the journal counts.
2. Justin sends: `I am changing the subject: tell me what you can answer in this preview.`
   Wait for the reply and the post-reply summary to finish. The desk records
   `summaryThrough`, `summaryPending`, calls and replies.
3. The desk sends `SIGKILL` to **only the isolated trial process**, waits for its
   writer lease to be released, and restarts the same trial on the same root and
   activation. Justin sends: `What was the cedar lantern code I told you?`
4. The reply must identify `731` from the prior conversation. The desk records
   the actual reply, `status`, and `inspect --root ROOT --text "What was the cedar
   lantern code I told you?" --model MODEL`. The intake count must include each
   accepted update once; physical sends and reply intents must not show a duplicate
   for an update. If a send before the kill is UNKNOWN, it remains UNKNOWN and is
   never sent again. A reserved model call or summary with no durable terminal
   result is also never repeated. A later new question must still work.

The deterministic before/after append-boundary proof is
`npx vitest run tests/preview/journal-continuity.test.ts --configLoader=runner`.
The live script checks the actual private-chat path; the offline proof checks
every append boundary, including intake, model reservation/result, reply check,
send intent/result and summary reservation/result. Keep the live trace as gate
evidence. Do not point either procedure at the current live root.
