# Justin's live check: recall latency change

Use the existing approved private preview chat and its current journal runner. Do not create a
new trial or change its bot, audience, grant, expiry or caps for this check. The 2,000-turn
latency measurement is the offline test in `recall-latency.test.ts`; this live check verifies
that the summary path still gives the same kind of answer through the real reply doorway.

1. As Justin, ask one question about a fact already in the chat's compacted history, such as
   "What did I ask you to remember about Sam?" Wait for its single PREVIEW reply.
2. Run `status --root ROOT` and `inspect --root ROOT` using the existing reviewed launcher
   command. Confirm the persisted answer packet has `historyMode: summary-plus-recent`, the
   reply check passed, and one send receipt exists for that update. If the topic has not yet
   compacted, this does not exercise the optimized branch; use an existing compacted fact.
3. As Justin, ask a recent-history question in the same private chat. Confirm one reply and
   one receipt. Check its persisted packet and record whether it used `complete` or
   `summary-plus-recent`.
4. Record the two exact questions and replies, packet modes, reply-check paths, send receipts,
   and any holds. Do not infer human delivery from Telegram API acceptance.

The offline test separately reports p95 for a model-free 2,000-turn fixture containing people,
commitments, recall, memory corrections, channel items and Jev. It does not measure network,
real model or live Telegram latency.
