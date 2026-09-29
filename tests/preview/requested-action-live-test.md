# Requested action — Justin's supervised private-chat check

The base platform does one general thing at a later time: what the verified operator explicitly
asked for, answered then as an ordinary turn. This procedure proves that on the approved journal
runner, its private operator chat, existing root, activation and credentials. It makes no new
grant. The desk keeps the sole writer; the builder does not run it. Never reset a root and never
resend an UNKNOWN effect. Before starting, run `status` and confirm room for four turns, four
replies and four model calls (plus reply reviews).

1. **Ask for something later.** Send “Remind me today at HH:MM am/pm to stretch” about 15 minutes
   ahead. Expect one reply that states the due time. `status.requestedActions.open` lists the request
   with its due time; `status.requestedActions.dueTurns` is empty.
2. **Ask for a different kind of thing later.** Send “Tell me today at HH:MM am/pm what I asked you
   to remember” for the same minute. Expect the same kind of reply; both requests are open.
3. **Cancel one in plain words.** Send “Actually, cancel the stretch one.” Expect a reply naming the
   cancelled request; `status.requestedActions.cancelled` is 1 and only the second request is open.
4. **Due time.** Wait for the due minute. Exactly one message arrives. Its first line is
   `PREVIEW — You asked on <time>: "Tell me today at … what I asked you to remember" (due …)` and
   the rest answers that request from the journal. Nothing about the cancelled request arrives.
   `status.requestedActions` shows `accepted: 1`, no open request, and one due turn `accepted`.
5. **No repeat.** Pause and resume the same runner and root. Wait one poll cycle. Nothing is resent;
   `status` is unchanged apart from the launch record.

Record the `status` excerpts after steps 1, 3, 4 and 5, the intent/result IDs, and whether the
answer in step 4 matched what was asked. An UNKNOWN send is recorded as UNKNOWN, never resent.
