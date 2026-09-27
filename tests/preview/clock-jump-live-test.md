# Clock-jump resilience: supervised live test for Justin

Use a disposable isolated host or VM, a private preview bot and a separately reviewed trial.
Keep the production host, live runner and its journal untouched. Use the reviewed
`journal-agent.mjs run` invocation from this README, unchanged activation, model and policy,
with enough remaining time and call/reply allowance for the sequence. Record the host wall time,
monotonic uptime, `status`, `inspect --text` and the preview chat after each step. Make the
clock changes while the runner remains active so the trial exercises a mid-conversation fault.

1. With the clock correct, send: “My appointment is tomorrow at 3 pm. When is it?” Confirm the
   reply gives the absolute local day and the correct hour. Record the journal's date item and
   current expiry in `status`. Send a second ordinary question and note its update order.
2. Move the VM wall clock backward by five minutes while the same runner is active. Send:
   “How long ago did I mention the appointment?” Confirm the packet and reply retain the
   original dated fact, no negative or earlier journal time is reported, and the prior reply
   is not sent again. Read `status` and `inspect --text`; compare the retained update order and
   the trial expiry. Repeat after a runner restart, leaving the same journal in place.
3. Use ordinary filler turns until a rolling summary covers the appointment. Confirm the
   summary frontier advances, the dated item survives replay, and a later relative-time
   question cites the right local day. For a separate fault injection, interrupt one summary
   result after reservation. While the wall clock moves backward, confirm a later frontier
   cannot start before 60 seconds of monotonic elapsed time and can start after that bound
   only with a later accepted turn and a free call slot. The old UNKNOWN charge remains.
4. Move the VM clock forward within the reviewed expiry. Ask whether the appointment is due or
   overdue on both sides of its local deadline. Confirm the state changes at the right local
   boundary and the answer uses the dated source, without an unprompted reminder.
5. At the end of the trial, move the VM clock to the exact reviewed expiry. Confirm `run`
   stops before a new provider call or Telegram send and `status` retains the original expiry.
   Move the clock backward again. Confirm the active process stays expired and no held turn is
   sent. Restore the VM clock and stop the trial.

Keep the status snapshots, packet hashes, chat message IDs, call outcome rows and journal
replay result as the live evidence. A missing or ambiguous provider result remains UNKNOWN;
never resend its old operation to make the test green.
