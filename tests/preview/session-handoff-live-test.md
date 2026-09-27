# Restart handoff live test for Justin

Use the existing private preview chat and root after the desk lands this build.
Keep the current activation, root, bot binding and finite caps. Record the root
path and exact launcher arguments from the desk's approved run command; do not
start a second runner against the same root.

1. Run `status --root ROOT` with `journal-agent.mjs` and save the JSON. Check
   that `stop` is not latched, the trial has time left, and there is room for at
   least two turns, replies and model attempts (including any reply reviews).
   If a cap needs raising, use the existing `raise-caps` command with Justin's
   recorded authority before this test.
2. Pause the one runner with SIGTERM and wait for it to exit and release its
   writer lease. Check `status` shows the latest launch ended `paused by signal
   SIGTERM`. Restart that same runner on the same root with its approved run
   command. Do not send a chat message until it is polling.
3. Send `What happened across your last restart, and was anything left in
   flight?` in the bound private chat. Wait for its reply. The reply should
   acknowledge the restart and describe any gap only when the recorded state
   warrants it. Immediately run `inspect --root ROOT` and save `last`:
   `restartHandoff` must be present, name the prior end, and match the pending,
   held, UNKNOWN and notice-due state in the status saved before restart. The
   note must contain counts and update IDs, never message bodies or secrets.
4. Send `Thanks. What can you tell me now?` and wait for the second reply. Run
   `inspect --root ROOT` again. Its persisted `last.restartHandoff` must be
   `null`. `status` must show two accepted replies and no reset of counters.
5. For a gap case already present in this trial, repeat steps 2–4 while status
   has a held turn or UNKNOWN outcome. Compare the first persisted handoff to
   the saved status. An UNKNOWN send must remain unsent; a due lost-answer
   notice follows the existing notice path. Do not create an uncertain send
   just for this test. Save the two actual replies and the before/after status
   and inspect outputs as the live trace.

The offline launcher and journal tests cover a first launch with no note,
an idle restart, a restart with all five work categories, bounded IDs, and
the second reply omitting the note. This live test checks the real private
surface; it is not evidence of receipt beyond Telegram API acceptance.
