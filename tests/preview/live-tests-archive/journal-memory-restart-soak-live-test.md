# Supervised memory continuity exercise for Justin

This is a live-test script, not a record that it has run. Use a fresh private
preview trial approved by the desk, with its reviewed activation and normal
finite caps. Do not point the runner at the live preview root or its journal.
The offline 2,000-turn test is `journal-memory-restart-soak.test.ts`; this
shorter exercise checks the real private-chat surface without spending 2,000
subscription calls or filling the live runner's caps.

1. Start `journal-agent.mjs run` on the isolated root using the reviewed
   invocation in `README.md`. Send: "Sam's atlas is blue." Record the Telegram
   update ID, API reply ID, `status`, and `audit` output.
2. Stop the isolated runner normally. Restart it on the same root. Send:
   "Correction: Sam's atlas is green." Record the new update and reply IDs,
   `status`, and `audit` output. Confirm the old fact is marked corrected in
   `inspect --text` and that the reply does not use blue as the current fact.
3. Stop and restart again. Send: "What color is Sam's atlas now?" Record the
   exact reply, `inspect --text`, `status`, and `audit`. Confirm the answer is
   green with a source citation or an honest uncertainty if the model cannot
   establish it. Confirm the audit has no findings.
4. Send a harmless fact to forget, then a separate authenticated request to
   forget it without repeating its content. Stop and restart. Ask what is
   remembered about that fact. Confirm the forgotten content is absent from
   the recalled packet and answer, while `status` still accounts for the
   memory change. Record the exact packet and audit output.
5. Compare the recorded update IDs with the journal intake cursor and send
   receipts. Each accepted update must occur once, and no reply may be sent
   twice. Record the trial root, branch commit, activation reference, caps,
   restart times, outputs, and any divergence with its first update/frame.

End the isolated trial using the normal stop command. Treat an UNKNOWN call or
send as UNKNOWN; do not retry its update. Any finding or factual divergence
goes to the desk with the captured frame and output before a live claim is made.
