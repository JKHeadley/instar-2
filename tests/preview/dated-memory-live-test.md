# Dated memory: supervised private preview test for Justin

Use the existing bound private Telegram preview and its existing root. Keep the runner's
`--time-zone` at your IANA zone and check `status` for at least six model calls, six replies and
six turns of room. This script sends no unprompted message and does not enable a scheduler.
Record actual replies, `status` and `inspect` outputs as the trace; a held or unresolved result
is incomplete evidence, not a pass.

1. Send `My dentist is Thursday at 3.` Check `status.dated` for the exact clause, the operator
   zone and the upcoming Thursday's local day. The hour should be marked `AM or PM unspecified`.
   If today is Thursday, the day should remain unresolved rather than choosing this or next week.
2. Send `Remind me about the invoice on Oct 1.` Check that the item has the next Oct 1 in the
   operator zone. The reply may acknowledge memory, but must not claim to have scheduled a
   reminder. Confirm no message arrives from the preview without another operator message.
3. On the due day, send `What is on my mind today?` Check that its persisted `inspect` packet
   includes the dated item with state `due` and that the reply can mention it. If the due day
   has passed, use `overdue` as the expected state. A current live date outside this trial's
   expiry requires a fresh authorized trial; do not edit journal dates.
4. Send `Actually, the invoice deadline is October 3.` Check that the old Oct 1 clause appears
   in `status.withheld`, that the Oct 1 dated item is absent from the next packet, and that the
   new item carries October 3. Send `Forget the invoice deadline.` Check that neither dated
   item appears in the next packet. Original turns must remain in the journal's turn count.

Run `status --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE` for the pull view. For a read-only
future packet, run `inspect --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE --text "What is due?"
--model DESK_EXACT_MODEL`. This procedure does not modify the live runner or journal by itself.
