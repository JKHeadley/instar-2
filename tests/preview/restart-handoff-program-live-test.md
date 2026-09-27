# Restart and handoff live test for Justin

This is a supervised script for a **new isolated private-chat trial** after the
candidate build has been reviewed. The desk supplies a fresh root, reviewed
activation and profile, finite caps, the bound private chat, and the exact
`journal-agent.mjs run` command from [README.md](README.md#structural-journal-runner-rounds-1013).
Never point these steps at the current live root or journal. Record the build
commit, activation digest, root, caps, and starting `status` for each run.

1. Justin sends `Remember the cedar lantern code 731 for this restart test.`
   Wait for Telegram API acceptance and record `status` plus the sent message ID.
   Justin then sends `What is the cedar lantern code?` and records the answer.
2. Stop the isolated runner with its ordinary cycle limit, restart the same root,
   and ask `What is the cedar lantern code?` again. Compare accepted intake,
   cursor, reply intents, send receipts, and the actual reply with step 1.
3. On separate fresh isolated roots, repeat the remembered-code setup and send
   SIGINT, SIGTERM, and SIGHUP to **only that trial PID** during polling. Restart
   each root and ask the recall question. The run log should name the signal;
   the journal should retain the accepted turn and send state without a second
   physical send for an old update.
4. For call and send interruption, the desk uses disposable trials with its
   controlled provider and Telegram endpoint and the append-boundary harness.
   Kill only the disposable process after a durable call reservation and after
   a durable send intent, respectively. Restart each root. An uncertain call
   stays UNKNOWN and is never invoked again; an uncertain send stays UNKNOWN
   and is never dispatched again. A new question can still be answered, and
   prior recall still yields 731. Compare endpoint logs with journal IDs.
5. Arrange a held answer by making the supervised reply check unavailable on
   a disposable root. After ten minutes, confirm one fixed held notice reaches
   the private chat. Restart and wait past the due time again; no second held
   notice may appear. Repeat with an interrupted notice send: its intent remains
   UNKNOWN and must not be retried. The original held answer remains separately
   pending. Do not simulate a successful delivery by editing the journal.
6. Renew an isolated still-live activation using the reviewed renewal record and
   `renew-expiry`, then restart. The old activation must be refused; the renewed
   activation must admit the same root. Compare recall, cursor, caps, UNKNOWN
   states and sent message IDs before and after renewal.
7. Stop the isolated runner and switch that root to the newer reviewed build
   without changing the activation, profile, model, provider policy or caps.
   Restart, ask the recall question and compare the same fields. If the newer
   reader refuses the journal, keep the trial stopped and preserve the root for
   diagnosis. The permanent `stop` command is a separate case: after latching
   it on a disposable root, a later launch must refuse while status still shows
   the remembered intake.

Pass requires each accepted update once, one or zero physical dispatches per
exact send intent, UNKNOWN never retried, one held notice per held turn, and
the same remembered fact in the reply after each allowed restart. Preserve the
status, inspect output, endpoint logs, run log and actual private-chat message
IDs as gate evidence. API acceptance is not proof Justin read the message.
