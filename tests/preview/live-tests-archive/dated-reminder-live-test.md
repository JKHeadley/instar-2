# Justin's private-chat morning reminder test

Use only the separately authorized, isolated **journal runner** trial described in
the [Structural journal runner](../README.md#structural-journal-runner-rounds-1013)
section. The trial grant must name initiated reminders to Justin's verified
private chat and its topics. Keep the approved bot, root, activation, model,
expiry, limits and secret bindings. This script does not authorize a new trial.
Do not use a production root, the live runner or its journal.

1. Start or resume the journal runner with `--time-zone America/Los_Angeles`
   and `--reminder-grant-reference GRANT_REFERENCE` from the separately
   reviewed reminder grant. Check `status.reminders.grant` matches it.
   Keep it running through 08:00 on the test day. Before 08:00, Justin sends a
   new private-chat message with a settled date for **today**, such as
   “Dentist appointment today at 3 pm.” If it is already 08:00, use
   **tomorrow** instead and leave the runner active through that morning.
   Check `status.dated`: the item must have the intended local `day`, `15:00`
   time and no ambiguity. An unresolved item is not a reminder test.
2. Before 08:00, check that `status.reminders.intents` has not advanced for the
   item and that Justin has no reminder message. At or shortly after 08:00,
   confirm exactly one message in the same private chat or topic:
   `PREVIEW reminder: Dentist appointment today at 3 pm. today at 15:00`
   (use the exact clause Justin actually sent). Check that `replies` rose by
   one, `reminders.intents` rose by one, and `reminders.accepted` rose by one.
   Bot API acceptance does not prove Justin read it.
   For an aggregation check, save two different settled items for the same day
   and private-chat topic before 08:00. Confirm one message with two
   `PREVIEW reminder:` lines and one reply slot consumed.
3. Pause the runner with SIGTERM and resume it with the same root and
   configuration while still in the morning window. Wait for two polls. Check
   that no second reminder appeared and that all three counters are unchanged.
4. On another test morning, have Justin save a dated item for that day, then
   correct its date or say “Forget [the exact item]” **before 08:00**. Check
   `status.withheld` and `status.dated` for the active projection. Confirm that
   no reminder for the old or forgotten item is sent at 08:00. If corrected,
   check the replacement only on its own morning.
5. In a separate isolated trial, spend the reply allowance before a dated
   item's morning; verify `replies == limits.maxReplies` and no reminder send.
   Latch `stop` before the morning for another item and verify no send after
   stop. Record `status` before and after each case, Telegram message IDs and
   the actual operator-local time, without recording secrets or journal bytes.

The offline preview tests exercise a transport result that is unknown. Do not
induce an uncertain live send: its intent is permanently counted and must never
be replayed. A live result here is evidence only for this supervised preview
and its exact grant, not a production deployment.
