# What changed while you were away — live test as Justin

Use the existing approved private preview runner and its bound Telegram chat.
This script does not authorize a new runner, grant, cap raise, deployment, or
message from the agent. The builder has not run it against the live journal.

1. Record `journal-agent.mjs status --root ROOT` and `inspect --root ROOT` with
   sensitive text redacted. Confirm one model attempt, one reply, and one turn
   remain under the existing caps. In the bound private chat, Justin sends:
   `I am stepping away. Please acknowledge briefly.` Record its Telegram date,
   reply, and the prepared prompt's `desk-status` snapshot.
2. The desk updates the existing `ROOT/desk-status.md` with one clear changed
   line, such as `Lane away-digest: live check in progress.` and records its
   modified time. During the gap, allow one normal supervised runner restart
   through the existing procedure. Record the new launch/end lines in
   `runs.jsonl`. Do not edit the journal or run log. Wait until more than three
   real hours after Justin's previous Telegram message.
3. Justin sends from the same bound account and private chat:
   `What changed while I was away? Keep it short.` Record the PREVIEW reply,
   `inspect --root ROOT`, and `status --root ROOT`. Check the exact prepared
   context for this turn, including its `away-digest` source.

**Pass:** the second prepared packet contains one `away-digest`, marked as
runner-derived data with no authority. It reports the actual launch/end counts
since Justin's earlier message and the changed desk line, without claiming a
restart cause that the run log did not record. The first packet has no digest.
The reply may mention the relevant changes in one or two lines. Exactly one
reply intent and at most one Telegram acceptance exist for the second turn;
the digest caused no separate model call or Telegram send. Compare call and
reply counters with `status`, allowing only the ordinary answer's recorded use.

If an approved trial happens to record a hold, lost-answer notice, unknown
outcome, or cap raise during this gap, check that the digest names the actual
count and does not call an unknown outcome delivered. Do not manufacture one
or raise caps solely to satisfy this optional observation. If the desk file
becomes missing, stale, or unreadable, the digest must not invent its contents.
Record a failed or absent observation as FAIL rather than calling the offline
tests a live proof.
