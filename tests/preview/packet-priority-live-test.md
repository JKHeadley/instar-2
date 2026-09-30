# Packet priority — live test as Justin

Run this only after the desk lands the preview build and resumes the **one** approved
runner on its existing root. The builder does not run or alter the live runner.
Use Justin's bound Telegram account in the existing private preview chat. Check
`journal-agent.mjs status --root ROOT` first for at least 14 turns, 18 model calls,
14 replies and enough time before expiry; the desk can use the existing recorded
`raise-caps` authority if needed. Keep the current context byte cap. Record the
starting `status` output and the actual replies.

1. Send `Please remember this open commitment: I will review the studio permit with you.`
2. Send `The studio permit review is due on 2026-09-29. Keep that date in mind.`
   If testing after that date, use an ISO date three days ahead instead and record it.
3. Send `Sam Patel said the permit needs a second signature. This is my report of
   what Sam said, not a message from Sam.`
4. Send `I thought the permit was for the east studio.` Wait for its reply.
5. Send `Actually, the permit is for the west studio, not the east studio.` Wait
   for the correction decision to settle. Check `status.withheld` and preserve
   the returned source and operator update IDs.
6. Send filler turns until `status.summaryThrough` covers steps 1–5 and
   `status.packet.dropped` becomes nonempty on a later answer. Each filler may
   say `Filler for packet priority; reply ok.` followed by a 2–3 KB paragraph
   of ordinary studio planning. Check status after each turn and stop before
   exhausting the caps. Do not send another filler once omissions appear.
7. Send `What should I remember about Sam and the permit review?` Record its
   reply and `status.packet`. The reply should retain the open commitment, the
   near-term date, the corrected west-studio fact and Justin's attribution of
   Sam's statement as space permits. It must not restore the east-studio fact or
   claim Sam spoke directly to the agent. `status.packet.bytes` must be at or
   below `status.packet.limit`; every omitted optional item must have a kind,
   source ID and byte-envelope reason. An omission of a higher-priority item
   while a lower-priority item remains is a failure. Inspect the persisted
   prepared prompt for this answer to check the exact retained items; the
   reply alone does not prove packet selection.
8. Pause and resume the same runner under the desk's normal procedure. Run
   `status` again. The last packet's byte count and omissions must match before
   and after replay. Ask one unrelated follow-up; it must get one answer, with
   no replay of a prior Telegram send.

Pass requires the recorded status and prompt evidence, the expected reply and
the unchanged safety counters. If the trial never reaches an omission within
the remaining finite caps, record that as **incomplete**, with the measured
packet bytes and cap; do not infer priority from a packet that never had to trim.
