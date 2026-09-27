# Correction acknowledgement: Justin's supervised private-chat test

Use the existing reply-only journal preview after the desk integrates this
branch and resumes its single runner on the approved root. This script does
not start another runner or touch the live journal. Keep the chat private and
send each message as Justin; wait for each reply before the next step.

1. Have the desk check `status` for at least six turns, six replies, and enough
   shared model-call room for replies, summaries, and reply checks. If a cap is
   low, use the existing recorded cap-raise authority before the test.
2. Send `The cedar trail starts at East Pier.` Then send
   `Actually, the cedar trail starts at West Pier.` The second reply should
   contain one line naming `East Pier` → `West Pier`. Check `status.withheld`
   reports a verified operator correction. Ask `Where does the cedar trail
   start?` The answer should use West Pier only; the persisted `inspect` packet
   for that question should not contain the old clause.
3. Send `My gym locker code is 3310.` Then send `Forget my gym locker code.`
   The forget reply should name the gym locker code and must not repeat `3310`.
   Check `status.withheld` reports verified operator forgetting. Ask
   `What is my gym locker code?` The answer should not supply the value; its
   persisted `inspect` packet should carry the forgotten marker without the
   old code.
4. Record the actual reply texts, `status` output, and persisted `inspect`
   views. A pending memory decision, exhausted cap, or missing reply is an
   incomplete result, not a pass. The runner must send only in response to
   these operator messages, with no extra notification.
