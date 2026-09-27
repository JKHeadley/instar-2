# Greeting continuity: Justin's supervised private-chat check

Use the existing approved journal runner, bot, private chat, activation, expiry,
caps and root after this branch is landed. Do not edit the encrypted journal or
run log. This script sends only Justin's own messages; it does not run the live
trial from the builder branch.

1. Read `status` for stop, expiry, call, turn and reply room. Confirm one open
   operator request under `commitments` by asking the runner to remember a short,
   non-sensitive topic such as “Please remember to revisit the garden plan.”
   Continue normal conversation until the rolling summary captures it and
   `status.commitments.open` is positive. If no open request is recorded, stop
   this probe as unproven; the greeting must not invent one.
2. Pause the existing runner with SIGTERM and wait for its recorded end. Resume
   it with the same approved launch command and root. Send “Hi, what should we
   work on?” as Justin. Expect one ordinary PREVIEW reply. It may include one
   short “Last time we were on …” line that names only the recorded open topic.
   Run `inspect --root ROOT` and check `last.greetingContinuity` is `true`.
   Record the exact reply and `status` call/reply counts; there must be one send
   intent and no extra model call for a greeting.
3. Send another ordinary message without pausing. Its saved packet's
   `last.greetingContinuity` must be `false` unless a separate greater-than-six-hour
   operator-message gap occurred. It must not repeat the restart line merely
   because the same runner is still up.
4. Have Justin explicitly close the topic, for example “The garden plan is
   settled; you can drop that request.” Continue until the summary records its
   closure. Only test the no-topic branch when `status.commitments.open` is zero;
   another open request would legitimately become the latest topic. Pause and
   resume as above, send “Hi,” and check the saved `last.greetingContinuity` is
   `false` and the reply invents no prior topic.
5. If a natural gap strictly greater than six hours occurs during the same
   approved trial, repeat step 2 without pausing. A gap of exactly six hours
   does not qualify. Record the actual timestamps; do not change the host clock.

Any missing reply, held turn, UNKNOWN send, exhausted cap, or unrecorded open or
closed decision is an incomplete live result. Record the status and inspect
output rather than claiming the operator saw a greeting. Telegram API acceptance
does not prove human delivery or reading.
