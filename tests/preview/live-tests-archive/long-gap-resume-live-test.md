# Long-gap resume: supervised private-chat test for Justin

Run only after this revision is installed in an approved private preview. Use
the bound Justin account and the existing runner procedure. This script does
not authorize a cap raise, a new trial, a journal edit or a live deployment.
The builder ran only injected-clock fixtures. A real 7-day observation needs an
approved trial whose expiry and remaining caps cover the full interval.

For each interval of 1, 3 and 7 days, use a distinct normal conversation
stretch so that the first message after the gap is unambiguous:

1. Record the operator zone and current local day from `status --root ROOT`.
   Confirm at least two turns, two replies and the required model attempts
   remain. In the bound private chat, Justin sends an ordinary dated item that
   will fall before or within the planned gap, one that will still be upcoming,
   and a commitment such as `Keep the draft open until I approve it.` Record
   their exact Telegram times, the reply and `status.dated`. Do not claim the
   preview can schedule, act on or send a reminder.
2. Allow the ordinary runner to summarize the source turns. Use read-only
   `inspect --root ROOT --text "Where are we now?"` to check that the packet
   can still cite the open commitment. If another commitment is closed by a
   later direct Justin message, record that closure and check it leaves the
   open list. Do not edit or backdate the journal to force a summary.
3. Send no messages for the chosen real interval. Record any normal run ends,
   restarts or desk changes through `status`; their absence is acceptable.
   After the interval, Justin sends `Where are we now? What has passed, what is
   upcoming, and what is still open?` Record the reply, `inspect` for that
   turn, and `status` with sensitive text redacted.
4. Compare the persisted packet's `clock.day`, `clock.weekday`, `clock.zone`
   and `resume.elapsedHours` with the real Telegram timestamps. Check each
   offered dated item's `due`, `overdue` or `upcoming` state against that local
   day. Check that open commitments are still open and verified closures stay
   closed. Earlier uses of “today” or “tomorrow” must remain tied to their
   original message day. The reply must state the current day accurately and
   make no stale “today” claim from the previous session.
5. Justin sends a short unrelated follow-up. Its next packet has no `resume`
   field. Check that the gap generated no separate model call, reminder send or
   second reply intent; only the two operator messages may receive ordinary
   replies.

**Pass:** all three real intervals meet the date, commitment, packet and
single-send checks. Record any missing dated or commitment item as an omission,
including `moreDated` or `packetDropped` when the byte bound applies. A held
turn, an unknown provider/send outcome, an expired trial or a shorter gap is
incomplete evidence for that interval. Keep the offline 1/3/7-day fixture
result separate from the live result.
