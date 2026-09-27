# Review-layer canary: Justin's supervised live test

Run this only after the desk has landed the offline canary, its targeted test is green,
and the existing preview-deploy procedure has separately authorized an isolated private
chat. Do not use this script on the current live runner or journal while reviewing the
branch. The offline canary is the pre-deploy gate; this script records channel evidence
after the live switch.

1. Justin opens the isolated private chat and notes the runner's current `status`:
   calls, replies, `summaryThrough`, `summaryChecks`, `replyCheckPaths`, held turns and
   unknown outcomes. Keep the status output in the deployment record.
2. Justin sends one ordinary preference in his own words, such as “Please always
   answer briefly.” Wait for the reply or a held-answer notice. Record the exact
   message, time and Telegram message id. Do not resend the same turn to force a result.
3. The desk reads `status` again from that same isolated runner. Confirm the turn is
   durably admitted; compare answer, reply-review, summary and summary-review call
   outcomes and the summary frontier with the pre-test status. Record whether the
   full-context reply review and summary review actually ran. A Jev pass can skip a
   subscription review, so absence of that review is an observed branch, not proof
   of its live behavior.
4. If a reply is held, Justin does not prompt around it. The desk records the hold,
   review verdict or unavailable outcome, and checks that no original reply was sent.
   If a summary is rejected, confirm its frontier did not advance. Escalate through
   the existing preview recovery procedure; do not reset the journal or replay a send.

Pass evidence is the received reply with its admitted turn and matching durable status,
or an accurately held turn with no duplicate send. Record any review layer that did
not run as unobserved. Never inject contradictory provider prose into a live call;
that negative case is covered by the offline canary.
