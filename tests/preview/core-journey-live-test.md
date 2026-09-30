# Core operator journey — Justin's supervised private-chat check

This is the one live procedure for the journal runner. It drives the talkable path end to end
in the existing private preview chat: talk, recall, correct and forget, restart, a held answer,
and a request for something at a later time. The per-feature procedures in
[live-tests-archive/](live-tests-archive/) keep their scenario detail and recorded results as
evidence; use one only when a change touches that scenario and this journey does not cover it.

Use only the already approved journal runner, its private operator chat, existing root,
activation and credentials. This script makes no new grant. The desk keeps the sole writer
and the live journal; the builder does not run it. Before starting, run `status` and confirm
room for about twelve turns, twelve replies and the shared model calls for answers, reply
reviews and one summary; use the recorded `raise-caps` authority if the trial needs more.
Never reset a root and never resend an UNKNOWN effect.

1. **Talk.** Send “Hello, this is the core journey check.” Expect one ordinary reply.
   `status` shows the turn, one exact send intent and one Telegram result (or an explicit
   UNKNOWN that is not retried).
2. **Recall.** Send “For this test, my locker code is 4127.” Then ask, in other words,
   “Which number opens my locker?” The answer should give 4127 and cite its source. Ask
   “What colour is my locker?” — never stated — and expect an honest “I don't know from
   this journal”, not a guess.
3. **Correct and forget.** Send “Correction: my locker code is 5390.” Ask the locker
   question again; expect 5390, not 4127. `status.withheld` lists the old claim. Then send
   “Forget my locker code.” Ask again; expect no code, and the next packet
   (`inspect --text "Which number opens my locker?" --model MODEL`) shows it withheld.
4. **Restart.** Pause and resume the same runner and root. Ask “What did we test so far?”
   The reply should reflect the journal across the restart, read the real clock, and not
   re-send anything already sent. `status.launches` records the pause and resume.
5. **Held answer.** Do not force a hold. If any reply in this journey was held, confirm
   its plain reason in `status.holds`, at most one held notice once one was due, and that
   the held answer later follows or is explained. Record “no hold occurred” otherwise.
6. **Requested action.** Ask “Remind me today at HH:MM am/pm to stretch” (about 15 minutes
   ahead); the reply states the due time and `status.requestedActions.open` lists it. At that time
   exactly one message arrives: its first line quotes the request and when it was asked, then the
   answer to it. Details: [requested-action-live-test.md](requested-action-live-test.md).

Record the `status` excerpts after steps 1, 3, 4 and 6, every intent/result ID, any UNKNOWN,
reply-check paths, and whether each answer matched the expected fact. A plain answer that
skips a step is a failed step, not a pass. This procedure does not replace offline tests;
it proves the shipped path with the real model and the real chat.
