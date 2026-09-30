# Edited Telegram message: live test as Justin

Use only the existing approved, bound private preview runner and its root. Check `status`
first for at least four admitted updates, two replies and three model attempts remaining.
Keep the bot, grant, expiry, limits and root unchanged. The builder has not run this against
the live runner or its journal. Record the Telegram message IDs and update/cursor values;
capture `status` and `inspect` outputs with sensitive text redacted.

1. As Justin, send one short fact: `The test launch is on Tuesday.` Wait for its one PREVIEW
   reply. Note that message's Telegram ID and the runner's reply count.
2. Edit that same Telegram message in place to `The test launch is on Thursday.` Do not send
   a second message. Wait for the next poll and run `status`. The cursor and admitted-update
   count should advance, a summary judgment should be recorded, and the reply count should
   stay unchanged. No new Telegram reply should appear.
3. Run read-only `inspect --root ROOT --text "When is the test launch?" --model DESK_EXACT_MODEL`.
   Its packet should carry Thursday and no active Tuesday claim. If the edit judgment is
   held, record the hold as a failed case; do not count it as a successful memory correction.
4. Send `When is the test launch?` as Justin. Check that the reply uses Thursday and that
   exactly one new reply intent and at most one Telegram acceptance belong to this new
   message. `status.withheld` should identify the original update and the edit update.
5. Edit the original message again to `The test launch is Thursday.` Check that the new edit
   advances intake without another reply and that a later `inspect` packet uses the latest
   wording. A wording-only edit need not add another withheld fact.

**Pass:** both edits are linked to the one original Telegram message, the first fact change
reaches the next answer, neither edit receives a reply, and a repeat poll or runner restart
does not create another reply. If the operator edits before the first answer instead, the
original should show `superseded by edit` and should send no stale answer. No step authorizes
an unprompted message, cap raise, deployment or live journal modification by the builder.
