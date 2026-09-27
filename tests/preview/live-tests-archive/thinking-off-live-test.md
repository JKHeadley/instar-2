# Justin's private preview check: replies no longer held by thinking tokens

Run only after the desk lands this commit and resumes the reviewed journal runner.
Use the existing private operator chat, root, activation record and profile. This
change adds `MAX_THINKING_TOKENS=0` to the subscription CLI's environment. It does
not change the recorded invocation policy, so the existing activation stays valid
and no re-record is needed. This procedure does not start a second runner or repeat
an UNKNOWN call.

1. Before sending, have the desk run `journal-agent.mjs status --root ROOT` and
   save the output. Confirm the trial still has room under its call, reply and turn
   caps. Note `callOutcomeCounts` and the latest `role:model` rows in
   `lastCallOutcomes`, including the earlier held calls where a named local output
   cap showed about 8192 output tokens.
2. Justin sends a question that previously triggered a long think, for example:
   `Three friends split $97: Ana pays $13 more than Ben, and Ben pays twice what Cy
   pays. Who pays what? One sentence.` Wait for the reply.
3. Pass: a reply arrives with no hold or loss notice. After `status`, the new
   `role:model` row shows `subtype: success`, `isError: false`, no local limit, and
   output tokens well under 2048. A short answer is expected to use tens to low
   hundreds of tokens, not thousands. If Jev escalated the reply, the
   `role:reply-review` row should also be under 2048 with no local limit.
4. Justin then sends two ordinary conversational messages, such as
   `What did I just ask you?` and `Summarise our chat in one line.` Each should get
   a reply without a hold, and each model row should stay under the cap.
5. Check answer quality. Thinking is now off, so read the arithmetic in step 2. The
   correct split is Cy $16.80, Ben $33.60, Ana $46.60. In the builder's offline
   probe, a harder two-part arithmetic question came back wrong with thinking off
   and right with thinking on. Record any wrong factual answer. That is the known
   trade-off of this fix, not a delivery failure.
6. Record the before/after status outputs, reply receipts, output tokens for each
   new row, and any hold, loss notice or wrong answer. Never resend a held or
   UNKNOWN message to get a row filled.
