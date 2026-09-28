# Justin's private-chat requested-reminder test

Use only a separately authorized, isolated **journal runner** trial described in the
[Structural journal runner](README.md#structural-journal-runner-rounds-1013) section, with
Justin's verified private chat. Keep the approved bot, root, activation, model, expiry, limits
and secret bindings. This script does not authorize a new trial. Do not use a production root,
the live runner or its journal. Do not pass `--reminder-grant-reference`; it is retired and the
runner refuses it.

Pick due times at least ten minutes ahead and inside the trial's expiry. Keep the runner active
through every due time. Record `status` before and after each step, Telegram message IDs and the
actual operator-local time, without recording secrets or journal bytes.

1. **Requested reminder, sent once with its reason.** Start the runner with
   `--time-zone America/Los_Angeles`. Justin sends, in the main chat:
   “remind me today at HH:MM am/pm to call Priya” (a real time about 15 minutes ahead, with
   am or pm). The reply must say `I will send you one reminder at <day> <HH:MM> (America/Los_Angeles).`
   Check `status.reminders.pending` lists the request with that due time. Before the due time,
   no reminder arrives. At or shortly after it, exactly one message arrives in the same chat:
   `PREVIEW reminder you asked for on <asked day time>: "remind me … to call Priya" (due <day time zone>)`.
   `replies`, `reminders.intents` and `reminders.accepted` each rose by one; `pending` is empty.
   Bot API acceptance does not prove Justin read it.
2. **Unrequested date, never pushed.** Justin sends “My dentist is today at HH:MM am/pm.”
   (no request to be reminded). The reply says the date was recorded and that a reminder is sent
   only when asked. Past that time, confirm no message arrives and `reminders.intents` is unchanged.
3. **Grouped.** In one topic, Justin asks for two reminders due at the same minute
   (“remind me today at T to stretch” and “remind me today at T to drink water”). At T, confirm
   one message with two `PREVIEW reminder you asked for` lines and one reply slot consumed.
4. **Cancel and change.** Justin asks “remind me today at T1 to buy milk”, then “cancel the milk
   reminder”. The reply says `Cancelled reminder: "…"`; `reminders.cancelled` rose by one. Then
   “remind me today at T2 to buy milk”. Confirm nothing at T1 and exactly one reminder at T2.
5. **Restart.** Ask for a reminder due in 15 minutes. Pause the runner with SIGTERM and resume it
   with the same root and configuration before the due time; confirm one send at the due time.
   After it is accepted, SIGTERM and resume again; wait for two polls and confirm no second send
   and unchanged counters.
6. **Stop before due.** Ask for a reminder due in 15 minutes, then latch `stop` before it is due.
   Confirm no reminder is sent.
7. **Not granted.** Ask “remind me today at 9 to …” (no am/pm) and a time already past. Each reply
   must say the reminder was not set and why; no reminder is sent.

The offline preview tests exercise an UNKNOWN transport result. Do not induce an uncertain live
send: its intent is permanently counted and must never be replayed. A live result here is evidence
only for this supervised preview, not a production deployment.
