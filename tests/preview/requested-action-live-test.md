# Requested action — Justin's supervised private-chat check

The base platform does one general thing at a later time: what the verified operator explicitly
asked for, answered then as an ordinary turn. This procedure proves that on the approved journal
runner, its private operator chat, existing root, activation and credentials. It makes no new
grant. The desk keeps the sole writer; the builder does not run it. Never reset a root and never
resend an UNKNOWN effect. Before starting, run `status` and confirm room for five turns, five
replies and five model calls (plus reply reviews).

1. **Ask for something later.** Send “Remind me today at HH:MM am/pm to stretch” about 15 minutes
   ahead. Expect one reply that states the due time. The reply must not deny the capability: no “I have
   no scheduler or background process”, no “I only reply when you message me”, and no handing the job
   to a phone or calendar alarm. `status.requestedActions.open` lists the request with its due time;
   `status.requestedActions.dueTurns` is empty.
2. **Promise with no time.** Send “Please promise to remind me about watering the tomato plants — say
   you will.” Expect an honest answer: asking for a day and time is the right one. It must not claim
   there is no scheduler, and must not hand the job to an alarm. Nothing is recorded without a settled
   time, so `status.requestedActions.open` is unchanged.
3. **Ask for a different kind of thing later.** Send “Tell me today at HH:MM am/pm what I asked you
   to remember” for the same minute. Expect the same kind of reply; both requests are open. The reply
   must not say the second request replaced, cancelled or took the slot of the first.
4. **Cancel one in plain words.** Send “Actually, cancel the stretch one.” Expect a reply naming the
   cancelled request; `status.requestedActions.cancelled` is 1 and only the second request is open.
   The operator's own words are what withdraw a request — a later request for the same minute never does.
5. **Due time.** Wait for the due minute. Exactly one message arrives. Its first line is
   `PREVIEW — You asked on <time>: "Tell me today at … what I asked you to remember" (due …)` and
   the rest answers that request from the journal. Nothing about the cancelled request arrives.
   `status.requestedActions` shows `accepted: 1`, no open request, and one due turn `accepted`.
6. **No repeat.** Pause and resume the same runner and root. Wait one poll cycle. Nothing is resent;
   `status` is unchanged apart from the launch record.

Record the `status` excerpts after steps 1, 4, 5 and 6, the intent/result IDs, and whether the
answer in step 5 matched what was asked. An UNKNOWN send is recorded as UNKNOWN, never resent.

Steps 1, 2 and 3 carry reply-text expectations because the words, not the machinery, failed on
2026-10-02 in proof room two (build cint-L23 e26a8c1b, fresh root): a reminder was recorded and did
fire at its due minute, but the reply denied having a scheduler and pointed at a phone alarm, the
undated promise was refused the same way, and a second request for the same minute was answered as a
replacement and cancelled the first. The state expectations above already covered the cancellation
(step 3 has always said both requests are open); what was missing was checking what the reply said.
The repair is w3-reminderwords (`tests/preview/reminder-words.test.ts`,
`tests/preview/fixtures/reminderwords-live-2026-10-02.json`), which proves both sides offline; these
steps are how the live run confirms it.
