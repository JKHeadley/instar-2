# Recall scorecard: Justin's supervised private-chat test

Run this only after the desk integrates the candidate into the approved live
preview build. Use the existing bound private chat, runner, encrypted journal,
grant, expiry, caps and provider policy. Justin sends every test message; do not
start a second runner or edit the journal. Record test markers privately.

1. Read the existing runner's `status --root /ABSOLUTE/APPROVED_ROOT`. Confirm
   stop is clear and the installed caps and expiry leave room for at least ten
   replies, their model and Jev calls, and a summary. If not, use the already
   authorized renewal or cap procedure before starting.
2. Justin sends eight harmless messages in order: `For this recall test, the
   scorecard marker is SC-A1.` through `... SC-A8.` Wait for each PREVIEW reply.
   If a reply is held, preserve its status and stop the test; no held turn counts
   as a completed answer.
3. Let the existing summary finish. Use read-only `status` and `inspect --root
   /ABSOLUTE/APPROVED_ROOT --text "What was the first scorecard marker?" --model
   APPROVED_MODEL`. Confirm `next.historyMode` is `summary-plus-recent`, the
   first marker's original dated operator turn appears in `next.recalled`. If
   history is still complete, send ordinary harmless turns until it is covered by
   a summary, then inspect again within the installed caps.
4. Justin asks `What was the first scorecard marker?` The answer should name
   `SC-A1`, not a later marker. Inspect the persisted last packet and confirm
   the same original source was offered to the model. A packet containing the
   fact with a wrong answer is an answer-quality failure, not a recall pass.
5. Justin asks `What is the latest scorecard marker?` The answer should name
   `SC-A8`. Inspect its packet and confirm the source is present. Save redacted
   status and inspect results plus the exact visible replies. Verify one
   Telegram reply per accepted question, an exact durable send intent and
   result (or UNKNOWN without retry), and no extra send.

This script is a future live-channel check; the offline scorecard is only a
packet-visibility result.
