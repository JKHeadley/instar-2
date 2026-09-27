# Dated memory: supervised private preview test for Justin

Use the existing bound private Telegram preview and its existing root after the desk lands this
revision. Run as Justin in the bound private chat. Set `--time-zone` to your IANA zone or use
the default `America/Los_Angeles`; check `status` for at least six model calls, six replies and
six turns of room. This script sends no unprompted message and does not enable a scheduler.
Record actual replies, `status` and `inspect` outputs as the trace; a held or unresolved result
is incomplete evidence, not a pass.

1. Note the current local date and zone shown by `status.self`. Send `The invoice is due
   tomorrow.` The reply must show the following local calendar date as `YYYY-MM-DD`, name the
   zone, and make no claim that a reminder was scheduled. Check `status.dated` has that same
   absolute `day`, the exact original phrase and the zone. The original Telegram send time,
   rather than a later processing time, decides the day.
2. Send `My dentist appointment is next Friday.` The reply and `status.dated` must show the
   Friday in the **following Monday–Sunday calendar week**, as an absolute `YYYY-MM-DD` date.
   This includes the case where the coming Friday is only one day away.
3. Ask `What dates did I give you for the invoice and dentist?` The persisted `inspect` packet
   must include both absolute days, including when they are still upcoming, and the reply must
   state absolute dates. Confirm no message arrives without another operator message.
4. Send `Actually, the invoice is due on October 3, not tomorrow.` Check the prior invoice
   clause in `status.withheld`, then ask for the invoice date again. The old date must be absent
   and the corrected absolute date shown. Send `Forget the invoice date.` Check it is withheld
   from the next `inspect` packet. Original turns remain in the journal count.

The offline `journal-dated-memory.test.ts` cases cover local midnight and both DST boundaries;
do not change the live runner clock or journal to simulate them. A current live date outside
this trial's expiry requires a fresh authorized trial.

Run `status --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE` for the pull view. For a read-only
future packet, run `inspect --root /ABSOLUTE/ROOT --time-zone YOUR_ZONE --text "What is due?"
--model DESK_EXACT_MODEL`. This procedure does not modify the live runner or journal by itself.
