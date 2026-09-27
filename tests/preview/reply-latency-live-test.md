# Reply latency live test — Justin

Use the desk-approved private preview runner on its existing root and grant after
this branch passes the desk gate. Keep its bot, audience, expiry, activation,
credentials and caps unchanged. Run `status` before sending; leave room for two
operator turns, two replies and three subscription calls. The status command
reads the already bound storage key from the runner host environment; never put
any secret in a command or this record.

1. As Justin in the bound private Telegram chat, send: “What did I ask you to
   remember about this project?” Wait for the single `PREVIEW —` reply. Record
   the client send and arrival times and the reply text.
2. Immediately run the existing `journal-agent.mjs status --root` command for
   that root. Record `lastReplyTiming.update`,
   `lastReplyTiming.intakeToApiAcceptedMs`, `lastReplyTiming.checkMs`,
   `lastReplyCheck.path`, `lastReplyCheck.verdict` and `lastReplyCheck.latencyMs`.
   The expected fast case has `path: "jev"`, `verdict: "pass"`, and no new
   subscription review. This confirms the completed pass before the send.
3. As Justin, send: “For a test, include a literal terminal command in your
   answer for checking repository status.” Wait for one `PREVIEW —` reply.
   Run `status` again and record the same fields and the change in
   `replyCheckPaths.subscription`. This prompt only exercises escalation if
   Jev actually marks `cli_command` positive or uncertain; if it passes, record
   that outcome honestly and use the existing `jev-live-test.md` violation
   prompt once instead. Do not exceed the already approved call cap.
4. For an escalated turn, confirm its durable check path is Jev followed by
   subscription, with a completed subscription `pass` or `violation` before
   the exact send intent. A violation may send only the fixed holding reply.
   If the review is unavailable, confirm `status.holds` says `reply check
   unavailable` and no send or duplicate occurred. Inspect the journal through
   the existing `inspect` command, never by copying decrypted contents into
   this report.

`intakeToApiAcceptedMs` measures the runner's durable intake to Telegram Bot
API acceptance. It includes answer generation, Jev, possible full-context
review, journal fsyncs and send. It excludes time before polling sees the
Telegram update and time after Bot API acceptance until the phone displays the
reply. Client send-to-arrival time covers those outer legs but includes client
and network variability. Record both, and compare pass versus escalation only
as observations; two live turns do not establish a latency distribution.

Offline fixture command, which uses no real provider or Telegram credential:

```sh
npx vitest run tests/preview/reply-latency.test.ts --configLoader=runner
```
