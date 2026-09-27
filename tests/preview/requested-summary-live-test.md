# Justin's private-chat requested-summary test

Use only a separately authorized, isolated **journal runner** trial described in the
[Structural journal runner](README.md#structural-journal-runner-rounds-1013) section, with
Justin's verified private chat. Keep the approved bot, root, activation, model, expiry, limits
and secret bindings. This script does not authorize a new trial. Do not use a production root,
the live runner or its journal.

Pick due times at least ten minutes ahead and inside the trial's expiry, and keep the runner
active through every due time unless a step says otherwise. Before and after each step, record
`status` (`requestedSummaries`, `replies`, `calls`), the Telegram message IDs and the actual
operator-local time. Do not record secrets or journal bytes. Each due summary uses one model
attempt and one reply slot, so check that the limits leave room.

1. **Requested daily summary, sent once with its reason.** Start the runner with
   `--time-zone America/Los_Angeles`. Justin sends, in the main chat, a couple of ordinary
   messages, then “send me a summary of today every day at HH:MM am/pm” (about 15 minutes ahead,
   with am or pm). The reply must say `I will send you a summary of today every day at <HH:MM>
   (America/Los_Angeles), first on <day>`. `status.requestedSummaries.active` lists it. Before
   the due time, nothing arrives. At or shortly after it, exactly one message arrives in the same
   chat. Its first line is `PREVIEW summary you asked for on <asked day time>: "send me a summary …"
   (due <day HH:MM> America/Los_Angeles)`, and a summary of today's conversation follows.
   `status.requestedSummaries.slots` shows that day `accepted`. Bot API acceptance does not prove
   Justin read it.
2. **Unrequested: never pushed.** Justin sends “summarize today” (a request for *now*). It is
   answered once, immediately, and `requestedSummaries.requested` is unchanged. Through the next
   due times, no summary arrives except the one Justin scheduled.
3. **Change, then cancel.** Justin sends “make that summary HH2:MM2 pm instead” (a new time ahead).
   The reply names the cancelled request and the new schedule. Confirm nothing at the old time and
   exactly one summary at the new time. Then “stop the daily summary”: the reply says `Cancelled
   summary: "…"`, `cancelled` rose by one, and nothing arrives at the next due time.
4. **Grouped with a reminder.** Justin asks for a one-off summary (“send me a summary of today
   today at T”) and a reminder (“remind me today at T to stretch”) in the same chat, for the same
   minute T. At T, confirm one message: the summary header and summary, then the
   `PREVIEW reminder you asked for …` line. Only one reply slot is consumed.
5. **Restart.** Ask for a one-off summary due in 15 minutes. SIGTERM the runner and resume it with
   the same root and configuration before the due time; confirm exactly one summary at the due time.
   After it is accepted, SIGTERM and resume again. Wait for two polls and confirm no second send.
6. **Downtime catch-up bounded to one.** With a daily request whose time has come at least twice
   while the runner is paused (stop it before the first due time; resume after the second), confirm
   exactly one summary arrives on resume. Its first line must say `sent late at …` and `1 earlier due
   summary was skipped, not sent`. Confirm nothing further until the next due time.
7. **Stop before due.** Ask for a summary due in 15 minutes, then latch `stop` before it is due.
   Confirm no summary is sent.
8. **Not granted.** Ask “send me a summary every day at 8” (no am/pm) and “summarize today today
   at <a past time>”. Each reply must say the summary was not set up and why; nothing is sent later.

The offline preview tests cover the call-cap held notice, an UNKNOWN model result and an UNKNOWN
transport result. Do not induce them live: an uncertain call or send is permanently counted and
must never be replayed. A live result here is evidence only for this supervised preview, not a
production deployment.
