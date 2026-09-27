# Cross-topic digest live test — Justin

Run only after the desk lands this build and resumes the approved private-chat
preview runner on its existing root. Use Justin's bound account and two existing
private-chat topics, A and B. Do not create a group or change the runner's bot,
grant, root, expiry, or journal. Save the actual replies and redacted `inspect`
output as the live trace.

1. In the main chat, ask `What is open across my topics?` Run read-only
   `inspect --root ROOT --text "What is open across my topics?" --model MODEL`.
   If the journal has only one conversation, `next.crossTopicDigest` is `null`.
2. In topic A, send `Please remember to ask me about the blue notebook.` Wait
   for its PREVIEW reply and for `status.summaryPending` to return to zero. If
   the summary has not covered that update, send ordinary short turns until it
   does; check `status` for remaining call, turn, reply and expiry room before
   each turn. A cap hold is an incomplete live test, not a reason to bypass it.
3. In topic B, send `The garden meeting is on Thursday.` Wait for its PREVIEW
   reply. From the main chat, ask `What is open across my topics?` Immediately
   before sending, inspect that exact text. `next.crossTopicDigest` must show
   topic A, topic B and the main chat with dates. Topic A's open commitments
   must quote the blue notebook request. The other two conversations must not
   acquire that commitment. The reply should identify where the open request
   came from and must not claim it was completed.
4. In topic A, send `I asked about the blue notebook; that is done.` Wait for
   the reply and a covering summary. Inspect the same main-chat question again.
   Topic A's blue notebook item must have left `openCommitments`; the original
   turn remains in the journal. Ask the question again and record the reply.
5. Compare the two inspect digests with their replies, the per-conversation
   dates, `omittedConversations`, call and reply counters, and any hold/UNKNOWN
   outcome. The digest itself must have caused no separate model reservation.
   The only new calls are the ordinary answers and existing summary attempts.

Offline tests cover held questions, UNKNOWN outcomes, replay, closure, and the
4096-byte bound. This live script does not deliberately create a failed send.
