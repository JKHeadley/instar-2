# Spend cap floor: supervised Justin test

Use only the desk-approved preview bot, private operator chat, activation,
profile, and isolated root. Pause the existing preview runner first and keep
its live root and journal untouched. Use the `journal-agent.mjs run` command in
this README with the same granted identity, expiry, and SecretRef host bindings.
Capture the runner's terminal output and `status` JSON. Never put a credential
in an argument or captured log. Do not run these cases against the live root.

For each case below, use a fresh isolated root and the bounds shown. Use a
new operator message as Justin, wait for the runner to exit, then run `status`.
Start the same root once more without changing its bounds; it must make no
new call or send and must not print the final cap line again. `status.capReports`
must retain the cap fence. Calls and replies also have a separately fenced 80%
line; exercise both stages with the
[cap-exhaustion-graceful live test](cap-exhaustion-graceful-live-test.md). The
fixed lines have no message text or credential.

1. **Calls:** set `--max-calls 2 --max-replies 3 --max-turns 4`. Send two
   ordinary questions. The first answer can use one subscription call and
   one Jev check. The second stays held at `call cap`, preserving the last
   subscription slot for a possible review. Expect exactly one `calls cap`
   terminal line; the first reply appears once and the second does not.
   `status.calls` must be 1 or 2, according to whether a review was needed,
   never above 2. If Jev does not pass the first answer, record the actual
   review and hold path instead of claiming a sent answer.
2. **Replies:** set `--max-calls 4 --max-replies 1 --max-turns 3`. Send one
   ordinary question and confirm one reply. Expect one `replies cap` line,
   `status.replies: 1`, and no second Telegram send after restart. If the
   reply check cannot pass, record its hold instead; this run has not proved
   the reply-cap branch.
3. **Turns:** set `--max-calls 4 --max-replies 3 --max-turns 1`. Send one
   ordinary question. Expect one `turns cap` line and `status.turns: 1`.
   A later update must not advance the cursor while this cap is active.
4. **Bytes:** set `--max-context-bytes 4096` with calls/replies/turns at
   4/3/3. Send an ordinary question. Expect an intact held turn, no model
   attempt for that turn, and one `bytes cap` line when the complete prepared
   prompt cannot fit. If the short prompt fits, send a longer synthetic
   message as Justin until the limit is reached, staying within the turn cap.

For one held case without an UNKNOWN call, the desk may issue `raise-caps`
with Justin's recorded authority and a larger finite limit. Resume the same
root and verify the held work drains once, counters carry forward, and a later
new threshold can receive its own single cap line. Never erase a journal
reservation to make a raise pass. If `status.unknownCalls` is nonzero, record
its breakdown and confirm the raise refuses; an UNKNOWN call must keep its
spent slot and must never be repeated.

Compare `status` counters, cap fences, held update IDs, exact send intents and
Telegram receipts before and after each restart. A Telegram API receipt proves
API acceptance only, not human reading. Record the actual transcript and
terminal/status outputs for the desk; this script itself is not live evidence.
