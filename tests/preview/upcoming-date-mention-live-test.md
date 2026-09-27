# Justin's private-chat upcoming date mention trial

Run only after this branch is reviewed, landed and the desk resumes the existing
approved journal runner on its existing root. Use Justin's bound private Telegram
chat and the runner's existing bot, grant, time zone, expiry and caps. Do not
edit the journal or start a second runner.

1. Read `status` for the current `dated`, `mentionedDates`, holds, remaining
   calls, replies and turns. Allow at least three replies and their model/check
   calls under the existing authorized limits. Record the runner's time zone.
2. As Justin, send: “Please remember: my appointment is tomorrow at 3 pm.”
   Wait for the reply. Check `status.dated` contains that exact source clause,
   a settled local day and `15:00`. If the model did not select and validate the
   date, record that as an incomplete trial; do not infer it was saved from the
   reply's wording. The saving reply must have no automatic `Upcoming:` clause
   for this new item.
3. As Justin, send an unrelated question such as “How is the project going?”
   The one checked PREVIEW reply should answer it and include one short
   `Upcoming:` clause naming the appointment and its local day and time. Read
   `status`: `mentionedDates` should have increased, with no new UNKNOWN send
   or reply-check hold for this turn. If the reply check substitutes its holding
   text, the mention has not occurred; record the hold and try an ordinary later
   turn only after the check path is available.
4. As Justin, send “Thanks.” The next reply must not repeat that appointment's
   `Upcoming:` clause. Pause and resume the runner through its usual supervised
   signal procedure, then send one more ordinary message. Confirm the clause
   remains absent and `mentionedDates` has not increased for the same item.

Record the exact replies, send outcomes, status snapshots and current clock.
Other previously saved dates may also be eligible; identify the new appointment
by its clause and source rather than assuming the counter starts at zero. The
offline suite covers the exact 48-hour and daylight-saving edges; this live
trial proves the private operator surface and replay at the current clock only.
