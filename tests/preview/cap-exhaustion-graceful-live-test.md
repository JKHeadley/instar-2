# Call and reply cap notices — supervised Justin live test

Use Justin's approved private preview bot, activation and login profile. Run
against a fresh isolated root for each case; pause the preview first and leave
its live root and journal untouched. Use the `journal-agent.mjs run` command in
the README with the same SecretRef host bindings. Capture terminal output and
`status` JSON. Do not put credentials or message bodies in captured logs.

1. **Calls:** start with `--max-calls 5 --max-replies 8 --max-turns 8`.
   As Justin, send ordinary questions one at a time. Check `status.calls` after
   each. Below 4 calls there must be no call warning; on reaching 4, expect
   exactly one `calls trial cap at least 80% used` line. At 5, or when a
   pending answer is held to reserve the last slot for review, expect exactly
   one final `calls cap reached` line. A review or summary can consume a call,
   so use the recorded counter and hold state, not the number of questions, to
   locate each boundary. `status.calls` must never exceed 5.
2. **Replies:** in a second root use `--max-calls 8 --max-replies 5
   --max-turns 8`. Repeat, watching `status.replies` below 4, at 4, and at 5.
   Expect one near line and one final line for replies, never more than five
   exact send intents. If a check holds a reply, record that actual path; it
   does not prove the reply-cap boundary.
3. Restart each capped root without raising it. Neither line may repeat. The
   journal's `status.capReports` must contain `calls:80:5` and `calls:5`, or
   `replies:80:5` and `replies:5`. Compare the status cursor with the last
   accepted update; a later update must remain available to polling after a
   raise, with no silent advance past it. A call- or reply-held question must
   remain visible in `status` with its original update ID.
4. If `status.unknownCalls` is zero and the grant is still active, stop the
   runner and issue `journal-agent.mjs raise-caps --root /ISOLATED/ROOT
   --max-calls 7 --authority 'Justin recorded raise'` for the call case, or
   `--max-replies 7` for the reply case. Leave the other bounds unchanged.
   Restart the same root and confirm the pending question receives one answer
   and one exact send intent. Restart again and confirm no second answer call
   or send. If an UNKNOWN call prevents the raise, verify the refusal and do
   not erase its reservation. An UNKNOWN send is also never retried.

The near and final notices are local terminal lines, not Telegram sends, and
therefore use no reply slots. Compare terminal output, `status` counters,
held update IDs, send intents and Telegram API receipts. API acceptance does
not prove Justin read the reply. Record observed results for the desk; this
procedure alone is not live evidence.
