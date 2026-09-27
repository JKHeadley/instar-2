# Held replies today in status — live test as Justin

Use only the desk's approved private preview trial, bound Telegram chat and
existing grant and caps. The builder has not run this against the live journal.
Do not edit the journal, stop file, or run log to create a hold.

1. As Justin, read `journal-agent.mjs status --root ROOT --time-zone
   America/Los_Angeles` and record `heldRepliesToday`, `holds`, `self`, the
   current local date, calls, replies and cursor. Check that an ordinary reply
   to a fresh message causes no hold and no increase in `heldRepliesToday`.
2. If the approved run naturally holds an accepted reply today, record that
   update and the exact plain hold reason from `status.heldRepliesToday.replies`.
   Ask from the same bound account and private chat, "How many of your replies
   were held today, and why?" Check the prepared packet's `self-state` source
   and the PREVIEW answer against a fresh `status`. Account for any additional
   hold caused by this question before comparing counts. A repeated hold on
   one update counts as one reply and lists each distinct reason.
3. If the desk later releases that hold through an already authorized cap
   change or normal retry, read `status` again. The reply must remain in
   `heldRepliesToday` for that local date with `stillHeld: false`, while
   `status.holds` no longer lists it. After local midnight, check that the
   previous day's hold is absent from the new day's count.

**Pass:** status and the prepared self-state agree on the local-day count,
updates and journal reasons. An ordinary reply adds zero. A released hold
remains visible for its day, and yesterday's holds do not count today. The
status command itself causes no model call, send intent or Telegram reply.
Record a missing natural hold or unobserved midnight/release as untested,
not as a live pass for that branch. Keep secrets and raw journal contents out
of the shared evidence.
