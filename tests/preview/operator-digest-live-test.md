# Operator status digest: live test for Justin

Use the already approved private preview chat and its current runner after the desk
lands this commit. Keep its existing grant, root, bot, expiry and limits. The desk
records the exact `status` command for that root and supplies its current report;
this script does not authorize a new run or a cap increase.

1. As Justin, ask **“What have you been doing?”** in the bound private chat. Save
   the PREVIEW reply. Run the read-only journal `status --root ROOT` command with
   the existing storage key binding and save `digest`, `self`, `launches` and `holds`.
   Check the reply distinguishes desk-reported work from this preview's own run
   history and makes no deploy claim absent from the desk report.
2. As Justin, send **“status”**. Save the PREVIEW reply and a fresh `status` output.
   Check that any desk freshness warning, launch without a recorded end, active
   hold, lost-answer notice or memory correction/forgetting in `digest` is described
   accurately. A category with no event must be reported as absent or unknown,
   never invented. The current message is in the packet before its reply is sent,
   so the subsequent status counters may be one reply ahead.
3. If the existing root already has a resolved hold, lost-answer notice or memory
   change, check that its update ID and event kind appear among the latest eight
   recorded events. If none exists, record that this live run did not exercise
   that category; do not induce a spend or send failure just for this test.
4. Record both actual replies, both `status` outputs and the desk report version as
   the live trace. Confirm one Telegram send intent and at most one accepted send
   for each of Justin's two messages. A model answer that invents work or deploys
   is a failed live result even when packet assembly is correct.
