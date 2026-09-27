# Memory inventory live test for Justin

Use the existing approved private Telegram preview runner, its existing root and
operator identity. Do not start a second runner or change its grant, bot, expiry,
audience or limits. This script is a supervised test, not a production claim.

1. As Justin, check `status --root ROOT` for at least eight turns, eight replies
   and ten model calls remaining. If the approved trial needs more room, use its
   recorded `raise-caps` authority while paused. Send: `Sam is my colleague. Sam
   has a blue bicycle.` Wait for one reply.
2. Send: `Please remember to ask Sam about the project.` Wait for one reply and
   for any rolling summary to finish. Ask: `What do you remember about Sam?`
   Confirm the reply attributes the claims and commitment to Justin, cites their
   dates, and does not claim Sam told the agent directly. Run `inspect --root ROOT
   --text "What do you remember about Sam?" --model MODEL` and record the
   `inventory` source, date, shown and truncated fields. If compaction has not
   occurred, continue with ordinary non-sensitive turns until it does, then ask
   again. Do not infer absence from a partial inventory.
3. Send: `Actually Sam has a green bicycle, not a blue bicycle.` Wait for the
   correction decision and check `status.withheld`. Ask the same memory question.
   The answer should give green only. In `inspect`, the inventory correction must
   name its operator source and date; no inventory entry may show the old claim.
4. Send: `Forget what I said about Sam's bicycle.` Wait for the forgetting decision
   and check `status.withheld` again. Ask the memory question. The answer should
   state that a bicycle detail was forgotten on Justin's request without giving
   either color. In `inspect`, a `forgotten` inventory item must have a source and
   date but no forgotten content. Record `total`, `shown` and `truncated`.
5. Ask: `What do you know about me?` Confirm the answer uses only the available
   journal evidence, distinguishes open commitments from completed acts, and says
   when the inventory is partial. If an agent-owned channel fixture was already
   imported under the approved trial, confirm its item is labelled as an export
   with source and date. Do not import a new file for this test.
6. Restart the same runner under the existing procedure, then repeat the two
   questions. Confirm the inventory and forgotten marker survive replay, and each
   operator question has at most one Telegram reply. Preserve the replies,
   `status` and redacted `inspect` output as the live trace.

If the call cap, prompt bound, correction decision or trial expiry holds a turn,
record that hold as the result. Do not claim a complete answer from a truncated
inventory or a held turn.
